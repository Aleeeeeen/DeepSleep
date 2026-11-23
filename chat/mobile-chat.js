function mountDeepSleepChat(ctx, actions) {
    const paths = {
        menu: '<path d="M3.5 6.5h17m-17 5.5h12m-12 5.5h17"/>',
        compose: '<path d="M13 4H6.8A3.3 3.3 0 0 0 3.5 7.3v9.9a3.3 3.3 0 0 0 3.3 3.3h9.9a3.3 3.3 0 0 0 3.3-3.3V11"/><path d="m10 14 .7-3.6 7.4-7.3a1.5 1.5 0 0 1 2.2 2.1L13 12.7z"/>',
        up: '<path d="M12 18V6m-5.5 5.5L12 6l5.5 5.5"/>',
        stop: '<rect x="6.8" y="6.8" width="10.4" height="10.4" rx="2" fill="currentColor" stroke="none"/>',
        close: '<path d="m6 6 12 12M18 6 6 18"/>',
        chat: '<path d="M5.8 4.5h12.4a2.7 2.7 0 0 1 2.8 2.7v8.1a2.7 2.7 0 0 1-2.8 2.7H9l-5.9 3v-14a2.7 2.7 0 0 1 2.7-2.5Z"/>',
        import: '<path d="M12 3.4v11.3m-4.2-4.2 4.2 4.2 4.2-4.2M4.3 15.3v2.5a2.2 2.2 0 0 0 2.2 2.2h11a2.2 2.2 0 0 0 2.2-2.2v-2.5"/>',
        account: '<circle cx="12" cy="8" r="3.5"/><path d="M4.8 20a7.2 7.2 0 0 1 14.4 0"/>',
        dsh: '<rect x="2.7" y="4.8" width="18.6" height="14.4" rx="3"/><path d="m6.6 9.2 2.7 2.7-2.7 2.7m5.5.1h3.7"/>',
        arrow: '<path d="m9.5 6.5 5.5 5.5-5.5 5.5"/>'
    };
    function icon(name) {
        return '<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + paths[name] + '</svg>';
    }
    const moon = '<svg class="ds-moon" aria-hidden="true" focusable="false" viewBox="0 0 64 64" fill="currentColor"><path d="M31.8 9.5c-7.4 4.6-10.1 13.9-7.3 21.8 3.2 9.1 13 14.9 22.8 12.5 3.9-.9 7.1-2.7 9.8-5.5C54.9 50.7 44.1 59 32.1 58.1 18.9 57.3 8.7 46.7 8.1 33.7 7.5 21 17.6 10.2 30.4 8.8c1.6-.2 2.3.1 1.4.7Z"/><path d="M48.7 3.1c1.4 7.9 3.1 10.2 10.5 12.1-7.4 1.7-9.1 4.2-10.5 12-1.4-7.8-3.2-10.3-10.5-12 7.3-1.9 9.1-4.2 10.5-12.1Z"/></svg>';
    const chat = document.createElement("div");
    chat.id = "deepsleep-chat";
    chat.lang = "zh-CN";
    chat.innerHTML = `<header class="ds-bar">
        <button type="button" class="ds-icon" data-cmd="history" aria-label="历史会话" aria-haspopup="dialog" aria-controls="deepsleep-drawer">${icon("menu")}</button>
        <span class="ds-title">DeepSleep</span>
        <button type="button" class="ds-icon" data-cmd="new" aria-label="新建对话">${icon("compose")}</button>
      </header>
      <main class="ds-scroll">
        <div class="ds-welcome"><div class="ds-brand">${moon}<strong>DeepSleep</strong></div><h1>今天有什么可以帮你？</h1></div>
        <div class="ds-transcript" role="region" aria-label="聊天记录"></div>
      </main>
      <div class="ds-bottom"><div class="ds-error" hidden><span role="alert"></span>
        <button type="button" data-cmd="account" hidden>登录 DeepSeek 账号</button>
        <button type="button" data-cmd="dsh" hidden>切换至 DSH</button></div>
        <form class="ds-composer"><textarea rows="1" aria-label="给 DeepSleep 发消息" placeholder="给 DeepSleep 发消息" enterkeyhint="send"></textarea>
        <button class="ds-submit" type="submit" aria-label="发送" disabled>${icon("up")}</button></form>
        <span class="ds-sr" role="status"></span>
      </div>
      <dialog id="deepsleep-drawer" aria-labelledby="deepsleep-history-heading">
        <div class="ds-drawer-panel"><header class="ds-drawer-head"><span class="ds-drawer-brand">${moon}DeepSleep</span>
          <button type="button" class="ds-icon" data-cmd="close" aria-label="关闭历史会话">${icon("close")}</button></header>
          <h2 id="deepsleep-history-heading">历史会话</h2>
          <div class="ds-history"></div>
          <nav class="ds-links" aria-label="聊天设置">
            <button type="button" data-cmd="import">${icon("import")}<span>导入历史</span>${icon("arrow")}</button>
            <button type="button" data-cmd="account">${icon("account")}<span>我的账号</span>${icon("arrow")}</button>
            <button type="button" data-cmd="dsh">${icon("dsh")}<span>切换至 DSH</span>${icon("arrow")}</button>
          </nav>
        </div>
      </dialog>`;
    const style = document.createElement("style");
    style.textContent = `
      html.ds-mobile-visible body>#root{display:none!important}
      #deepsleep-chat{--blue:#4168f4;--ink:#1e2535;--muted:#616b7e;--line:#e6e9f1;
        position:fixed;inset:0;z-index:2147482000;display:flex;flex-direction:column;
        color-scheme:light;color:var(--ink);background:#fff;text-align:start;
        font:16px/1.55 system-ui,-apple-system,"PingFang SC","Microsoft YaHei",Roboto,sans-serif}
      #deepsleep-chat [hidden],#deepsleep-chat[hidden]{display:none!important}
      #deepsleep-chat *,#deepsleep-chat *::before,#deepsleep-chat *::after{box-sizing:border-box}
      #deepsleep-chat button,#deepsleep-chat textarea{font:inherit;color:inherit;letter-spacing:normal}
      #deepsleep-chat button{border:none;background:none;margin:0;cursor:pointer;text-transform:none;touch-action:manipulation;-webkit-tap-highlight-color:transparent}
      #deepsleep-chat button:focus-visible,#deepsleep-chat summary:focus-visible{outline:2px solid var(--blue);outline-offset:-2px}
      #deepsleep-chat svg{width:22px;height:22px;display:block;flex:none}
      #deepsleep-chat .ds-bar{flex:none;display:flex;align-items:center;justify-content:space-between;gap:12px;
        width:min(100%,850px);margin:0 auto;padding:calc(7px + env(safe-area-inset-top,0px)) 12px 7px;background:white}
      #deepsleep-chat .ds-icon{width:44px;height:44px;border-radius:14px;display:grid;place-content:center;padding:0}
      #deepsleep-chat .ds-icon:active{background:#f0f2f8}
      #deepsleep-chat .ds-title{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:center;font-size:16px;font-weight:630;letter-spacing:-.35px}
      #deepsleep-chat .ds-scroll{position:relative;display:flex;flex:1 1 auto;min-height:0;overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin}
      #deepsleep-chat .ds-welcome{width:100%;margin:auto;text-align:center;padding:26px 12px;transform:translateY(-5vh)}
      #deepsleep-chat .ds-brand,#deepsleep-chat .ds-drawer-brand{display:flex;align-items:center;justify-content:center;color:var(--blue)}
      #deepsleep-chat .ds-brand{gap:6px}
      #deepsleep-chat .ds-brand .ds-moon{width:53px;height:53px}
      #deepsleep-chat .ds-brand strong{font-size:36px;font-weight:690;letter-spacing:-1.9px;line-height:1.2}
      #deepsleep-chat h1{font:600 clamp(20px,5.1vw,25px)/1.5 system-ui,sans-serif;margin:15px 0 0;color:var(--ink)}
      #deepsleep-chat .ds-transcript{width:min(100%,760px);padding:12px clamp(16px,4vw,28px) 20px;margin:0 auto;align-self:flex-start}
      #deepsleep-chat .ds-message{display:flex;flex-direction:column;align-items:flex-start;gap:6px;margin:0 0 24px}
      #deepsleep-chat .ds-message:last-child{margin-bottom:0}
      #deepsleep-chat .ds-message[data-role=user]{align-items:flex-end}
      #deepsleep-chat .ds-text,#deepsleep-chat .ds-reason-text,#deepsleep-chat .ds-error{white-space:pre-wrap;overflow-wrap:anywhere;user-select:text}
      #deepsleep-chat .ds-text{font-size:16px;line-height:1.7;max-width:100%;margin:0}
      #deepsleep-chat .ds-transcript[aria-busy=true]::after{content:"正在生成…";display:block;color:var(--muted);font-size:13px;margin-top:6px}
      #deepsleep-chat [data-role=user] .ds-text{background:#edf2ff;border-radius:18px 18px 6px 18px;padding:10px 15px;max-width:88%}
      #deepsleep-chat .ds-speaker{display:flex;align-items:center;gap:6px;color:#43506b;font-size:13px;font-weight:600}
      #deepsleep-chat .ds-speaker .ds-moon{width:21px;height:21px;color:var(--blue)}
      #deepsleep-chat .ds-reason{max-width:100%;font-size:14px;color:var(--muted)}
      #deepsleep-chat .ds-reason summary{cursor:pointer;padding:5px 0}
      #deepsleep-chat .ds-reason-text{margin:3px 0 6px;border-inline-start:2px solid #dfe5f4;padding-inline-start:10px}
      #deepsleep-chat .ds-bottom{flex:none;align-self:center;width:min(100%,760px);padding:6px clamp(12px,3vw,22px) max(12px,env(safe-area-inset-bottom,0px));background:white}
      #deepsleep-chat .ds-composer{display:flex;align-items:flex-end;gap:6px;padding:7px 8px 7px 16px;min-height:54px;
        border:1px solid #e3e6ee;border-radius:24px;background:#f8f9fc;box-shadow:0 2px 8px #1e253505;margin:0}
      #deepsleep-chat .ds-composer:focus-within{border-color:#a8b9f2}
      #deepsleep-chat textarea{flex:1 1 auto;min-width:0;margin:0;display:block;padding:7px 0;resize:none;
        font-size:16px;line-height:24px;min-height:38px;max-height:min(140px,24vh);
        background:transparent;border:0;outline:none;box-shadow:none}
      #deepsleep-chat textarea::placeholder{color:#747e90;opacity:1}
      #deepsleep-chat .ds-submit{display:grid;place-content:center;flex:none;width:38px;height:38px;padding:0;border-radius:50%;background:var(--blue);color:white}
      #deepsleep-chat .ds-submit:disabled{background:#dce2f4;color:#697da9;cursor:default}
      #deepsleep-chat .ds-error{max-height:17vh;overflow:auto;color:#9d3939;background:#fff3f2;padding:8px 12px;border-radius:12px;font-size:14px;margin-bottom:7px;white-space:normal}
      #deepsleep-chat .ds-error span{white-space:pre-wrap}
      #deepsleep-chat .ds-error button{color:#315ad8;font-weight:600;text-decoration:underline;text-underline-offset:3px;padding:4px 6px}
      #deepsleep-chat .ds-error[data-readonly=true]{color:var(--muted);background:#f1f4fb}
      #deepsleep-chat .ds-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
      #deepsleep-drawer{position:fixed;inset:0 auto 0 0;margin:0;padding:0;border:0;width:min(84vw,330px);
        height:100%;max-height:100%;max-width:100%;background:#fff;color:var(--ink);box-shadow:8px 0 35px #222e4d12;overflow:hidden}
      #deepsleep-drawer:not([open]){display:none}
      #deepsleep-drawer::backdrop{background:rgba(28,37,57,.3)}
      #deepsleep-chat .ds-drawer-panel{display:flex;flex-direction:column;height:100%;padding:calc(9px + env(safe-area-inset-top,0px)) 12px max(12px,env(safe-area-inset-bottom,0px))}
      #deepsleep-chat .ds-drawer-head{display:flex;align-items:center;justify-content:space-between;gap:8px}
      #deepsleep-chat .ds-drawer-brand{gap:5px;padding-inline-start:4px;font-size:22px;font-weight:680;letter-spacing:-1px}
      #deepsleep-chat .ds-drawer-brand .ds-moon{width:31px;height:31px}
      #deepsleep-chat .ds-drawer-head .ds-icon{color:var(--muted)}
      #deepsleep-chat h2{font:600 13px/1.5 system-ui,sans-serif;color:var(--muted);margin:26px 8px 9px}
      #deepsleep-chat .ds-history{flex:1;min-height:0;overflow:auto}
      #deepsleep-chat .ds-history p{color:var(--muted);font-size:14px;margin:12px 8px}
      #deepsleep-chat .ds-history button,#deepsleep-chat .ds-links button{display:flex;align-items:center;gap:11px;text-align:start;width:100%;min-height:46px;padding:8px 10px;border-radius:12px;font-size:15px}
      #deepsleep-chat .ds-history button svg,#deepsleep-chat .ds-links button svg{color:var(--muted);width:19px;height:19px}
      #deepsleep-chat .ds-history button span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      #deepsleep-chat .ds-history button[aria-current=true]{color:#315ad8;background:#eef2ff}
      #deepsleep-chat .ds-history button[aria-current=true] svg{color:inherit}
      #deepsleep-chat .ds-links{padding-top:7px;border-top:1px solid var(--line);margin-top:6px}
      #deepsleep-chat .ds-links button svg:last-child{width:14px;height:14px;margin-inline-start:auto;color:#8c95a5}
      #deepsleep-chat .ds-history button:active,#deepsleep-chat .ds-links button:active{background:#f0f2f8}
      @media(max-height:430px){#deepsleep-chat .ds-welcome{transform:none;padding:6px}#deepsleep-chat .ds-brand .ds-moon{width:36px;height:36px}
        #deepsleep-chat .ds-brand strong{font-size:26px}#deepsleep-chat h1{margin-top:5px;font-size:18px}#deepsleep-chat .ds-bar{padding-block:1px}
        #deepsleep-chat h2{margin-top:7px}#deepsleep-chat .ds-links button{min-height:36px}}
    `;
    document.head.append(style);
    document.body.append(chat);
    const find = selector => chat.querySelector(selector);
    const drawer = find("dialog"), history = find(".ds-history"), heading = find(".ds-title");
    const scroll = find(".ds-scroll"), transcript = find(".ds-transcript"), welcome = find(".ds-welcome");
    const form = find("form"), input = find("textarea"), submit = find(".ds-submit");
    const alert = find(".ds-error"), announcement = find(".ds-sr");
    const root = document.getElementById("root");
    const originallyInert = root?.inert;
    let previousId, lastAttempt, disposed = false, queued = false, accepting = false, localError = "", stopping = false;
    let viewRevision = 0;
    function notify() {
        if (queued || disposed) return;
        queued = true;
        queueMicrotask(() => { queued = false; if (!disposed && !chat.hidden) render(); });
    }
    const sessions = createDeepSleepSessions(ctx, notify);

    function updateMessage(node, message) {
        if (node.dataset.role !== message.role) {
            node.className = "ds-message";
            node.dataset.role = message.role;
            if (message.role === "assistant") {
                node.setAttribute("aria-label", "DeepSleep");
                node.innerHTML = '<div class="ds-speaker">' + moon + 'DeepSleep</div><details class="ds-reason"><summary>思考过程</summary><div class="ds-reason-text"></div></details><div class="ds-text"></div>';
            } else {
                node.setAttribute("aria-label", message.role === "user" ? "你" : "系统消息");
                node.innerHTML = '<div class="ds-text"></div>';
            }
        }
        const body = node.lastElementChild;
        if (body.textContent !== message.text) body.textContent = message.text || "";
        const reasoning = node.querySelector("details");
        if (reasoning) {
            reasoning.hidden = !message.reasoning;
            const text = reasoning.lastElementChild;
            if (text.textContent !== (message.reasoning || "")) text.textContent = message.reasoning || "";
        }
    }
    function renderHistory(id) {
        const rows = sessions.list();
        const buttons = new Map(Array.from(history.querySelectorAll("button"), b => [b.dataset.id, b]));
        if (!rows.length) {
            if (!history.querySelector("p")) {
                const empty = document.createElement("p");
                empty.textContent = "暂无历史会话";
                history.replaceChildren(empty);
            }
            return;
        }
        history.querySelector("p")?.remove();
        rows.forEach((row, index) => {
            let b = buttons.get(row.id);
            if (!b) {
                b = document.createElement("button");
                b.type = "button";
                b.dataset.id = row.id;
                b.innerHTML = icon("chat") + "<span></span>";
            }
            const title = row.title || "新对话";
            if (b.lastElementChild.textContent !== title) b.lastElementChild.textContent = title;
            b.setAttribute("aria-current", String(row.id === id));
            if (history.children[index] !== b) history.insertBefore(b, history.children[index] || null);
            buttons.delete(row.id);
        });
        for (const b of buttons.values()) b.remove();
    }
    function updateComposer(busy) {
        const mode = busy ? "stop" : "up";
        if (submit.dataset.mode !== mode) {
            submit.dataset.mode = mode;
            submit.innerHTML = icon(mode);
            submit.setAttribute("aria-label", busy ? "停止生成" : "发送");
        }
        submit.disabled = input.disabled || (busy ? stopping : accepting || !input.value.trim());
    }
    function fitInput() {
        input.style.height = "auto";
        input.style.height = input.scrollHeight + "px";
    }
    function render() {
        const state = sessions.snapshot();
        const changed = previousId !== state.id;
        const follow = changed || scroll.scrollHeight - scroll.clientHeight - scroll.scrollTop < 75;
        if (changed) { transcript.replaceChildren(); previousId = state.id; }
        heading.textContent = state.id ? (state.title || "DeepSleep") : "DeepSleep";
        welcome.hidden = state.messages.length > 0 || state.busy;
        transcript.hidden = !welcome.hidden;
        state.messages.forEach((message, index) => {
            let node = transcript.children[index];
            if (!node) { node = document.createElement("article"); transcript.append(node); }
            updateMessage(node, message);
        });
        while (transcript.childElementCount > state.messages.length) transcript.lastElementChild.remove();
        const error = localError || state.error?.message || state.error || "";
        const accountError = !state.readOnly && error && !actions.isSignedIn() &&
            /账号|授权|凭据|密钥|模型|登录|provider|credential|authentication|model|api key|401/i.test(error);
        const note = error || (state.readOnly ? "此会话使用 DSH 的高级功能，请在 DSH 中继续。" : "");
        if (alert.firstElementChild.textContent !== note) alert.firstElementChild.textContent = note;
        alert.hidden = !note;
        alert.dataset.readonly = String(Boolean(state.readOnly));
        alert.querySelector('[data-cmd="account"]').hidden = !accountError;
        alert.querySelector('[data-cmd="dsh"]').hidden = !state.readOnly;
        input.disabled = Boolean(state.readOnly);
        if (lastAttempt && !lastAttempt.id && state.id) lastAttempt.id = state.id;
        if (accountError && lastAttempt && lastAttempt.id === state.id && !input.value) {
            input.value = lastAttempt.text;
            lastAttempt = null;
            fitInput();
        }
        const status = state.busy ? "正在生成回复…" : "";
        if (announcement.textContent !== status) announcement.textContent = status;
        transcript.setAttribute("aria-busy", String(Boolean(state.busy)));
        if (drawer.open) renderHistory(state.id);
        updateComposer(state.busy);
        if (follow) scroll.scrollTop = scroll.scrollHeight;
    }
    async function run(work) {
        localError = "";
        let revision = viewRevision;
        try {
            const result = work();
            // A navigation action selects its destination before loading its messages.
            revision = viewRevision;
            await result;
        } catch (err) {
            if (revision === viewRevision && !disposed) localError = err?.message || "操作失败，请重试。";
        }
        notify();
    }
    function closeDrawer() { if (drawer.open) drawer.close(); }
    function resetComposer() {
        viewRevision++;
        accepting = stopping = false;
        lastAttempt = null;
        input.value = "";
        fitInput();
    }
    async function openSession(id) {
        closeDrawer();
        show();
        localError = "";
        if (sessions.snapshot().id !== id) resetComposer();
        await sessions.open(id);
        if (!disposed && !chat.hidden) render();
    }
    chat.addEventListener("click", event => {
        const button = event.target.closest("button");
        if (!button) return;
        if (button.dataset.id) { void run(() => openSession(button.dataset.id)); return; }
        const cmd = button.dataset.cmd;
        if (cmd === "history") {
            renderHistory(sessions.snapshot().id);
            drawer.showModal();
            find('[data-cmd="close"]').focus();
        } else if (cmd === "close") closeDrawer();
        else if (cmd === "new") void run(() => {
            resetComposer();
            return sessions.newChat();
        });
        else if (cmd === "import" || cmd === "account" || cmd === "dsh") {
            closeDrawer();
            void run(() => cmd === "dsh" ? actions.dsh(sessions.snapshot().id) :
                cmd === "import" ? actions.importHistory() : actions.account());
        }
    });
    drawer.addEventListener("click", event => {
        if (event.target !== drawer) return;
        const bounds = drawer.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right ||
            event.clientY < bounds.top || event.clientY > bounds.bottom) closeDrawer();
    });
    function back(event) {
        if (!event.defaultPrevented && !chat.hidden && drawer.open) {
            event.preventDefault();
            closeDrawer();
        }
    }
    window.addEventListener("deepsleep-back", back);
    input.addEventListener("input", () => { lastAttempt = null; fitInput(); updateComposer(sessions.snapshot().busy); });
    input.addEventListener("keydown", event => {
        if (event.key === "Enter" && !event.shiftKey && !event.isComposing && event.keyCode !== 229) {
            event.preventDefault();
            if (!sessions.snapshot().busy) form.requestSubmit();
        }
    });
    form.addEventListener("submit", async event => {
        event.preventDefault();
        if (input.disabled) return;
        const revision = viewRevision;
        if (sessions.snapshot().busy) {
            if (stopping) return;
            stopping = true;
            updateComposer(true);
            await run(() => sessions.stop());
            if (revision === viewRevision) stopping = false;
            notify();
            return;
        }
        const text = input.value.trim();
        if (!text || accepting) return;
        accepting = true;
        const initial = sessions.snapshot();
        const attempt = { id: initial.id, text };
        lastAttempt = attempt;
        input.value = "";
        fitInput();
        updateComposer(false);
        await run(async () => {
            try { await sessions.send(text); }
            catch (err) {
                if (revision !== viewRevision || disposed) return;
                const after = sessions.snapshot();
                const submitted = after.messages.slice(initial.messages.length).some(m => m.role === "user" && m.text === text);
                if (lastAttempt === attempt && !input.value && !submitted) {
                    input.value = text;
                    fitInput();
                }
                throw err;
            }
        });
        if (revision === viewRevision) accepting = false;
        notify();
    });
    function show() {
        document.documentElement.classList.add("ds-mobile-visible");
        if (root) root.inert = true;
        chat.hidden = false;
        render();
    }
    function hide() {
        closeDrawer();
        chat.hidden = true;
        document.documentElement.classList.remove("ds-mobile-visible");
        if (root) root.inert = originallyInert;
    }
    show();
    return {
        openSession, show, hide,
        dispose() {
            disposed = true;
            hide();
            window.removeEventListener("deepsleep-back", back);
            sessions.dispose();
            chat.remove();
            style.remove();
        }
    };
}
