import 'dotenv/config';
import { Client } from '@elastic/elasticsearch';
import { NextRequest, NextResponse } from 'next/server';
import {
    initializeDatabase,
    getAllConnections,
    getConnectionById,
    createConnection,
    updateConnection,
    deleteConnection,
    getAllQueries,
    getQueryById,
    createQuery,
    updateQuery,
    deleteQuery,
    getAllSearchQueries,
    createSearchQuery,
    deleteSearchQuery,
    decryptPassword
} from '../database';

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
    /^\/_all\//,
    /^\/_template$/,
    /^\/_index_template$/,
];

const isDangerousRequest = (method: string, requestPath: string): boolean => {
    const normalizedPath = requestPath.toLowerCase();
    const normalizedMethod = method.toUpperCase();

    if (DANGEROUS_PATHS.includes(normalizedPath)) {
        return true;
    }

    for (const pattern of DANGEROUS_PATH_PATTERNS) {
        if (pattern.test(normalizedPath)) {
            return true;
        }
    }

    if (normalizedMethod === 'DELETE') {
        if (normalizedPath === '/' || normalizedPath === '/_all' || normalizedPath.startsWith('/_all/')) {
            return true;
        }
        if (normalizedPath === '/*' || normalizedPath === '/_all') {
            return true;
        }
    }

    return false;
};

const validateIndexName = (indexName: string): { valid: boolean; error?: string } => {
    if (!indexName || typeof indexName !== 'string') {
        return { valid: false, error: 'INDEX_NAME_REQUIRED' };
    }

    if (indexName.length > 255) {
        return { valid: false, error: 'INDEX_NAME_TOO_LONG' };
    }

    if (/^[-_+]/.test(indexName)) {
        return { valid: false, error: 'INDEX_NAME_INVALID_START' };
    }

    if (/[\\/*?"<>|,#:\s]/.test(indexName)) {
        return { valid: false, error: 'INDEX_NAME_INVALID_CHARS' };
    }

    if (indexName === '.' || indexName === '..') {
        return { valid: false, error: 'INDEX_NAME_INVALID' };
    }

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

    try {
        new URL(input.url);
    } catch {
        return { valid: false, error: 'URL_INVALID' };
    }

    return { valid: true };
};

let databaseInit: Promise<unknown> | null = null;
let esClient: Client | null = null;
let connectionInfo: { id: number | null; url: string; connected: boolean; name: string; color: string } = {
    id: null,
    url: '',
    connected: false,
    name: '',
    color: ''
};

const esClientsCache: Map<number, Client> = new Map();

const ensureDatabase = async () => {
    if (!databaseInit) {
        databaseInit = initializeDatabase();
    }
    await databaseInit;
};

const json = (body: any, status = 200) => NextResponse.json(body, { status });

const errorMessage = (error: any) => json({ error: error.message }, 500);

const internalError = (error: any) => json({ errorCode: 'INTERNAL_ERROR', details: error.message }, 500);

const readJson = async <T = any>(request: NextRequest): Promise<T> => {
    try {
        return await request.json();
    } catch {
        return {} as T;
    }
};

const requireConnection = (): NextResponse | null => {
    if (!esClient) {
        return json({ errorCode: 'NO_ES_CONNECTION' }, 400);
    }
    return null;
};

const cleanIndexSettings = (settings: Record<string, any>) => {
    const cleanSettings = { ...settings };
    delete cleanSettings.uuid;
    delete cleanSettings.version;
    delete cleanSettings.creation_date;
    delete cleanSettings.provided_name;
    delete cleanSettings.routing;
    delete cleanSettings.resize;
    return cleanSettings;
};

const getClientForConnection = async (connectionId: number): Promise<Client | null> => {
    if (esClientsCache.has(connectionId)) {
        return esClientsCache.get(connectionId)!;
    }

    const conn = await getConnectionById(connectionId);
    if (!conn) return null;

    try {
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
        esClientsCache.set(connectionId, client);
        return client;
    } catch (error) {
        console.error(`Connection ${connectionId} failed:`, error);
        return null;
    }
};

export const handleApiRequest = async (request: NextRequest, segments: string[]) => {
    await ensureDatabase();

    const requestMethod = request.method.toUpperCase();
    const method = requestMethod === 'HEAD' ? 'GET' : requestMethod;
    const [first, second, third, fourth] = segments;

    if (method === 'GET' && first === 'connections' && second === 'export' && segments.length === 2) {
        try {
            const connections = await getAllConnections();
            const exportConnections = connections.map(c => ({
                name: c.name,
                url: c.url,
                username: c.username || undefined,
                password: c.password ? decryptPassword(c.password) : undefined,
                color: c.color,
            }));
            return json(exportConnections);
        } catch (error: any) {
            return internalError(error);
        }
    }

    if (method === 'GET' && first === 'connections' && segments.length === 1) {
        try {
            const connections = await getAllConnections();
            const safeConnections = connections.map(c => ({
                ...c,
                password: c.password ? '••••••••' : null
            }));
            return json(safeConnections);
        } catch (error: any) {
            return errorMessage(error);
        }
    }

    if (method === 'GET' && first === 'connections' && second && segments.length === 2) {
        try {
            const connection = await getConnectionById(parseInt(second));
            if (!connection) {
                return json({ errorCode: 'CONNECTION_NOT_FOUND' }, 404);
            }
            return json({ ...connection, password: connection.password ? decryptPassword(connection.password) : null });
        } catch (error: any) {
            return internalError(error);
        }
    }

    if (method === 'POST' && first === 'connections' && segments.length === 1) {
        try {
            const body = await readJson(request);
            const { name, url, username, password, color } = body;
            const validation = validateConnectionInput(body);
            if (!validation.valid) {
                return json({ errorCode: validation.error }, 400);
            }

            const connection = await createConnection({ name, url, username, password, color });
            return json({ ...connection, password: connection.password ? '••••••••' : null });
        } catch (error: any) {
            return internalError(error);
        }
    }

    if (method === 'PUT' && first === 'connections' && second && segments.length === 2) {
        try {
            const body = await readJson(request);
            const { name, url, username, password, color } = body;
            const connection = await updateConnection(parseInt(second), {
                name, url, username, password, color
            });
            if (!connection) {
                return json({ errorCode: 'CONNECTION_NOT_FOUND' }, 404);
            }
            return json({ ...connection, password: connection.password ? '••••••••' : null });
        } catch (error: any) {
            return internalError(error);
        }
    }

    if (method === 'DELETE' && first === 'connections' && second && segments.length === 2) {
        try {
            const success = await deleteConnection(parseInt(second));
            if (!success) {
                return json({ errorCode: 'CONNECTION_NOT_FOUND' }, 404);
            }
            return json({ success: true });
        } catch (error: any) {
            return internalError(error);
        }
    }

    if (method === 'GET' && first === 'status' && segments.length === 1) {
        return json(connectionInfo);
    }

    if (method === 'POST' && first === 'connect' && segments.length === 1) {
        const body = await readJson(request);
        const { connectionId, url, username, password } = body;

        let connUrl = url;
        let connUsername = username;
        let connPassword = password;
        let connName = '';
        let connColor = '';
        let connId: number | null = null;

        if (connectionId) {
            const savedConn = await getConnectionById(connectionId);
            if (!savedConn) {
                return json({ errorCode: 'SAVED_CONNECTION_NOT_FOUND' }, 404);
            }
            connUrl = savedConn.url;
            connUsername = savedConn.username;
            connPassword = savedConn.password ? decryptPassword(savedConn.password) : null;
            connName = savedConn.name;
            connColor = savedConn.color;
            connId = savedConn.id;
        }

        if (!connUrl) {
            return json({ errorCode: 'URL_REQUIRED' }, 400);
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
            return json({ success: true, messageCode: 'CONNECTION_SUCCESS' });
        } catch (error: any) {
            esClient = null;
            connectionInfo = { id: null, url: '', connected: false, name: '', color: '' };
            return json({ errorCode: 'CONNECTION_FAILED', details: error.message }, 500);
        }
    }

    if (method === 'POST' && first === 'disconnect' && segments.length === 1) {
        esClient = null;
        connectionInfo = { id: null, url: '', connected: false, name: '', color: '' };
        return json({ success: true });
    }

    if (method === 'GET' && first === 'cluster' && second === 'health' && segments.length === 2) {
        const blocked = requireConnection();
        if (blocked) return blocked;
        try {
            const health = await esClient!.cluster.health();
            return json(health);
        } catch (error: any) {
            return errorMessage(error);
        }
    }

    if (method === 'GET' && first === 'cluster' && second === 'info' && segments.length === 2) {
        const blocked = requireConnection();
        if (blocked) return blocked;
        try {
            const info = await esClient!.info();
            return json(info);
        } catch (error: any) {
            return errorMessage(error);
        }
    }

    if (method === 'GET' && first === 'cluster' && second === 'stats' && segments.length === 2) {
        const blocked = requireConnection();
        if (blocked) return blocked;
        try {
            const stats = await esClient!.cluster.stats();
            return json(stats);
        } catch (error: any) {
            return errorMessage(error);
        }
    }

    if (method === 'GET' && first === 'nodes' && segments.length === 1) {
        const blocked = requireConnection();
        if (blocked) return blocked;
        try {
            const nodes = await esClient!.nodes.stats();
            return json(nodes);
        } catch (error: any) {
            return errorMessage(error);
        }
    }

    if (method === 'GET' && first === 'nodes' && second === 'info' && segments.length === 2) {
        const blocked = requireConnection();
        if (blocked) return blocked;
        try {
            const info = await esClient!.nodes.info();
            return json(info);
        } catch (error: any) {
            return errorMessage(error);
        }
    }

    if (method === 'GET' && first === 'nodes' && second === 'stats' && third === 'all' && segments.length === 3) {
        const blocked = requireConnection();
        if (blocked) return blocked;
        try {
            const stats = await esClient!.nodes.stats({
                metric: ['jvm', 'os', 'fs', 'indices', 'thread_pool', 'transport', 'http', 'breaker', 'process']
            });
            return json(stats);
        } catch (error: any) {
            return errorMessage(error);
        }
    }

    if (method === 'GET' && first === 'nodes' && second === 'breakers' && segments.length === 2) {
        const blocked = requireConnection();
        if (blocked) return blocked;
        try {
            const stats = await esClient!.nodes.stats({
                metric: ['breaker']
            });
            return json(stats);
        } catch (error: any) {
            return errorMessage(error);
        }
    }

    if (method === 'GET' && first === 'cat' && second === 'nodes' && segments.length === 2) {
        const blocked = requireConnection();
        if (blocked) return blocked;
        try {
            const nodes = await esClient!.cat.nodes({
                format: 'json',
                h: 'name,ip,node.role,master,heap.percent,ram.percent,cpu,load_1m,load_5m,load_15m,disk.used_percent,disk.total,disk.used'
            });
            return json(nodes);
        } catch (error: any) {
            return errorMessage(error);
        }
    }

    if (method === 'GET' && first === 'cat' && second === 'shards' && segments.length === 2) {
        const blocked = requireConnection();
        if (blocked) return blocked;
        try {
            const shards = await esClient!.cat.shards({
                format: 'json',
                h: 'index,shard,prirep,state,docs,store,node'
            });
            return json(shards);
        } catch (error: any) {
            return errorMessage(error);
        }
    }

    if (method === 'GET' && first === 'cat' && second === 'segments' && segments.length === 2) {
        const blocked = requireConnection();
        if (blocked) return blocked;
        try {
            const segmentsResponse = await esClient!.cat.segments({
                format: 'json',
                h: 'index,shard,segment,generation,docs.count,docs.deleted,size,size.memory'
            });
            return json(segmentsResponse);
        } catch (error: any) {
            return errorMessage(error);
        }
    }

    if (method === 'GET' && first === 'cat' && second === 'recovery' && segments.length === 2) {
        const blocked = requireConnection();
        if (blocked) return blocked;
        try {
            const recovery = await esClient!.cat.recovery({
                format: 'json',
                active_only: true
            });
            return json(recovery);
        } catch (error: any) {
            return errorMessage(error);
        }
    }

    if (method === 'GET' && first === 'tasks' && segments.length === 1) {
        const blocked = requireConnection();
        if (blocked) return blocked;
        try {
            const tasks = await esClient!.tasks.list({
                detailed: true,
                group_by: 'parents'
            });
            return json(tasks);
        } catch (error: any) {
            return errorMessage(error);
        }
    }

    if (method === 'GET' && first === 'cluster' && second === 'pending_tasks' && segments.length === 2) {
        const blocked = requireConnection();
        if (blocked) return blocked;
        try {
            const pending = await esClient!.cluster.pendingTasks();
            return json(pending);
        } catch (error: any) {
            return errorMessage(error);
        }
    }

    if (method === 'GET' && first === 'thread_pool' && segments.length === 1) {
        const blocked = requireConnection();
        if (blocked) return blocked;
        try {
            const threadPool = await esClient!.cat.threadPool({
                format: 'json',
                h: 'node_name,name,active,queue,rejected,completed,type,size,queue_size'
            });
            return json(threadPool);
        } catch (error: any) {
            return errorMessage(error);
        }
    }

    if (method === 'GET' && first === 'stats' && second === 'indexing' && segments.length === 2) {
        const blocked = requireConnection();
        if (blocked) return blocked;
        try {
            const stats = await esClient!.indices.stats({
                metric: ['indexing', 'search', 'get', 'merge', 'refresh', 'flush', 'segments']
            });
            return json(stats);
        } catch (error: any) {
            return errorMessage(error);
        }
    }

    if (method === 'GET' && first === 'nodes' && second === 'hot_threads' && segments.length === 2) {
        const blocked = requireConnection();
        if (blocked) return blocked;
        try {
            const hotThreads = await esClient!.nodes.hotThreads({
                threads: 3,
                interval: '500ms'
            });
            return json({ threads: hotThreads });
        } catch (error: any) {
            return errorMessage(error);
        }
    }

    if (method === 'POST' && first === 'tasks' && second && third === 'cancel' && segments.length === 3) {
        const blocked = requireConnection();
        if (blocked) return blocked;
        try {
            const result = await esClient!.tasks.cancel({
                task_id: second
            });
            return json(result);
        } catch (error: any) {
            return errorMessage(error);
        }
    }

    if (method === 'GET' && first === 'indices' && segments.length === 1) {
        const blocked = requireConnection();
        if (blocked) return blocked;
        try {
            const indicesResponse = await esClient!.cat.indices({ format: 'json', h: 'index,health,status,docs.count,store.size' });
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

            return json(indices);
        } catch (error: any) {
            return errorMessage(error);
        }
    }

    if (method === 'GET' && first === 'indices' && second && third === 'mapping' && segments.length === 3) {
        const blocked = requireConnection();
        if (blocked) return blocked;
        try {
            const response = await esClient!.indices.getMapping({ index: second });
            return json(response);
        } catch (error: any) {
            return errorMessage(error);
        }
    }

    if (method === 'GET' && first === 'indices' && second && third === 'settings' && segments.length === 3) {
        const blocked = requireConnection();
        if (blocked) return blocked;
        try {
            const response = await esClient!.indices.getSettings({ index: second });
            return json(response);
        } catch (error: any) {
            return errorMessage(error);
        }
    }

    if (method === 'GET' && first === 'indices' && second && third === 'stats' && segments.length === 3) {
        const blocked = requireConnection();
        if (blocked) return blocked;
        try {
            const response = await esClient!.indices.stats({ index: second });
            return json(response);
        } catch (error: any) {
            return errorMessage(error);
        }
    }

    if (method === 'DELETE' && first === 'indices' && second && segments.length === 2) {
        const blocked = requireConnection();
        if (blocked) return blocked;
        try {
            await esClient!.indices.delete({ index: second });
            return json({ success: true, messageCode: 'INDEX_DELETED', index: second });
        } catch (error: any) {
            return errorMessage(error);
        }
    }

    if (method === 'POST' && first === 'indices' && second && third === 'open' && segments.length === 3) {
        const blocked = requireConnection();
        if (blocked) return blocked;
        try {
            await esClient!.indices.open({ index: second });
            return json({ success: true, messageCode: 'INDEX_OPENED', index: second });
        } catch (error: any) {
            return errorMessage(error);
        }
    }

    if (method === 'POST' && first === 'indices' && second && third === 'close' && segments.length === 3) {
        const blocked = requireConnection();
        if (blocked) return blocked;
        try {
            await esClient!.indices.close({ index: second });
            return json({ success: true, messageCode: 'INDEX_CLOSED', index: second });
        } catch (error: any) {
            return errorMessage(error);
        }
    }

    if (method === 'POST' && first === 'indices' && segments.length === 1) {
        const blocked = requireConnection();
        if (blocked) return blocked;
        const body = await readJson(request);
        const { indexName, settings, mappings } = body;
        const validation = validateIndexName(indexName);
        if (!validation.valid) {
            return json({ errorCode: validation.error }, 400);
        }

        try {
            const createBody: any = {};
            if (settings) {
                createBody.settings = cleanIndexSettings(settings);
            }
            if (mappings) {
                createBody.mappings = mappings;
            }

            await esClient!.indices.create({
                index: indexName,
                body: createBody
            });

            return json({ success: true, messageCode: 'INDEX_CREATED', index: indexName });
        } catch (error: any) {
            return errorMessage(error);
        }
    }

    if (method === 'POST' && first === 'reindex' && segments.length === 1) {
        const blocked = requireConnection();
        if (blocked) return blocked;
        const body = await readJson(request);
        const { sourceIndex, targetIndex, createNew, settings, mappings } = body;

        if (!sourceIndex || !targetIndex) {
            return json({ errorCode: 'SOURCE_TARGET_INDEX_REQUIRED' }, 400);
        }

        const sourceValidation = validateIndexName(sourceIndex);
        if (!sourceValidation.valid) {
            return json({ errorCode: sourceValidation.error }, 400);
        }

        const targetValidation = validateIndexName(targetIndex);
        if (!targetValidation.valid) {
            return json({ errorCode: targetValidation.error }, 400);
        }

        try {
            if (createNew) {
                const createBody: any = {};
                if (settings) {
                    createBody.settings = cleanIndexSettings(settings);
                }
                if (mappings) {
                    createBody.mappings = mappings;
                }

                await esClient!.indices.create({ index: targetIndex, body: createBody });
            }

            const result = await esClient!.reindex({
                body: {
                    source: { index: sourceIndex },
                    dest: { index: targetIndex },
                },
                wait_for_completion: false,
            } as any);

            const taskId = (result as any).task ?? (result as any).body?.task ?? null;
            return json({ success: true, taskId });
        } catch (error: any) {
            return errorMessage(error);
        }
    }

    if (method === 'POST' && first === 'aggregations' && segments.length === 1) {
        const blocked = requireConnection();
        if (blocked) return blocked;
        const body = await readJson(request);
        const { index, fields, dateField, query } = body;

        if (!index) {
            return json({ errorCode: 'INDEX_REQUIRED' }, 400);
        }

        try {
            const aggs: Record<string, any> = {};

            if (fields && Array.isArray(fields)) {
                for (const field of fields) {
                    aggs[field] = {
                        terms: {
                            field,
                            size: 10
                        }
                    };
                }
            }

            if (dateField) {
                aggs['date_histogram'] = {
                    date_histogram: {
                        field: dateField,
                        calendar_interval: 'day',
                        format: 'yyyy-MM-dd',
                        min_doc_count: 1
                    }
                };

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

            return json({
                aggregations: response.aggregations
            });
        } catch (error: any) {
            return errorMessage(error);
        }
    }

    if (method === 'POST' && first === 'search' && segments.length === 1) {
        const blocked = requireConnection();
        if (blocked) return blocked;
        const body = await readJson(request);
        const { index, query, from = 0, size = 20, sort } = body;

        if (!index) {
            return json({ errorCode: 'INDEX_REQUIRED' }, 400);
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

            return json({
                total: typeof response.hits.total === 'number'
                    ? response.hits.total
                    : response.hits.total?.value || 0,
                hits: response.hits.hits,
                took: response.took
            });
        } catch (error: any) {
            return errorMessage(error);
        }
    }

    if (method === 'GET' && first === 'indices' && second && third === 'doc' && fourth && segments.length === 4) {
        const blocked = requireConnection();
        if (blocked) return blocked;
        try {
            const response = await esClient!.get({ index: second, id: fourth });
            return json(response);
        } catch (error: any) {
            return errorMessage(error);
        }
    }

    if (method === 'DELETE' && first === 'indices' && second && third === 'doc' && fourth && segments.length === 4) {
        const blocked = requireConnection();
        if (blocked) return blocked;
        try {
            const response = await esClient!.delete({ index: second, id: fourth });
            return json(response);
        } catch (error: any) {
            return errorMessage(error);
        }
    }

    if (method === 'PUT' && first === 'indices' && second && third === 'doc' && fourth && segments.length === 4) {
        const blocked = requireConnection();
        if (blocked) return blocked;
        try {
            const document = await readJson(request);
            const response = await esClient!.index({
                index: second,
                id: fourth,
                body: document,
                refresh: true
            });

            return json(response);
        } catch (error: any) {
            return errorMessage(error);
        }
    }

    if (method === 'PUT' && first === 'indices' && second && third === 'doc' && segments.length === 3) {
        const blocked = requireConnection();
        if (blocked) return blocked;
        try {
            const document = await readJson(request);
            const response = await esClient!.index({
                index: second,
                body: document,
                refresh: true
            });

            return json(response);
        } catch (error: any) {
            return errorMessage(error);
        }
    }

    if (method === 'POST' && first === 'indices' && second && third === 'alias' && segments.length === 3) {
        const blocked = requireConnection();
        if (blocked) return blocked;
        try {
            const body = await readJson(request);
            const { alias } = body;
            const aliasValidation = validateAliasName(alias);
            if (!aliasValidation.valid) {
                return json({ errorCode: aliasValidation.error }, 400);
            }

            await esClient!.indices.putAlias({
                index: second,
                name: alias
            });

            return json({ success: true, messageCode: 'ALIAS_ADDED', index: second, alias });
        } catch (error: any) {
            return errorMessage(error);
        }
    }

    if (method === 'DELETE' && first === 'indices' && second && third === 'alias' && fourth && segments.length === 4) {
        const blocked = requireConnection();
        if (blocked) return blocked;
        try {
            await esClient!.indices.deleteAlias({
                index: second,
                name: fourth
            });

            return json({ success: true, message: `Alias "${fourth}" silindi` });
        } catch (error: any) {
            return errorMessage(error);
        }
    }

    if (method === 'POST' && first === 'rest' && segments.length === 1) {
        const blocked = requireConnection();
        if (blocked) return blocked;
        const body = await readJson(request);
        const { method: restMethod, path: requestPath, body: restBody } = body;

        if (!restMethod || !requestPath) {
            return json({ errorCode: 'METHOD_PATH_REQUIRED' }, 400);
        }

        const normalizedPath = requestPath.startsWith('/') ? requestPath : `/${requestPath}`;
        if (isDangerousRequest(restMethod, normalizedPath)) {
            return json({ errorCode: 'DANGEROUS_REQUEST_BLOCKED' }, 403);
        }

        try {
            const response = await esClient!.transport.request({
                method: restMethod.toUpperCase(),
                path: normalizedPath,
                body: restBody || undefined,
            } as any);

            return json(response);
        } catch (error: any) {
            if (error.meta?.body) {
                return json(error.meta.body, error.meta.statusCode || 500);
            }
            return errorMessage(error);
        }
    }

    if (method === 'GET' && first === 'queries' && segments.length === 1) {
        try {
            const queries = await getAllQueries();
            return json(queries);
        } catch (error: any) {
            return errorMessage(error);
        }
    }

    if (method === 'GET' && first === 'queries' && second && segments.length === 2) {
        try {
            const query = await getQueryById(parseInt(second));
            if (!query) {
                return json({ errorCode: 'QUERY_NOT_FOUND' }, 404);
            }
            return json(query);
        } catch (error: any) {
            return internalError(error);
        }
    }

    if (method === 'POST' && first === 'queries' && segments.length === 1) {
        try {
            const body = await readJson(request);
            const { name, method: queryMethod, path, body: queryBody } = body;
            if (!name || !queryMethod || !path) {
                return json({ errorCode: 'NAME_METHOD_PATH_REQUIRED' }, 400);
            }
            const query = await createQuery({ name, method: queryMethod, path, body: queryBody });
            return json(query);
        } catch (error: any) {
            return internalError(error);
        }
    }

    if (method === 'PUT' && first === 'queries' && second && segments.length === 2) {
        try {
            const body = await readJson(request);
            const { name, method: queryMethod, path, body: queryBody } = body;
            const query = await updateQuery(parseInt(second), {
                name, method: queryMethod, path, body: queryBody
            });
            if (!query) {
                return json({ errorCode: 'QUERY_NOT_FOUND' }, 404);
            }
            return json(query);
        } catch (error: any) {
            return internalError(error);
        }
    }

    if (method === 'DELETE' && first === 'queries' && second && segments.length === 2) {
        try {
            const success = await deleteQuery(parseInt(second));
            if (!success) {
                return json({ errorCode: 'QUERY_NOT_FOUND' }, 404);
            }
            return json({ success: true });
        } catch (error: any) {
            return internalError(error);
        }
    }

    if (method === 'GET' && first === 'search-queries' && segments.length === 1) {
        try {
            const queries = await getAllSearchQueries();
            return json(queries);
        } catch (error: any) {
            return internalError(error);
        }
    }

    if (method === 'POST' && first === 'search-queries' && segments.length === 1) {
        try {
            const body = await readJson(request);
            const { name, index_pattern, query, sort_field, sort_order, ui_state } = body;
            if (!name || !index_pattern || !query) {
                return json({ errorCode: 'MISSING_REQUIRED_FIELDS' }, 400);
            }
            const savedQuery = await createSearchQuery({ name, index_pattern, query, sort_field, sort_order, ui_state });
            return json(savedQuery, 201);
        } catch (error: any) {
            return internalError(error);
        }
    }

    if (method === 'DELETE' && first === 'search-queries' && second && segments.length === 2) {
        try {
            const success = await deleteSearchQuery(parseInt(second));
            if (!success) {
                return json({ errorCode: 'QUERY_NOT_FOUND' }, 404);
            }
            return json({ success: true });
        } catch (error: any) {
            return internalError(error);
        }
    }

    if (method === 'GET' && first === 'connections' && second && third === 'indices' && segments.length === 3) {
        try {
            const client = await getClientForConnection(parseInt(second));

            if (!client) {
                return json({ errorCode: 'CONNECTION_FAILED' }, 400);
            }

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

            return json(indices);
        } catch (error: any) {
            return errorMessage(error);
        }
    }

    if (method === 'GET' && first === 'connections' && second && third === 'indices' && fourth && segments[4] === 'mapping' && segments.length === 5) {
        try {
            const client = await getClientForConnection(parseInt(second));

            if (!client) {
                return json({ errorCode: 'CONNECTION_FAILED' }, 400);
            }

            const mapping = await client.indices.getMapping({ index: fourth });
            return json(mapping);
        } catch (error: any) {
            return errorMessage(error);
        }
    }

    if (method === 'POST' && first === 'copy-document' && segments.length === 1) {
        const body = await readJson(request);
        const {
            sourceConnectionId,
            sourceIndex,
            documentId,
            targetConnectionId,
            targetIndex,
            createIndexIfNotExists,
            copyMapping
        } = body;

        if (!targetConnectionId || !targetIndex || !documentId) {
            return json({ errorCode: 'TARGET_CONNECTION_INDEX_ID_REQUIRED' }, 400);
        }

        try {
            const sourceClient = sourceConnectionId ? await getClientForConnection(sourceConnectionId) : esClient;

            if (!sourceClient) {
                return json({ errorCode: 'SOURCE_CONNECTION_NOT_FOUND' }, 400);
            }

            const targetClient = await getClientForConnection(targetConnectionId);
            if (!targetClient) {
                return json({ errorCode: 'TARGET_CONNECTION_FAILED' }, 400);
            }

            const sourceDoc = await sourceClient.get({
                index: sourceIndex,
                id: documentId
            });

            const indexExists = await targetClient.indices.exists({ index: targetIndex });

            if (!indexExists) {
                if (createIndexIfNotExists) {
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
                    return json({ errorCode: 'TARGET_INDEX_NOT_FOUND', details: targetIndex }, 400);
                }
            }

            const result = await targetClient.index({
                index: targetIndex,
                id: documentId,
                body: sourceDoc._source,
                refresh: true
            });

            return json({
                success: true,
                messageCode: 'DOCUMENT_COPIED',
                result: result.result,
                targetIndex,
                documentId
            });
        } catch (error: any) {
            return errorMessage(error);
        }
    }

    if (method === 'POST' && first === 'copy-documents' && segments.length === 1) {
        const body = await readJson(request);
        const {
            sourceConnectionId,
            documents,
            targetConnectionId,
            targetIndex,
            createIndexIfNotExists,
            copyMapping
        } = body;

        if (!targetConnectionId || !targetIndex || !documents || !documents.length) {
            return json({ errorCode: 'TARGET_CONNECTION_INDEX_DOCUMENTS_REQUIRED' }, 400);
        }

        try {
            const sourceClient = sourceConnectionId ? await getClientForConnection(sourceConnectionId) : esClient;

            if (!sourceClient) {
                return json({ errorCode: 'SOURCE_CONNECTION_NOT_FOUND' }, 400);
            }

            const targetClient = await getClientForConnection(targetConnectionId);
            if (!targetClient) {
                return json({ errorCode: 'TARGET_CONNECTION_FAILED' }, 400);
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
                    return json({ errorCode: 'TARGET_INDEX_NOT_FOUND', details: targetIndex }, 400);
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
                } catch {
                    errorCount++;
                }
            }

            if (operations.length > 0) {
                await targetClient.bulk({
                    body: operations,
                    refresh: true
                });
            }

            return json({
                success: true,
                messageCode: 'DOCUMENTS_COPIED',
                copied: successCount,
                errors: errorCount
            });
        } catch (error: any) {
            return errorMessage(error);
        }
    }

    return json({ errorCode: 'NOT_FOUND' }, 404);
};
