package com.qureocity.app;

import android.graphics.Color;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Lets the web app tell the native shell what colour is at the top and the
 * bottom of the screen, so the status and navigation bars can match it.
 *
 * Called from the page as:
 * window.Capacitor.nativePromise("QureoSystemBars", "setColors",
 *   { statusBar: "#ffffff", navigationBar: "#ffffff" })
 */
@CapacitorPlugin(name = "QureoSystemBars")
public class SystemBarColorsPlugin extends Plugin {

    @PluginMethod
    public void setColors(PluginCall call) {
        final int status;
        final int navigation;
        try {
            status = Color.parseColor(call.getString("statusBar", "#FFFFFF"));
            navigation = Color.parseColor(call.getString("navigationBar", "#FFFFFF"));
        } catch (IllegalArgumentException e) {
            call.reject("Colours must be #RRGGBB");
            return;
        }

        getBridge().executeOnMainThread(() -> {
            if (getActivity() instanceof MainActivity) {
                ((MainActivity) getActivity()).setBarColors(status, navigation);
            }
            call.resolve();
        });
    }
}
