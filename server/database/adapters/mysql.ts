import mysql from 'mysql2/promise';
import {
    DatabaseAdapter,
    SavedConnection,
    CreateConnectionInput,
    SavedQuery,
    CreateQueryInput,
    SavedSearchQuery,
    CreateSearchQueryInput,
    MySQLConfig
} from '../types';
import { encryptPassword } from '../encryption';

export class MySQLAdapter implements DatabaseAdapter {
    private pool: mysql.Pool | null = null;
    private config: MySQLConfig;

    constructor(config: MySQLConfig) {
        this.config = config;
    }

    async initialize(): Promise<void> {
        this.pool = mysql.createPool({
            host: this.config.host,
            port: this.config.port,
            database: this.config.database,
            user: this.config.user,
            password: this.config.password,
            ssl: this.config.ssl ? { rejectUnauthorized: false } : undefined,
            connectionLimit: this.config.poolSize || 10,
            waitForConnections: true,
            queueLimit: 0,
        });

        // Test connection and create tables
        const connection = await this.pool.getConnection();
        try {
            // Create connections table
            await connection.execute(`
                CREATE TABLE IF NOT EXISTS connections (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    url TEXT NOT NULL,
                    username VARCHAR(255),
                    password TEXT,
                    color VARCHAR(20) DEFAULT '#3b82f6',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                )
            `);

            // Create saved_queries table
            await connection.execute(`
                CREATE TABLE IF NOT EXISTS saved_queries (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    method VARCHAR(20) NOT NULL,
                    path TEXT NOT NULL,
                    body TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                )
            `);

            await connection.execute(`
                CREATE TABLE IF NOT EXISTS saved_search_queries (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    index_pattern VARCHAR(255) NOT NULL,
                    query TEXT NOT NULL,
                    sort_field VARCHAR(255),
                    sort_order VARCHAR(10),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                )
            `);

            console.log('✅ MySQL database initialized');
        } finally {
            connection.release();
        }
    }

    async close(): Promise<void> {
        if (this.pool) {
            await this.pool.end();
            this.pool = null;
        }
    }

    private getPool(): mysql.Pool {
        if (!this.pool) {
            throw new Error('Database not initialized. Call initialize() first.');
        }
        return this.pool;
    }

    // ==================== CONNECTIONS ====================

    async getAllConnections(): Promise<SavedConnection[]> {
        const [rows] = await this.getPool().execute(
            'SELECT * FROM connections ORDER BY name ASC'
        );
        return (rows as any[]).map(this.mapConnection);
    }

    async getConnectionById(id: number): Promise<SavedConnection | undefined> {
        const [rows] = await this.getPool().execute(
            'SELECT * FROM connections WHERE id = ?',
            [id]
        );
        const results = rows as any[];
        return results[0] ? this.mapConnection(results[0]) : undefined;
    }

    async createConnection(input: CreateConnectionInput): Promise<SavedConnection> {
        const [result] = await this.getPool().execute(
            `INSERT INTO connections (name, url, username, password, color)
             VALUES (?, ?, ?, ?, ?)`,
            [
                input.name,
                input.url,
                input.username || null,
                input.password ? encryptPassword(input.password) : null,
                input.color || '#3b82f6'
            ]
        );

        const insertId = (result as mysql.ResultSetHeader).insertId;
        const created = await this.getConnectionById(insertId);
        if (!created) {
            throw new Error('Failed to create connection');
        }
        return created;
    }

    async updateConnection(id: number, input: Partial<CreateConnectionInput>): Promise<SavedConnection | undefined> {
        const existing = await this.getConnectionById(id);
        if (!existing) return undefined;

        // Handle password: encrypt if new password provided, keep existing if not
        let passwordValue = existing.password;
        if (input.password !== undefined) {
            passwordValue = input.password ? encryptPassword(input.password) : null;
        }

        await this.getPool().execute(
            `UPDATE connections 
             SET name = ?, url = ?, username = ?, password = ?, color = ?
             WHERE id = ?`,
            [
                input.name ?? existing.name,
                input.url ?? existing.url,
                input.username !== undefined ? input.username : existing.username,
                passwordValue,
                input.color ?? existing.color,
                id
            ]
        );

        return this.getConnectionById(id);
    }

    async deleteConnection(id: number): Promise<boolean> {
        const [result] = await this.getPool().execute(
            'DELETE FROM connections WHERE id = ?',
            [id]
        );
        return (result as mysql.ResultSetHeader).affectedRows > 0;
    }

    // ==================== QUERIES ====================

    async getAllQueries(): Promise<SavedQuery[]> {
        const [rows] = await this.getPool().execute(
            'SELECT * FROM saved_queries ORDER BY name ASC'
        );
        return (rows as any[]).map(this.mapQuery);
    }

    async getQueryById(id: number): Promise<SavedQuery | undefined> {
        const [rows] = await this.getPool().execute(
            'SELECT * FROM saved_queries WHERE id = ?',
            [id]
        );
        const results = rows as any[];
        return results[0] ? this.mapQuery(results[0]) : undefined;
    }

    async createQuery(input: CreateQueryInput): Promise<SavedQuery> {
        const [result] = await this.getPool().execute(
            `INSERT INTO saved_queries (name, method, path, body)
             VALUES (?, ?, ?, ?)`,
            [
                input.name,
                input.method,
                input.path,
                input.body || null
            ]
        );

        const insertId = (result as mysql.ResultSetHeader).insertId;
        const created = await this.getQueryById(insertId);
        if (!created) {
            throw new Error('Failed to create query');
        }
        return created;
    }

    async updateQuery(id: number, input: Partial<CreateQueryInput>): Promise<SavedQuery | undefined> {
        const existing = await this.getQueryById(id);
        if (!existing) return undefined;

        await this.getPool().execute(
            `UPDATE saved_queries 
             SET name = ?, method = ?, path = ?, body = ?
             WHERE id = ?`,
            [
                input.name ?? existing.name,
                input.method ?? existing.method,
                input.path ?? existing.path,
                input.body !== undefined ? input.body : existing.body,
                id
            ]
        );

        return this.getQueryById(id);
    }

    async deleteQuery(id: number): Promise<boolean> {
        const [result] = await this.getPool().execute(
            'DELETE FROM saved_queries WHERE id = ?',
            [id]
        );
        return (result as mysql.ResultSetHeader).affectedRows > 0;
    }

    // ==================== SEARCH QUERIES ====================

    async getAllSearchQueries(): Promise<SavedSearchQuery[]> {
        const [rows] = await this.getPool().execute<mysql.RowDataPacket[]>(
            'SELECT * FROM saved_search_queries ORDER BY created_at DESC'
        );
        return rows.map(this.mapSearchQuery);
    }

    async createSearchQuery(input: CreateSearchQueryInput): Promise<SavedSearchQuery> {
        const [result] = await this.getPool().execute<mysql.ResultSetHeader>(
            `INSERT INTO saved_search_queries (name, index_pattern, query, sort_field, sort_order)
             VALUES (?, ?, ?, ?, ?)`,
            [input.name, input.index_pattern, input.query, input.sort_field || null, input.sort_order || null]
        );

        const [rows] = await this.getPool().execute<mysql.RowDataPacket[]>(
            'SELECT * FROM saved_search_queries WHERE id = ?',
            [result.insertId]
        );
        return this.mapSearchQuery(rows[0]);
    }

    async deleteSearchQuery(id: number): Promise<boolean> {
        const [result] = await this.getPool().execute(
            'DELETE FROM saved_search_queries WHERE id = ?',
            [id]
        );
        return (result as mysql.ResultSetHeader).affectedRows > 0;
    }

    // ==================== HELPERS ====================

    private mapConnection(row: any): SavedConnection {
        return {
            id: row.id,
            name: row.name,
            url: row.url,
            username: row.username,
            password: row.password,
            color: row.color,
            created_at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
            updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
        };
    }

    private mapQuery(row: any): SavedQuery {
        return {
            id: row.id,
            name: row.name,
            method: row.method,
            path: row.path,
            body: row.body,
            created_at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
            updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
        };
    }

    private mapSearchQuery(row: any): SavedSearchQuery {
        return {
            id: row.id,
            name: row.name,
            index_pattern: row.index_pattern,
            query: row.query,
            sort_field: row.sort_field,
            sort_order: row.sort_order,
            created_at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
            updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
        };
    }
}
