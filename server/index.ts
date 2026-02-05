import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { Client } from '@elastic/elasticsearch';
import https from 'https';
import {
    getAllConnections,
    getConnectionById,
    createConnection,
    updateConnection,
    deleteConnection,
    SavedConnection,
    getAllQueries,
    getQueryById,
    createQuery,
    updateQuery,
    deleteQuery,
    SavedQuery,
    decryptPassword
} from './database';

const app = express();
app.use(cors());
app.use(express.json());

// ==================== SECURITY: REST API BLACKLIST ====================

const DANGEROUS_PATHS = [
    '/_all',
    '/_cluster/settings',
    '/_security',
    '/_snapshot',
    '/_slm',
    '/_ilm',
    '/_license',
    '/_xpack/security',
    '/_nodes/shutdown',
    '/_shutdown',
];

const DANGEROUS_PATH_PATTERNS = [
    /^\/_all\//,           // /_all/* operations
    /^\/_template$/,       // Delete all templates
    /^\/_index_template$/, // Delete all index templates
];

const isDangerousRequest = (method: string, requestPath: string): boolean => {
    const normalizedPath = requestPath.toLowerCase();
    const normalizedMethod = method.toUpperCase();

    // Block dangerous paths
    if (DANGEROUS_PATHS.includes(normalizedPath)) {
        return true;
    }

    // Block dangerous patterns
    for (const pattern of DANGEROUS_PATH_PATTERNS) {
        if (pattern.test(normalizedPath)) {
            return true;
        }
    }

    // Block DELETE on root or _all
    if (normalizedMethod === 'DELETE') {
        if (normalizedPath === '/' || normalizedPath === '/_all' || normalizedPath.startsWith('/_all/')) {
            return true;
        }
        // Block DELETE /* (all indices wildcard)
        if (normalizedPath === '/*' || normalizedPath === '/_all') {
            return true;
        }
    }

    return false;
};

// ==================== SECURITY: INPUT VALIDATION ====================

const validateIndexName = (indexName: string): { valid: boolean; error?: string } => {
    if (!indexName || typeof indexName !== 'string') {
        return { valid: false, error: 'INDEX_NAME_REQUIRED' };
    }

    // Max length check
    if (indexName.length > 255) {
        return { valid: false, error: 'INDEX_NAME_TOO_LONG' };
    }

    // Cannot start with - _ +
    if (/^[-_+]/.test(indexName)) {
        return { valid: false, error: 'INDEX_NAME_INVALID_START' };
    }

    // Cannot contain special characters
    if (/[\\/*?"<>|,#:\s]/.test(indexName)) {
        return { valid: false, error: 'INDEX_NAME_INVALID_CHARS' };
    }

    // Cannot be . or ..
    if (indexName === '.' || indexName === '..') {
        return { valid: false, error: 'INDEX_NAME_INVALID' };
    }

    // Must be lowercase
    if (indexName !== indexName.toLowerCase()) {
        return { valid: false, error: 'INDEX_NAME_MUST_BE_LOWERCASE' };
    }

    return { valid: true };
};

const validateAliasName = (aliasName: string): { valid: boolean; error?: string } => {
    if (!aliasName || typeof aliasName !== 'string') {
        return { valid: false, error: 'ALIAS_REQUIRED' };
    }

    if (aliasName.length > 255) {
        return { valid: false, error: 'ALIAS_NAME_TOO_LONG' };
    }

    if (/[\\/*?"<>|,#:\s]/.test(aliasName)) {
        return { valid: false, error: 'ALIAS_NAME_INVALID_CHARS' };
    }

    return { valid: true };
};

const validateConnectionInput = (input: any): { valid: boolean; error?: string } => {
    if (!input.name || typeof input.name !== 'string' || input.name.trim().length === 0) {
        return { valid: false, error: 'NAME_REQUIRED' };
    }

    if (input.name.length > 100) {
        return { valid: false, error: 'NAME_TOO_LONG' };
    }

    if (!input.url || typeof input.url !== 'string') {
        return { valid: false, error: 'URL_REQUIRED' };
    }

    // Basic URL validation
    try {
        new URL(input.url);
    } catch {
        return { valid: false, error: 'URL_INVALID' };
    }

    return { valid: true };
};

let esClient: Client | null = null;
let connectionInfo: { id: number | null; url: string; connected: boolean; name: string; color: string } = {
    id: null,
    url: '',
    connected: false,
    name: '',
    color: ''
};

const esClientsCache: Map<number, Client> = new Map();

// ==================== MIDDLEWARE ====================

/**
 * Middleware to check if Elasticsearch connection is active
 */
const requireConnection = (req: Request, res: Response, next: NextFunction) => {
    if (!esClient) {
        return res.status(400).json({ errorCode: 'NO_ES_CONNECTION' });
    }
    next();
};

// ==================== HELPER FUNCTIONS ====================

const getClientForConnection = async (connectionId: number): Promise<Client | null> => {
    if (esClientsCache.has(connectionId)) {
        return esClientsCache.get(connectionId)!;
    }

    const conn = getConnectionById(connectionId);
    if (!conn) return null;

    try {
        // Decrypt password before using
        const decryptedPassword = conn.password ? decryptPassword(conn.password) : null;

        const client = new Client({
            node: conn.url,
            ...(conn.username && decryptedPassword && {
                auth: { username: conn.username, password: decryptedPassword }
            }),
            tls: {
                rejectUnauthorized: false
            }
        });

        await client.ping();

        // Cache'e ekle
        esClientsCache.set(connectionId, client);
        return client;
    } catch (error) {
        console.error(`Connection ${connectionId} failed:`, error);
        return null;
    }
};

// ==================== SAVED CONNECTIONS API ====================

app.get('/api/connections', (req, res) => {
    try {
        const connections = getAllConnections();
        const safeConnections = connections.map(c => ({
            ...c,
            password: c.password ? '••••••••' : null
        }));
        res.json(safeConnections);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});


app.get('/api/connections/:id', (req, res) => {
    try {
        const connection = getConnectionById(parseInt(req.params.id));
        if (!connection) {
            return res.status(404).json({ errorCode: 'CONNECTION_NOT_FOUND' });
        }
        res.json({ ...connection, password: connection.password ? '••••••••' : null });
    } catch (error: any) {
        res.status(500).json({ errorCode: 'INTERNAL_ERROR', details: error.message });
    }
});

app.post('/api/connections', (req, res) => {
    try {
        const { name, url, username, password, color } = req.body;

        // Input validation
        const validation = validateConnectionInput(req.body);
        if (!validation.valid) {
            return res.status(400).json({ errorCode: validation.error });
        }

        const connection = createConnection({ name, url, username, password, color });
        res.json({ ...connection, password: connection.password ? '••••••••' : null });
    } catch (error: any) {
        res.status(500).json({ errorCode: 'INTERNAL_ERROR', details: error.message });
    }
});

app.put('/api/connections/:id', (req, res) => {
    try {
        const { name, url, username, password, color } = req.body;
        const connection = updateConnection(parseInt(req.params.id), {
            name, url, username, password, color
        });
        if (!connection) {
            return res.status(404).json({ errorCode: 'CONNECTION_NOT_FOUND' });
        }
        res.json({ ...connection, password: connection.password ? '••••••••' : null });
    } catch (error: any) {
        res.status(500).json({ errorCode: 'INTERNAL_ERROR', details: error.message });
    }
});

app.delete('/api/connections/:id', (req, res) => {
    try {
        const success = deleteConnection(parseInt(req.params.id));
        if (!success) {
            return res.status(404).json({ errorCode: 'CONNECTION_NOT_FOUND' });
        }
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ errorCode: 'INTERNAL_ERROR', details: error.message });
    }
});

// ==================== ELASTICSEARCH CONNECTION API ====================

app.get('/api/status', (req, res) => {
    res.json(connectionInfo);
});

app.post('/api/connect', async (req, res) => {
    const { connectionId, url, username, password } = req.body;

    let connUrl = url;
    let connUsername = username;
    let connPassword = password;
    let connName = '';
    let connColor = '';
    let connId: number | null = null;

    if (connectionId) {
        const savedConn = getConnectionById(connectionId);
        if (!savedConn) {
            return res.status(404).json({ errorCode: 'SAVED_CONNECTION_NOT_FOUND' });
        }
        connUrl = savedConn.url;
        connUsername = savedConn.username;
        // Decrypt password from database
        connPassword = savedConn.password ? decryptPassword(savedConn.password) : null;
        connName = savedConn.name;
        connColor = savedConn.color;
        connId = savedConn.id;
    }

    if (!connUrl) {
        return res.status(400).json({ errorCode: 'URL_REQUIRED' });
    }

    try {
        esClient = new Client({
            node: connUrl,
            ...(connUsername && connPassword && {
                auth: { username: connUsername, password: connPassword }
            }),
            tls: {
                rejectUnauthorized: false
            }
        });

        await esClient.ping();

        connectionInfo = { id: connId, url: connUrl, connected: true, name: connName, color: connColor };
        res.json({ success: true, message: 'Bağlantı başarılı' });
    } catch (error: any) {
        esClient = null;
        connectionInfo = { id: null, url: '', connected: false, name: '', color: '' };
        res.status(500).json({ errorCode: 'CONNECTION_FAILED', details: error.message });
    }
});

app.post('/api/disconnect', (req, res) => {
    esClient = null;
    connectionInfo = { id: null, url: '', connected: false, name: '', color: '' };
    res.json({ success: true });
});

// Cluster bilgisi
app.get('/api/cluster/health', requireConnection, async (req, res) => {
    try {
        const health = await esClient!.cluster.health();
        res.json(health);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Cluster info (version, etc.)
app.get('/api/cluster/info', requireConnection, async (req, res) => {
    try {
        const info = await esClient!.info();
        res.json(info);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Cluster stats
app.get('/api/cluster/stats', requireConnection, async (req, res) => {
    try {
        const stats = await esClient!.cluster.stats();
        res.json(stats);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Node'lar
app.get('/api/nodes', requireConnection, async (req, res) => {
    try {
        const nodes = await esClient!.nodes.stats();
        res.json(nodes);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/nodes/info', requireConnection, async (req, res) => {
    try {
        const info = await esClient!.nodes.info();
        res.json(info);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Node stats with all metrics for cluster monitoring
app.get('/api/nodes/stats/all', requireConnection, async (req, res) => {
    try {
        const stats = await esClient!.nodes.stats({
            metric: ['jvm', 'os', 'fs', 'indices', 'thread_pool', 'transport', 'http', 'breaker', 'process']
        });
        res.json(stats);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Circuit breakers
app.get('/api/nodes/breakers', requireConnection, async (req, res) => {
    try {
        const stats = await esClient!.nodes.stats({
            metric: ['breaker']
        });
        res.json(stats);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Cat APIs for summary views
app.get('/api/cat/nodes', requireConnection, async (req, res) => {
    try {
        const nodes = await esClient!.cat.nodes({
            format: 'json',
            h: 'name,ip,node.role,master,heap.percent,ram.percent,cpu,load_1m,load_5m,load_15m,disk.used_percent,disk.total,disk.used'
        });
        res.json(nodes);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/cat/shards', requireConnection, async (req, res) => {
    try {
        const shards = await esClient!.cat.shards({
            format: 'json',
            h: 'index,shard,prirep,state,docs,store,node'
        });
        res.json(shards);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/cat/segments', requireConnection, async (req, res) => {
    try {
        const segments = await esClient!.cat.segments({
            format: 'json',
            h: 'index,shard,segment,generation,docs.count,docs.deleted,size,size.memory'
        });
        res.json(segments);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/cat/recovery', requireConnection, async (req, res) => {
    try {
        const recovery = await esClient!.cat.recovery({
            format: 'json',
            active_only: true
        });
        res.json(recovery);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== OPERATIONS / TASKS API ====================

// Get running tasks
app.get('/api/tasks', requireConnection, async (req, res) => {
    try {
        const tasks = await esClient!.tasks.list({
            detailed: true,
            group_by: 'parents'
        });
        res.json(tasks);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Get pending cluster tasks
app.get('/api/cluster/pending_tasks', requireConnection, async (req, res) => {
    try {
        const pending = await esClient!.cluster.pendingTasks();
        res.json(pending);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Get thread pool stats
app.get('/api/thread_pool', requireConnection, async (req, res) => {
    try {
        const threadPool = await esClient!.cat.threadPool({
            format: 'json',
            h: 'node_name,name,active,queue,rejected,completed,type,size,queue_size'
        });
        res.json(threadPool);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Get indexing stats (all indices)
app.get('/api/stats/indexing', requireConnection, async (req, res) => {
    try {
        const stats = await esClient!.indices.stats({
            metric: ['indexing', 'search', 'get', 'merge', 'refresh', 'flush', 'segments']
        });
        res.json(stats);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Get hot threads
app.get('/api/nodes/hot_threads', requireConnection, async (req, res) => {
    try {
        const hotThreads = await esClient!.nodes.hotThreads({
            threads: 3,
            interval: '500ms'
        });
        res.json({ threads: hotThreads });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Cancel a task
app.post('/api/tasks/:taskId/cancel', requireConnection, async (req, res) => {
    try {
        const { taskId } = req.params;
        const result = await esClient!.tasks.cancel({
            task_id: taskId
        });
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Index listesi
app.get('/api/indices', requireConnection, async (req, res) => {
    try {
        // Index bilgilerini al
        const indicesResponse = await esClient!.cat.indices({ format: 'json', h: 'index,health,status,docs.count,store.size' });

        // Alias bilgilerini al
        const aliasesResponse = await esClient!.cat.aliases({ format: 'json', h: 'alias,index' });

        const settingsResponse = await esClient!.indices.getSettings({});

        const aliasMap: Record<string, string[]> = {};
        (aliasesResponse as any[]).forEach((alias: any) => {
            if (!alias.index.startsWith('.')) {
                if (!aliasMap[alias.index]) {
                    aliasMap[alias.index] = [];
                }
                aliasMap[alias.index].push(alias.alias);
            }
        });

        // Sistem indexlerini filtrele ve alias + creation_date bilgisini ekle
        const indices = (indicesResponse as any[])
            .filter((idx: any) => !idx.index.startsWith('.'))
            .map((idx: any) => {
                const settings = (settingsResponse as any)[idx.index]?.settings?.index;
                const creationDate = settings?.creation_date ? parseInt(settings.creation_date) : null;
                const numberOfShards = settings?.number_of_shards ? parseInt(settings.number_of_shards) : null;
                const numberOfReplicas = settings?.number_of_replicas ? parseInt(settings.number_of_replicas) : null;
                return {
                    ...idx,
                    aliases: aliasMap[idx.index] || [],
                    creation_date: creationDate,
                    number_of_shards: numberOfShards,
                    number_of_replicas: numberOfReplicas
                };
            });

        res.json(indices);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Index mapping bilgisi
app.get('/api/indices/:index/mapping', requireConnection, async (req, res) => {
    try {
        const { index } = req.params;
        const response = await esClient!.indices.getMapping({ index });
        res.json(response);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Index settings bilgisi
app.get('/api/indices/:index/settings', requireConnection, async (req, res) => {
    try {
        const { index } = req.params;
        const response = await esClient!.indices.getSettings({ index });
        res.json(response);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Index istatistikleri
app.get('/api/indices/:index/stats', requireConnection, async (req, res) => {
    try {
        const { index } = req.params;
        const response = await esClient!.indices.stats({ index });
        res.json(response);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Index silme
app.delete('/api/indices/:index', requireConnection, async (req, res) => {
    try {
        const { index } = req.params;
        await esClient!.indices.delete({ index });
        res.json({ success: true, message: `Index "${index}" silindi` });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Index open
app.post('/api/indices/:index/open', requireConnection, async (req, res) => {
    try {
        const { index } = req.params;
        await esClient!.indices.open({ index });
        res.json({ success: true, message: `Index "${index}" opened` });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Index close
app.post('/api/indices/:index/close', requireConnection, async (req, res) => {
    try {
        const { index } = req.params;
        await esClient!.indices.close({ index });
        res.json({ success: true, message: `Index "${index}" closed` });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/indices', requireConnection, async (req, res) => {
    const { indexName, settings, mappings } = req.body;

    // Input validation
    const validation = validateIndexName(indexName);
    if (!validation.valid) {
        return res.status(400).json({ errorCode: validation.error });
    }

    try {
        const body: any = {};

        if (settings) {
            const cleanSettings = { ...settings };
            delete cleanSettings.uuid;
            delete cleanSettings.version;
            delete cleanSettings.creation_date;
            delete cleanSettings.provided_name;
            delete cleanSettings.routing;
            delete cleanSettings.resize;

            body.settings = cleanSettings;
        }

        if (mappings) {
            body.mappings = mappings;
        }

        await esClient!.indices.create({
            index: indexName,
            body
        });

        res.json({ success: true, message: `Index "${indexName}" oluşturuldu` });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Aggregation endpoint for facets
app.post('/api/aggregations', requireConnection, async (req, res) => {
    const { index, fields, dateField, query } = req.body;

    if (!index) {
        return res.status(400).json({ errorCode: 'INDEX_REQUIRED' });
    }

    try {
        const aggs: Record<string, any> = {};

        // Keyword field aggregations
        if (fields && Array.isArray(fields)) {
            for (const field of fields) {
                aggs[field] = {
                    terms: {
                        field: field,
                        size: 10
                    }
                };
            }
        }

        // Date field histogram (if provided)
        if (dateField) {
            aggs['date_histogram'] = {
                date_histogram: {
                    field: dateField,
                    calendar_interval: 'day',
                    format: 'yyyy-MM-dd',
                    min_doc_count: 1
                }
            };

            // Date range for quick filters
            aggs['date_range'] = {
                date_range: {
                    field: dateField,
                    ranges: [
                        { key: 'today', from: 'now/d', to: 'now' },
                        { key: 'yesterday', from: 'now-1d/d', to: 'now/d' },
                        { key: 'last_7_days', from: 'now-7d/d', to: 'now' },
                        { key: 'last_30_days', from: 'now-30d/d', to: 'now' },
                        { key: 'this_month', from: 'now/M', to: 'now' }
                    ]
                }
            };
        }

        const searchBody: any = {
            size: 0,
            aggs
        };

        if (query) {
            searchBody.query = query;
        }

        const response = await esClient!.search({
            index,
            body: searchBody
        });

        res.json({
            aggregations: response.aggregations
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/search', requireConnection, async (req, res) => {
    const { index, query, from = 0, size = 20, sort } = req.body;

    if (!index) {
        return res.status(400).json({ errorCode: 'INDEX_REQUIRED' });
    }

    try {
        const searchBody: any = {
            from,
            size
        };

        if (query) {
            searchBody.query = query;
        } else {
            searchBody.query = { match_all: {} };
        }

        if (sort) {
            searchBody.sort = sort;
        }

        const response = await esClient!.search({
            index,
            body: searchBody
        });

        res.json({
            total: typeof response.hits.total === 'number'
                ? response.hits.total
                : response.hits.total?.value || 0,
            hits: response.hits.hits,
            took: response.took
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/indices/:index/doc/:id', requireConnection, async (req, res) => {
    try {
        const { index, id } = req.params;
        const response = await esClient!.get({ index: index as string, id: id as string });
        res.json(response);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/indices/:index/doc/:id', requireConnection, async (req, res) => {
    try {
        const { index, id } = req.params;
        const response = await esClient!.delete({ index: index as string, id: id as string });
        res.json(response);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/indices/:index/doc/:id', requireConnection, async (req, res) => {
    try {
        const { index, id } = req.params;
        const document = req.body;

        const response = await esClient!.index({
            index: index as string,
            id: id as string,
            body: document,
            refresh: true
        });

        res.json(response);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/indices/:index/doc', requireConnection, async (req, res) => {
    try {
        const { index } = req.params;
        const document = req.body;

        const response = await esClient!.index({
            index: index as string,
            body: document,
            refresh: true
        });

        res.json(response);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Alias ekleme
app.post('/api/indices/:index/alias', requireConnection, async (req, res) => {
    try {
        const { index } = req.params;
        const { alias } = req.body;

        // Input validation
        const aliasValidation = validateAliasName(alias);
        if (!aliasValidation.valid) {
            return res.status(400).json({ errorCode: aliasValidation.error });
        }

        await esClient!.indices.putAlias({
            index,
            name: alias
        });

        res.json({ success: true, message: `Alias "${alias}" eklendi` });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Alias silme
app.delete('/api/indices/:index/alias/:alias', requireConnection, async (req, res) => {
    try {
        const { index, alias } = req.params;

        await esClient!.indices.deleteAlias({
            index,
            name: alias
        });

        res.json({ success: true, message: `Alias "${alias}" silindi` });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/rest', requireConnection, async (req, res) => {
    const { method, path: requestPath, body } = req.body;

    if (!method || !requestPath) {
        return res.status(400).json({ errorCode: 'METHOD_PATH_REQUIRED' });
    }

    // Security: Check for dangerous requests
    const normalizedPath = requestPath.startsWith('/') ? requestPath : `/${requestPath}`;
    if (isDangerousRequest(method, normalizedPath)) {
        return res.status(403).json({ errorCode: 'DANGEROUS_REQUEST_BLOCKED' });
    }

    try {
        const response = await esClient!.transport.request({
            method: method.toUpperCase(),
            path: normalizedPath,
            body: body || undefined,
        });

        res.json(response);
    } catch (error: any) {
        if (error.meta?.body) {
            return res.status(error.meta.statusCode || 500).json(error.meta.body);
        }
        res.status(500).json({ error: error.message });
    }
});

// ==================== SAVED QUERIES API ====================

app.get('/api/queries', (req, res) => {
    try {
        const queries = getAllQueries();
        res.json(queries);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Tek sorgu getir
app.get('/api/queries/:id', (req, res) => {
    try {
        const query = getQueryById(parseInt(req.params.id));
        if (!query) {
            return res.status(404).json({ errorCode: 'QUERY_NOT_FOUND' });
        }
        res.json(query);
    } catch (error: any) {
        res.status(500).json({ errorCode: 'INTERNAL_ERROR', details: error.message });
    }
});

// Yeni sorgu ekle
app.post('/api/queries', (req, res) => {
    try {
        const { name, method, path, body } = req.body;
        if (!name || !method || !path) {
            return res.status(400).json({ errorCode: 'NAME_METHOD_PATH_REQUIRED' });
        }
        const query = createQuery({ name, method, path, body });
        res.json(query);
    } catch (error: any) {
        res.status(500).json({ errorCode: 'INTERNAL_ERROR', details: error.message });
    }
});

app.put('/api/queries/:id', (req, res) => {
    try {
        const { name, method, path, body } = req.body;
        const query = updateQuery(parseInt(req.params.id), {
            name, method, path, body
        });
        if (!query) {
            return res.status(404).json({ errorCode: 'QUERY_NOT_FOUND' });
        }
        res.json(query);
    } catch (error: any) {
        res.status(500).json({ errorCode: 'INTERNAL_ERROR', details: error.message });
    }
});

// Sorgu sil
app.delete('/api/queries/:id', (req, res) => {
    try {
        const success = deleteQuery(parseInt(req.params.id));
        if (!success) {
            return res.status(404).json({ errorCode: 'QUERY_NOT_FOUND' });
        }
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ errorCode: 'INTERNAL_ERROR', details: error.message });
    }
});

// ==================== CROSS-SERVER COPY API ====================

app.get('/api/connections/:connectionId/indices', async (req, res) => {
    try {
        const connectionId = parseInt(req.params.connectionId);
        const client = await getClientForConnection(connectionId);

        if (!client) {
            return res.status(400).json({ error: 'Bağlantı kurulamadı' });
        }

        // Index'leri al
        const indicesResponse = await client.cat.indices({ format: 'json', h: 'index,health,status,docs.count,store.size' });

        const aliasesResponse = await client.cat.aliases({ format: 'json', h: 'alias,index' });

        const aliasMap: Record<string, string[]> = {};
        (aliasesResponse as any[]).forEach((alias: any) => {
            if (!alias.index.startsWith('.')) {
                if (!aliasMap[alias.index]) {
                    aliasMap[alias.index] = [];
                }
                aliasMap[alias.index].push(alias.alias);
            }
        });

        const indices = (indicesResponse as any[])
            .filter((idx: any) => !idx.index.startsWith('.'))
            .map((idx: any) => ({
                index: idx.index,
                health: idx.health,
                docsCount: idx['docs.count'],
                storeSize: idx['store.size'],
                aliases: aliasMap[idx.index] || []
            }));

        res.json(indices);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/connections/:connectionId/indices/:index/mapping', async (req, res) => {
    try {
        const connectionId = parseInt(req.params.connectionId);
        const { index } = req.params;
        const client = await getClientForConnection(connectionId);

        if (!client) {
            return res.status(400).json({ error: 'Bağlantı kurulamadı' });
        }

        const mapping = await client.indices.getMapping({ index });
        res.json(mapping);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/copy-document', async (req, res) => {
    const {
        sourceConnectionId,
        sourceIndex,
        documentId,
        targetConnectionId,
        targetIndex,
        createIndexIfNotExists,
        copyMapping
    } = req.body;

    if (!targetConnectionId || !targetIndex || !documentId) {
        return res.status(400).json({ errorCode: 'TARGET_CONNECTION_INDEX_ID_REQUIRED' });
    }

    try {
        let sourceClient: Client | null;
        if (sourceConnectionId) {
            sourceClient = await getClientForConnection(sourceConnectionId);
        } else {
            sourceClient = esClient;
        }

        if (!sourceClient) {
            return res.status(400).json({ errorCode: 'SOURCE_CONNECTION_NOT_FOUND' });
        }

        // Hedef client
        const targetClient = await getClientForConnection(targetConnectionId);
        if (!targetClient) {
            return res.status(400).json({ errorCode: 'TARGET_CONNECTION_FAILED' });
        }

        const sourceDoc = await sourceClient.get({
            index: sourceIndex,
            id: documentId
        });

        const indexExists = await targetClient.indices.exists({ index: targetIndex });

        if (!indexExists) {
            if (createIndexIfNotExists) {
                // Mapping'i de kopyala
                if (copyMapping) {
                    const sourceMapping = await sourceClient.indices.getMapping({ index: sourceIndex });
                    const mappings = (sourceMapping as any)[sourceIndex]?.mappings || {};

                    await targetClient.indices.create({
                        index: targetIndex,
                        body: { mappings }
                    });
                } else {
                    await targetClient.indices.create({ index: targetIndex });
                }
            } else {
                return res.status(400).json({ errorCode: 'TARGET_INDEX_NOT_FOUND', details: targetIndex });
            }
        }

        const result = await targetClient.index({
            index: targetIndex,
            id: documentId,
            body: sourceDoc._source,
            refresh: true
        });

        res.json({
            success: true,
            message: `Döküman başarıyla kopyalandı`,
            result: result.result,
            targetIndex,
            documentId
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/copy-documents', async (req, res) => {
    const {
        sourceConnectionId,
        documents, // [{index, id}, ...]
        targetConnectionId,
        targetIndex,
        createIndexIfNotExists,
        copyMapping
    } = req.body;

    if (!targetConnectionId || !targetIndex || !documents || !documents.length) {
        return res.status(400).json({ errorCode: 'TARGET_CONNECTION_INDEX_DOCUMENTS_REQUIRED' });
    }

    try {
        // Kaynak client
        let sourceClient: Client | null;
        if (sourceConnectionId) {
            sourceClient = await getClientForConnection(sourceConnectionId);
        } else {
            sourceClient = esClient;
        }

        if (!sourceClient) {
            return res.status(400).json({ errorCode: 'SOURCE_CONNECTION_NOT_FOUND' });
        }

        // Hedef client
        const targetClient = await getClientForConnection(targetConnectionId);
        if (!targetClient) {
            return res.status(400).json({ errorCode: 'TARGET_CONNECTION_FAILED' });
        }

        const indexExists = await targetClient.indices.exists({ index: targetIndex });

        if (!indexExists) {
            if (createIndexIfNotExists) {
                if (copyMapping && documents.length > 0) {
                    const sourceMapping = await sourceClient.indices.getMapping({ index: documents[0].index });
                    const mappings = (sourceMapping as any)[documents[0].index]?.mappings || {};

                    await targetClient.indices.create({
                        index: targetIndex,
                        body: { mappings }
                    });
                } else {
                    await targetClient.indices.create({ index: targetIndex });
                }
            } else {
                return res.status(400).json({ errorCode: 'TARGET_INDEX_NOT_FOUND', details: targetIndex });
            }
        }

        const operations: any[] = [];
        let successCount = 0;
        let errorCount = 0;

        for (const doc of documents) {
            try {
                const sourceDoc = await sourceClient.get({
                    index: doc.index,
                    id: doc.id
                });

                operations.push({ index: { _index: targetIndex, _id: doc.id } });
                operations.push(sourceDoc._source);
                successCount++;
            } catch (err) {
                errorCount++;
            }
        }

        if (operations.length > 0) {
            await targetClient.bulk({
                body: operations,
                refresh: true
            });
        }

        res.json({
            success: true,
            message: `${successCount} döküman kopyalandı${errorCount > 0 ? `, ${errorCount} hata` : ''}`,
            copied: successCount,
            errors: errorCount
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== STATIC FILE SERVING (Production) ====================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve static files from dist folder in production
if (process.env.NODE_ENV === 'production') {
    const distPath = path.join(__dirname, '..', 'dist');
    app.use(express.static(distPath));

    // SPA fallback - serve index.html for all non-API routes
    app.use((req, res, next) => {
        if (!req.path.startsWith('/api')) {
            res.sendFile(path.join(distPath, 'index.html'));
        } else {
            next();
        }
    });
}

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
    console.log(`ElasticScope Server running on http://localhost:${PORT}`);
    if (process.env.NODE_ENV === 'production') {
        console.log(`Serving static files from dist folder`);
    } else {
        console.log(`Frontend can connect without CORS issues`);
    }
});
