package com.qureocity.app;

import android.content.res.Configuration;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.ColorFilter;
import android.graphics.Paint;
import android.graphics.PixelFormat;
import android.graphics.Rect;
import android.graphics.drawable.Drawable;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.webkit.WebView;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.core.graphics.ColorUtils;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

/**
 * Hosts the QureoCity web app.
 *
 * The window is drawn edge-to-edge and the page is padded clear of the
 * status bar, navigation bar and keyboard. The strips behind the two system
 * bars are painted by {@link SystemBarsBackground} in whatever colours the
 * page reports through {@link SystemBarColorsPlugin}, so the bars always
 * match the screen underneath them, on every Android version (Android 15+
 * no longer lets apps colour the bars directly).
 */
public class MainActivity extends BridgeActivity {

    private final SystemBarsBackground barsBackground = new SystemBarsBackground();
    private int statusBarColor = Color.WHITE;
    private int navigationBarColor = Color.WHITE;
    private int bottomInsetCssPx = 0;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(SystemBarColorsPlugin.class);
        super.onCreate(savedInstanceState);

        Window window = getWindow();
        WindowCompat.setDecorFitsSystemWindows(window, false);
        window.setStatusBarColor(Color.TRANSPARENT);
        window.setNavigationBarColor(Color.TRANSPARENT);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            // Otherwise Android adds its own translucent scrim over the bars.
            window.setStatusBarContrastEnforced(false);
            window.setNavigationBarContrastEnforced(false);
        }

        View content = findViewById(android.R.id.content);
        content.setBackground(barsBackground);
        ViewCompat.setOnApplyWindowInsetsListener(content, (v, insets) -> {
            Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            Insets ime = insets.getInsets(WindowInsetsCompat.Type.ime());
            boolean keyboardOpen = insets.isVisible(WindowInsetsCompat.Type.ime());
            // The page runs underneath the navigation bar (no seam below the
            // floating menu); it is told how tall that bar is via a CSS
            // variable so it can keep its buttons clear of it. With the
            // keyboard open the page simply ends above the keyboard.
            v.setPadding(bars.left, bars.top, bars.right, keyboardOpen ? ime.bottom : 0);
            barsBackground.setTopHeight(bars.top);
            float density = getResources().getDisplayMetrics().density;
            bottomInsetCssPx = keyboardOpen ? 0 : Math.round(bars.bottom / density);
            pushInsetToPage();
            return WindowInsetsCompat.CONSUMED;
        });

        // Add the white background + bar-colour sync to every page, so the
        // app looks right even before the website itself is redeployed.
        final String pageScript = readRawText(R.raw.page_inject);
        if (bridge != null && pageScript != null) {
            bridge.addWebViewListener(new WebViewListener() {
                @Override
                public void onPageCommitVisible(WebView view, String url) {
                    injectInto(view, pageScript);
                }

                @Override
                public void onPageLoaded(WebView view) {
                    injectInto(view, pageScript);
                }
            });
        }

        // Capacitor's own SystemBars plugin sets the icon style from the
        // phone's dark-mode setting on start-up; run after it.
        content.post(this::applyBarColors);
    }

    @Override
    public void onConfigurationChanged(@NonNull Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        // Same as above: undo the phone-theme based icon style.
        applyBarColors();
    }

    /** Called by the page (via the plugin) whenever its colours change. Main thread only. */
    void setBarColors(int statusColor, int navigationColor) {
        statusBarColor = statusColor;
        navigationBarColor = navigationColor;
        applyBarColors();
    }

    private void applyBarColors() {
        barsBackground.setColors(statusBarColor, navigationBarColor);
        Window window = getWindow();
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, window.getDecorView());
        // Dark icons on light bars, light icons on dark bars.
        controller.setAppearanceLightStatusBars(isLight(statusBarColor));
        controller.setAppearanceLightNavigationBars(isLight(navigationBarColor));
    }

    private void injectInto(WebView view, String script) {
        String url = view.getUrl();
        if (url != null && url.startsWith("https://")) {
            view.evaluateJavascript(script, null);
            pushInsetToPage();
        }
    }

    /** Sets --qc-inset-bottom (height of the navigation bar, CSS px) on the page. */
    private void pushInsetToPage() {
        if (bridge == null || bridge.getWebView() == null) {
            return;
        }
        bridge
            .getWebView()
            .evaluateJavascript(
                "document.documentElement.style.setProperty('--qc-inset-bottom','" + bottomInsetCssPx + "px')",
                null
            );
    }

    @Nullable
    private String readRawText(int resId) {
        try (InputStream in = getResources().openRawResource(resId)) {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buf = new byte[4096];
            int n;
            while ((n = in.read(buf)) != -1) {
                out.write(buf, 0, n);
            }
            return out.toString(StandardCharsets.UTF_8.name());
        } catch (IOException e) {
            return null;
        }
    }

    private static boolean isLight(int color) {
        return ColorUtils.calculateLuminance(color) > 0.5;
    }

    /** Paints the status-bar strip in one colour and everything else (navigation bar, side insets) in another. */
    static final class SystemBarsBackground extends Drawable {

        private final Paint paint = new Paint();
        private int topHeight = 0;
        private int statusColor = Color.WHITE;
        private int navigationColor = Color.WHITE;

        void setTopHeight(int height) {
            if (height != topHeight) {
                topHeight = height;
                invalidateSelf();
            }
        }

        void setColors(int status, int navigation) {
            if (status != statusColor || navigation != navigationColor) {
                statusColor = status;
                navigationColor = navigation;
                invalidateSelf();
            }
        }

        @Override
        public void draw(@NonNull Canvas canvas) {
            Rect b = getBounds();
            paint.setColor(navigationColor);
            canvas.drawRect(b, paint);
            paint.setColor(statusColor);
            canvas.drawRect(b.left, b.top, b.right, b.top + topHeight, paint);
        }

        @Override
        public void setAlpha(int alpha) {}

        @Override
        public void setColorFilter(@Nullable ColorFilter colorFilter) {}

        @Override
        public int getOpacity() {
            return PixelFormat.OPAQUE;
        }
    }
}
