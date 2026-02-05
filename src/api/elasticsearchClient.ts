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
        throw new Error(data.error || 'UNKNOWN_ERROR');
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

// Cluster info (Elasticsearch version etc.)
export interface ClusterInfo {
    name: string;
    cluster_name: string;
    cluster_uuid: string;
    version: {
        number: string;
        build_flavor: string;
        build_type: string;
        build_hash: string;
        build_date: string;
        build_snapshot: boolean;
        lucene_version: string;
        minimum_wire_compatibility_version: string;
        minimum_index_compatibility_version: string;
    };
    tagline: string;
}

export const getClusterInfo = () =>
    apiRequest<ClusterInfo>('/cluster/info');

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

// ==================== OPERATIONS / TASKS API ====================

export interface TaskInfo {
    node: string;
    id: number;
    type: string;
    action: string;
    status?: {
        total?: number;
        updated?: number;
        created?: number;
        deleted?: number;
        batches?: number;
        version_conflicts?: number;
        noops?: number;
        retries?: {
            bulk?: number;
            search?: number;
        };
        throttled_millis?: number;
        requests_per_second?: number;
        throttled_until_millis?: number;
        phases?: Record<string, any>;
    };
    description?: string;
    start_time_in_millis: number;
    running_time_in_nanos: number;
    cancellable: boolean;
    cancelled?: boolean;
    parent_task_id?: string;
    headers?: Record<string, string>;
}

export interface ThreadPoolInfo {
    node_name: string;
    name: string;
    active: string;
    queue: string;
    rejected: string;
    completed: string;
    type: string;
    size: string;
    queue_size: string;
}

export interface IndexingStats {
    _shards: {
        total: number;
        successful: number;
        failed: number;
    };
    _all: {
        primaries: {
            indexing: {
                index_total: number;
                index_time_in_millis: number;
                index_current: number;
                index_failed: number;
                delete_total: number;
                delete_time_in_millis: number;
                delete_current: number;
            };
            search: {
                query_total: number;
                query_time_in_millis: number;
                query_current: number;
                fetch_total: number;
                fetch_time_in_millis: number;
                fetch_current: number;
            };
            get: {
                total: number;
                time_in_millis: number;
                exists_total: number;
                exists_time_in_millis: number;
                missing_total: number;
                missing_time_in_millis: number;
                current: number;
            };
            merge: {
                current: number;
                current_docs: number;
                current_size_in_bytes: number;
                total: number;
                total_time_in_millis: number;
                total_docs: number;
                total_size_in_bytes: number;
            };
            refresh: {
                total: number;
                total_time_in_millis: number;
            };
            flush: {
                total: number;
                total_time_in_millis: number;
            };
            segments: {
                count: number;
                memory_in_bytes: number;
            };
        };
        total: {
            indexing: {
                index_total: number;
                index_time_in_millis: number;
                index_current: number;
                index_failed: number;
                delete_total: number;
                delete_time_in_millis: number;
                delete_current: number;
            };
            search: {
                query_total: number;
                query_time_in_millis: number;
                query_current: number;
                fetch_total: number;
                fetch_time_in_millis: number;
                fetch_current: number;
            };
        };
    };
    indices: Record<string, any>;
}

export const getTasks = () =>
    apiRequest<{
        nodes: Record<string, {
            name: string;
            tasks: Record<string, TaskInfo>;
        }>;
    }>('/tasks');

export const getPendingTasks = () =>
    apiRequest<{
        tasks: Array<{
            insert_order: number;
            priority: string;
            source: string;
            time_in_queue_millis: number;
            time_in_queue: string;
        }>;
    }>('/cluster/pending_tasks');

export const getThreadPool = () =>
    apiRequest<ThreadPoolInfo[]>('/thread_pool');

export const getIndexingStats = () =>
    apiRequest<IndexingStats>('/stats/indexing');

export const getHotThreads = () =>
    apiRequest<{ threads: string }>('/nodes/hot_threads');

export const cancelTask = (taskId: string) =>
    apiRequest<any>(`/tasks/${encodeURIComponent(taskId)}/cancel`, {
        method: 'POST',
    });

// ==================== CLUSTER MONITORING API ====================

// Full node stats (JVM, OS, FS, indices, thread_pool, transport, http, breaker)
export interface NodeStats {
    name: string;
    transport_address: string;
    host: string;
    ip: string;
    roles: string[];
    os: {
        timestamp: number;
        cpu: {
            percent: number;
            load_average?: {
                '1m': number;
                '5m': number;
                '15m': number;
            };
        };
        mem: {
            total_in_bytes: number;
            free_in_bytes: number;
            used_in_bytes: number;
            free_percent: number;
            used_percent: number;
        };
        swap: {
            total_in_bytes: number;
            free_in_bytes: number;
            used_in_bytes: number;
        };
    };
    jvm: {
        timestamp: number;
        uptime_in_millis: number;
        mem: {
            heap_used_in_bytes: number;
            heap_used_percent: number;
            heap_committed_in_bytes: number;
            heap_max_in_bytes: number;
            non_heap_used_in_bytes: number;
            non_heap_committed_in_bytes: number;
        };
        gc: {
            collectors: {
                young: {
                    collection_count: number;
                    collection_time_in_millis: number;
                };
                old: {
                    collection_count: number;
                    collection_time_in_millis: number;
                };
            };
        };
        threads: {
            count: number;
            peak_count: number;
        };
    };
    fs: {
        timestamp: number;
        total: {
            total_in_bytes: number;
            free_in_bytes: number;
            available_in_bytes: number;
        };
        data: Array<{
            path: string;
            mount: string;
            type: string;
            total_in_bytes: number;
            free_in_bytes: number;
            available_in_bytes: number;
        }>;
    };
    transport: {
        server_open: number;
        total_outbound_connections: number;
        rx_count: number;
        rx_size_in_bytes: number;
        tx_count: number;
        tx_size_in_bytes: number;
    };
    http: {
        current_open: number;
        total_opened: number;
    };
    breaker: {
        [key: string]: {
            limit_size_in_bytes: number;
            limit_size: string;
            estimated_size_in_bytes: number;
            estimated_size: string;
            overhead: number;
            tripped: number;
        };
    };
    thread_pool: {
        [key: string]: {
            threads: number;
            queue: number;
            active: number;
            rejected: number;
            largest: number;
            completed: number;
        };
    };
    indices: {
        docs: {
            count: number;
            deleted: number;
        };
        store: {
            size_in_bytes: number;
        };
        indexing: {
            index_total: number;
            index_time_in_millis: number;
            index_current: number;
            index_failed: number;
            delete_total: number;
            delete_time_in_millis: number;
            delete_current: number;
        };
        get: {
            total: number;
            time_in_millis: number;
            exists_total: number;
            exists_time_in_millis: number;
            missing_total: number;
            missing_time_in_millis: number;
            current: number;
        };
        search: {
            query_total: number;
            query_time_in_millis: number;
            query_current: number;
            fetch_total: number;
            fetch_time_in_millis: number;
            fetch_current: number;
            open_contexts: number;
        };
        merges: {
            current: number;
            current_docs: number;
            current_size_in_bytes: number;
            total: number;
            total_time_in_millis: number;
            total_docs: number;
            total_size_in_bytes: number;
        };
        refresh: {
            total: number;
            total_time_in_millis: number;
        };
        flush: {
            total: number;
            total_time_in_millis: number;
        };
        translog: {
            operations: number;
            size_in_bytes: number;
            uncommitted_operations: number;
            uncommitted_size_in_bytes: number;
        };
        segments: {
            count: number;
            memory_in_bytes: number;
            terms_memory_in_bytes: number;
            stored_fields_memory_in_bytes: number;
            term_vectors_memory_in_bytes: number;
            norms_memory_in_bytes: number;
            points_memory_in_bytes: number;
            doc_values_memory_in_bytes: number;
            index_writer_memory_in_bytes: number;
            version_map_memory_in_bytes: number;
            fixed_bit_set_memory_in_bytes: number;
            max_unsafe_auto_id_timestamp: number;
            file_sizes: Record<string, any>;
        };
        fielddata: {
            memory_size_in_bytes: number;
            evictions: number;
        };
        query_cache: {
            memory_size_in_bytes: number;
            total_count: number;
            hit_count: number;
            miss_count: number;
            cache_size: number;
            cache_count: number;
            evictions: number;
        };
        request_cache: {
            memory_size_in_bytes: number;
            evictions: number;
            hit_count: number;
            miss_count: number;
        };
    };
    process: {
        timestamp: number;
        open_file_descriptors: number;
        max_file_descriptors: number;
        cpu: {
            percent: number;
            total_in_millis: number;
        };
        mem: {
            total_virtual_in_bytes: number;
        };
    };
}

export interface NodesStatsResponse {
    cluster_name: string;
    nodes: Record<string, NodeStats>;
}

export const getNodesStatsAll = () =>
    apiRequest<NodesStatsResponse>('/nodes/stats/all');

export const getCatNodes = () =>
    apiRequest<Array<{
        name: string;
        ip: string;
        'node.role': string;
        master: string;
        'heap.percent': string;
        'ram.percent': string;
        cpu: string;
        'load_1m': string;
        'load_5m': string;
        'load_15m': string;
        'disk.used_percent': string;
        'disk.total': string;
        'disk.used': string;
    }>>('/cat/nodes');

export const getCatShards = () =>
    apiRequest<Array<{
        index: string;
        shard: string;
        prirep: string;
        state: string;
        docs: string;
        store: string;
        node: string;
    }>>('/cat/shards');

export const getCatSegments = () =>
    apiRequest<Array<{
        index: string;
        shard: string;
        segment: string;
        generation: string;
        'docs.count': string;
        'docs.deleted': string;
        size: string;
        'size.memory': string;
    }>>('/cat/segments');

export const getCatRecovery = () =>
    apiRequest<Array<{
        index: string;
        shard: string;
        type: string;
        stage: string;
        source_host: string;
        source_node: string;
        target_host: string;
        target_node: string;
        repository: string;
        snapshot: string;
        files: string;
        files_recovered: string;
        files_percent: string;
        files_total: string;
        bytes: string;
        bytes_recovered: string;
        bytes_percent: string;
        bytes_total: string;
    }>>('/cat/recovery');

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
