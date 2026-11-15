package com.anaraa.khanblocks;

import android.os.Handler;
import android.os.Looper;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.regex.Pattern;

/**
 * The JavaScript interface "KhanNative" that the game page talks to (src/js/54-native.js).
 *
 * <p>JS calls {@link #info()} (state now, as JSON) and {@link #post(String)} with {id, op, args}. Every request is
 * checked here before anything runs; the answer comes back later through the page's single dispatcher,
 * window.__khanNative(json), with {id, ok, data} or {id, ok: false, error}. Events (state changes, purchases that
 * finish outside a purchase flow) use the same dispatcher as {event, data}.
 *
 * <p>Only the bundled page (file:///android_asset/index.html) may use it: MainActivity tells the bridge which page is
 * loaded and refuses to navigate anywhere else.
 */
final class NativeBridge {
    static final String NAME = "KhanNative";
    static final String PAGE = "file:///android_asset/index.html";

    private static final Pattern SKU = Pattern.compile("remove_ads|coins_(small|medium|large)|pass_[a-z0-9]{1,16}");
    private static final Pattern TOKEN = Pattern.compile("[A-Za-z0-9._:-]{10,4096}");
    private static final Pattern REF = Pattern.compile("[A-Za-z0-9_.:-]{1,64}");
    private static final Pattern UUID = Pattern.compile("[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}");

    private final WebView webView;
    private final Handler main = new Handler(Looper.getMainLooper());
    private volatile boolean trusted;
    private AdsManager ads;
    private BillingManager billing;

    NativeBridge(WebView webView) {
        this.webView = webView;
    }

    void attach(AdsManager ads, BillingManager billing) {
        this.ads = ads;
        this.billing = billing;
    }

    /** Called by MainActivity's WebViewClient for every page that starts loading. */
    void pageStarted(String url) {
        trusted = PAGE.equals(url);
    }

    // ------------------------------------------------------------------ called from JavaScript (JavaBridge thread)

    @JavascriptInterface
    public String info() {
        return trusted ? state().toString() : "{}";
    }

    @JavascriptInterface
    public String post(String message) {
        if (!trusted) return "untrusted";
        if (message == null || message.length() > 8192) return "bad_request";
        final JSONObject m;
        try {
            m = new JSONObject(message);
        } catch (JSONException e) {
            return "bad_request";
        }
        final int id = m.optInt("id", 0);
        final String op = m.optString("op", "");
        final JSONObject args = m.optJSONObject("args") != null ? m.optJSONObject("args") : new JSONObject();
        if (id <= 0) return "bad_request";
        switch (op) {
            case "products": case "buy": case "purchases": case "finish":
            case "rewarded": case "interstitial": case "privacy":
                break;
            default:
                return "unknown_op";
        }
        main.post(() -> dispatch(new Reply(id), op, args));
        return "ok";
    }

    // ------------------------------------------------------------------ checked requests, on the main thread

    private void dispatch(Reply reply, String op, JSONObject a) {
        try {
            switch (op) {
                case "products":
                    billing.queryProducts(skus(a.optJSONArray("skus")), reply);
                    break;
                case "buy":
                    billing.buy(match(SKU, a.optString("sku", "")), accountId(a.optString("account", "")), reply);
                    break;
                case "purchases":
                    billing.queryPurchases(reply);
                    break;
                case "finish":
                    billing.finish(match(TOKEN, a.optString("token", "")), a.optBoolean("consume", false), reply);
                    break;
                case "rewarded": {
                    String placement = a.optString("placement", "");
                    if (!"free_coins".equals(placement) && !"double_coins".equals(placement)) throw new IllegalArgumentException();
                    ads.showRewarded(placement, match(REF, a.optString("ref", "")), reply);
                    break;
                }
                case "interstitial":
                    ads.showInterstitial(reply);
                    break;
                case "privacy":
                    ads.showPrivacyOptions(reply);
                    break;
                default:
                    reply.error("unknown_op");
            }
        } catch (IllegalArgumentException e) {
            reply.error("bad_request");
        }
    }

    private static String match(Pattern p, String v) {
        if (v == null || !p.matcher(v).matches()) throw new IllegalArgumentException();
        return v;
    }

    private static List<String> skus(JSONArray list) {
        if (list == null || list.length() == 0 || list.length() > 20) throw new IllegalArgumentException();
        List<String> out = new ArrayList<>();
        for (int i = 0; i < list.length(); i++) {
            String s = match(SKU, list.optString(i, ""));
            if (!out.contains(s)) out.add(s);
        }
        return out;
    }

    /**
     * The id Google Play keeps with the purchase (setObfuscatedAccountId): SHA-256 of the player's Supabase user id,
     * 64 hex characters, so the verify-purchase function can check whose purchase it is without Play seeing the id.
     */
    static String accountId(String userId) {
        if (userId == null || userId.isEmpty()) return "";
        if (!UUID.matcher(userId).matches()) throw new IllegalArgumentException();
        try {
            byte[] h = MessageDigest.getInstance("SHA-256").digest(userId.toLowerCase(Locale.ROOT).getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : h) sb.append(String.format(Locale.ROOT, "%02x", b & 0xff));
            return sb.toString();
        } catch (Exception e) {
            return "";
        }
    }

    // ------------------------------------------------------------------ answers and events back to the page

    JSONObject state() {
        JSONObject s = new JSONObject();
        try {
            s.put("v", 1);
            s.put("platform", "android");
            s.put("app", BuildConfig.VERSION_NAME);
            s.put("billing", billing != null ? billing.state() : "connecting");
            s.put("ads", ads != null ? ads.state() : new JSONObject());
        } catch (JSONException ignored) {
            // only fixed keys and simple values
        }
        return s;
    }

    /** Sends the current state to the page (after consent, billing or ad availability changes); any thread. */
    void emitState() {
        main.post(() -> emit("state", state()));
    }

    void emit(String event, JSONObject data) {
        JSONObject m = new JSONObject();
        try {
            m.put("event", event);
            m.put("data", data);
        } catch (JSONException ignored) {
            return;
        }
        send(m);
    }

    private void send(JSONObject message) {
        // JSONObject.quote makes it a safe JavaScript string literal; the page parses it again
        final String js = "window.__khanNative&&window.__khanNative(" + JSONObject.quote(message.toString()) + ")";
        main.post(() -> {
            if (trusted) webView.evaluateJavascript(js, null);
        });
    }

    /** One answer per request, from any thread. */
    final class Reply {
        private final int id;
        private final AtomicBoolean done = new AtomicBoolean(false);

        Reply(int id) {
            this.id = id;
        }

        void ok(JSONObject data) {
            if (done.getAndSet(true)) return;
            JSONObject m = new JSONObject();
            try {
                m.put("id", id);
                m.put("ok", true);
                m.put("data", data != null ? data : new JSONObject());
            } catch (JSONException ignored) {
                return;
            }
            send(m);
        }

        /** A request that ended with a status the page handles ({status: ...}), not an error. */
        void status(String status) {
            JSONObject d = new JSONObject();
            try {
                d.put("status", status);
            } catch (JSONException ignored) {
                // fixed key
            }
            ok(d);
        }

        void error(String code) {
            if (done.getAndSet(true)) return;
            JSONObject m = new JSONObject();
            try {
                m.put("id", id);
                m.put("ok", false);
                m.put("error", code);
            } catch (JSONException ignored) {
                return;
            }
            send(m);
        }
    }
}
