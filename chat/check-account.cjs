// Runs the mobile account and import views with simulated Harness services in a real browser.
const { readFileSync, writeFileSync, mkdtempSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { pathToFileURL } = require('node:url');
const { spawnSync } = require('node:child_process');
const browser = process.argv[2];
if (!browser) throw new Error('Pass the path to Chrome or Edge.');

async function check() {
    const expect = (ok, label) => { if (!ok) throw new Error(label); };
    const tick = () => new Promise(resolve => setTimeout(resolve, 0));
    let snapshot = { view: { status: 'signed-out' } };
    let listener, started = 0, refreshed = 0, cancelled = 0;
    const update = value => { snapshot = value; listener(); };
    const byId = {
        autoBlank: { id: 'autoBlank', blank: true, retainedBy: {} },
        first: { id: 'first', retainedBy: { deepSleepChat: 1 } },
        second: { id: 'second', title: '第二条会话', retainedBy: {} }
    };
    let dshSession;
    const navigation = { openSession(id) {
        if (dshSession) delete byId[dshSession].retainedBy.mainView;
        byId[id].retainedBy.mainView = 1;
        dshSession = id;
    }};
    const services = {
        sessions: { list: { getSnapshot: () => ({ byId }) }, refresh: async () => {} },
        workspaces: { list: { getSnapshot: () => ({ items: [
            { workspaceId: 'other', sessionIds: [] }, { workspaceId: 'current', sessionIds: ['first'] },
        ] }) } },
        uiWorkspace: navigation,
    };
    const dispose = mountMobileAccount({
        hooks: { account: { getSnapshot: () => snapshot, subscribe: fn => { listener = fn; return () => {}; } } },
        async start() { started++; update({ view: {status: 'signed-out', attempt: {id: 'test', phase: 'waiting-browser'}} }); },
        async cancel(id) { expect(id === 'test', 'cancel attempt'); cancelled++; update({ view: {status: 'signed-out'} }); },
        async refreshAccount() { refreshed++; },
        async signOut() { update({ view: { status: 'signed-out' } }); },
        showLogin() {}
    }, { get: name => services[name] });
    const panel = document.querySelector('#ds-chat-account');
    const action = name => panel.querySelector('[data-action="' + name + '"]');
    const root = document.querySelector('#root');
    const chat = document.querySelector('#deepsleep-chat');
    const drawer = chat.querySelector('dialog');
    const openDrawer = () => chat.querySelector('[data-cmd="history"]').click();
    function chooseLink(name) {
        openDrawer();
        drawer.querySelector('[data-cmd="' + name + '"]').click();
    }
    async function chooseSession(id) {
        openDrawer();
        drawer.querySelector('[data-id="' + id + '"]').click();
        await tick();
    }
    const back = () => !window.dispatchEvent(new CustomEvent('deepsleep-back', {cancelable: true}));
    expect(document.documentElement.hasAttribute('data-deepsleep-mounted'), 'ready signal');
    expect(!panel.open && !chat.hidden && getComputedStyle(root).display === 'none', 'guest opens directly in chat');
    openDrawer();
    expect(drawer.open && back() && !drawer.open, 'Android Back closes history drawer');
    chooseLink('account');
    expect(panel.open && !action('login').hidden && action('pay').hidden, 'opt-in signed-out account');
    action('login').click(); await tick();
    expect(started === 1 && !action('cancel').hidden, 'pending login');
    action('cancel').click(); await tick();
    expect(cancelled === 1 && !action('login').hidden, 'cancel login');
    action('login').click(); await tick();
    update({ view: {status: 'credential-stored', links: {topUpUrl: 'https://platform.deepseek.com/top_up'}},
        details: {balance: {status: 'ready', value: [{currency: 'CNY', balance: '12.34'}], bonusWallets: []}} });
    expect(!panel.open && !chat.hidden, 'successful login returns to chat');
    chooseLink('account');
    expect(panel.open && action('pay').href === 'https://platform.deepseek.com/top_up', 'checkout destination');
    expect(panel.querySelector('output').textContent.includes('12.34'), 'server-reported currency');
    window.dispatchEvent(new Event('dschat-resume'));
    expect(refreshed === 2, 'resume refresh');
    update({...snapshot, details: {balance: {status: 'unavailable'}}});
    expect(panel.querySelector('output').textContent.includes('无法查询'), 'unavailable balance');
    expect(back() && !panel.open, 'Android Back closes account');

    const composer = chat.querySelector('textarea');
    composer.value = '未发送的草稿';
    chooseLink('dsh');
    navigation.openSession('autoBlank');
    expect(back() && mobile.id == null && composer.value === '未发送的草稿', 'DSH blank preserves mobile draft');
    await chooseSession('first');
    chooseLink('dsh');
    expect(chat.hidden && dshSession === 'first' && getComputedStyle(root).display !== 'none', 'DSH receives current conversation');
    const bar = document.querySelector('#ds-dsh-bar');
    expect(!bar.hidden && root.getBoundingClientRect().top === bar.getBoundingClientRect().bottom, 'DSH occupies space below return bar');
    navigation.openSession('second');
    expect(back() && !chat.hidden && mobile.id === 'second' && bar.hidden, 'Android Back returns to DSH selection');
    await tick();
    await chooseSession('first');
    chooseLink('dsh');
    bar.querySelector('button').click();
    expect(!chat.hidden && mobile.id === 'first' && !back(), 'return button and Android Back at chat root');

    chooseLink('import');
    const sheet = document.querySelector('#ds-history-import');
    expect(sheet.open && back() && !sheet.open, 'Android Back closes import');
    chooseLink('import');
    const upload = new DataTransfer();
    upload.items.add(new File(['zip-fixture'], 'history.zip', {type: 'application/zip'}));
    sheet.querySelector('input[type=file]').files = upload.files;
    sheet.querySelector('input[type=file]').dispatchEvent(new Event('change'));
    let uploaded = false;
    window.fetch = async (url, init) => {
        uploaded = url.pathname.endsWith('/api/deepseek-chat-import/archive') && url.searchParams.get('workspaceId') === 'current' &&
            init.method === 'POST' && await init.body.text() === 'zip-fixture';
        expect(back() && sheet.open, 'Android Back preserves active import');
        return new Response(JSON.stringify({type: 'outcome', outcome: {ok: true, value: { sessionIds: ['second'], skipped: [] }}}));
    };
    await sheet.querySelector('.submit').onclick();
    expect(uploaded && sheet.querySelector('.sessions').textContent.includes('第二条会话'),
        'ZIP import into active workspace: ' + sheet.querySelector('[role=status]').textContent);
    sheet.querySelector('.sessions button').click(); await tick();
    expect(!sheet.open && !chat.hidden && mobile.id === 'second' && dshSession === 'second', 'imported session opens in both views');
    chooseLink('account');
    window.confirm = () => true;
    action('logout').click(); await tick();
    expect(!panel.open && !chat.hidden && !action('login').hidden, 'sign-out returns to chat');
    dispose();
    expect(mobile.disposed && !document.documentElement.hasAttribute('data-deepsleep-mounted') && !back(), 'cleanup');

    // DeepSeek recycles message elements as the user scrolls. Only a few turns
    // are present at once, and the shared-page notice has its own negative key.
    const list = document.createElement('div');
    list.className = 'ds-virtual-list';
    list.style.cssText = 'position:fixed;top:0;left:0;height:180px;width:300px;overflow:auto';
    const track = document.createElement('div');
    track.style.cssText = 'height:1440px;position:relative';
    list.append(track);
    document.body.append(list);
    function paintRows() {
        const start = Math.floor(list.scrollTop / 90);
        track.replaceChildren();
        for (let i = start; i < Math.min(16, start + 4); i++) {
            const row = document.createElement('div');
            row.dataset.virtualListItemKey = i === 0 ? '-999' : String(i);
            row.style.cssText = 'position:absolute;top:' + (i * 90) + 'px';
            if (!i) row.textContent = 'Shared conversation notice';
            else {
                const content = document.createElement('div');
                content.className = i % 2 ? 'ds-collapsible-text' : 'ds-markdown ds-assistant-message-main-content';
                content.textContent = 'Message ' + i;
                row.append(content);
            }
            track.append(row);
        }
    }
    list.onscroll = paintRows;
    list.scrollTop = 450;
    paintRows();
    const page = new URL('https://chat.deepseek.com/share/fixture');
    expect(readWebTranscript(new URL('https://example.org/share/fixture')) === 'wrong-page', 'reject unrelated page');
    expect(readWebTranscript(page) === 'reading', 'start reading a shared conversation');
    for (let i = 0; i < 120 && !window.deepSleepTranscriptJob.result; i++) {
        paintRows();
        await new Promise(resolve => setTimeout(resolve, 50));
    }
    const transcript = window.deepSleepTranscriptJob.result;
    expect(transcript?.messages?.length === 15 && transcript.messages.every((msg, i) =>
        msg.text === 'Message ' + (i + 1) && msg.role === (i % 2 ? 'ASSISTANT' : 'USER')), 'all recycled messages in order');
    expect(list.scrollTop === 450, 'restore scroll after import');
}

const dir = mkdtempSync(join(tmpdir(), 'deepsleep-ui-'));
const html = join(dir, 'ui.html');
const code = ['mobile-chat.js','mobile-import.js','mobile-account.js'].map(name => readFileSync(join(__dirname, name), 'utf8')).join('\n');
const extractor = readFileSync(join(__dirname, 'web-transcript.js'), 'utf8');
const engine = `
const mobile = {
    id: null, disposed: false,
    list() { return [{id: 'first', title: '第一条会话'}, {id: 'second', title: '第二条会话'}]; },
    snapshot() { return { id: this.id, messages: [], busy: false }; },
    async open(id) { this.id = id; },
    dispose() { this.disposed = true; }
};
function createDeepSleepSessions() { return mobile; }
`;
writeFileSync(html, '<meta charset=utf-8><body><div id=root></div><script>const readWebTranscript = (location) => ' + extractor + ';\n' + engine + code + '\n(' + check.toString() +
    ')().then(()=>document.body.textContent="DS_CHAT_CHECK_OK",e=>document.body.textContent="Failed: "+e.message)</script>');
const result = spawnSync(browser, ['--headless=new','--disable-gpu','--no-first-run','--disable-background-networking',
    '--user-data-dir=' + join(dir,'profile'),'--virtual-time-budget=12000','--dump-dom',pathToFileURL(html).href],
    {encoding:'utf8', timeout:45000});
if (result.status !== 0 || !result.stdout?.includes('<body>DS_CHAT_CHECK_OK</body>'))
    throw Error(result.error?.message || result.stdout?.match(/<body>Failed:[^<]+/)?.[0] || 'UI check failed');
console.log('PASS account, ZIP import, session switching, Android Back and virtualized web transcript');
