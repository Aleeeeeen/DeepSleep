package app.dsconversation.mobile;

import android.app.Activity;
import android.app.Dialog;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.util.Base64;
import android.view.ViewGroup;
import android.webkit.*;
import android.widget.*;
import org.json.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import java.util.zip.*;

/** Read only the conversation the user opens and explicitly imports. */
final class WebHistory {
    interface Receiver { void receive(String archive); }
    static final String HOME = "https://chat.deepseek.com/";
    private final Dialog dialog;
    private final WebView page;
    private final Button submit;
    private final TextView status;
    private final Receiver receiver;
    private final Handler ui = new Handler(Looper.getMainLooper());
    private final String script;
    private int generation;
    private boolean reading;

    static boolean official(Uri uri) {
        return uri != null && "https".equals(uri.getScheme()) && "chat.deepseek.com".equals(uri.getEncodedAuthority());
    }
    static boolean conversation(Uri uri) {
        return official(uri) && uri.getEncodedPath() != null && uri.getEncodedPath().matches("/(a/chat/s|share)/[A-Za-z0-9_-]+/?");
    }
    static boolean shared(Uri uri) {
        return conversation(uri) && uri.getEncodedPath().startsWith("/share/");
    }

    WebHistory(Activity activity, String address, Receiver receiver) throws IOException {
        this.receiver = receiver;
        try (InputStream in = activity.getAssets().open("web-transcript.js")) {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] chunk = new byte[8192];
            for (int n; (n = in.read(chunk)) != -1;) out.write(chunk, 0, n);
            script = out.toString("UTF-8");
        }
        dialog = new Dialog(activity, android.R.style.Theme_Material_Light_NoActionBar);
        LinearLayout panel = new LinearLayout(activity);
        panel.setOrientation(LinearLayout.VERTICAL);
        LinearLayout bar = new LinearLayout(activity);
        Button close = new Button(activity);
        close.setText("返回");
        close.setOnClickListener(v -> dialog.dismiss());
        bar.addView(close);
        submit = new Button(activity);
        submit.setText("导入当前对话并续聊");
        bar.addView(submit, new LinearLayout.LayoutParams(0, -2, 1));
        panel.addView(bar);
        status = new TextView(activity);
        status.setPadding(16, 6, 16, 8);
        status.setText("在 DeepSeek 官网页面打开一条对话，可导入当前分支的文字。");
        panel.addView(status);
        page = new WebView(activity);
        page.getSettings().setJavaScriptEnabled(true);
        page.getSettings().setDomStorageEnabled(true);
        page.getSettings().setAllowFileAccess(false);
        page.getSettings().setAllowContentAccess(false);
        page.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest req) {
                Uri u = req.getUrl();
                String h = u.getEncodedAuthority();
                return !"https".equals(u.getScheme()) || h == null || !h.matches("(?:[A-Za-z0-9-]+\\.)*deepseek\\.com");
            }
            @Override public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest req) {
                if ("http".equals(req.getUrl().getScheme()))
                    return new WebResourceResponse("text/plain", "UTF-8", new ByteArrayInputStream(new byte[0]));
                return null;
            }
            @Override public void onReceivedError(WebView v, WebResourceRequest req, WebResourceError error) {
                if (req.isForMainFrame()) status.setText("官网页面加载失败，请检查网络或返回后重试。");
            }
            @Override public void onReceivedHttpError(WebView v, WebResourceRequest req, WebResourceResponse res) {
                if (req.isForMainFrame()) status.setText("官网返回 HTTP " + res.getStatusCode() + "。请稍后重试。");
            }
        });
        panel.addView(page, new LinearLayout.LayoutParams(-1, 0, 1));
        submit.setOnClickListener(v -> read());
        dialog.setContentView(panel);
        dialog.setOnDismissListener(d -> {
            generation++;
            ui.removeCallbacksAndMessages(null);
            page.stopLoading();
            ((ViewGroup)page.getParent()).removeView(page);
            page.destroy();
        });
        dialog.show();
        page.loadUrl(address);
    }
    void close() { dialog.dismiss(); }
    private void error(String text) {
        reading = false;
        submit.setEnabled(true);
        status.setText(text);
    }
    private void read() {
        if (reading) return;
        String url = page.getUrl();
        if (url == null || !conversation(Uri.parse(url))) {
            error("先在官网历史列表中打开要导入的那条对话。"); return;
        }
        reading = true;
        submit.setEnabled(false);
        status.setText("正在读取当前对话的文字…");
        final int id = ++generation;
        page.evaluateJavascript(script, value -> {
            if (id != generation) return;
            if (!"\"reading\"".equals(value)) { error("当前页面无法读取，请打开一条官网对话。"); return; }
            poll(id, url, SystemClock.elapsedRealtime() + 120000);
        });
    }
    private void poll(int id, String url, long deadline) {
        if (id != generation) return;
        if (!url.equals(page.getUrl()) || SystemClock.elapsedRealtime() >= deadline) {
            error("读取超时或对话已切换，请重试。"); return;
        }
        page.evaluateJavascript("location.origin === 'https://chat.deepseek.com' ? window.deepSleepTranscriptJob?.result : null", raw -> {
            if (id != generation) return;
            if (!url.equals(page.getUrl())) { error("对话已切换，请重试。"); return; }
            if (raw == null || "null".equals(raw)) { ui.postDelayed(() -> poll(id, url, deadline), 250); return; }
            if (raw.length() > 6 * 1024 * 1024) { error("对话较大，请使用 ZIP 导入。"); return; }
            new Thread(() -> {
                try {
                    JSONObject data = new JSONObject(raw);
                    if (data.has("error")) {
                        String detail = data.optString("error").replaceAll("[\\r\\n]", " ");
                        ui.post(() -> { if (id == generation) error(detail.substring(0, Math.min(detail.length(), 150))); });
                        return;
                    }
                    String archive = archive(data);
                    ui.post(() -> {
                        if (id != generation) return;
                        close();
                        receiver.receive(archive);
                    });
                } catch (Exception e) { ui.post(() -> { if (id == generation) error("无法转换当前对话，请使用 ZIP 导入。"); }); }
            }, "web-history-import").start();
        });
    }
    private static String archive(JSONObject data) throws Exception {
        String id = UUID.randomUUID().toString(), now = java.time.Instant.now().toString();
        JSONObject index = new JSONObject().put("id", id).put("title", data.getString("title")).put("inserted_at", now).put("updated_at", now);
        JSONArray messages = new JSONArray(), input = data.getJSONArray("messages");
        if (input.length() == 0 || input.length() > 20000) throw new IOException("message count");
        for (int i = 0; i < input.length(); i++) {
            JSONObject row = input.getJSONObject(i);
            String role = row.getString("role");
            if (!role.equals("USER") && !role.equals("ASSISTANT")) throw new IOException("role");
            JSONObject fragment = new JSONObject().put("type", role.equals("USER") ? "REQUEST" : "RESPONSE").put("content", row.getString("text"));
            messages.put(new JSONObject().put("id", i+1).put("parent_id", i == 0 ? JSONObject.NULL : i)
                .put("role", role).put("status", "FINISHED").put("inserted_at", now).put("fragments", new JSONArray().put(fragment)));
        }
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try (ZipOutputStream zip = new ZipOutputStream(out)) {
            write(zip, "manifest.json", "{\"export_format_version\":3}");
            write(zip, "chat_session_index.json", new JSONArray().put(index).toString());
            write(zip, "chat_sessions/" + id + ".json", index.put("messages", messages).put("current_message_id", input.length()).toString());
        }
        return Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP);
    }
    private static void write(ZipOutputStream zip, String path, String value) throws IOException {
        zip.putNextEntry(new ZipEntry(path));
        zip.write(value.getBytes(StandardCharsets.UTF_8));
        zip.closeEntry();
    }
}
