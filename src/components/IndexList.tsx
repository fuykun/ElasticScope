import { useEffect, useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, Tag, Home, Plus, List, FolderTree, ChevronRight, ChevronDown, Folder, FolderOpen } from 'lucide-react';
import { getIndices, IndexInfo } from '../api/elasticsearchClient';
import { Modal } from './Modal';
import { CreateIndexModal } from './CreateIndexModal';
import { SkeletonLoader } from './SkeletonLoader';
import { formatRelativeDate, formatDate } from '../utils/formatters';

// Akıllı tarih pattern tespiti - birden fazla yaygın format desteklenir
// Her pattern: [regex, matchFn] — matchFn index adı alır, prefix döndürür (veya null)
const DATE_PATTERNS: Array<{ regex: RegExp; extract: (name: string, match: RegExpMatchArray) => string | null }> = [
    // _YYYYMMDD veya _YYYYMMDD_NNN (ör: logs_20260206, logs_20260206_001)
    { regex: /_(\d{8})(?:_(\d{1,9}))?$/, extract: (name, match) => name.substring(0, match.index!) || null },
    // _YYYYMMDDHHmm veya _YYYYMMDDHHmmss (ör: boyner_202602061003, index_20260206103045)
    { regex: /_(\d{10,14})$/, extract: (name, match) => name.substring(0, match.index!) || null },
    // -YYYY.MM.DD veya _YYYY.MM.DD (ör: logstash-2026.02.06, metrics_2026.02.06)
    { regex: /[-_](\d{4}\.\d{2}\.\d{2})(?:[-_](\d+))?$/, extract: (name, match) => name.substring(0, match.index!) || null },
    // -YYYY-MM-DD veya _YYYY-MM-DD (ör: app-logs-2026-02-06)
    { regex: /[-_](\d{4}-\d{2}-\d{2})(?:[-_](\d+))?$/, extract: (name, match) => name.substring(0, match.index!) || null },
    // -YYYYMMDD veya -YYYYMMDD-NNN (ör: app-logs-20260206)
    { regex: /-(\d{8})(?:-(\d{1,9}))?$/, extract: (name, match) => name.substring(0, match.index!) || null },
    // -YYYYMMDDHHmm (ör: app-logs-202602061003)
    { regex: /-(\d{10,14})$/, extract: (name, match) => name.substring(0, match.index!) || null },
    // _vN veya -vN sürüm numaralı indexler (ör: products_v1, products_v2)
    { regex: /[-_]v(\d{1,4})$/, extract: (name, match) => name.substring(0, match.index!) || null },
];

function extractGroupPrefix(indexName: string): string | null {
    for (const pattern of DATE_PATTERNS) {
        const match = indexName.match(pattern.regex);
        if (match) {
            const prefix = pattern.extract(indexName, match);
            if (prefix && prefix.length > 0) return prefix;
        }
    }
    return null;
}

interface IndexGroup {
    prefix: string;
    indices: IndexInfo[];
}

interface GroupedResult {
    groups: IndexGroup[];
    ungrouped: IndexInfo[];
}

function groupIndices(indices: IndexInfo[]): GroupedResult {
    const prefixMap = new Map<string, IndexInfo[]>();
    const ungrouped: IndexInfo[] = [];

    for (const idx of indices) {
        const prefix = extractGroupPrefix(idx.index);
        if (prefix) {
            if (!prefixMap.has(prefix)) {
                prefixMap.set(prefix, []);
            }
            prefixMap.get(prefix)!.push(idx);
        } else {
            ungrouped.push(idx);
        }
    }

    const groups: IndexGroup[] = [];
    // Minimum 2 index olmalı ki grup olsun, yoksa ungrouped'a düşer
    for (const [prefix, idxList] of prefixMap) {
        if (idxList.length >= 2) {
            groups.push({ prefix, indices: idxList });
        } else {
            ungrouped.push(...idxList);
        }
    }

    groups.sort((a, b) => a.prefix.localeCompare(b.prefix));
    ungrouped.sort((a, b) => a.index.localeCompare(b.index));

    return { groups, ungrouped };
}

function getDisplayName(indexName: string, prefix: string): string {
    // Prefix'i çıkarıp kalan kısmı göster (baştaki _ da temizle)
    return indexName.substring(prefix.length).replace(/^_/, '');
}

function getGroupHealthColor(indices: IndexInfo[]): string {
    if (indices.some(i => i.health === 'red')) return '#ef4444';
    if (indices.some(i => i.health === 'yellow')) return '#eab308';
    if (indices.every(i => i.health === 'green')) return '#22c55e';
    return '#6b7280';
}

interface IndexListProps {
    onSelectIndex: (index: string | null) => void;
    selectedIndex: string | null;
    refreshTrigger: number;
    onRefreshNeeded: () => void;
}

export const IndexList: React.FC<IndexListProps> = ({
    onSelectIndex,
    selectedIndex,
    refreshTrigger,
    onRefreshNeeded,
}) => {
    const { t } = useTranslation();
    const [indices, setIndices] = useState<IndexInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState('');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [viewMode, setViewMode] = useState<'flat' | 'grouped'>(() => {
        return (localStorage.getItem('es_index_view_mode') as 'flat' | 'grouped') || 'grouped';
    });
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => {
        try {
            const saved = localStorage.getItem('es_index_expanded_groups');
            return saved ? new Set(JSON.parse(saved)) : new Set<string>();
        } catch {
            return new Set<string>();
        }
    });

    useEffect(() => {
        localStorage.setItem('es_index_view_mode', viewMode);
    }, [viewMode]);

    useEffect(() => {
        localStorage.setItem('es_index_expanded_groups', JSON.stringify([...expandedGroups]));
    }, [expandedGroups]);

    const toggleGroup = useCallback((prefix: string) => {
        setExpandedGroups(prev => {
            const next = new Set(prev);
            if (next.has(prefix)) {
                next.delete(prefix);
            } else {
                next.add(prefix);
            }
            return next;
        });
    }, []);

    useEffect(() => {
        loadIndices();
    }, [refreshTrigger]);

    const loadIndices = async () => {
        setLoading(true);
        setError(null);

        try {
            const data = await getIndices();
            setIndices(data.sort((a, b) => a.index.localeCompare(b.index)));
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const filteredIndices = indices.filter((idx) => {
        const searchTerm = filter.toLowerCase();
        const matchesIndex = idx.index.toLowerCase().includes(searchTerm);
        const matchesAlias = idx.aliases?.some(a => a.toLowerCase().includes(searchTerm));
        return matchesIndex || matchesAlias;
    });

    const groupedData = useMemo(() => groupIndices(filteredIndices), [filteredIndices]);

    // Seçili index'in grubunu otomatik aç
    useEffect(() => {
        if (selectedIndex && viewMode === 'grouped') {
            const prefix = extractGroupPrefix(selectedIndex);
            if (prefix && groupedData.groups.some(g => g.prefix === prefix)) {
                setExpandedGroups(prev => {
                    if (prev.has(prefix)) return prev;
                    const next = new Set(prev);
                    next.add(prefix);
                    return next;
                });
            }
        }
    }, [selectedIndex, viewMode, groupedData.groups]);

    const getHealthColor = (health: string) => {
        switch (health) {
            case 'green':
                return '#22c55e';
            case 'yellow':
                return '#eab308';
            case 'red':
                return '#ef4444';
            default:
                return '#6b7280';
        }
    };

    if (loading) {
        return (
            <div className="index-list">
                <div className="index-list-header">
                    <button
                        onClick={() => onSelectIndex(null)}
                        className={`btn btn-dashboard ${selectedIndex === null ? 'active' : ''}`}
                        title={t('dashboard.title')}
                    >
                        <Home size={14} />
                        {t('dashboard.title')}
                    </button>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="btn btn-icon"
                        title={t('indexList.createNew')}
                        disabled
                    >
                        <Plus size={14} />
                    </button>
                    <button onClick={loadIndices} className="btn btn-icon" title={t('common.refresh')} disabled>
                        <RefreshCw size={14} />
                    </button>
                </div>
                <input
                    type="text"
                    placeholder={t('indexList.searchPlaceholder')}
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="index-filter"
                    disabled
                />
                <SkeletonLoader type="index-list" count={8} />
            </div>
        );
    }

    if (error) {
        return (
            <div className="index-list">
                <div className="error-message">{error}</div>
                <button onClick={loadIndices} className="btn btn-retry">
                    {t('common.retry')}
                </button>
            </div>
        );
    }

    return (
        <div className="index-list">
            <div className="index-list-header">
                <button
                    onClick={() => onSelectIndex(null)}
                    className={`btn btn-dashboard ${selectedIndex === null ? 'active' : ''}`}
                    title={t('dashboard.title')}
                >
                    <Home size={14} />
                    {t('dashboard.title')}
                </button>
                <button
                    onClick={() => setViewMode(viewMode === 'flat' ? 'grouped' : 'flat')}
                    className={`btn btn-icon ${viewMode === 'grouped' ? 'active' : ''}`}
                    title={viewMode === 'flat' ? t('indexList.grouped') : t('indexList.flat')}
                >
                    {viewMode === 'flat' ? <FolderTree size={14} /> : <List size={14} />}
                </button>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="btn btn-icon"
                    title={t('indexList.createNew')}
                >
                    <Plus size={14} />
                </button>
                <button onClick={loadIndices} className="btn btn-icon" title={t('common.refresh')}>
                    <RefreshCw size={14} />
                </button>
            </div>

            <input
                type="text"
                placeholder={t('indexList.searchPlaceholder')}
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="index-filter"
            />

            <div className="index-items">
                {filteredIndices.length === 0 ? (
                    <div className="no-results">{t('common.noResults')}</div>
                ) : viewMode === 'flat' ? (
                    /* Flat view */
                    filteredIndices.map((idx) => (
                        <IndexItem
                            key={idx.index}
                            idx={idx}
                            selected={selectedIndex === idx.index}
                            onClick={() => onSelectIndex(idx.index)}
                            getHealthColor={getHealthColor}
                        />
                    ))
                ) : (
                    /* Grouped view */
                    <>
                        {groupedData.groups.map((group) => {
                            const isExpanded = expandedGroups.has(group.prefix);
                            const hasSelectedChild = group.indices.some(i => i.index === selectedIndex);
                            const healthColor = getGroupHealthColor(group.indices);

                            return (
                                <div key={group.prefix} className={`index-group ${hasSelectedChild ? 'has-selected' : ''}`}>
                                    <div
                                        className="index-group-header"
                                        onClick={() => toggleGroup(group.prefix)}
                                    >
                                        <span className="group-chevron">
                                            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                        </span>
                                        <span className="group-folder-icon">
                                            {isExpanded ? <FolderOpen size={14} /> : <Folder size={14} />}
                                        </span>
                                        <span className="group-name">{group.prefix}</span>
                                        <span className="group-health-dot" style={{ backgroundColor: healthColor }} />
                                        <span className="group-count">{group.indices.length}</span>
                                    </div>
                                    {isExpanded && (
                                        <div className="index-group-items">
                                            {group.indices.map((idx) => (
                                                <IndexItem
                                                    key={idx.index}
                                                    idx={idx}
                                                    selected={selectedIndex === idx.index}
                                                    onClick={() => onSelectIndex(idx.index)}
                                                    getHealthColor={getHealthColor}
                                                    displayName={getDisplayName(idx.index, group.prefix)}
                                                    grouped
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        {groupedData.ungrouped.map((idx) => (
                            <IndexItem
                                key={idx.index}
                                idx={idx}
                                selected={selectedIndex === idx.index}
                                onClick={() => onSelectIndex(idx.index)}
                                getHealthColor={getHealthColor}
                            />
                        ))}
                    </>
                )}
            </div>

            {/* Create Index Modal */}
            <Modal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                title={t('indexList.createNew')}
            >
                <CreateIndexModal
                    onSuccess={() => {
                        setShowCreateModal(false);
                        loadIndices();
                        onRefreshNeeded();
                    }}
                    onCancel={() => setShowCreateModal(false)}
                />
            </Modal>
        </div>
    );
};

/* ====== Index Item Component ====== */
interface IndexItemProps {
    idx: IndexInfo;
    selected: boolean;
    onClick: () => void;
    getHealthColor: (health: string) => string;
    displayName?: string;
    grouped?: boolean;
}

const IndexItem: React.FC<IndexItemProps> = ({ idx, selected, onClick, getHealthColor, displayName, grouped }) => {
    return (
        <div
            className={`index-item ${selected ? 'selected' : ''} ${grouped ? 'grouped-child' : ''}`}
            onClick={onClick}
            title={idx.index}
        >
            <span
                className="health-dot"
                title={`Health: ${idx.health}`}
                style={{ backgroundColor: getHealthColor(idx.health) }}
            />
            <div className="index-content">
                <div className="index-top-row">
                    <span className="index-name">{displayName || idx.index}</span>
                    {idx.aliases?.length > 0 && (
                        <span className="alias-count" title={idx.aliases.join(', ')}>
                            <Tag size={9} />
                            {idx.aliases.length}
                        </span>
                    )}
                </div>
                <div className="index-bottom-row">
                    {idx['store.size'] && (
                        <span className="index-size">{idx['store.size']}</span>
                    )}
                    {idx.creation_date && (
                        <span className="index-date" title={formatDate(idx.creation_date)}>
                            {formatRelativeDate(idx.creation_date)}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};
