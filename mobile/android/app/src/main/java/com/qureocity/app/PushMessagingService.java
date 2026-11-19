package com.qureocity.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.service.notification.StatusBarNotification;
import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
import java.util.Map;

/**
 * Shows QureoCity alerts sent by the server (lib/push/server.ts) as data
 * messages, so they appear the same whether the app is open, in the
 * background or closed. Mirrors public/sw.js: same tag replaces the
 * previous alert, and "group" alerts fold into "3 new check-ins".
 */
public class PushMessagingService extends FirebaseMessagingService {

    static final String CHANNEL_ID = "alerts";
    static final String EXTRA_URL = "qureocity_url";
    private static final String EXTRA_COUNT = "qureocity_count";

    @Override
    public void onNewToken(@NonNull String token) {
        // The web app re-registers this device's token every time it opens
        // (refreshSubscriptionIfNeeded), so nothing to do here.
    }

    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        Map<String, String> data = remoteMessage.getData();
        String title = valueOr(data.get("title"), "QureoCity");
        String body = valueOr(data.get("body"), "");
        String url = valueOr(data.get("url"), "/employee");
        String tag = data.get("tag");
        String groupPlural = data.get("group");

        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return;
        ensureChannel(manager);

        int id = tag != null && !tag.isEmpty() ? tag.hashCode() : (int) System.currentTimeMillis();

        int count = 1;
        if (groupPlural != null && !groupPlural.isEmpty() && tag != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            for (StatusBarNotification active : manager.getActiveNotifications()) {
                if (active.getId() == id) {
                    Bundle extras = active.getNotification().extras;
                    count = extras.getInt(EXTRA_COUNT, 1) + 1;
                    title = count + " " + groupPlural;
                    break;
                }
            }
        }

        Intent open = new Intent(this, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        open.putExtra(EXTRA_URL, url);
        PendingIntent pending = PendingIntent.getActivity(
            this,
            id,
            open,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Bundle extras = new Bundle();
        extras.putInt(EXTRA_COUNT, count);

        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_notify)
            .setColor(ContextCompat.getColor(this, R.color.notification_accent))
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .setAutoCancel(true)
            .setContentIntent(pending)
            .addExtras(extras)
            .build();

        manager.notify(id, notification);
    }

    static void ensureChannel(NotificationManager manager) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && manager.getNotificationChannel(CHANNEL_ID) == null) {
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "Alerts", NotificationManager.IMPORTANCE_HIGH);
            channel.setDescription("Check-ins, registrations, staff and session alerts");
            manager.createNotificationChannel(channel);
        }
    }

    private static String valueOr(String v, String fallback) {
        return v == null || v.isEmpty() ? fallback : v;
    }
}
