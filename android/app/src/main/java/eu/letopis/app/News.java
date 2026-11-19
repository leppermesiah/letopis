package eu.letopis.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

import androidx.annotation.NonNull;
import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.TimeUnit;

/** About every 15 minutes, even with the app closed: what happened in the world, as notifications. */
public class News extends Worker {
    static final String PREFS = "letopis";
    private static final String CHANNEL = "chronicle";
    /** more than this at once would only be noise: the newest ones are shown */
    private static final int MAX = 5;

    public News(@NonNull Context c, @NonNull WorkerParameters p) {
        super(c, p);
    }

    static void schedule(Context c) {
        PeriodicWorkRequest req = new PeriodicWorkRequest.Builder(News.class, 15, TimeUnit.MINUTES)
            .setConstraints(new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
            .build();
        WorkManager.getInstance(c).enqueueUniquePeriodicWork("news", ExistingPeriodicWorkPolicy.KEEP, req);
    }

    @NonNull
    @Override
    public Result doWork() {
        SharedPreferences p = getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String server = p.getString("server", "");
        try {
            JSONObject o = new JSONObject(p.getString("news", "{}"));
            if (server.isEmpty() || !o.optBoolean("on", true)) return Result.success();
            JSONArray k = o.optJSONArray("kinds");
            if (k == null || k.length() == 0) return Result.success();
            StringBuilder kinds = new StringBuilder();
            for (int i = 0; i < k.length(); i++) kinds.append(i > 0 ? "," : "").append(k.getString(i));
            String q = "?lang=" + URLEncoder.encode(o.optString("lang", "bg"), "UTF-8")
                + "&kids=" + (o.optBoolean("kids") ? "1" : "0")
                + "&kinds=" + URLEncoder.encode(kinds.toString(), "UTF-8");
            look(p, server + "/api/news" + q, "last");
            if (o.optBoolean("mars", true)) look(p, server + "/mars/api/news" + q, "lastMars");
            return Result.success();
        } catch (Exception e) {
            return Result.retry();
        }
    }

    private void look(SharedPreferences p, String url, String key) throws Exception {
        long last = p.getLong(key, -1);
        HttpURLConnection c = (HttpURLConnection) new URL(last < 0 ? url : url + "&after=" + last).openConnection();
        c.setConnectTimeout(10000);
        c.setReadTimeout(15000);
        try {
            if (c.getResponseCode() != 200) return; // Mars may still be empty
            JSONObject res = new JSONObject(read(c.getInputStream()));
            JSONArray items = res.getJSONArray("items");
            for (int i = Math.max(0, items.length() - MAX); i < items.length(); i++) {
                JSONObject it = items.getJSONObject(i);
                show(it.getLong("id") + (key.equals("lastMars") ? 1L << 40 : 0), it.getString("title"), it.getString("text"));
            }
            p.edit().putLong(key, res.getLong("last")).apply();
        } finally {
            c.disconnect();
        }
    }

    private static String read(InputStream in) throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buf = new byte[8192];
        for (int n; (n = in.read(buf)) > 0; ) out.write(buf, 0, n);
        return out.toString(StandardCharsets.UTF_8.name());
    }

    private void show(long id, String title, String text) {
        Context c = getApplicationContext();
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        if (nm.getNotificationChannel(CHANNEL) == null) {
            NotificationChannel ch = new NotificationChannel(CHANNEL, c.getString(R.string.channel), NotificationManager.IMPORTANCE_DEFAULT);
            ch.setDescription(c.getString(R.string.channel_text));
            nm.createNotificationChannel(ch);
        }
        PendingIntent open = PendingIntent.getActivity(c, 0, new Intent(c, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
            PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        Notification n = new Notification.Builder(c, CHANNEL)
            .setSmallIcon(R.drawable.ic_notify)
            .setContentTitle(title)
            .setContentText(text)
            .setStyle(new Notification.BigTextStyle().bigText(text))
            .setContentIntent(open)
            .setAutoCancel(true)
            .setGroup("chronicle")
            .build();
        nm.notify((int) (id ^ (id >>> 32)), n);
    }
}
