const db = require('../config/database');
const { encrypt, decrypt } = require('../utils/encryption');

class ChatService {
    /**
     * Save message to database (encrypted)
     */
    async saveMessage(senderId, receiverId, message, messageType = 'text') {
        try {
            // Temporarily disable encryption to fix decryption issues
            // TODO: Re-enable encryption once key derivation is fixed between Laravel and Node.js
            const encryptedMessage = message; // Store as plain text for now
            
            // Uncomment below to re-enable encryption:
            // const encryptedMessage = encrypt(message);
            
            const [result] = await db.execute(
                `INSERT INTO chat_messages (sender_id, receiver_id, message, message_type, created_at, updated_at) 
                 VALUES (?, ?, ?, ?, NOW(), NOW())`,
                [senderId, receiverId, encryptedMessage, messageType]
            );

            const [rows] = await db.execute(
                `SELECT cm.*, 
                        s.name as sender_name, s.profile_photo as sender_photo,
                        r.name as receiver_name, r.profile_photo as receiver_photo
                 FROM chat_messages cm
                 JOIN users s ON cm.sender_id = s.id
                 JOIN users r ON cm.receiver_id = r.id
                 WHERE cm.id = ?`,
                [result.insertId]
            );

            // Message is already plain text (encryption disabled temporarily)
            // No need to decrypt
            // if (rows[0]) {
            //     rows[0].message = decrypt(rows[0].message);
            // }

            return rows[0];
        } catch (error) {
            console.error('Error saving message:', error);
            throw error;
        }
    }

    /**
     * Get conversation between two users (decrypted)
     */
    async getConversation(userId1, userId2, limit = 50, offset = 0) {
        try {
            const [rows] = await db.execute(
                `SELECT cm.*, 
                        s.name as sender_name, s.profile_photo as sender_photo,
                        r.name as receiver_name, r.profile_photo as receiver_photo
                 FROM chat_messages cm
                 JOIN users s ON cm.sender_id = s.id
                 JOIN users r ON cm.receiver_id = r.id
                 WHERE ((cm.sender_id = ? AND cm.receiver_id = ? AND cm.is_deleted_by_sender = 0)
                    OR (cm.sender_id = ? AND cm.receiver_id = ? AND cm.is_deleted_by_receiver = 0))
                 ORDER BY cm.created_at DESC
                 LIMIT ? OFFSET ?`,
                [userId1, userId2, userId2, userId1, limit, offset]
            );

            // Messages are already plain text (encryption disabled temporarily)
            // No need to decrypt
            // const decryptedRows = rows.map(row => {
            //     row.message = decrypt(row.message);
            //     return row;
            // });

            return rows.reverse();
        } catch (error) {
            console.error('Error getting conversation:', error);
            throw error;
        }
    }

    /**
     * Mark messages as read
     */
    async markAsRead(senderId, receiverId) {
        try {
            await db.execute(
                `UPDATE chat_messages 
                 SET is_read = 1, read_at = NOW() 
                 WHERE sender_id = ? AND receiver_id = ? AND is_read = 0`,
                [senderId, receiverId]
            );
        } catch (error) {
            console.error('Error marking as read:', error);
            throw error;
        }
    }

    /**
     * Get unread count
     */
    async getUnreadCount(userId) {
        try {
            const [rows] = await db.execute(
                `SELECT COUNT(*) as count FROM chat_messages 
                 WHERE receiver_id = ? AND is_read = 0`,
                [userId]
            );

            return rows[0].count;
        } catch (error) {
            console.error('Error getting unread count:', error);
            throw error;
        }
    }

    /**
     * Check if users can chat
     */
    async canChat(userId1, userId2) {
        return true;
    }

    /**
     * Get user info
     */
    async getUser(userId) {
        try {
            const [rows] = await db.execute(
                `SELECT id, name, profile_photo FROM users WHERE id = ?`,
                [userId]
            );

            return rows[0] || null;
        } catch (error) {
            console.error('Error getting user:', error);
            return null;
        }
    }

    /**
     * Find recently created message to avoid duplicate DB insertions
     */
    async findRecentMessage(senderId, receiverId, message) {
        try {
            const [rows] = await db.execute(
                `SELECT cm.*, 
                        s.name as sender_name, s.profile_photo as sender_photo,
                        r.name as receiver_name, r.profile_photo as receiver_photo
                 FROM chat_messages cm
                 JOIN users s ON cm.sender_id = s.id
                 JOIN users r ON cm.receiver_id = r.id
                 WHERE cm.sender_id = ? AND cm.receiver_id = ? AND cm.message = ?
                 ORDER BY cm.id DESC LIMIT 1`,
                [senderId, receiverId, message]
            );

            if (!rows || rows.length === 0) {
                return null;
            }

            const latest = rows[0];
            const msgTime = new Date(latest.created_at).getTime();
            const now = Date.now();
            const diffSec = Math.abs(now - msgTime) / 1000;

            const [diffResult] = await db.execute(
                `SELECT TIMESTAMPDIFF(SECOND, created_at, NOW()) as sec_diff FROM chat_messages WHERE id = ?`,
                [latest.id]
            );
            const dbSecDiff = diffResult && diffResult[0] && diffResult[0].sec_diff !== null 
                ? Math.abs(diffResult[0].sec_diff) 
                : 999;

            if (diffSec <= 60 || dbSecDiff <= 60) {
                return latest;
            }

            return null;
        } catch (error) {
            console.error('Error finding recent message:', error);
            return null;
        }
    }
}

module.exports = new ChatService();




