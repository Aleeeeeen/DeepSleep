// Runs only after the native import button is pressed on an official conversation page.
(function readConversation() {
    const startUrl = location.href;
    const allowed = () => location.origin === "https://chat.deepseek.com" &&
        /^\/(?:a\/chat\/s|share)\/[\w-]+\/?$/.test(location.pathname) && location.href === startUrl;
    if (!allowed()) return "wrong-page";
    const job = {};
    window.deepSleepTranscriptJob = job;
    const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
    const text = node => (node?.innerText || "").trim();
    function readRow(row) {
        const matches = selector => [...(row.matches(selector) ? [row] : []), ...row.querySelectorAll(selector)];
        const answers = matches(".ds-assistant-message-main-content, [data-message-author-role=assistant]");
        const reply = answers[0] || matches(".ds-markdown").find(el => !el.closest(".ds-think-content"));
        const question = matches("[data-message-author-role=user], .ds-user-message, .ds-collapsible-text")
            .find(el => !el.closest(".ds-markdown, .ds-think-content"));
        const result = [];
        if (question && text(question)) result.push({role: "USER", text: text(question)});
        if (reply && text(reply)) result.push({role: "ASSISTANT", text: text(reply)});
        if (!result.length && text(row)) throw Error("有消息无法识别，请用 ZIP 导入以保留完整对话。");
        return result;
    }
    async function collect() {
        const first = document.querySelector("[data-virtual-list-item-key]");
        if (!first) {
            const rows = [...document.querySelectorAll(".ds-message")];
            const messages = (rows.length ? rows : [...document.querySelectorAll("[data-message-author-role]")]).flatMap(readRow);
            if (!messages.length) throw Error("还没有读到消息。请确认对话已打开并加载完成。");
            return messages;
        }
        const container = first.closest(".ds-virtual-list") || first.parentElement;
        let scroller = first.parentElement;
        while (scroller && !(scroller.scrollHeight > scroller.clientHeight + 2 &&
            /(scroll|auto|overlay)/.test(getComputedStyle(scroller).overflowY))) scroller = scroller.parentElement;
        scroller ||= document.scrollingElement;
        const original = scroller.scrollTop;
        const rows = new Map();
        let size = 0;
        let previousKeys = null;
        try {
            scroller.scrollTop = 0;
            let stableBottom = 0;
            for (let step = 0; step < 900; step++) {
                await delay(step === 0 ? 350 : 90);
                if (!allowed() || window.deepSleepTranscriptJob !== job || !container.isConnected) throw Error("对话已切换，请重新选择。");
                const items = [...container.querySelectorAll("[data-virtual-list-item-key]")];
                const keys = items.map(el => el.getAttribute("data-virtual-list-item-key"));
                if (!keys.length || (previousKeys && !keys.some(key => previousKeys.includes(key)))) {
                    throw Error("长对话有一段尚未加载。请重试或使用 ZIP。");
                }
                for (const [index, row] of items.entries()) {
                    // The share page places its AI-generated-content notice in row -999.
                    if (keys[index] === "-999" && !row.querySelector(".ds-message")) continue;
                    const value = readRow(row);
                    if (!value.length) continue;
                    const key = keys[index];
                    size -= (rows.get(key) || []).reduce((sum, m) => sum + m.text.length, 0);
                    rows.set(key, value);
                    size += value.reduce((sum, m) => sum + m.text.length, 0);
                }
                if (size > 1024 * 1024) throw Error("对话较大，请使用 ZIP 导入。");
                previousKeys = keys;
                const bottom = scroller.scrollHeight - scroller.clientHeight;
                if (scroller.scrollTop >= bottom - 2) {
                    if (++stableBottom >= 4) return [...rows.values()].flat();
                } else {
                    stableBottom = 0;
                    scroller.scrollTop += Math.max(1, Math.floor(scroller.clientHeight * 0.45));
                }
            }
            throw Error("对话读取超时，请使用 ZIP 导入。");
        } finally {
            if (allowed() && window.deepSleepTranscriptJob === job) scroller.scrollTop = original;
        }
    }
    collect().then(messages => {
        if (!allowed() || !messages.length || messages[0].role !== "USER") throw Error("无法确认对话开头，请重新打开完整对话。");
        if (messages.reduce((sum, m) => sum + m.text.length, 0) > 1024 * 1024) throw Error("对话较大，请使用 ZIP 导入。");
        const title = document.title.replace(/\s*[-|·]\s*DeepSeek.*$/i, "").trim();
        job.result = {title: (title && !/^deepseek/i.test(title) ? title : messages[0].text).slice(0, 80), messages};
    }).catch(err => { job.result = {error: err.message}; });
    return "reading";
})()
