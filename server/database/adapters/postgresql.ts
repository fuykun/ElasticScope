import pg from 'pg';
import {
    DatabaseAdapter,
    SavedConnection,
    CreateConnectionInput,
    SavedQuery,
    CreateQueryInput,
    PostgreSQLConfig
} from '../types';
import { encryptPassword } from '../encryption';

const { Pool } = pg;

export class PostgreSQLAdapter implements DatabaseAdapter {
    private pool: pg.Pool | null = null;
    private config: PostgreSQLConfig;

    constructor(config: PostgreSQLConfig) {
        this.config = config;
    }

    async initialize(): Promise<void> {
        this.pool = new Pool({
            host: this.config.host,
            port: this.config.port,
            database: this.config.database,
            user: this.config.user,
            password: this.config.password,
            ssl: this.config.ssl ? { rejectUnauthorized: false } : false,
            max: this.config.poolSize || 10,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        });

        // Test connection
        const client = await this.pool.connect();
        try {
            // Create connections table
            await client.query(`
                CREATE TABLE IF NOT EXISTS connections (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    url TEXT NOT NULL,
                    username VARCHAR(255),
                    password TEXT,
                    color VARCHAR(20) DEFAULT '#3b82f6',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Create saved_queries table
            await client.query(`
                CREATE TABLE IF NOT EXISTS saved_queries (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    method VARCHAR(20) NOT NULL,
                    path TEXT NOT NULL,
                    body TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            console.log('✅ PostgreSQL database initialized');
        } finally {
            client.release();
        }
    }

    async close(): Promise<void> {
        if (this.pool) {
            await this.pool.end();
            this.pool = null;
        }
    }

    private getPool(): pg.Pool {
        if (!this.pool) {
            throw new Error('Database not initialized. Call initialize() first.');
        }
        return this.pool;
    }

    // ==================== CONNECTIONS ====================

    async getAllConnections(): Promise<SavedConnection[]> {
        const result = await this.getPool().query(
            'SELECT * FROM connections ORDER BY name ASC'
        );
        return result.rows.map(this.mapConnection);
    }

    async getConnectionById(id: number): Promise<SavedConnection | undefined> {
        const result = await this.getPool().query(
            'SELECT * FROM connections WHERE id = $1',
            [id]
        );
        return result.rows[0] ? this.mapConnection(result.rows[0]) : undefined;
    }

    async createConnection(input: CreateConnectionInput): Promise<SavedConnection> {
        const result = await this.getPool().query(
            `INSERT INTO connections (name, url, username, password, color)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [
                input.name,
                input.url,
                input.username || null,
                input.password ? encryptPassword(input.password) : null,
                input.color || '#3b82f6'
            ]
        );
        return this.mapConnection(result.rows[0]);
    }

    async updateConnection(id: number, input: Partial<CreateConnectionInput>): Promise<SavedConnection | undefined> {
        const existing = await this.getConnectionById(id);
        if (!existing) return undefined;

        // Handle password: encrypt if new password provided, keep existing if not
        let passwordValue = existing.password;
        if (input.password !== undefined) {
            passwordValue = input.password ? encryptPassword(input.password) : null;
        }

        const result = await this.getPool().query(
            `UPDATE connections 
             SET name = $1, url = $2, username = $3, password = $4, color = $5, updated_at = CURRENT_TIMESTAMP
             WHERE id = $6
             RETURNING *`,
            [
                input.name ?? existing.name,
                input.url ?? existing.url,
                input.username !== undefined ? input.username : existing.username,
                passwordValue,
                input.color ?? existing.color,
                id
            ]
        );

        return result.rows[0] ? this.mapConnection(result.rows[0]) : undefined;
    }

    async deleteConnection(id: number): Promise<boolean> {
        const result = await this.getPool().query(
            'DELETE FROM connections WHERE id = $1',
            [id]
        );
        return (result.rowCount ?? 0) > 0;
    }

    // ==================== QUERIES ====================

    async getAllQueries(): Promise<SavedQuery[]> {
        const result = await this.getPool().query(
            'SELECT * FROM saved_queries ORDER BY name ASC'
        );
        return result.rows.map(this.mapQuery);
    }

    async getQueryById(id: number): Promise<SavedQuery | undefined> {
        const result = await this.getPool().query(
            'SELECT * FROM saved_queries WHERE id = $1',
            [id]
        );
        return result.rows[0] ? this.mapQuery(result.rows[0]) : undefined;
    }

    async createQuery(input: CreateQueryInput): Promise<SavedQuery> {
        const result = await this.getPool().query(
            `INSERT INTO saved_queries (name, method, path, body)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [
                input.name,
                input.method,
                input.path,
                input.body || null
            ]
        );
        return this.mapQuery(result.rows[0]);
    }

    async updateQuery(id: number, input: Partial<CreateQueryInput>): Promise<SavedQuery | undefined> {
        const existing = await this.getQueryById(id);
        if (!existing) return undefined;

        const result = await this.getPool().query(
            `UPDATE saved_queries 
             SET name = $1, method = $2, path = $3, body = $4, updated_at = CURRENT_TIMESTAMP
             WHERE id = $5
             RETURNING *`,
            [
                input.name ?? existing.name,
                input.method ?? existing.method,
                input.path ?? existing.path,
                input.body !== undefined ? input.body : existing.body,
                id
            ]
        );

        return result.rows[0] ? this.mapQuery(result.rows[0]) : undefined;
    }

    async deleteQuery(id: number): Promise<boolean> {
        const result = await this.getPool().query(
            'DELETE FROM saved_queries WHERE id = $1',
            [id]
        );
        return (result.rowCount ?? 0) > 0;
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
}
