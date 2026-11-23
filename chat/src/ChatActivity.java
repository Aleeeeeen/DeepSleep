package app.dsconversation.mobile;

import android.app.*;
import android.content.*;
import android.graphics.Color;
import android.net.Uri;
import android.os.*;
import android.view.*;
import android.webkit.*;
import android.widget.*;

public final class ChatActivity extends Activity {
    private final Handler ui = new Handler(Looper.getMainLooper());
    private WebView chat;
    private LinearLayout loading;
    private TextView message;
    private Button retry;
    private String loaded;
    private boolean pageFinished;
    private boolean checkingMount;
    private long mountDeadline;
    private static final int PICK_DOCUMENT = 31;
    private ValueCallback<Uri[]> pendingFile;
    private final Runnable monitor = new Runnable() {
        @Override public void run() {
            String entry = ChatHost.entry;
            if (entry != null && !entry.equals(loaded)) {
                loaded = entry;
                pageFinished = false;
                loading.setVisibility(View.VISIBLE);
                chat.loadUrl(entry);
            }
            if (entry == null) {
                loaded = null;
                loading.setVisibility(View.VISIBLE);
                message.setText(ChatHost.status);
                retry.setVisibility(ChatHost.failed ? View.VISIBLE : View.GONE);
            } else if (pageFinished && loading.getVisibility() == View.VISIBLE && !checkingMount) {
                checkingMount = true;
                chat.evaluateJavascript("document.documentElement.hasAttribute('data-deepsleep-mounted')", ready -> {
                    checkingMount = false;
                    if (isDestroyed() || !entry.equals(loaded)) return;
                    if ("true".equals(ready)) {
                        loading.setVisibility(View.GONE);
                    } else if (SystemClock.elapsedRealtime() > mountDeadline) {
                        message.setText("聊天界面加载超时，请重试。");
                        retry.setVisibility(View.VISIBLE);
                    }
                });
            }
            ui.postDelayed(this, 450);
        }
    };
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(Color.WHITE);
        getWindow().setNavigationBarColor(Color.WHITE);
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
        FrameLayout frame = new FrameLayout(this);
        chat = new WebView(this);
        WebSettings settings = chat.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setSupportMultipleWindows(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(true);
        settings.setTextZoom(100);
        chat.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (!request.isForMainFrame()) return !local(uri);
                if (local(uri)) return false;
                openExternal(uri);
                return true;
            }
            @Override public void onPageFinished(WebView v, String url) {
                if (local(Uri.parse(url))) {
                    pageFinished = true;
                    mountDeadline = SystemClock.elapsedRealtime() + 90000;
                }
            }
            @Override public void onReceivedError(WebView v, WebResourceRequest req, WebResourceError error) {
                if (!req.isForMainFrame()) return;
                loading.setVisibility(View.VISIBLE);
                message.setText("聊天页面加载失败。");
                retry.setVisibility(View.VISIBLE);
            }
        });
        // Harness preopens about:blank on the user gesture, then navigates it after PKCE initialization.
        // Only the system browser renders the external login, checkout and payment app hand-off.
        chat.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (pendingFile != null) pendingFile.onReceiveValue(null);
                pendingFile = callback;
                if (view != chat || view.getUrl() == null || !local(Uri.parse(view.getUrl()))) {
                    finishPicker(null);
                    return true;
                }
                Intent pick = new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE)
                    .setType("*/*");
                try { startActivityForResult(pick, PICK_DOCUMENT); }
                catch (ActivityNotFoundException e) {
                    finishPicker(null);
                    Toast.makeText(ChatActivity.this, "未找到系统文件选择器", Toast.LENGTH_LONG).show();
                }
                return true;
            }
            @Override public boolean onCreateWindow(WebView v, boolean dialog, boolean gesture, Message result) {
                WebView handoff = new WebView(ChatActivity.this);
                handoff.getSettings().setAllowFileAccess(false);
                handoff.getSettings().setAllowContentAccess(false);
                handoff.setWebViewClient(new WebViewClient() {
                    boolean sent;
                    boolean route(Uri uri) {
                        if ("about:blank".equals(uri.toString())) return false;
                        if (!sent) { sent = true; openExternal(uri); }
                        return true;
                    }
                    @Override public boolean shouldOverrideUrlLoading(WebView w, WebResourceRequest req) { return route(req.getUrl()); }
                    @Override public void onPageStarted(WebView w, String url, android.graphics.Bitmap icon) {
                        if (route(Uri.parse(url))) w.stopLoading();
                    }
                });
                handoff.setWebChromeClient(new WebChromeClient() {
                    @Override public void onCloseWindow(WebView w) { w.destroy(); }
                });
                ((WebView.WebViewTransport) result.obj).setWebView(handoff);
                result.sendToTarget();
                return true;
            }
        });
        frame.addView(chat);
        loading = new LinearLayout(this);
        loading.setBackgroundColor(Color.WHITE);
        loading.setOrientation(LinearLayout.VERTICAL);
        loading.setGravity(Gravity.CENTER);
        ImageView icon = new ImageView(this);
        icon.setImageResource(R.drawable.app_icon);
        int iconSize = Math.round(56 * getResources().getDisplayMetrics().density);
        loading.addView(icon, iconSize, iconSize);
        TextView title = new TextView(this);
        title.setText("DeepSleep"); title.setTextColor(0xff273043); title.setTextSize(28);
        loading.addView(title);
        message = new TextView(this);
        message.setGravity(Gravity.CENTER); message.setPadding(24,24,24,24);
        message.setTextColor(0xff69778b);
        loading.addView(message);
        retry = new Button(this);
        retry.setText("重试");
        retry.setVisibility(View.GONE);
        retry.setOnClickListener(v -> {
            pageFinished = false;
            retry.setVisibility(View.GONE);
            message.setText("正在启动聊天…");
            if (ChatHost.entry != null) chat.loadUrl(ChatHost.entry);
            else startForegroundService(new Intent(this, ChatHost.class));
        });
        loading.addView(retry);
        frame.addView(loading);
        setContentView(frame);
        startForegroundService(new Intent(this, ChatHost.class));
    }
    private boolean local(Uri uri) {
        String entry = ChatHost.entry;
        return entry != null && "http".equals(uri.getScheme()) && "127.0.0.1".equals(uri.getHost())
            && uri.getUserInfo() == null && Uri.parse(entry).getPort() == uri.getPort();
    }
    private void finishPicker(Uri value) {
        ValueCallback<Uri[]> callback = pendingFile;
        pendingFile = null;
        if (callback != null) callback.onReceiveValue(value == null ? null : new Uri[]{value});
    }
    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (request != PICK_DOCUMENT) return;
        Uri uri = result == RESULT_OK && data != null ? data.getData() : null;
        if (uri != null && (!"content".equals(uri.getScheme()) || getPackageName().equals(uri.getAuthority()))) uri = null;
        finishPicker(uri);
    }
    private void openExternal(Uri uri) {
        if (!"https".equals(uri.getScheme()) || uri.getHost() == null || uri.getUserInfo() != null) return;
        try { startActivity(new Intent(Intent.ACTION_VIEW, uri).addCategory(Intent.CATEGORY_BROWSABLE)); }
        catch (ActivityNotFoundException e) { Toast.makeText(this, "请安装支持 HTTPS 的系统浏览器", Toast.LENGTH_LONG).show(); }
    }
    @Override public void onResume() {
        super.onResume();
        ui.post(monitor);
        if (loaded != null) chat.evaluateJavascript("window.dispatchEvent(new Event('dschat-resume'))", null);
    }
    @Override public void onPause() { ui.removeCallbacks(monitor); super.onPause(); }
    @Override public void onBackPressed() {
        if (loaded != null && loading.getVisibility() == View.GONE) {
            chat.evaluateJavascript("!window.dispatchEvent(new CustomEvent('deepsleep-back',{cancelable:true}))", handled -> {
                if (!isDestroyed() && !"true".equals(handled)) backFromPage();
            });
            return;
        }
        backFromPage();
    }
    private void backFromPage() {
        if (chat.canGoBack()) chat.goBack(); else super.onBackPressed();
    }
    @Override public void onDestroy() {
        finishPicker(null);
        ui.removeCallbacks(monitor);
        chat.destroy();
        if (isFinishing()) stopService(new Intent(this, ChatHost.class));
        super.onDestroy();
    }
}
