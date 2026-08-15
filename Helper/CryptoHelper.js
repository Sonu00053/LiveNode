const crypto = require('crypto');

const algorithm = 'aes-256-cbc';
require('dotenv').config();

const SECT_KEY = process.env.SECT_KEY;

// 32-byte key
const key = crypto.createHash('sha256')
    .update(SECT_KEY)
    .digest();

const iv = Buffer.alloc(16, 0);

class CryptoHelper {

    static encrypt(text) {
        const cipher = crypto.createCipheriv(
            algorithm,
            key,
            iv
        );

        let encrypted = cipher.update(
            String(text),
            'utf8',
            'hex'
        );

        encrypted += cipher.final('hex');

        return encrypted;
    }

    static decrypt(text) {
        const decipher = crypto.createDecipheriv(
            algorithm,
            key,
            iv
        );

        let decrypted = decipher.update(
            text,
            'hex',
            'utf8'
        );

        decrypted += decipher.final('utf8');

        return decrypted;
    }
}

module.exports = CryptoHelper;