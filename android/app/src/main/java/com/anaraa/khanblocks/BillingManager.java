package com.anaraa.khanblocks;

import android.app.Activity;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import com.android.billingclient.api.AcknowledgePurchaseParams;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClient.BillingResponseCode;
import com.android.billingclient.api.BillingClient.ProductType;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.ConsumeParams;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.PurchasesUpdatedListener;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryPurchasesParams;
import com.android.billingclient.api.UnfetchedProduct;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Google Play Billing (Play Billing Library 9) for one-time products: remove_ads and pass_* (non-consumable) and the
 * coin packs (consumable). The page decides when a purchase is granted (the server when online); this class only
 * launches the purchase flow, reports purchases, and acknowledges or consumes a purchase when the page says it was
 * granted. Pending payments are reported as pending and finished later (PurchasesUpdatedListener, or the restore the
 * page runs at start).
 */
final class BillingManager implements PurchasesUpdatedListener {
    private static final String TAG = "KhanBilling";

    private final Activity activity;
    private final NativeBridge bridge;
    private final BillingClient client;
    private final Handler main = new Handler(Looper.getMainLooper());
    private final Map<String, ProductDetails> details = new HashMap<>();
    // tokens Google Play reported in this session: only these may be acknowledged or consumed
    private final Set<String> knownTokens = Collections.synchronizedSet(new HashSet<>());
    private volatile String state = "connecting";
    private NativeBridge.Reply buying;
    private long retryMs = 2000;

    BillingManager(Activity activity, NativeBridge bridge) {
        this.activity = activity;
        this.bridge = bridge;
        this.client = BillingClient.newBuilder(activity)
                .setListener(this)
                .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
                // reconnects by itself after the Play service disconnects
                .enableAutoServiceReconnection()
                .build();
    }

    String state() {
        return state;
    }

    void start() {
        client.startConnection(new BillingClientStateListener() {
            @Override
            public void onBillingSetupFinished(BillingResult result) {
                int code = result.getResponseCode();
                if (code == BillingResponseCode.OK) {
                    retryMs = 2000;
                    setState("ready");
                } else if (code == BillingResponseCode.BILLING_UNAVAILABLE) {
                    setState("unavailable");          // no Play Store, Play Store blocked, or billing not supported here
                } else {
                    setState("connecting");
                    main.postDelayed(BillingManager.this::start, retryMs);
                    retryMs = Math.min(retryMs * 2, 60000);
                }
            }

            @Override
            public void onBillingServiceDisconnected() {
                // enableAutoServiceReconnection() connects again on the next call
                Log.i(TAG, "billing service disconnected");
            }
        });
    }

    void end() {
        client.endConnection();
    }

    /** On resume: purchases that finished while the app was away (a pending payment, a purchase from the Play Store). */
    void onResume() {
        if (!"ready".equals(state)) return;
        client.queryPurchasesAsync(QueryPurchasesParams.newBuilder().setProductType(ProductType.INAPP).build(), (result, list) -> {
            if (result.getResponseCode() != BillingResponseCode.OK || list == null) return;
            List<Purchase> open = new ArrayList<>();
            for (Purchase p : list) {
                if (p.getPurchaseState() == Purchase.PurchaseState.PURCHASED && !p.isAcknowledged()) open.add(p);
            }
            if (!open.isEmpty()) emitPurchases(open);
        });
    }

    private void setState(String s) {
        boolean changed = !s.equals(state);
        state = s;
        if (changed) bridge.emitState();
    }

    // ------------------------------------------------------------------ requests from the page

    void queryProducts(List<String> skus, NativeBridge.Reply reply) {
        List<QueryProductDetailsParams.Product> products = new ArrayList<>();
        for (String sku : skus) {
            products.add(QueryProductDetailsParams.Product.newBuilder().setProductId(sku).setProductType(ProductType.INAPP).build());
        }
        client.queryProductDetailsAsync(QueryProductDetailsParams.newBuilder().setProductList(products).build(), (result, res) -> {
            if (result.getResponseCode() != BillingResponseCode.OK || res == null) {
                reply.error(codeName(result.getResponseCode()));
                return;
            }
            JSONArray found = new JSONArray();
            JSONArray missing = new JSONArray();
            try {
                for (ProductDetails d : res.getProductDetailsList()) {
                    ProductDetails.OneTimePurchaseOfferDetails offer = d.getOneTimePurchaseOfferDetails();
                    if (offer == null) {
                        missing.put(d.getProductId());
                        continue;
                    }
                    synchronized (details) {
                        details.put(d.getProductId(), d);
                    }
                    found.put(new JSONObject()
                            .put("sku", d.getProductId())
                            .put("price", offer.getFormattedPrice())
                            .put("micros", offer.getPriceAmountMicros())
                            .put("currency", offer.getPriceCurrencyCode())
                            .put("title", d.getName()));
                }
                // not set up in Play Console, or not sold in the player's country
                for (UnfetchedProduct u : res.getUnfetchedProductList()) missing.put(u.getProductId());
                reply.ok(new JSONObject().put("products", found).put("missing", missing));
            } catch (JSONException e) {
                reply.error("json");
            }
        });
    }

    void buy(String sku, String accountId, NativeBridge.Reply reply) {
        ProductDetails d;
        synchronized (details) {
            d = details.get(sku);
        }
        if (d == null || d.getOneTimePurchaseOfferDetails() == null) {
            reply.ok(status("error", "not_loaded"));
            return;
        }
        if (buying != null) {
            reply.ok(status("error", "busy"));
            return;
        }
        BillingFlowParams.ProductDetailsParams.Builder item = BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(d);
        String offerToken = d.getOneTimePurchaseOfferDetails().getOfferToken();
        if (offerToken != null && !offerToken.isEmpty()) item.setOfferToken(offerToken);   // the offer whose price was shown
        BillingFlowParams.Builder flow = BillingFlowParams.newBuilder().setProductDetailsParamsList(Collections.singletonList(item.build()));
        if (!accountId.isEmpty()) flow.setObfuscatedAccountId(accountId);
        buying = reply;
        BillingResult r = client.launchBillingFlow(activity, flow.build());
        if (r.getResponseCode() != BillingResponseCode.OK) {
            buying = null;
            reply.ok(r.getResponseCode() == BillingResponseCode.ITEM_ALREADY_OWNED ? status("owned", null)
                    : r.getResponseCode() == BillingResponseCode.USER_CANCELED ? status("cancel", null)
                    : status("error", codeName(r.getResponseCode())));
        }
    }

    @Override
    public void onPurchasesUpdated(BillingResult result, List<Purchase> purchases) {
        main.post(() -> {
            NativeBridge.Reply reply = buying;
            buying = null;
            int code = result.getResponseCode();
            List<Purchase> list = purchases != null ? purchases : Collections.emptyList();
            if (reply == null) {
                // not from a buy() call: a pending payment went through, for example
                if (code == BillingResponseCode.OK && !list.isEmpty()) emitPurchases(list);
                return;
            }
            if (code == BillingResponseCode.OK) {
                boolean purchased = false;
                for (Purchase p : list) purchased |= p.getPurchaseState() == Purchase.PurchaseState.PURCHASED;
                JSONObject d = status(purchased ? "ok" : list.isEmpty() ? "error" : "pending", null);
                try {
                    d.put("purchases", toJson(list));
                } catch (JSONException ignored) {
                    // fixed key
                }
                reply.ok(d);
            } else if (code == BillingResponseCode.USER_CANCELED) {
                reply.ok(status("cancel", null));
            } else if (code == BillingResponseCode.ITEM_ALREADY_OWNED) {
                reply.ok(status("owned", null));
            } else {
                reply.ok(status("error", codeName(code)));
            }
        });
    }

    /** What Play still has: unconsumed coin packs, owned non-consumables, pending payments (restore). */
    void queryPurchases(NativeBridge.Reply reply) {
        client.queryPurchasesAsync(QueryPurchasesParams.newBuilder().setProductType(ProductType.INAPP).build(), (result, list) -> {
            if (result.getResponseCode() != BillingResponseCode.OK) {
                reply.error(codeName(result.getResponseCode()));
                return;
            }
            try {
                reply.ok(new JSONObject().put("purchases", toJson(list != null ? list : Collections.emptyList())));
            } catch (JSONException e) {
                reply.error("json");
            }
        });
    }

    /** After the grant: consume a coin pack (it can be bought again) or acknowledge the rest (else Play refunds it in 3 days). */
    void finish(String token, boolean consume, NativeBridge.Reply reply) {
        if (!knownTokens.contains(token)) {
            reply.error("unknown_token");
            return;
        }
        if (consume) {
            client.consumeAsync(ConsumeParams.newBuilder().setPurchaseToken(token).build(), (result, t) -> {
                if (result.getResponseCode() == BillingResponseCode.OK) reply.ok(done());
                else reply.error(codeName(result.getResponseCode()));
            });
        } else {
            client.acknowledgePurchase(AcknowledgePurchaseParams.newBuilder().setPurchaseToken(token).build(), result -> {
                if (result.getResponseCode() == BillingResponseCode.OK) reply.ok(done());
                else reply.error(codeName(result.getResponseCode()));
            });
        }
    }

    // ------------------------------------------------------------------ helpers

    private void emitPurchases(List<Purchase> list) {
        try {
            bridge.emit("purchases", new JSONObject().put("purchases", toJson(list)));
        } catch (JSONException ignored) {
            // fixed key
        }
    }

    private JSONArray toJson(List<Purchase> list) {
        JSONArray out = new JSONArray();
        for (Purchase p : list) {
            List<String> products = p.getProducts();
            if (products == null || products.isEmpty()) continue;
            knownTokens.add(p.getPurchaseToken());
            int st = p.getPurchaseState();
            try {
                out.put(new JSONObject()
                        .put("token", p.getPurchaseToken())
                        .put("sku", products.get(0))
                        .put("orderId", p.getOrderId() != null ? p.getOrderId() : "")
                        .put("state", st == Purchase.PurchaseState.PURCHASED ? "purchased" : st == Purchase.PurchaseState.PENDING ? "pending" : "unknown")
                        .put("acknowledged", p.isAcknowledged())
                        .put("time", p.getPurchaseTime())
                        .put("quantity", p.getQuantity()));
            } catch (JSONException ignored) {
                // fixed keys
            }
        }
        return out;
    }

    private static JSONObject status(String status, String code) {
        JSONObject d = new JSONObject();
        try {
            d.put("status", status);
            if (code != null) d.put("code", code);
        } catch (JSONException ignored) {
            // fixed keys
        }
        return d;
    }

    private static JSONObject done() {
        JSONObject d = new JSONObject();
        try {
            d.put("done", true);
        } catch (JSONException ignored) {
            // fixed key
        }
        return d;
    }

    static String codeName(int code) {
        switch (code) {
            case BillingResponseCode.OK: return "ok";
            case BillingResponseCode.USER_CANCELED: return "cancel";
            case BillingResponseCode.SERVICE_UNAVAILABLE: return "service_unavailable";
            case BillingResponseCode.BILLING_UNAVAILABLE: return "billing_unavailable";
            case BillingResponseCode.ITEM_UNAVAILABLE: return "item_unavailable";
            case BillingResponseCode.DEVELOPER_ERROR: return "developer_error";
            case BillingResponseCode.ITEM_ALREADY_OWNED: return "item_already_owned";
            case BillingResponseCode.ITEM_NOT_OWNED: return "item_not_owned";
            case BillingResponseCode.NETWORK_ERROR: return "network_error";
            case BillingResponseCode.SERVICE_DISCONNECTED: return "service_disconnected";
            case BillingResponseCode.FEATURE_NOT_SUPPORTED: return "feature_not_supported";
            default: return "error";
        }
    }
}
