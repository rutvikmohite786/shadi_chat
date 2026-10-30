const db = require('../config/database');

/**
 * Send push notification to a device via Expo Push API
 */
async function sendExpoPushNotification({ toToken, title, body, data }) {
    if (!toToken || (!toToken.startsWith('ExponentPushToken[') && !toToken.startsWith('ExpoPushToken['))) {
        return false;
    }

    try {
        const payload = {
            to: toToken,
            title,
            body,
            sound: 'default',
            priority: 'high',
            channelId: 'default',
            data: data || {}
        };

        const response = await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Accept-Encoding': 'gzip, deflate',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            console.error('[EXPO PUSH NODE] Response error:', response.status, await response.text());
            return false;
        }

        const resData = await response.json();
        console.log('[EXPO PUSH NODE] Sent notification:', resData);
        return true;
    } catch (err) {
        console.error('[EXPO PUSH NODE] Exception:', err.message);
        return false;
    }
}

/**
 * Send push notification for a chat message
 */
async function sendChatMessagePush(senderId, receiverId, message, messageId) {
    try {
        const [rows] = await db.execute(
            `SELECT u.name, u.first_name, u.last_name,
                    r.expo_push_token, r.notification_status
             FROM users u
             CROSS JOIN users r
             WHERE u.id = ? AND r.id = ?`,
            [senderId, receiverId]
        );

        if (!rows.length || !rows[0].expo_push_token) return;

        const row = rows[0];
        if (row.notification_status === 0 || row.notification_status === false) {
            return;
        }

        const senderName = row.name || `${row.first_name || ''} ${row.last_name || ''}`.trim() || 'Someone';
        const preview = message.length > 100 ? message.substring(0, 97) + '...' : message;

        await sendExpoPushNotification({
            toToken: row.expo_push_token,
            title: senderName,
            body: preview,
            data: {
                type: 'chat_message',
                sender_id: senderId,
                sender_name: senderName,
                message_id: messageId
            }
        });
    } catch (err) {
        console.error('[EXPO PUSH NODE] Error sending message push:', err.message);
    }
}

module.exports = {
    sendExpoPushNotification,
    sendChatMessagePush
};
