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
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.EditText;
import android.widget.FrameLayout;

/** The game itself, from the server at home, in a full-screen web view. */
public class MainActivity extends Activity {
    private WebView web;
    private SharedPreferences prefs;
    private boolean asking;

    @Override
    protected void onCreate(Bundle saved) {
        super.onCreate(saved);
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

    /** the first start, or the player wants another world */
    private void askServer() {
        if (asking) return;
        asking = true;
        EditText in = new EditText(this);
        in.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI);
        in.setHint(R.string.server_hint);
        in.setText(prefs.getString("server", "").replaceFirst("^http://", ""));
        FrameLayout box = new FrameLayout(this);
        int pad = (int) (20 * getResources().getDisplayMetrics().density);
        box.setPadding(pad, pad / 2, pad, 0);
        box.addView(in);
        AlertDialog.Builder b = new AlertDialog.Builder(this)
            .setTitle(R.string.server_title)
            .setMessage(R.string.server_text)
            .setView(box)
            .setCancelable(!prefs.getString("server", "").isEmpty())
            .setPositiveButton(R.string.ok, (d, w) -> {
                String v = in.getText().toString().trim().replaceAll("/+$", "");
                if (!v.matches("^https?://.*")) v = "http://" + v;
                if (!v.equals(prefs.getString("server", ""))) {
                    // another world: its chronicle starts from now
                    prefs.edit().putString("server", v).remove("last").remove("lastMars").apply();
                }
                open();
            })
            .setOnDismissListener(d -> asking = false);
        if (!prefs.getString("server", "").isEmpty()) b.setNegativeButton(R.string.cancel, null);
        b.show();
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
    }
}
