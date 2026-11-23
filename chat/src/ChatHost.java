package app.dsconversation.mobile;

import android.app.*;
import android.content.*;
import android.os.IBinder;
import android.util.Base64;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.security.SecureRandom;
import java.util.*;

/** Owns one private Harness host while the chat or its external payment flow is open. */
public final class ChatHost extends Service {
    static volatile String status = "正在准备…";
    static volatile String entry;
    static volatile boolean failed;
    private volatile boolean closing;
    private volatile Process process;
    private Thread worker;
    private static final String MODULES = "opt/dsh/lib/node_modules/";

    @Override public IBinder onBind(Intent i) { return null; }
    @Override public synchronized int onStartCommand(Intent i, int flags, int id) {
        NotificationManager manager = getSystemService(NotificationManager.class);
        manager.createNotificationChannel(new NotificationChannel("chat", "本机聊天服务", NotificationManager.IMPORTANCE_LOW));
        PendingIntent open = PendingIntent.getActivity(this, 0, new Intent(this, ChatActivity.class)
            .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP), PendingIntent.FLAG_IMMUTABLE);
        startForeground(1, new Notification.Builder(this, "chat").setSmallIcon(R.drawable.app_icon)
            .setContentTitle("DeepSleep").setContentText("点此返回聊天").setContentIntent(open).build());
        if (worker == null || !worker.isAlive()) {
            failed = false;
            entry = null;
            worker = new Thread(this::runHost, "local-chat");
            worker.start();
        }
        return START_NOT_STICKY;
    }

    private void runHost() {
        try {
            File files = getFilesDir();
            File runtime = new File(files, "runtime-v1");
            File home = new File(files, "home");
            File tmp = new File(files, "tmp");
            File profile = new File(home, ".dsh/profiles/web");
            Files.createDirectories(tmp.toPath());
            Files.createDirectories(profile.toPath());
            File marker = new File(runtime, ".complete");
            if (!marker.isFile()) {
                status = "首次启动，正在解压本机聊天引擎…";
                Files.createDirectories(runtime.toPath());
                unpack(runtime, "engine.tar.gz");
                unpack(runtime, "node.tar.gz");
                Files.createFile(marker.toPath());
            }
            Path modules = new File(runtime, MODULES).toPath();
            Path namespace = Files.createDirectories(modules.resolve("@dsconversation"));
            Path importer = namespace.resolve("history-import");
            if (!Files.exists(importer)) {
                Path staging = Files.createTempDirectory(namespace, ".import-");
                unpack(staging.toFile(), "history-import.tar.gz");
                Files.move(staging, importer, StandardCopyOption.ATOMIC_MOVE);
            }
            Path client = modules.resolve("@deepseek-ai/dsh-client-ui-settings-account/lib/client.js");
            installAsset("mobile-client.js", client);
            installAsset("history.patch.yml", importer.resolve("cordis.patch.yml"));
            installAsset("history-host.js", importer.resolve("lib/index.js"));
            installAsset("chat-tools.js", importer.resolve("lib/chat-tools.js"));
            installAsset("history-package.json", importer.resolve("package.json"));
            installAsset("web-app.patch.yml", modules.resolve("@deepseek-ai/dsh-web-app/cordis.patch.yml"));
            installAsset("android-session-controller.js", modules.resolve("@deepseek-ai/dsh-api-session-controller/lib/index.js"));
            File documents = new File(home, "Documents");
            Files.createDirectories(documents.toPath());
            Path link = profile.toPath().resolve("node_modules");
            if (!Files.isSymbolicLink(link)) Files.createSymbolicLink(link, modules);
            write(profile, "package.json", "{\"name\":\"ds-chat\",\"private\":true,\"dsh\":{\"profile\":{\"bundles\":[\"@deepseek-ai/dsh-base\",\"@deepseek-ai/dsh-web-app\",\"@dsconversation/history-import\"],\"patchReload\":\"startup\"}}}");
            write(profile, "cordis.yml", "[]\n");
            if (!new File(profile, "cordis.patch.yml").exists()) write(profile, "cordis.patch.yml", "- id: hmr\n  disabled: true\n");
            String port;
            try (ServerSocket s = new ServerSocket(0, 1, InetAddress.getByName("127.0.0.1"))) {
                port = Integer.toString(s.getLocalPort());
            }
            byte[] secret = new byte[32];
            new SecureRandom().nextBytes(secret);
            String token = Base64.encodeToString(secret, Base64.URL_SAFE | Base64.NO_WRAP | Base64.NO_PADDING);
            String origin = "http://127.0.0.1:" + port;
            String launchUrl = origin + "/?token=" + token;
            File usr = new File(runtime, "usr");
            ProcessBuilder builder = new ProcessBuilder(new File(usr, "bin/node").toString(), "--expose-internals",
                modules.resolve("@deepseek-ai/dsh/lib/bin.js").toString(), "--profile", "web", "--host", "127.0.0.1", "--port", port);
            builder.directory(home);
            Map<String, String> env = builder.environment();
            env.put("DSH_HOME", new File(home, ".dsh").toString());
            env.put("DSCHAT_DOCUMENTS", documents.toString());
            env.put("HOME", home.toString());
            env.put("TMPDIR", tmp.toString());
            env.put("PREFIX", usr.toString());
            env.put("PATH", new File(usr, "bin") + ":/system/bin");
            env.put("LD_LIBRARY_PATH", new File(usr, "lib").toString());
            env.put("NODE_EXTRA_CA_CERTS", new File(usr, "etc/tls/cert.pem").toString());
            env.put("NODE_OPTIONS", "--max-old-space-size=1536 --require " + modules.resolve("android-platform-aliases.cjs"));
            env.put("DSH_LAUNCH_TOKEN", token);
            env.put("LANG", "C.UTF-8");
            builder.redirectErrorStream(true);
            status = "正在启动聊天…";
            if (closing) return;
            Process host = builder.start();
            process = host;
            // Drain without persisting console output, which can include a launch URL.
            new Thread(() -> drain(host.getInputStream()), "host-output").start();
            long deadline = android.os.SystemClock.elapsedRealtime() + 180000;
            while (!closing && host.isAlive() && android.os.SystemClock.elapsedRealtime() < deadline) {
                if (ready(launchUrl)) {
                    entry = launchUrl;
                    break;
                }
                Thread.sleep(400);
            }
            if (closing) return;
            if (entry == null && host.isAlive()) throw new IOException("聊天服务启动超时");
            throw new IOException("聊天服务已退出（" + host.waitFor() + "）");
        } catch (Exception e) {
            if (!closing) {
                status = "启动失败：" + e.getMessage();
                failed = true;
            }
        } finally {
            entry = null;
            Process current = process;
            if (current != null) current.destroy();
        }
    }

    private void installAsset(String asset, Path destination) throws IOException {
        Path staged = destination.resolveSibling(destination.getFileName() + ".tmp");
        try (InputStream in = getAssets().open(asset)) {
            Files.copy(in, staged, StandardCopyOption.REPLACE_EXISTING);
            Files.move(staged, destination, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
        }
    }
    private void unpack(File destination, String asset) throws Exception {
        Process tar = new ProcessBuilder("/system/bin/toybox", "tar", "xzf", "-", "-C", destination.toString())
            .redirectErrorStream(true).start();
        new Thread(() -> drain(tar.getInputStream()), "unpack-output").start();
        try (InputStream source = getAssets().open(asset); OutputStream out = tar.getOutputStream()) {
            byte[] buf = new byte[131072];
            int n;
            while ((n = source.read(buf)) != -1) {
                if (closing) throw new InterruptedIOException();
                out.write(buf, 0, n);
            }
        } finally {
            if (closing) tar.destroy();
        }
        if (tar.waitFor() != 0) throw new IOException("解压失败，请检查手机剩余空间后重试");
    }
    private static void drain(InputStream stream) {
        try (InputStream in = stream) { byte[] buf = new byte[8192]; while (in.read(buf) != -1) {} }
        catch (IOException ignored) {}
    }
    private static boolean ready(String launchUrl) {
        HttpURLConnection c = null;
        try {
            c = (HttpURLConnection) new URL(launchUrl).openConnection(Proxy.NO_PROXY);
            c.setInstanceFollowRedirects(false);
            c.setConnectTimeout(350); c.setReadTimeout(900);
            int status = c.getResponseCode();
            return status == 200 || status == 302 || status == 303 || status == 307;
        } catch (IOException ignored) { return false; }
        finally { if (c != null) c.disconnect(); }
    }
    private static void write(File dir, String name, String text) throws IOException {
        Files.write(new File(dir, name).toPath(), text.getBytes(StandardCharsets.UTF_8));
    }
    @Override public void onDestroy() {
        closing = true;
        if (process != null) process.destroy();
        if (worker != null) worker.interrupt();
        super.onDestroy();
    }
}
