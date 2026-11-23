// The pinned Harness owns account persistence, browser authorization and model setup.
function deepSleepRetainedId(sessions, source) {
    const rows = sessions?.list.getSnapshot().byId || {};
    return Object.keys(rows).find(id => rows[id].retainedBy?.[source] > 0);
}

function mountMobileAccount(operations, ctx) {
    const account = operations.hooks.account;
    const html = document.documentElement;
    const panel = document.createElement("dialog");
    panel.id = "ds-chat-account";
    panel.setAttribute("aria-labelledby", "ds-account-heading");
    panel.innerHTML = `<header><h2 id="ds-account-heading"></h2><form method="dialog"><button aria-label="关闭账号窗口">关闭</button></form></header>
      <p role="status" aria-live="polite"></p><output></output>
      <div class="actions"><button type="button" data-action="login">登录 DeepSeek 账号</button>
      <a data-action="pay" target="_blank" rel="noopener noreferrer">去官方充值</a>
      <button type="button" data-action="refresh">刷新余额</button>
      <button type="button" data-action="cancel">取消授权</button>
      <button type="button" data-action="logout">退出账号</button></div>`;
    const bar = document.createElement("header");
    bar.id = "ds-dsh-bar";
    bar.hidden = true;
    bar.innerHTML = '<button type="button"><span aria-hidden="true">‹</span> 返回 DeepSleep</button><strong>DSH</strong>';
    const style = document.createElement("style");
    style.textContent = `
      html[data-deepsleep-mode="chat"] body>:not(#deepsleep-chat,#ds-chat-account,#ds-history-import,#ds-dsh-bar){display:none!important}
      html[data-deepsleep-mode="dsh"] body>#root{position:fixed!important;inset:44px 0 0!important;width:auto!important;height:auto!important;min-height:0!important;transform:translateZ(0);isolation:isolate}
      #ds-dsh-bar{box-sizing:border-box;position:fixed;inset:0 0 auto;z-index:2147483646;height:44px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #e6e9f1;padding:0 16px 0 8px;background:#fff;color:#616b7e;font:14px system-ui,sans-serif}
      #ds-dsh-bar strong{font-size:13px;letter-spacing:.06em} #ds-dsh-bar button{height:100%;border:0;background:transparent;color:#355acd;font:600 14px system-ui,sans-serif;cursor:pointer;padding:0 8px}
      #ds-dsh-bar button span{display:inline-block;vertical-align:-1px;font:23px/0.9 system-ui}
      #ds-dsh-bar[hidden],#ds-chat-account [hidden]{display:none!important}
      #ds-chat-account{box-sizing:border-box;position:fixed;inset:0;z-index:2147483647;width:min(92vw,420px);max-height:85dvh;margin:auto;overflow:auto;border:1px solid #e6e9f1;border-radius:20px;padding:22px;background:#fff;color:#1e2535;font:16px/1.5 system-ui,sans-serif;color-scheme:light}
      #ds-chat-account::backdrop{background:#16213d70}
      #ds-chat-account header{display:flex;align-items:center;justify-content:space-between;gap:12px}
      #ds-chat-account h2{font-size:21px;line-height:1.25;margin:0}
      #ds-chat-account p{margin:16px 0;color:#616b7e}
      #ds-chat-account output{display:block;white-space:pre-line;padding:14px;background:#eef1fa;border-radius:12px;font-weight:600}
      #ds-chat-account output:empty{display:none}
      #ds-chat-account .actions{margin-top:18px;display:grid;gap:9px}
      #ds-chat-account button,#ds-chat-account a{box-sizing:border-box;font:inherit;cursor:pointer;text-decoration:none;text-align:center}
      #ds-chat-account header button{padding:7px 8px;border:0;background:transparent;color:#616b7e;font-size:14px}
      #ds-chat-account .actions>*{background:#fff;color:#1e2535;border:1px solid #e6e9f1;border-radius:14px;padding:10px 14px}
      #ds-chat-account [data-action=login],#ds-chat-account [data-action=pay]{background:#4168f4;border-color:#4168f4;color:#fff;font-weight:600}
      #ds-chat-account button:disabled{opacity:.5}
    `;
    html.dataset.deepsleepMode = "chat";
    document.head.append(style);
    document.body.append(bar, panel);
    const button = name => panel.querySelector('[data-action="' + name + '"]');
    const running = new Set(["initializing", "waiting-browser", "exchanging", "committing"]);
    const isSignedIn = () => account.getSnapshot().view?.status === "credential-stored";
    let starting = false;
    let waitingForLogin = false;
    let actionError = "";
    let previousSigned = isSignedIn();
    function render() {
        const state = account.getSnapshot();
        const view = state.view;
        const signed = isSignedIn();
        const attempt = view?.attempt;
        const pending = !signed && (starting || running.has(attempt?.phase));
        if (signed && waitingForLogin) {
            waitingForLogin = false;
            if (panel.open) panel.close();
        }
        if (signed !== previousSigned) {
            previousSigned = signed;
            if (html.dataset.deepsleepMode === "chat") chat.show();
        }
        button("login").hidden = signed || pending;
        button("login").disabled = !view;
        button("cancel").hidden = !pending || !attempt?.id || attempt.phase === "committing";
        button("refresh").hidden = !signed;
        button("logout").hidden = !signed;
        const pay = button("pay");
        pay.hidden = !signed || !view?.links?.topUpUrl;
        if (pay.hidden) pay.removeAttribute("href");
        else pay.href = view.links.topUpUrl;
        panel.querySelector("h2").textContent = signed ? "我的 DeepSeek 账号" : "登录 DeepSeek";
        let note = "在 DeepSeek 官方页面授权，使用开放平台余额聊天。";
        if (!view) note = state.failed ? "账号服务连接失败，请重新打开应用。" : "正在连接账号服务…";
        else if (signed) note = "充值将通过 DeepSeek 官方收银台完成。";
        else if (pending) note = "正在等待官方授权。完成后返回 DeepSleep。";
        else if (state.loginFailed || attempt?.phase === "failed" || attempt?.phase === "expired") note = "官方授权未完成，请重新登录。";
        panel.querySelector("[role=status]").textContent = actionError || note;
        const balance = state.details?.balance;
        const output = panel.querySelector("output");
        if (!signed) output.textContent = "";
        else if (!balance) output.textContent = "正在查询余额…";
        else if (balance.status !== "ready") output.textContent = "余额暂时无法查询";
        else {
            const amounts = rows => rows.map(w => w.currency + " " + w.balance).join("、");
            const lines = [];
            if (balance.value.length) lines.push("充值余额　" + amounts(balance.value));
            if (balance.bonusWallets?.length) lines.push("赠送余额　" + amounts(balance.bonusWallets));
            output.textContent = lines.join("\n") || "暂无余额记录";
        }
    }
    function refresh() {
        if (isSignedIn()) operations.refreshAccount().catch(() => {
            actionError = "刷新失败，请重试。";
            render();
        });
    }
    panel.addEventListener("click", async event => {
        const action = event.target.closest("[data-action]")?.dataset.action;
        if (!action) return;
        actionError = "";
        try {
            if (action === "login" && !starting) {
                starting = waitingForLogin = true;
                render();
                try {
                    const request = operations.start();
                    operations.showLogin(false); // The mobile dialog displays the official attempt.
                    await request;
                } finally { starting = false; }
            } else if (action === "cancel") {
                const attempt = account.getSnapshot().view?.attempt;
                if (attempt) await operations.cancel(attempt.id);
                waitingForLogin = false;
            } else if (action === "refresh") refresh();
            else if (action === "logout" && window.confirm("退出当前 DeepSeek 账号？")) {
                await operations.signOut();
                panel.close();
            }
        } catch { actionError = "操作未完成，请重试。"; }
        render();
    });
    function openAccount() {
        actionError = "";
        render();
        if (!panel.open) panel.showModal();
        refresh();
    }

    let mobileSessionAtSwitch;
    function showMobile() {
        html.dataset.deepsleepMode = "chat";
        bar.hidden = true;
        chat.show();
    }
    function enterDsh(id) {
        mobileSessionAtSwitch = id || null;
        chat.hide();
        html.dataset.deepsleepMode = "dsh";
        bar.hidden = false;
        if (id) ctx.get("uiWorkspace")?.openSession(id);
    }
    async function returnFromDsh() {
        const sessions = ctx.get("sessions");
        const id = deepSleepRetainedId(sessions, "mainView");
        showMobile();
        if (!id || id === mobileSessionAtSwitch) return;
        if (!mobileSessionAtSwitch && sessions.list.getSnapshot().byId[id]?.blank) return;
        try { await chat.openSession(id); }
        catch (error) { console.warn("DeepSleep could not open the selected DSH session", error); }
    }
    const importer = mountMobileImport(ctx, id => {
        ctx.get("uiWorkspace")?.openSession(id);
        showMobile();
        return chat.openSession(id);
    });
    const chat = mountDeepSleepChat(ctx, {
        account: openAccount, importHistory: importer.show, dsh: enterDsh, isSignedIn
    });
    bar.querySelector("button").addEventListener("click", returnFromDsh);
    function handleBack(event) {
        if (panel.open) panel.close();
        else if (!importer.handleBack()) {
            if (html.dataset.deepsleepMode !== "dsh") return;
            void returnFromDsh();
        }
        event.preventDefault();
    }
    const off = account.subscribe(render);
    window.addEventListener("deepsleep-back", handleBack, true);
    window.addEventListener("dschat-resume", refresh);
    render();
    html.dataset.deepsleepMounted = "true";
    return () => {
        delete html.dataset.deepsleepMounted;
        delete html.dataset.deepsleepMode;
        window.removeEventListener("deepsleep-back", handleBack, true);
        window.removeEventListener("dschat-resume", refresh);
        off();
        importer.dispose();
        chat.dispose();
        panel.remove();
        bar.remove();
        style.remove();
    };
}
