package com.anaraa.khanblocks;

import android.app.Activity;
import android.util.Log;

import com.google.android.libraries.ads.mobile.sdk.MobileAds;
import com.google.android.libraries.ads.mobile.sdk.common.AdRequest;
import com.google.android.libraries.ads.mobile.sdk.common.FullScreenContentError;
import com.google.android.libraries.ads.mobile.sdk.common.LoadAdError;
import com.google.android.libraries.ads.mobile.sdk.common.PreloadCallback;
import com.google.android.libraries.ads.mobile.sdk.common.PreloadConfiguration;
import com.google.android.libraries.ads.mobile.sdk.common.RequestConfiguration;
import com.google.android.libraries.ads.mobile.sdk.common.ResponseInfo;
import com.google.android.libraries.ads.mobile.sdk.initialization.InitializationConfig;
import com.google.android.libraries.ads.mobile.sdk.interstitial.InterstitialAd;
import com.google.android.libraries.ads.mobile.sdk.interstitial.InterstitialAdEventCallback;
import com.google.android.libraries.ads.mobile.sdk.interstitial.InterstitialAdPreloader;
import com.google.android.libraries.ads.mobile.sdk.rewarded.RewardedAd;
import com.google.android.libraries.ads.mobile.sdk.rewarded.RewardedAdEventCallback;
import com.google.android.libraries.ads.mobile.sdk.rewarded.RewardedAdPreloader;
import com.google.android.ump.ConsentDebugSettings;
import com.google.android.ump.ConsentInformation;
import com.google.android.ump.ConsentRequestParameters;
import com.google.android.ump.UserMessagingPlatform;

import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * AdMob through the GMA Next-Gen SDK, with Google's UMP consent first.
 *
 * <p>At start the UMP SDK updates the consent information and shows the consent form where the law requires it
 * (EEA, UK, Switzerland). Only when {@code canRequestAds()} is true is the ads SDK initialized and are ads preloaded
 * (one rewarded and one interstitial preloader). When to show an ad is decided by the page (src/js/55-store.js); this
 * class only shows a preloaded ad and reports how it ended. The ad unit IDs come from BuildConfig: Google's public test
 * IDs unless the release build got real ones from GitHub secrets (android/app/build.gradle).
 *
 * <p>The Next-Gen SDK calls its callbacks on a background thread, so results go back through the bridge, which
 * posts to the main thread.
 */
final class AdsManager {
    private static final String TAG = "KhanAds";

    private final Activity activity;
    private final NativeBridge bridge;
    private final ConsentInformation consent;
    private final AtomicBoolean started = new AtomicBoolean(false);
    private volatile boolean ready;
    private volatile boolean showing;

    AdsManager(Activity activity, NativeBridge bridge) {
        this.activity = activity;
        this.bridge = bridge;
        this.consent = UserMessagingPlatform.getConsentInformation(activity);
    }

    /** Main thread, from MainActivity.onCreate. Consent information must be updated on every app start. */
    void start() {
        ConsentRequestParameters.Builder params = new ConsentRequestParameters.Builder();
        if (BuildConfig.UMP_DEBUG_EEA) {
            // debug builds only (build.gradle): behave as if in the EEA, to see the consent form while testing
            ConsentDebugSettings.Builder debug = new ConsentDebugSettings.Builder(activity)
                    .setDebugGeography(ConsentDebugSettings.DebugGeography.DEBUG_GEOGRAPHY_EEA);
            if (!BuildConfig.ADS_TEST_DEVICE.isEmpty()) debug.addTestDeviceHashedId(BuildConfig.ADS_TEST_DEVICE);
            params.setConsentDebugSettings(debug.build());
        }
        consent.requestConsentInfoUpdate(activity, params.build(),
                () -> UserMessagingPlatform.loadAndShowConsentFormIfRequired(activity, formError -> afterConsent()),
                requestError -> {
                    Log.w(TAG, "consent info update failed: " + requestError.getMessage());
                    afterConsent();
                });
        // consent given in an earlier session lets ads load at once
        if (consent.canRequestAds()) initSdk();
    }

    private void afterConsent() {
        bridge.emitState();
        if (consent.canRequestAds()) initSdk();
    }

    private void initSdk() {
        if (started.getAndSet(true)) return;
        new Thread(() -> {
            List<String> testDevices = new ArrayList<>();
            if (!BuildConfig.ADS_TEST_DEVICE.isEmpty()) testDevices.add(BuildConfig.ADS_TEST_DEVICE);
            RequestConfiguration requests = new RequestConfiguration.Builder()
                    // the game is for ages 13 and up (docs/LAUNCH.md): ads suitable for teens at most
                    .setMaxAdContentRating(RequestConfiguration.MaxAdContentRating.MAX_AD_CONTENT_RATING_T)
                    .setTestDeviceIds(testDevices)
                    .build();
            // on a background thread, as the SDK asks (it may block)
            MobileAds.initialize(activity,
                    new InitializationConfig.Builder(BuildConfig.ADMOB_APP_ID).setRequestConfiguration(requests).build(),
                    status -> startPreloading());
        }, "ads-init").start();
    }

    private void startPreloading() {
        PreloadCallback callback = new PreloadCallback() {
            @Override
            public void onAdPreloaded(String preloadId, ResponseInfo responseInfo) {
                bridge.emitState();
            }

            @Override
            public void onAdsExhausted(String preloadId) {
                bridge.emitState();
            }

            @Override
            public void onAdFailedToPreload(String preloadId, LoadAdError adError) {
                // the preloader retries by itself
                Log.i(TAG, "preload failed for " + preloadId + ": " + adError.getMessage());
            }
        };
        RewardedAdPreloader.start(BuildConfig.ADMOB_REWARDED_ID,
                new PreloadConfiguration(new AdRequest.Builder(BuildConfig.ADMOB_REWARDED_ID).build()), callback);
        InterstitialAdPreloader.start(BuildConfig.ADMOB_INTERSTITIAL_ID,
                new PreloadConfiguration(new AdRequest.Builder(BuildConfig.ADMOB_INTERSTITIAL_ID).build()), callback);
        ready = true;
        bridge.emitState();
    }

    JSONObject state() {
        JSONObject s = new JSONObject();
        try {
            s.put("canRequest", consent.canRequestAds());
            s.put("privacyRequired", consent.getPrivacyOptionsRequirementStatus()
                    == ConsentInformation.PrivacyOptionsRequirementStatus.REQUIRED);
            s.put("rewarded", ready && RewardedAdPreloader.isAdAvailable(BuildConfig.ADMOB_REWARDED_ID));
            s.put("interstitial", ready && InterstitialAdPreloader.isAdAvailable(BuildConfig.ADMOB_INTERSTITIAL_ID));
            s.put("test", BuildConfig.ADS_TEST);
        } catch (JSONException ignored) {
            // fixed keys
        }
        return s;
    }

    // ------------------------------------------------------------------ requests from the page (main thread)

    /** A rewarded ad the player asked for. Answers "earned" (watched to the reward), "closed" or "unavailable". */
    void showRewarded(String placement, String ref, NativeBridge.Reply reply) {
        if (!ready || showing || !consent.canRequestAds()) {
            reply.status("unavailable");
            return;
        }
        RewardedAd ad = RewardedAdPreloader.pollAd(BuildConfig.ADMOB_REWARDED_ID);
        if (ad == null) {
            reply.status("unavailable");
            return;
        }
        Log.i(TAG, "rewarded ad for " + placement + " " + ref);
        AtomicBoolean earned = new AtomicBoolean(false);
        ad.setAdEventCallback(new RewardedAdEventCallback() {
            @Override
            public void onAdDismissedFullScreenContent() {
                showing = false;
                reply.status(earned.get() ? "earned" : "closed");
                bridge.emitState();
            }

            @Override
            public void onAdFailedToShowFullScreenContent(FullScreenContentError error) {
                showing = false;
                reply.status("unavailable");
                bridge.emitState();
            }
        });
        showing = true;
        ad.show(activity, rewardItem -> earned.set(true));
    }

    /** An ad between matches; the page has already applied the pacing rules. Answers "shown" once it is closed. */
    void showInterstitial(NativeBridge.Reply reply) {
        if (!ready || showing || !consent.canRequestAds()) {
            reply.status("unavailable");
            return;
        }
        InterstitialAd ad = InterstitialAdPreloader.pollAd(BuildConfig.ADMOB_INTERSTITIAL_ID);
        if (ad == null) {
            reply.status("unavailable");
            return;
        }
        ad.setAdEventCallback(new InterstitialAdEventCallback() {
            @Override
            public void onAdDismissedFullScreenContent() {
                showing = false;
                reply.status("shown");
                bridge.emitState();
            }

            @Override
            public void onAdFailedToShowFullScreenContent(FullScreenContentError error) {
                showing = false;
                reply.status("unavailable");
                bridge.emitState();
            }
        });
        showing = true;
        ad.show(activity);
    }

    /** Settings → "Privacy and ad choices": the UMP privacy options form (shown only when it is required). */
    void showPrivacyOptions(NativeBridge.Reply reply) {
        UserMessagingPlatform.showPrivacyOptionsForm(activity, formError -> {
            JSONObject d = new JSONObject();
            try {
                d.put("status", formError == null ? "closed" : "error");
                d.put("state", bridge.state());
            } catch (JSONException ignored) {
                // fixed keys
            }
            reply.ok(d);
            bridge.emitState();
            if (consent.canRequestAds()) initSdk();
        });
    }
}
