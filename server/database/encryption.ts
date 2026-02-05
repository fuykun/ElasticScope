import crypto from 'crypto';

// ==================== ENCRYPTION ====================

// Encryption key - In production, use environment variable!
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'elasticscope-default-key-change-me!';
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

// Generate a proper 32-byte key from the input key
const getKey = (): Buffer => {
    return crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
};

export const encryptPassword = (password: string): string => {
    const iv = crypto.randomBytes(IV_LENGTH);
    const key = getKey();
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(password, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    // Format: iv:authTag:encryptedData
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
};

export const decryptPassword = (encryptedPassword: string): string => {
    try {
        const parts = encryptedPassword.split(':');
        if (parts.length !== 3) {
            // Old plaintext password - return as is (migration support)
            return encryptedPassword;
        }

        const iv = Buffer.from(parts[0], 'hex');
        const authTag = Buffer.from(parts[1], 'hex');
        const encrypted = parts[2];

        const key = getKey();
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    } catch {
        // If decryption fails, assume it's plaintext (migration support)
        return encryptedPassword;
    }
};
