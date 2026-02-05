// ==================== DATABASE TYPES ====================

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

// ==================== DATABASE ADAPTER INTERFACE ====================

export interface DatabaseAdapter {
    // Connections
    getAllConnections(): Promise<SavedConnection[]>;
    getConnectionById(id: number): Promise<SavedConnection | undefined>;
    createConnection(input: CreateConnectionInput): Promise<SavedConnection>;
    updateConnection(id: number, input: Partial<CreateConnectionInput>): Promise<SavedConnection | undefined>;
    deleteConnection(id: number): Promise<boolean>;

    // Queries
    getAllQueries(): Promise<SavedQuery[]>;
    getQueryById(id: number): Promise<SavedQuery | undefined>;
    createQuery(input: CreateQueryInput): Promise<SavedQuery>;
    updateQuery(id: number, input: Partial<CreateQueryInput>): Promise<SavedQuery | undefined>;
    deleteQuery(id: number): Promise<boolean>;

    // Lifecycle
    initialize(): Promise<void>;
    close(): Promise<void>;
}

// ==================== DATABASE CONFIG ====================

export type DatabaseType = 'sqlite' | 'postgresql' | 'mysql';

export interface SQLiteConfig {
    type: 'sqlite';
    path: string;
}

export interface PostgreSQLConfig {
    type: 'postgresql';
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
    ssl?: boolean;
    poolSize?: number;
}

export interface MySQLConfig {
    type: 'mysql';
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
    ssl?: boolean;
    poolSize?: number;
}

export type DatabaseConfig = SQLiteConfig | PostgreSQLConfig | MySQLConfig;
