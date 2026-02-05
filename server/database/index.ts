import path from 'path';
import { DatabaseAdapter, DatabaseType, DatabaseConfig } from './types';
import { SQLiteAdapter } from './adapters/sqlite';
import { PostgreSQLAdapter } from './adapters/postgresql';
import { MySQLAdapter } from './adapters/mysql';

// Re-export types and encryption
export * from './types';
export { encryptPassword, decryptPassword } from './encryption';

// ==================== CONFIGURATION ====================

const getDbType = (): DatabaseType => {
    const dbType = (process.env.DB_TYPE || 'sqlite').toLowerCase();

    if (!['sqlite', 'postgresql', 'mysql'].includes(dbType)) {
        throw new Error(
            `Invalid DB_TYPE: "${dbType}". Supported values: sqlite, postgresql, mysql`
        );
    }

    return dbType as DatabaseType;
};

const validateEnvVar = (name: string, value: string | undefined, dbType: string): string => {
    if (!value || value.trim() === '') {
        throw new Error(
            `Missing required environment variable "${name}" for ${dbType} database. ` +
            `Please set ${name} in your .env file or environment.`
        );
    }
    return value;
};

const getConfig = (): DatabaseConfig => {
    const dbType = getDbType();

    switch (dbType) {
        case 'sqlite': {
            const dbPath = process.env.DB_PATH || path.join(process.cwd(), 'data', 'connections.db');
            return {
                type: 'sqlite',
                path: dbPath,
            };
        }

        case 'postgresql': {
            return {
                type: 'postgresql',
                host: validateEnvVar('DB_HOST', process.env.DB_HOST, 'PostgreSQL'),
                port: parseInt(process.env.DB_PORT || '5432', 10),
                database: validateEnvVar('DB_NAME', process.env.DB_NAME, 'PostgreSQL'),
                user: validateEnvVar('DB_USER', process.env.DB_USER, 'PostgreSQL'),
                password: validateEnvVar('DB_PASSWORD', process.env.DB_PASSWORD, 'PostgreSQL'),
                ssl: process.env.DB_SSL === 'true',
                poolSize: parseInt(process.env.DB_POOL_SIZE || '10', 10),
            };
        }

        case 'mysql': {
            return {
                type: 'mysql',
                host: validateEnvVar('DB_HOST', process.env.DB_HOST, 'MySQL'),
                port: parseInt(process.env.DB_PORT || '3306', 10),
                database: validateEnvVar('DB_NAME', process.env.DB_NAME, 'MySQL'),
                user: validateEnvVar('DB_USER', process.env.DB_USER, 'MySQL'),
                password: validateEnvVar('DB_PASSWORD', process.env.DB_PASSWORD, 'MySQL'),
                ssl: process.env.DB_SSL === 'true',
                poolSize: parseInt(process.env.DB_POOL_SIZE || '10', 10),
            };
        }

        default:
            throw new Error(`Unsupported database type: ${dbType}`);
    }
};

// ==================== FACTORY ====================

const createAdapter = (config: DatabaseConfig): DatabaseAdapter => {
    switch (config.type) {
        case 'sqlite':
            return new SQLiteAdapter(config);
        case 'postgresql':
            return new PostgreSQLAdapter(config);
        case 'mysql':
            return new MySQLAdapter(config);
        default:
            throw new Error(`Unknown database type`);
    }
};

// ==================== SINGLETON ====================

let dbInstance: DatabaseAdapter | null = null;

export const initializeDatabase = async (): Promise<DatabaseAdapter> => {
    if (dbInstance) {
        return dbInstance;
    }

    const config = getConfig();
    console.log(`🔧 Initializing ${config.type.toUpperCase()} database...`);

    dbInstance = createAdapter(config);
    await dbInstance.initialize();

    return dbInstance;
};

export const getDatabase = (): DatabaseAdapter => {
    if (!dbInstance) {
        throw new Error(
            'Database not initialized. Call initializeDatabase() first.'
        );
    }
    return dbInstance;
};

export const closeDatabase = async (): Promise<void> => {
    if (dbInstance) {
        await dbInstance.close();
        dbInstance = null;
        console.log('🔒 Database connection closed');
    }
};

// ==================== CONVENIENCE FUNCTIONS ====================
// These wrap the adapter methods for backward compatibility

export const getAllConnections = () => getDatabase().getAllConnections();
export const getConnectionById = (id: number) => getDatabase().getConnectionById(id);
export const createConnection = (input: Parameters<DatabaseAdapter['createConnection']>[0]) =>
    getDatabase().createConnection(input);
export const updateConnection = (id: number, input: Parameters<DatabaseAdapter['updateConnection']>[1]) =>
    getDatabase().updateConnection(id, input);
export const deleteConnection = (id: number) => getDatabase().deleteConnection(id);

export const getAllQueries = () => getDatabase().getAllQueries();
export const getQueryById = (id: number) => getDatabase().getQueryById(id);
export const createQuery = (input: Parameters<DatabaseAdapter['createQuery']>[0]) =>
    getDatabase().createQuery(input);
export const updateQuery = (id: number, input: Parameters<DatabaseAdapter['updateQuery']>[1]) =>
    getDatabase().updateQuery(id, input);
export const deleteQuery = (id: number) => getDatabase().deleteQuery(id);
