const crypto = require('crypto');
const config = require('../config/app');

/**
 * Encryption utility for chat messages
 * Uses AES-256-CBC encryption
 */

// Get encryption key from config (should be 32 bytes for AES-256)
// Must match Laravel's EncryptionService key derivation exactly
function getEncryptionKey() {
    let key = config.jwtSecret || process.env.APP_KEY || 'default-key-change-in-production';
    
    // Remove 'base64:' prefix if present and decode (to match Laravel's behavior)
    if (key.startsWith('base64:')) {
        // Decode base64 to get the original key string
        const decoded = Buffer.from(key.substring(7), 'base64');
        // Hash the decoded buffer (matching Laravel's hash('sha256', $key, true))
        return crypto.createHash('sha256').update(decoded).digest();
    }
    
    // If no base64 prefix, hash the key string directly
    // Hash the key to get exactly 32 bytes for AES-256 (matching Laravel)
    return crypto.createHash('sha256').update(key, 'utf8').digest();
}

/**
 * Encrypt a message
 * @param {string} text - Plain text message to encrypt
 * @returns {string} - Encrypted message in format: iv:encryptedData
 */
function encrypt(text) {
    try {
        if (!text) return text;
        
        const key = getEncryptionKey();
        const iv = crypto.randomBytes(16); // Initialization vector
        
        const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        // Return IV and encrypted data separated by colon
        return iv.toString('hex') + ':' + encrypted;
    } catch (error) {
        console.error('Encryption error:', error);
        throw new Error('Failed to encrypt message');
    }
}

/**
 * Decrypt a message
 * @param {string} encryptedText - Encrypted message in format: iv:encryptedData
 * @returns {string} - Decrypted plain text message
 */
function decrypt(encryptedText) {
    try {
        if (!encryptedText) return encryptedText;
        
        // Check if already decrypted (for backward compatibility)
        if (!encryptedText.includes(':')) {
            return encryptedText;
        }
        
        const key = getEncryptionKey();
        const parts = encryptedText.split(':');
        
        if (parts.length !== 2) {
            // If format is wrong, return as is (might be old unencrypted data)
            return encryptedText;
        }
        
        const iv = Buffer.from(parts[0], 'hex');
        const encrypted = parts[1];
        
        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
    } catch (error) {
        console.error('Decryption error:', error);
        // Return original text if decryption fails (for backward compatibility)
        return encryptedText;
    }
}

module.exports = {
    encrypt,
    decrypt
};



