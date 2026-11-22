package eu.letopis.app;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.text.InputType;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;

import org.json.JSONArray;
import org.json.JSONObject;

/** The game itself, from the server at home, in a full-screen web view. */
public class MainActivity extends Activity {
    private WebView web;
    private SharedPreferences prefs;
    private boolean asking;

    @Override
    protected void onCreate(Bundle saved) {
        super.onCreate(saved);
        // the screen stays on while the game is in front (the flag only holds while the window is shown)
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        prefs = getSharedPreferences(News.PREFS, Context.MODE_PRIVATE);
        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#0F1620"));
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(true);
        web.addJavascriptInterface(new Bridge(), "LetopisApp");
        web.setWebViewClient(new WebViewClient() {
            @Override
            public void onReceivedError(WebView view, WebResourceRequest req, WebResourceError err) {
                if (req.isForMainFrame()) offline();
            }
        });
        setContentView(web, new FrameLayout.LayoutParams(-1, -1));
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[] { Manifest.permission.POST_NOTIFICATIONS }, 1);
        }
        News.schedule(this);
        if (saved != null) web.restoreState(saved);
        else open();
    }

    // in the background the page goes quiet (the page stops its music and sounds when it is hidden)
    @Override
    protected void onPause() {
        super.onPause();
        web.evaluateJavascript("window.letopisHold && letopisHold(true)", null);
        web.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
        web.evaluateJavascript("window.letopisHold && letopisHold(false)", null);
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    private void open() {
        String server = prefs.getString("server", "");
        if (server.isEmpty()) askServer();
        else web.loadUrl(server + "/");
    }

    /** the saved servers, each {name, url}; an app from before the list has only "server" */
    private JSONArray servers() {
        JSONArray a;
        try { a = new JSONArray(prefs.getString("servers", "[]")); } catch (Exception e) { a = new JSONArray(); }
        String cur = prefs.getString("server", "");
        if (a.length() == 0 && !cur.isEmpty()) {
            a.put(entry(shortName(cur), cur));
            prefs.edit().putString("servers", a.toString()).apply();
        }
        return a;
    }

    private static JSONObject entry(String name, String url) {
        JSONObject o = new JSONObject();
        try { o.put("name", name).put("url", url); } catch (Exception ignored) { }
        return o;
    }

    private static String shortName(String url) {
        return url.replaceFirst("^https?://", "");
    }

    /** to another world; each server keeps its own place in the chronicle, so going back brings no old news */
    private void use(String url) {
        String cur = prefs.getString("server", "");
        if (url.equals(cur)) { open(); return; }
        SharedPreferences.Editor e = prefs.edit().putString("server", url);
        if (!cur.isEmpty()) {
            for (String k : new String[] { "last", "lastMars" }) {
                if (prefs.contains(k)) e.putLong(k + "@" + cur, prefs.getLong(k, -1)); else e.remove(k + "@" + cur);
            }
        }
        for (String k : new String[] { "last", "lastMars" }) {
            if (prefs.contains(k + "@" + url)) e.putLong(k, prefs.getLong(k + "@" + url, -1)); else e.remove(k);
        }
        e.apply();
        open();
    }

    /** the first start, or the player wants another world: the saved servers, or a new one */
    private void askServer() {
        if (asking) return;
        JSONArray a = servers();
        if (a.length() == 0) { addServer(); return; }
        asking = true;
        String cur = prefs.getString("server", "");
        String[] items = new String[a.length() + 1];
        for (int i = 0; i < a.length(); i++) {
            JSONObject o = a.optJSONObject(i);
            String url = o.optString("url");
            String name = o.optString("name", shortName(url));
            items[i] = (url.equals(cur) ? "✓ " : "    ") + name + (name.equals(shortName(url)) ? "" : "  (" + shortName(url) + ")");
        }
        items[a.length()] = getString(R.string.add);
        AlertDialog.Builder b = new AlertDialog.Builder(this)
            .setTitle(R.string.server_title)
            .setItems(items, (d, w) -> {
                if (w == a.length()) { asking = false; addServer(); }
                else use(a.optJSONObject(w).optString("url"));
            })
            .setCancelable(!cur.isEmpty())
            .setOnDismissListener(d -> asking = false);
        if (a.length() > 1) b.setNeutralButton(R.string.remove, (d, w) -> { asking = false; removeServer(); });
        if (!cur.isEmpty()) b.setNegativeButton(R.string.cancel, null);
        b.show();
    }

    private void addServer() {
        if (asking) return;
        asking = true;
        int pad = (int) (20 * getResources().getDisplayMetrics().density);
        EditText in = new EditText(this);
        in.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI);
        in.setHint(R.string.server_hint);
        EditText name = new EditText(this);
        name.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_CAP_SENTENCES);
        name.setHint(R.string.name_hint);
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setPadding(pad, pad / 2, pad, 0);
        box.addView(in);
        box.addView(name);
        boolean first = servers().length() == 0;
        AlertDialog.Builder b = new AlertDialog.Builder(this)
            .setTitle(R.string.server_title)
            .setMessage(R.string.server_text)
            .setView(box)
            .setCancelable(!first)
            .setPositiveButton(R.string.ok, (d, w) -> {
                String v = in.getText().toString().trim().replaceAll("/+$", "");
                if (v.isEmpty()) { if (first) { asking = false; addServer(); } return; }
                if (!v.matches("^https?://.*")) v = "http://" + v;
                String n = name.getText().toString().trim();
                JSONArray a = servers();
                JSONArray out = new JSONArray();
                for (int i = 0; i < a.length(); i++) {
                    if (!a.optJSONObject(i).optString("url").equals(v)) out.put(a.optJSONObject(i));
                }
                out.put(entry(n.isEmpty() ? shortName(v) : n, v));
                prefs.edit().putString("servers", out.toString()).apply();
                use(v);
            })
            .setOnDismissListener(d -> asking = false);
        if (!first) b.setNegativeButton(R.string.cancel, null);
        b.show();
    }

    private void removeServer() {
        if (asking) return;
        asking = true;
        JSONArray a = servers();
        String cur = prefs.getString("server", "");
        String[] items = new String[a.length()];
        for (int i = 0; i < a.length(); i++) items[i] = a.optJSONObject(i).optString("name");
        new AlertDialog.Builder(this)
            .setTitle(R.string.remove)
            .setItems(items, (d, w) -> {
                String url = a.optJSONObject(w).optString("url");
                JSONArray out = new JSONArray();
                for (int i = 0; i < a.length(); i++) if (i != w) out.put(a.optJSONObject(i));
                prefs.edit().putString("servers", out.toString()).remove("last@" + url).remove("lastMars@" + url).apply();
                asking = false;
                if (url.equals(cur)) use(out.optJSONObject(0).optString("url"));
            })
            .setNegativeButton(R.string.cancel, null)
            .setOnDismissListener(d -> asking = false)
            .show();
    }

    private void offline() {
        if (asking) return;
        asking = true;
        new AlertDialog.Builder(this)
            .setTitle(R.string.app_name)
            .setMessage(R.string.offline)
            .setCancelable(false)
            .setPositiveButton(R.string.retry, (d, w) -> web.reload())
            .setNeutralButton(R.string.change, (d, w) -> { asking = false; askServer(); })
            .setOnDismissListener(d -> asking = false)
            .show();
    }

    @Override
    public void onBackPressed() {
        if (web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    /** what the page can ask the app: the notification choices and another server */
    private class Bridge {
        @JavascriptInterface
        public String getPrefs() {
            return prefs.getString("news", "");
        }

        @JavascriptInterface
        public void setPrefs(String json) {
            prefs.edit().putString("news", json).apply();
        }

        @JavascriptInterface
        public void changeServer() {
            runOnUiThread(MainActivity.this::askServer);
        }

        /** the name of the server being watched, for the button in the page */
        @JavascriptInterface
        public String serverName() {
            String cur = prefs.getString("server", "");
            JSONArray a = servers();
            for (int i = 0; i < a.length(); i++) {
                if (a.optJSONObject(i).optString("url").equals(cur)) return a.optJSONObject(i).optString("name");
            }
            return shortName(cur);
        }
    }
}
