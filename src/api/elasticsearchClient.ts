import type {
    SavedConnection,
    CreateConnectionInput,
    SavedQuery,
    CreateQueryInput,
    IndexInfo,
    SearchResult,
    ConnectionIndex,
    CopyDocumentInput,
    CopyDocumentsInput,
    CopyResult,
    RestRequestInput,
    CreateIndexInput,
    ClusterHealth,
    ClusterStats,
    ConnectionStatus,
} from '../types';

// Re-export types for convenience
export type {
    SavedConnection,
    CreateConnectionInput,
    SavedQuery,
    CreateQueryInput,
    IndexInfo,
    SearchResult,
    ConnectionIndex,
    CopyDocumentInput,
    CopyDocumentsInput,
    CopyResult,
    RestRequestInput,
    CreateIndexInput,
    ClusterHealth,
    ClusterStats,
    ConnectionStatus,
};

const API_URL = 'http://localhost:3001/api';

async function apiRequest<T>(
    endpoint: string,
    options?: RequestInit
): Promise<T> {
    const response = await fetch(`${API_URL}${endpoint}`, {
        headers: {
            'Content-Type': 'application/json',
        },
        ...options,
    });

    const data = await response.json();

    if (!response.ok) {
        // If server sends errorCode, throw it directly for i18n translation
        if (data.errorCode) {
            const error: any = new Error(data.errorCode);
            error.errorCode = data.errorCode;
            error.details = data.details;
            throw error;
        }
        // Fallback for old-style errors
        const errorMessage = typeof data.error === 'object'
            ? JSON.stringify(data)
            : (data.error || 'UNKNOWN_ERROR');
        throw new Error(errorMessage);
    }

    return data;
}

// ==================== SAVED CONNECTIONS API ====================

export const getSavedConnections = () =>
    apiRequest<SavedConnection[]>('/connections');

export const getSavedConnection = (id: number) =>
    apiRequest<SavedConnection>(`/connections/${id}`);

export const createSavedConnection = (input: CreateConnectionInput) =>
    apiRequest<SavedConnection>('/connections', {
        method: 'POST',
        body: JSON.stringify(input),
    });

export const updateSavedConnection = (id: number, input: Partial<CreateConnectionInput>) =>
    apiRequest<SavedConnection>(`/connections/${id}`, {
        method: 'PUT',
        body: JSON.stringify(input),
    });

export const deleteSavedConnection = (id: number) =>
    apiRequest<{ success: boolean }>(`/connections/${id}`, {
        method: 'DELETE',
    });

// ==================== ELASTICSEARCH CONNECTION API ====================

export const getConnectionStatus = () =>
    apiRequest<{ id: number | null; url: string; connected: boolean; name: string; color: string }>('/status');

export const connectWithSavedConnection = (connectionId: number) =>
    apiRequest<{ success: boolean; message: string }>('/connect', {
        method: 'POST',
        body: JSON.stringify({ connectionId }),
    });

export const connectToElasticsearch = (
    url: string,
    username?: string,
    password?: string
) =>
    apiRequest<{ success: boolean; message: string }>('/connect', {
        method: 'POST',
        body: JSON.stringify({ url, username, password }),
    });

export const disconnect = () =>
    apiRequest<{ success: boolean }>('/disconnect', {
        method: 'POST',
    });

export const getClusterHealth = () =>
    apiRequest<{
        cluster_name: string;
        status: 'green' | 'yellow' | 'red';
        number_of_nodes: number;
        active_shards: number;
        active_primary_shards: number;
        relocating_shards: number;
        initializing_shards: number;
        unassigned_shards: number;
        number_of_pending_tasks: number;
        number_of_data_nodes: number;
    }>('/cluster/health');

// Cluster istatistikleri
export const getClusterStats = () =>
    apiRequest<{
        cluster_name: string;
        cluster_uuid: string;
        status: string;
        indices: {
            count: number;
            shards: {
                total: number;
                primaries: number;
                replication: number;
            };
            docs: {
                count: number;
                deleted: number;
            };
            store: {
                size_in_bytes: number;
            };
        };
        nodes: {
            count: {
                total: number;
                data: number;
                master: number;
                ingest: number;
                coordinating_only: number;
            };
            os: {
                available_processors: number;
                mem: {
                    total_in_bytes: number;
                    free_in_bytes: number;
                    used_in_bytes: number;
                    free_percent: number;
                    used_percent: number;
                };
            };
            jvm: {
                max_uptime_in_millis: number;
                mem: {
                    heap_used_in_bytes: number;
                    heap_max_in_bytes: number;
                };
            };
            fs: {
                total_in_bytes: number;
                free_in_bytes: number;
                available_in_bytes: number;
            };
        };
    }>('/cluster/stats');

// Node'lar
export const getNodes = () =>
    apiRequest<{
        cluster_name: string;
        nodes: Record<string, {
            name: string;
            transport_address: string;
            host: string;
            ip: string;
            roles: string[];
            os: {
                cpu: {
                    percent: number;
                };
                mem: {
                    total_in_bytes: number;
                    free_in_bytes: number;
                    used_in_bytes: number;
                    free_percent: number;
                    used_percent: number;
                };
            };
            jvm: {
                mem: {
                    heap_used_in_bytes: number;
                    heap_max_in_bytes: number;
                    heap_used_percent: number;
                };
                uptime_in_millis: number;
            };
            fs: {
                total: {
                    total_in_bytes: number;
                    free_in_bytes: number;
                    available_in_bytes: number;
                };
            };
        }>;
    }>('/nodes');

export const getNodesInfo = () =>
    apiRequest<{
        cluster_name: string;
        nodes: Record<string, {
            name: string;
            version: string;
            transport_address: string;
            host: string;
            ip: string;
            roles: string[];
            os: {
                name: string;
                arch: string;
                version: string;
                available_processors: number;
            };
            jvm: {
                version: string;
                vm_name: string;
                vm_vendor: string;
                mem: {
                    heap_init_in_bytes: number;
                    heap_max_in_bytes: number;
                };
            };
        }>;
    }>('/nodes/info');

// Index listesi
export const getIndices = () => apiRequest<IndexInfo[]>('/indices');

// Index mapping
export const getIndexMapping = (index: string) =>
    apiRequest<Record<string, any>>(`/indices/${encodeURIComponent(index)}/mapping`);

// Index settings
export const getIndexSettings = (index: string) =>
    apiRequest<Record<string, any>>(`/indices/${encodeURIComponent(index)}/settings`);

// Index istatistikleri
export const getIndexStats = (index: string) =>
    apiRequest<Record<string, any>>(`/indices/${encodeURIComponent(index)}/stats`);

// Index silme
export const deleteIndex = (index: string) =>
    apiRequest<{ success: boolean; message: string }>(`/indices/${encodeURIComponent(index)}`, {
        method: 'DELETE',
    });

// Index open
export const openIndex = (index: string) =>
    apiRequest<{ success: boolean; message: string }>(`/indices/${encodeURIComponent(index)}/open`, {
        method: 'POST',
    });

// Index close
export const closeIndex = (index: string) =>
    apiRequest<{ success: boolean; message: string }>(`/indices/${encodeURIComponent(index)}/close`, {
        method: 'POST',
    });

export const createIndex = (input: CreateIndexInput) =>
    apiRequest<{ success: boolean; message: string }>('/indices', {
        method: 'POST',
        body: JSON.stringify(input),
    });

export const searchDocuments = (
    index: string,
    query?: object,
    from = 0,
    size = 20,
    sort?: object
) =>
    apiRequest<SearchResult>('/search', {
        method: 'POST',
        body: JSON.stringify({ index, query, from, size, sort }),
    });

// Aggregation için tip tanımları
export interface AggregationBucket {
    key: string;
    doc_count: number;
    from?: number;
    to?: number;
}

export interface AggregationResult {
    aggregations: Record<string, {
        buckets: AggregationBucket[];
    }> | null;
}

export const getAggregations = (
    index: string,
    fields?: string[],
    dateField?: string,
    query?: object
) =>
    apiRequest<AggregationResult>('/aggregations', {
        method: 'POST',
        body: JSON.stringify({ index, fields, dateField, query }),
    });

export const getDocument = (index: string, id: string) =>
    apiRequest<{
        _index: string;
        _id: string;
        _source: Record<string, any>;
    }>(`/indices/${encodeURIComponent(index)}/doc/${encodeURIComponent(id)}`);

export const deleteDocument = (index: string, id: string) =>
    apiRequest<{ result: string }>(
        `/indices/${encodeURIComponent(index)}/doc/${encodeURIComponent(id)}`,
        { method: 'DELETE' }
    );

export const saveDocument = (
    index: string,
    document: Record<string, any>,
    id?: string
) =>
    apiRequest<{ _id: string; result: string }>(
        `/indices/${encodeURIComponent(index)}/doc${id ? `/${encodeURIComponent(id)}` : ''}`,
        {
            method: 'PUT',
            body: JSON.stringify(document),
        }
    );

// Alias ekleme
export const addAlias = (index: string, alias: string) =>
    apiRequest<{ success: boolean; message: string }>(
        `/indices/${encodeURIComponent(index)}/alias`,
        {
            method: 'POST',
            body: JSON.stringify({ alias }),
        }
    );

// Alias silme
export const deleteAlias = (index: string, alias: string) =>
    apiRequest<{ success: boolean; message: string }>(
        `/indices/${encodeURIComponent(index)}/alias/${encodeURIComponent(alias)}`,
        {
            method: 'DELETE',
        }
    );

export const executeRestRequest = (input: RestRequestInput) =>
    apiRequest<any>('/rest', {
        method: 'POST',
        body: JSON.stringify(input),
    });

// ==================== SAVED QUERIES API ====================

export const getSavedQueries = () =>
    apiRequest<SavedQuery[]>('/queries');

// Tek sorgu getir
export const getSavedQuery = (id: number) =>
    apiRequest<SavedQuery>(`/queries/${id}`);

// Yeni sorgu kaydet
export const createSavedQuery = (input: CreateQueryInput) =>
    apiRequest<SavedQuery>('/queries', {
        method: 'POST',
        body: JSON.stringify(input),
    });

export const updateSavedQuery = (id: number, input: Partial<CreateQueryInput>) =>
    apiRequest<SavedQuery>(`/queries/${id}`, {
        method: 'PUT',
        body: JSON.stringify(input),
    });

// Sorgu sil
export const deleteSavedQuery = (id: number) =>
    apiRequest<{ success: boolean }>(`/queries/${id}`, {
        method: 'DELETE',
    });

// ==================== CROSS-SERVER COPY API ====================

export const getConnectionIndices = (connectionId: number) =>
    apiRequest<ConnectionIndex[]>(`/connections/${connectionId}/indices`);

export const getConnectionIndexMapping = (connectionId: number, index: string) =>
    apiRequest<Record<string, any>>(`/connections/${connectionId}/indices/${index}/mapping`);

export const copyDocument = (input: CopyDocumentInput) =>
    apiRequest<CopyResult>('/copy-document', {
        method: 'POST',
        body: JSON.stringify(input),
    });

export const copyDocuments = (input: CopyDocumentsInput) =>
    apiRequest<CopyResult>('/copy-documents', {
        method: 'POST',
        body: JSON.stringify(input),
    });
