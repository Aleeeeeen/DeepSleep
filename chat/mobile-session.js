// The Harness owns the model, event journal, and stream. Each open chat holds
// one reference to its Session and observes the same Chat projection as DSH.
function createDeepSleepSessions(ctx, notify) {
    const chatPreset = "deepsleep-chat";
    const advancedMessage = "这条会话启用了 DSH 工具，请切换至 DSH 继续。";
    let selected = null;
    let revision = 0;
    let sending = null;
    let localError = "";
    let disposed = false;
    let queued = false;
    let startupTimer;
    const catalogOff = [];
    const firstLines = new Map();

    function changed() {
        if (disposed || queued) return;
        queued = true;
        queueMicrotask(() => {
            queued = false;
            if (!disposed) notify();
        });
    }

    // The account plugin can mount before the workspace and Session plugins.
    function connectCatalogs() {
        const sessions = ctx.get("sessions");
        const workspaces = ctx.get("workspaces");
        if (!sessions || !workspaces) {
            startupTimer = setTimeout(connectCatalogs, 250);
            return;
        }
        catalogOff.push(sessions.list.subscribe(changed), workspaces.list.subscribe(changed));
        changed();
    }
    connectCatalogs();

    function errorText(error) {
        const failure = error?.rpcError || error;
        if (failure?.code === "session/provider-credentials-unavailable" ||
            /unauthorized|invalid api key|authentication fail|credentials? (?:unavailable|missing)|\b401\b/i.test(failure?.message || failure)) {
            return "请先登录 DeepSeek 账号，再发送消息。";
        }
        return failure?.message || (typeof failure === "string" && failure) || "聊天服务暂时不可用，请稍后重试。";
    }

    function titleOf(row, id) {
        return row?.title || firstLines.get(id) || "未命名对话";
    }

    function list() {
        const catalog = ctx.get("sessions")?.list.getSnapshot();
        if (!catalog) return [];
        const archived = new Set(ctx.get("workspaces")?.list.getSnapshot().archivedSessionIds);
        return catalog.ids.map(id => catalog.byId[id])
            .filter(row => row && !row.blank && row.origin !== "subagent" && !archived.has(row.id))
            .sort((a, b) => b.updatedAt - a.updatedAt)
            .map(row => ({ id: row.id, title: titleOf(row, row.id) }));
    }

    function reset() {
        revision++;
        if (selected) {
            selected.off.forEach(off => off());
            selected.ref.release();
        }
        selected = sending = null;
        localError = "";
    }

    function newChat() {
        reset();
        changed();
    }

    function readOnlyReason(current) {
        if (!current) return "";
        const state = current.session.getSnapshot();
        if (state.openError) return errorText(state.openError);
        if (state.openState !== "open") return "正在读取会话模式…";
        const preset = current.preset.getSnapshot();
        // A successful baseline carries null for a legacy import. The mobile
        // host resumes those logs with the chat preset. Missing data is undefined.
        if (preset === undefined) return "无法确认会话模式，请重新打开对话。";
        return preset === null || preset === chatPreset ? "" : advancedMessage;
    }

    async function bind(id, version) {
        const sessions = ctx.get("sessions");
        const conversations = ctx.get("uiConversation");
        if (!sessions || !conversations) throw Error("聊天服务正在连接，请稍后重试。");
        const ref = sessions.retain(id, { source: "deepSleepChat" });
        const session = ref.binding.session;
        const current = { id, ref, session, off: [], chat: null, preset: session.projections.faceOf("agentPreset") };
        selected = current;
        const assembly = conversations.binding(ref.binding);
        current.chat = assembly.target("chat");
        current.off.push(current.session.subscribe(changed));
        current.off.push(current.chat.subscribe(changed));
        current.off.push(current.preset.subscribe(changed));
        changed();
        await ref.ready;
        if (version !== revision) return;
        const state = current.session.getSnapshot();
        if (state.openError) throw state.openError;
        if (state.hasMore) await current.session.loadThrough(0);
    }

    async function open(id) {
        reset();
        const version = revision;
        try {
            await bind(id, version);
        } catch (error) {
            if (version !== revision) return;
            localError = errorText(error);
            throw Error(localError);
        } finally {
            changed();
        }
    }

    function assistantMessage(blocks) {
        let text = "", reasoning = "";
        for (const block of blocks) {
            if (block.kind === "text") text += block.text;
            if (block.kind === "reasoning") reasoning += block.text;
        }
        if (text || reasoning) return { role: "assistant", text, ...(reasoning && { reasoning }) };
    }

    function userText(block) {
        if (block.type === "text") return block.text;
        if (block.type !== "image" && block.type !== "file") return "";
        const label = block.type === "image" ? "图片" : "文件";
        return block.attachment?.name ? "［" + label + " · " + block.attachment.name + "］" : "［" + label + "］";
    }

    function snapshot() {
        const id = selected?.id ?? null;
        const row = id && ctx.get("sessions")?.list.getSnapshot().byId[id];
        const state = selected?.session.getSnapshot();
        const chat = selected?.chat?.getSnapshot()?.legacy;
        const messages = [];
        const echoed = new Set();
        let turnError = "";
        for (const node of chat?.nodes || []) {
            if (node.kind === "user" || node.kind === "steering") {
                if (node.source?.rpcId) echoed.add(node.source.rpcId);
                const text = node.content.map(userText).filter(Boolean).join("\n");
                if (text) {
                    messages.push({ role: "user", text });
                    if (!firstLines.has(id)) firstLines.set(id, text.trim().slice(0, 32));
                }
                turnError = "";
            } else if (node.kind === "assistant") {
                const message = assistantMessage(node.blocks);
                if (message) messages.push(message);
                turnError = "";
            } else if (node.kind === "turn-error") {
                turnError = errorText(node.message);
            }
        }
        for (const pending of state?.pendingSubmissions || []) {
            if (!echoed.has(pending.requestId)) messages.push({ role: "user", text: pending.text });
        }
        if (chat?.partial) {
            const message = assistantMessage(chat.partial.blocks);
            if (message) messages.push(message);
        }
        const failure = state?.promptError?.error || state?.openError || state?.lastAgentError;
        const busy = Boolean(sending || state?.running ||
            (!failure && !localError && (state?.awaitingFirstTurn || state?.pendingSubmissions.length)));
        const modeError = readOnlyReason(selected);
        return {
            id, title: id ? titleOf(row, id) : "新对话", messages, busy, readOnly: Boolean(modeError),
            error: modeError || localError || (failure ? errorText(failure) : "") || (!busy && turnError) || ""
        };
    }

    async function send(text) {
        const input = String(text ?? "").trim();
        if (!input || disposed) return;
        if (snapshot().busy) throw Error("请等待当前回复完成。");
        const version = revision;
        const operation = { stopped: false, admission: null };
        sending = operation;
        localError = "";
        changed();
        let echo;
        try {
            const isNew = !selected;
            if (isNew) {
                const sessions = ctx.get("sessions"), workspaces = ctx.get("workspaces");
                if (!sessions || !workspaces) throw Error("聊天服务正在连接，请稍后重试。");
                const workspace = workspaces.list.getSnapshot().items[0] || await workspaces.initializeDefault();
                if (version !== revision || operation.stopped) return;
                if (!workspace) throw Error("本地会话存储尚未就绪，请稍后重试。");
                const id = await sessions.create({ workspaceId: workspace.workspaceId, agentPreset: chatPreset });
                if (version !== revision || operation.stopped) return;
                await bind(id, version);
            } else {
                await selected.ref.ready;
            }
            if (version !== revision || operation.stopped) return;
            const modeError = readOnlyReason(selected);
            if (modeError) throw Error(modeError);
            const { id, session } = selected;
            const state = session.getSnapshot();
            if (state.openError) throw state.openError;
            const firstTurn = state.blank;
            echo = session.beginSubmission({ mode: "queue", text: input, attachments: [] });
            changed();
            operation.admission = session.prompt([{ type: "text", text: input }], "queue", undefined, echo.requestId);
            const result = await operation.admission;
            if (!result.ok) throw result.error;
            if (firstTurn) {
                const title = input.split(/\r?\n/, 1)[0].slice(0, 32);
                firstLines.set(id, title);
                if (!ctx.get("sessions").list.getSnapshot().byId[id]?.title)
                    void session.rename(title).catch(() => {});
            }
        } catch (error) {
            echo?.abandon();
            if (version !== revision || operation.stopped) return;
            localError = errorText(error);
            throw Error(localError);
        } finally {
            if (sending === operation) sending = null;
            changed();
        }
    }

    async function stop() {
        const current = selected, version = revision;
        try {
            if (sending) {
                sending.stopped = true;
                if (!sending.admission || !(await sending.admission).ok) return;
            }
            if (!current || revision !== version) return;
            const modeError = readOnlyReason(current);
            if (modeError) throw Error(modeError);
            const result = await current.session.cancel();
            if (!result.ok) throw result.error;
        } catch (error) {
            if (revision !== version) return;
            localError = errorText(error);
            throw Error(localError);
        } finally {
            changed();
        }
    }

    function dispose() {
        disposed = true;
        clearTimeout(startupTimer);
        catalogOff.forEach(off => off());
        reset();
    }
    return { list, open, newChat, send, stop, snapshot, dispose };
}
