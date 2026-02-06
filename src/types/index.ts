// ==================== INDEX TYPES ====================

export interface IndexInfo {
    index: string;
    health: 'green' | 'yellow' | 'red' | string;
    status: string;
    'docs.count': string;
    'store.size': string;
    aliases: string[];
    creation_date: number | null;
    number_of_shards: number | null;
    number_of_replicas: number | null;
}

// ==================== SEARCH TYPES ====================

export interface SearchHit {
    _index: string;
    _id: string;
    _score: number;
    _source: Record<string, any>;
}

export interface SearchResult {
    total: number;
    hits: SearchHit[];
    took: number;
}

// ==================== FILTER TYPES ====================

export interface QuickFilter {
    id: string;
    type: 'date' | 'term' | 'custom';
    field: string;
    label: string;
    value: any;
    query: object;
}

export interface FacetBucket {
    key: string;
    doc_count: number;
    selected?: boolean;
}

export interface Facet {
    field: string;
    buckets: FacetBucket[];
}

// ==================== CLUSTER TYPES ====================

export interface ClusterHealth {
    cluster_name: string;
    status: 'green' | 'yellow' | 'red';
    number_of_nodes: number;
    number_of_data_nodes: number;
    active_shards: number;
    active_primary_shards: number;
    relocating_shards: number;
    initializing_shards: number;
    unassigned_shards: number;
    number_of_pending_tasks: number;
}

export interface ClusterStats {
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
}

// ==================== CONNECTION TYPES ====================

export interface ConnectionStatus {
    id: number | null;
    url: string;
    connected: boolean;
    name: string;
    color: string;
}

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

// ==================== QUERY TYPES ====================

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

export interface SavedSearchQuery {
    id: number;
    name: string;
    index_pattern: string;
    query: string; // JSON stringified query
    sort_field: string | null;
    sort_order: string | null;
    ui_state: string | null; // JSON stringified UI state
    created_at: string;
    updated_at: string;
}

export interface CreateSearchQueryInput {
    name: string;
    index_pattern: string;
    query: string; // JSON stringified query
    sort_field?: string;
    sort_order?: string;
    ui_state?: string; // JSON stringified UI state
}

// ==================== COPY TYPES ====================

export interface ConnectionIndex {
    index: string;
    health: string;
    docsCount: string;
    storeSize: string;
    aliases: string[];
}

export interface CopyDocumentInput {
    sourceConnectionId?: number;
    sourceIndex: string;
    documentId: string;
    targetConnectionId: number;
    targetIndex: string;
    createIndexIfNotExists?: boolean;
    copyMapping?: boolean;
}

export interface CopyDocumentsInput {
    sourceConnectionId?: number;
    documents: Array<{ index: string; id: string }>;
    targetConnectionId: number;
    targetIndex: string;
    createIndexIfNotExists?: boolean;
    copyMapping?: boolean;
}

export interface CopyResult {
    success: boolean;
    messageCode?: string;
    result?: string;
    targetIndex?: string;
    documentId?: string;
    copied?: number;
    errors?: number;
}

// ==================== REST API TYPES ====================

export interface RestRequestInput {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    path: string;
    body?: object;
}

// ==================== INDEX CREATION TYPES ====================

export interface CreateIndexInput {
    indexName: string;
    settings?: Record<string, any>;
    mappings?: Record<string, any>;
}

// ==================== NODE TYPES ====================

export interface NodeInfo {
    id: string;
    name: string;
    version: string;
    ip: string;
    roles: string[];
    cpuPercent: number;
    memPercent: number;
    heapPercent: number;
    diskPercent: number;
    uptime: string;
}
