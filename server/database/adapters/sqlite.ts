import Database, { Database as DatabaseType } from 'better-sqlite3';
import {
    DatabaseAdapter,
    SavedConnection,
    CreateConnectionInput,
    SavedQuery,
    CreateQueryInput,
    SQLiteConfig
} from '../types';
import { encryptPassword } from '../encryption';

export class SQLiteAdapter implements DatabaseAdapter {
    private db: DatabaseType | null = null;
    private config: SQLiteConfig;

    constructor(config: SQLiteConfig) {
        this.config = config;
    }

    async initialize(): Promise<void> {
        this.db = new Database(this.config.path);

        // Create connections table
        this.db.exec(`
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

        // Create saved_queries table
        this.db.exec(`
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

        console.log('✅ SQLite database initialized');
    }

    async close(): Promise<void> {
        if (this.db) {
            this.db.close();
            this.db = null;
        }
    }

    private getDb(): DatabaseType {
        if (!this.db) {
            throw new Error('Database not initialized. Call initialize() first.');
        }
        return this.db;
    }

    // ==================== CONNECTIONS ====================

    async getAllConnections(): Promise<SavedConnection[]> {
        const stmt = this.getDb().prepare('SELECT * FROM connections ORDER BY name ASC');
        return stmt.all() as SavedConnection[];
    }

    async getConnectionById(id: number): Promise<SavedConnection | undefined> {
        const stmt = this.getDb().prepare('SELECT * FROM connections WHERE id = ?');
        return stmt.get(id) as SavedConnection | undefined;
    }

    async createConnection(input: CreateConnectionInput): Promise<SavedConnection> {
        const stmt = this.getDb().prepare(`
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

        const created = await this.getConnectionById(result.lastInsertRowid as number);
        if (!created) {
            throw new Error('Failed to create connection');
        }
        return created;
    }

    async updateConnection(id: number, input: Partial<CreateConnectionInput>): Promise<SavedConnection | undefined> {
        const existing = await this.getConnectionById(id);
        if (!existing) return undefined;

        const stmt = this.getDb().prepare(`
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

        return this.getConnectionById(id);
    }

    async deleteConnection(id: number): Promise<boolean> {
        const stmt = this.getDb().prepare('DELETE FROM connections WHERE id = ?');
        const result = stmt.run(id);
        return result.changes > 0;
    }

    // ==================== QUERIES ====================

    async getAllQueries(): Promise<SavedQuery[]> {
        const stmt = this.getDb().prepare('SELECT * FROM saved_queries ORDER BY name ASC');
        return stmt.all() as SavedQuery[];
    }

    async getQueryById(id: number): Promise<SavedQuery | undefined> {
        const stmt = this.getDb().prepare('SELECT * FROM saved_queries WHERE id = ?');
        return stmt.get(id) as SavedQuery | undefined;
    }

    async createQuery(input: CreateQueryInput): Promise<SavedQuery> {
        const stmt = this.getDb().prepare(`
            INSERT INTO saved_queries (name, method, path, body)
            VALUES (?, ?, ?, ?)
        `);

        const result = stmt.run(
            input.name,
            input.method,
            input.path,
            input.body || null
        );

        const created = await this.getQueryById(result.lastInsertRowid as number);
        if (!created) {
            throw new Error('Failed to create query');
        }
        return created;
    }

    async updateQuery(id: number, input: Partial<CreateQueryInput>): Promise<SavedQuery | undefined> {
        const existing = await this.getQueryById(id);
        if (!existing) return undefined;

        const stmt = this.getDb().prepare(`
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

        return this.getQueryById(id);
    }

    async deleteQuery(id: number): Promise<boolean> {
        const stmt = this.getDb().prepare('DELETE FROM saved_queries WHERE id = ?');
        const result = stmt.run(id);
        return result.changes > 0;
    }
}
