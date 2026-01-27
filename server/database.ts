import Database, { Database as DatabaseType } from 'better-sqlite3';
import path from 'path';
import crypto from 'crypto';

const dbPath = path.join(process.cwd(), 'data', 'connections.db');

const db: DatabaseType = new Database(dbPath);

// ==================== ENCRYPTION ====================

// Encryption key - In production, use environment variable!
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'elasticscope-default-key-change-me!';
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

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

db.exec(`
  CREATE TABLE IF NOT EXISTS connections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    username TEXT,
    password TEXT,
    color TEXT DEFAULT '#3b82f6',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

export interface SavedConnection {
    id: number;
    name: string;
    url: string;
    username: string | null;
    password: string | null;
    color: string;
    created_at: string;
    updated_at: string;
}

export interface CreateConnectionInput {
    name: string;
    url: string;
    username?: string;
    password?: string;
    color?: string;
}

export const getAllConnections = (): SavedConnection[] => {
    const stmt = db.prepare('SELECT * FROM connections ORDER BY name ASC');
    return stmt.all() as SavedConnection[];
};

export const getConnectionById = (id: number): SavedConnection | undefined => {
    const stmt = db.prepare('SELECT * FROM connections WHERE id = ?');
    return stmt.get(id) as SavedConnection | undefined;
};

export const createConnection = (input: CreateConnectionInput): SavedConnection => {
    const stmt = db.prepare(`
    INSERT INTO connections (name, url, username, password, color)
    VALUES (?, ?, ?, ?, ?)
  `);

    const result = stmt.run(
        input.name,
        input.url,
        input.username || null,
        input.password ? encryptPassword(input.password) : null,
        input.color || '#3b82f6'
    );

    return getConnectionById(result.lastInsertRowid as number)!;
};

export const updateConnection = (id: number, input: Partial<CreateConnectionInput>): SavedConnection | undefined => {
    const existing = getConnectionById(id);
    if (!existing) return undefined;

    const stmt = db.prepare(`
    UPDATE connections 
    SET name = ?, url = ?, username = ?, password = ?, color = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);

    // Handle password: encrypt if new password provided, keep existing if not
    let passwordValue = existing.password;
    if (input.password !== undefined) {
        passwordValue = input.password ? encryptPassword(input.password) : null;
    }

    stmt.run(
        input.name ?? existing.name,
        input.url ?? existing.url,
        input.username !== undefined ? input.username : existing.username,
        passwordValue,
        input.color ?? existing.color,
        id
    );

    return getConnectionById(id);
};

export const deleteConnection = (id: number): boolean => {
    const stmt = db.prepare('DELETE FROM connections WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
};

// ==================== SAVED QUERIES ====================

db.exec(`
  CREATE TABLE IF NOT EXISTS saved_queries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    method TEXT NOT NULL,
    path TEXT NOT NULL,
    body TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

export interface SavedQuery {
    id: number;
    name: string;
    method: string;
    path: string;
    body: string | null;
    created_at: string;
    updated_at: string;
}

export interface CreateQueryInput {
    name: string;
    method: string;
    path: string;
    body?: string;
}

export const getAllQueries = (): SavedQuery[] => {
    const stmt = db.prepare('SELECT * FROM saved_queries ORDER BY name ASC');
    return stmt.all() as SavedQuery[];
};

// Tek sorgu getir
export const getQueryById = (id: number): SavedQuery | undefined => {
    const stmt = db.prepare('SELECT * FROM saved_queries WHERE id = ?');
    return stmt.get(id) as SavedQuery | undefined;
};

// Sorgu ekle
export const createQuery = (input: CreateQueryInput): SavedQuery => {
    const stmt = db.prepare(`
    INSERT INTO saved_queries (name, method, path, body)
    VALUES (?, ?, ?, ?)
  `);

    const result = stmt.run(
        input.name,
        input.method,
        input.path,
        input.body || null
    );

    return getQueryById(result.lastInsertRowid as number)!;
};

export const updateQuery = (id: number, input: Partial<CreateQueryInput>): SavedQuery | undefined => {
    const existing = getQueryById(id);
    if (!existing) return undefined;

    const stmt = db.prepare(`
    UPDATE saved_queries 
    SET name = ?, method = ?, path = ?, body = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);

    stmt.run(
        input.name ?? existing.name,
        input.method ?? existing.method,
        input.path ?? existing.path,
        input.body !== undefined ? input.body : existing.body,
        id
    );

    return getQueryById(id);
};

// Sorgu sil
export const deleteQuery = (id: number): boolean => {
    const stmt = db.prepare('DELETE FROM saved_queries WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
};

export default db;
