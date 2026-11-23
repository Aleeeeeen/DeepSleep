// The archive stays on the authenticated loopback host. Only an explicit chat
// submission sends message history to the selected model.
function mountMobileImport(ctx, enterConversation) {
    const sheet = document.createElement("dialog");
    sheet.id = "ds-history-import";
    sheet.setAttribute("aria-labelledby", "ds-import-heading");
    sheet.innerHTML = `<form method="dialog"><h2 id="ds-import-heading">导入网页版聊天记录</h2><button aria-label="关闭导入窗口" value="close">关闭</button></form>
      <p>选择 DeepSeek 网页版导出的原始 ZIP。已有会话会保留，重复导入会产生副本。</p>
      <label>导出文件<input type="file" accept=".zip,application/zip,application/x-zip-compressed"></label>
      <button type="button" class="submit" disabled>开始导入</button>
      <p role="status" aria-live="polite"></p><div class="sessions"></div>`;
    const style = document.createElement("style");
    style.textContent = `#ds-history-import{box-sizing:border-box;position:fixed;inset:0;z-index:2147483647;width:min(92vw,440px);max-height:84dvh;margin:auto;overflow:auto;border:1px solid #e6e9f1;border-radius:20px;padding:22px;color:#1e2535;background:white;font:16px system-ui,sans-serif;color-scheme:light}
      #ds-history-import::backdrop{background:#16213d70} #ds-history-import form{display:flex;align-items:center;justify-content:space-between}
      #ds-history-import h2{font-size:20px;margin:0} #ds-history-import p{line-height:1.5;color:#616b7e}
      #ds-history-import label,#ds-history-import input{display:block;margin:10px 0;width:100%} #ds-history-import input{padding:8px 0}
      #ds-history-import button{font:inherit;color:#3052bf;cursor:pointer;border:0;background:none;padding:8px}
      #ds-history-import .submit{width:100%;color:white;background:#4168f4;border-radius:14px;padding:12px}
      #ds-history-import button:disabled{opacity:.45} #ds-history-import .sessions button{display:block;width:100%;border-top:1px solid #e1e5ef;text-align:left;overflow-wrap:anywhere}`;
    document.head.append(style);
    document.body.append(sheet);
    const file = sheet.querySelector("input");
    const submit = sheet.querySelector(".submit");
    const status = sheet.querySelector("[role=status]");
    const rows = sheet.querySelector(".sessions");
    const close = sheet.querySelector("form button");
    let busy = false;
    const controller = new AbortController();
    const reasons = {
        "missing-manifest": "缺少 manifest.json，请选择 DeepSeek 网页版导出的原始 ZIP。",
        "missing-index": "没有找到会话索引。", "unsupported-version": "仅支持官网 v3 格式导出。",
        "unreadable-archive": "文件损坏或 ZIP 结构无效。", "no-conversations": "ZIP 内没有会话。",
        "too-large": "文件超过导入大小限制。", "busy": "另一项导入正在进行。",
        "workspace-not-found": "目标工作区不可用，请重试。"
    };
    function show() { if (!sheet.open) sheet.showModal(); }
    function handleBack() {
        if (!sheet.open) return false;
        if (!busy) sheet.close();
        return true;
    }
    file.onchange = () => {
        rows.replaceChildren(); status.textContent = "";
        const chosen = file.files[0];
        submit.disabled = !chosen || chosen.size === 0 || chosen.size > 128 * 1024 * 1024;
        if (chosen && submit.disabled) status.textContent = "请选择非空且不超过 128 MiB 的 ZIP。";
    };
    sheet.addEventListener("cancel", event => { if (busy) event.preventDefault(); });
    submit.onclick = async () => {
        const archive = file.files[0];
        if (!archive || busy) return;
        busy = file.disabled = submit.disabled = close.disabled = true;
        rows.replaceChildren(); status.textContent = "正在读取 ZIP…";
        try {
            const workspaces = ctx.get("workspaces"), sessions = ctx.get("sessions");
            if (!workspaces || !sessions) throw Error("聊天引擎正在启动，请稍后重试。");
            const current = deepSleepRetainedId(sessions, "deepSleepChat") || deepSleepRetainedId(sessions, "mainView");
            const items = workspaces.list.getSnapshot().items;
            const workspace = items.find(item => item.sessionIds?.includes(current)) || items[0] || await workspaces.initializeDefault(controller.signal);
            if (!workspace) throw Error("请先在会话列表中创建一个工作区，再导入。");
            const url = new URL("/api/deepseek-chat-import/archive", location.href);
            url.searchParams.set("workspaceId", workspace.workspaceId);
            const response = await fetch(url, { method: "POST", body: archive, signal: controller.signal,
                headers: { "content-type": "application/octet-stream" } });
            if (!response.ok || !response.body) throw Error("本机导入服务返回 " + response.status + "，请重新打开 DeepSleep 后再试。");
            const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
            let buffer = "", outcome;
            function consume(line) {
                if (!line.trim()) return;
                const frame = JSON.parse(line);
                if (frame.type === "progress") status.textContent = "正在导入 " + frame.done + " / " + frame.total;
                if (frame.type === "outcome") outcome = frame.outcome;
            }
            for (;;) {
                const part = await reader.read();
                if (part.done) break;
                const lines = (buffer + part.value).split("\n");
                buffer = lines.pop();
                lines.forEach(consume);
            }
            consume(buffer);
            if (!outcome) throw Error("导入中断。请先检查会话列表，再决定是否重试。");
            if (!outcome.ok) throw Error(reasons[outcome.error.reason] || outcome.error.message);
            const result = outcome.value;
            await sessions.refresh().catch(() => {});
            status.textContent = "已导入 " + result.sessionIds.length + " 条会话。" +
                (result.omittedByLimit ? "超出数量限制 " + result.omittedByLimit + " 条。" : "") +
                (result.skipped.length ? "跳过 " + result.skipped.length + " 条：" + result.skipped.slice(0, 3).map(s => s.title || s.conversationId).join("、") : "");
            const byId = sessions.list.getSnapshot().byId;
            for (const id of result.sessionIds) {
                const button = document.createElement("button");
                button.textContent = "打开 · " + (byId[id]?.title || id);
                button.onclick = async () => {
                    try {
                        await enterConversation(id);
                        sheet.close();
                    } catch {
                        status.textContent = "会话已保存，暂时无法打开。请稍后重试。";
                    }
                };
                rows.append(button);
            }
            file.value = "";
        } catch (err) {
            status.textContent = err.message || "导入失败，请检查 ZIP。";
            const sessions = ctx.get("sessions");
            if (sessions) await sessions.refresh().catch(() => {});
        } finally {
            busy = file.disabled = close.disabled = false;
            submit.disabled = !file.files.length;
        }
    };
    return { show, handleBack, dispose() { controller.abort(); sheet.remove(); style.remove(); } };
}
