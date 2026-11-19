package com.qureocity.app;

import android.Manifest;
import android.os.Build;
import androidx.core.app.NotificationManagerCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.google.firebase.messaging.FirebaseMessaging;

/**
 * Native push (Firebase Cloud Messaging) for the web app, used from
 * lib/push/client.ts through window.Capacitor.nativePromise("QureoPush", ...).
 */
@CapacitorPlugin(
    name = "QureoPush",
    permissions = @Permission(strings = { Manifest.permission.POST_NOTIFICATIONS }, alias = "notifications")
)
public class PushPlugin extends Plugin {

    private boolean notificationsEnabled() {
        return NotificationManagerCompat.from(getContext()).areNotificationsEnabled();
    }

    private void resolveGranted(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("granted", notificationsEnabled());
        call.resolve(ret);
    }

    @PluginMethod
    public void checkPermission(PluginCall call) {
        resolveGranted(call);
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU || getPermissionState("notifications") == PermissionState.GRANTED) {
            resolveGranted(call);
            return;
        }
        requestPermissionForAlias("notifications", call, "permissionCallback");
    }

    @PermissionCallback
    private void permissionCallback(PluginCall call) {
        resolveGranted(call);
    }

    @PluginMethod
    public void getToken(PluginCall call) {
        try {
            FirebaseMessaging.getInstance()
                .getToken()
                .addOnCompleteListener(task -> {
                    if (task.isSuccessful() && task.getResult() != null) {
                        JSObject ret = new JSObject();
                        ret.put("token", task.getResult());
                        call.resolve(ret);
                    } else {
                        call.reject("Could not get a push token: " + (task.getException() != null ? task.getException().getMessage() : "unknown error"));
                    }
                });
        } catch (IllegalStateException e) {
            // No google-services.json in this build.
            call.reject("Push notifications are not set up in this app build (Firebase missing).", "NOT_CONFIGURED");
        }
    }

    @PluginMethod
    public void deleteToken(PluginCall call) {
        try {
            FirebaseMessaging.getInstance().deleteToken().addOnCompleteListener(task -> call.resolve());
        } catch (IllegalStateException e) {
            call.resolve();
        }
    }
}
