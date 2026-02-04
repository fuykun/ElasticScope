import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Trash2,
    HardDrive,
    Calendar,
    Tag,
    AlertTriangle,
    Loader,
    Search,
    ChevronDown,
    Settings,
    Check,
    RefreshCw,
    ChevronLeft,
    Code,
    ChevronRight,
    Layers,
    FileJson,
    Plus,
    X,
    Play,
    Hash,
    ArrowUpDown,
    ArrowUp,
    ArrowDown,
    FileText,
    Filter,
    Lock,
    Unlock,
} from 'lucide-react';
import {
    getIndices,
    deleteIndex,
    openIndex,
    closeIndex,
    getIndexMapping,
    getIndexSettings,
    searchDocuments,
    IndexInfo,
    addAlias,
    deleteAlias,
    saveDocument,
} from '../api/elasticsearchClient';
import { Modal } from './Modal';
import { DocumentViewer } from './DocumentViewer';
import { JsonViewer } from './JsonViewer';
import { RestModal } from './RestModal';
import { CopyDocumentModal } from './CopyDocumentModal';
import {
    getIndexPrefix,
    getColumnsForPrefix,
    saveColumnsForPrefix,
    extractFieldsFromMapping,
    extractSearchableFieldsFromMapping,
    getSearchFieldsForPrefix,
    saveSearchFieldsForPrefix,
} from '../utils/columnStorage';
import { SearchHit } from '../types';
import type { QuickFilter } from '../types';
import { PAGE_SIZE_OPTIONS } from '../constants';
import { pageSizeStorage } from '../utils/storage';
import { formatDate, formatDocCount } from '../utils/formatters';
import { QuickFilters } from './QuickFilters';
import { translateError } from '../utils/errorHandler';

interface IndexPageProps {
    indexName: string;
    onIndexDeleted: () => void;
    onAddToComparison: (doc: { _id: string; _index: string; _source: Record<string, any> }) => void;
    onRemoveFromComparison: (docId: string, indexName: string) => void;
    isInComparison: (docId: string, indexName: string) => boolean;
    connectionId?: number | null;
}

export const IndexPage: React.FC<IndexPageProps> = ({
    indexName,
    onIndexDeleted,
    onAddToComparison,
    onRemoveFromComparison,
    isInComparison,
    connectionId,
}) => {
    const { t } = useTranslation();

    // Index bilgisi
    const [indexInfo, setIndexInfo] = useState<IndexInfo | null>(null);

    // Delete modal
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteConfirmText, setDeleteConfirmText] = useState('');
    const [deleting, setDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);

    // Settings/Mappings modal
    const [showIndexInfoModal, setShowIndexInfoModal] = useState(false);
    const [indexInfoTab, setIndexInfoTab] = useState<'settings' | 'mappings'>('settings');
    const [settingsData, setSettingsData] = useState<Record<string, any> | null>(null);
    const [mappingsData, setMappingsData] = useState<Record<string, any> | null>(null);
    const [loadingIndexInfo, setLoadingIndexInfo] = useState(false);

    // Search
    const [simpleQuery, setSimpleQuery] = useState('');
    const [searchError, setSearchError] = useState<string | null>(null);
    const [searchField, setSearchField] = useState<string>(''); // Empty means all fields
    const [searchFieldDropdownOpen, setSearchFieldDropdownOpen] = useState(false);
    const [searchFieldSearch, setSearchFieldSearch] = useState('');
    const searchFieldDropdownRef = React.useRef<HTMLDivElement>(null);

    // Column selector
    const [columnDropdownOpen, setColumnDropdownOpen] = useState(false);
    const [availableFields, setAvailableFields] = useState<string[]>([]);
    const [searchableFields, setSearchableFields] = useState<string[]>([]); // Aranabilir alanlar (primitive)
    const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
    const [columnSearch, setColumnSearch] = useState('');
    const columnDropdownRef = React.useRef<HTMLDivElement>(null);

    // Documents
    const [documents, setDocuments] = useState<SearchHit[]>([]);
    const [total, setTotal] = useState(0);
    const [took, setTook] = useState(0);
    const [page, setPage] = useState(0);
    const [loading, setLoading] = useState(false);
    const [currentQuery, setCurrentQuery] = useState<object | null>(null);
    const [pageSize, setPageSize] = useState<number>(pageSizeStorage.get());

    // Alias management
    const [showAliasModal, setShowAliasModal] = useState(false);
    const [newAlias, setNewAlias] = useState('');
    const [aliasError, setAliasError] = useState<string | null>(null);
    const [aliasLoading, setAliasLoading] = useState(false);

    // Open/Close index
    const [openCloseLoading, setOpenCloseLoading] = useState(false);

    // REST Modal
    const [showRestModal, setShowRestModal] = useState(false);
    const [restEndpoint, setRestEndpoint] = useState<'search' | 'count' | 'general'>('search');

    // Copy Document Modal
    const [showCopyModal, setShowCopyModal] = useState(false);
    const [copyDocuments, setCopyDocuments] = useState<Array<{ id: string; source?: any }>>([]);

    // Add Document Modal
    const [showAddDocModal, setShowAddDocModal] = useState(false);
    const [newDocId, setNewDocId] = useState('');
    const [newDocBody, setNewDocBody] = useState('{\n  \n}');
    const [addDocLoading, setAddDocLoading] = useState(false);
    const [addDocError, setAddDocError] = useState<string | null>(null);

    // Sort
    const [sortField, setSortField] = useState<string>('');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
    const [sortFieldSearch, setSortFieldSearch] = useState('');
    const sortDropdownRef = React.useRef<HTMLDivElement>(null);

    // Quick Filters
    const [activeFilters, setActiveFilters] = useState<QuickFilter[]>([]);
    const [showFilters, setShowFilters] = useState(false);
    const [dateFields, setDateFields] = useState<string[]>([]);
    const [keywordFields, setKeywordFields] = useState<string[]>([]);

    const prefix = getIndexPrefix(indexName);

    // Load index info
    useEffect(() => {
        loadIndexInfo();
        loadFieldsAndConfig();
    }, [indexName]);

    // Initial search when index changes
    useEffect(() => {
        performSearch(null);
    }, [indexName]);

    // Close column dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                columnDropdownRef.current &&
                !columnDropdownRef.current.contains(event.target as Node)
            ) {
                setColumnDropdownOpen(false);
            }
            if (
                searchFieldDropdownRef.current &&
                !searchFieldDropdownRef.current.contains(event.target as Node)
            ) {
                setSearchFieldDropdownOpen(false);
            }
            if (
                sortDropdownRef.current &&
                !sortDropdownRef.current.contains(event.target as Node)
            ) {
                setSortDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const loadIndexInfo = async () => {
        try {
            const indices = await getIndices();
            const info = indices.find((idx) => idx.index === indexName);
            setIndexInfo(info || null);
        } catch (error) {
            console.error('Index bilgisi alınamadı:', error);
        }
    };

    const loadFieldsAndConfig = async () => {
        try {
            const mapping = await getIndexMapping(indexName);
            const fields = extractFieldsFromMapping(mapping, indexName);
            setAvailableFields(fields);

            const searchable = extractSearchableFieldsFromMapping(mapping, indexName);
            setSearchableFields(searchable);

            // Extract date and keyword fields for quick filters
            // Skip nested fields as they require nested queries
            const extractTypedFields = (
                mappingObj: Record<string, any>,
                targetType: string,
                parentPath = ''
            ): string[] => {
                const result: string[] = [];
                const properties = mappingObj[indexName]?.mappings?.properties || mappingObj?.properties || mappingObj;

                const traverse = (obj: Record<string, any>, path: string) => {
                    for (const [key, value] of Object.entries(obj)) {
                        if (!value || typeof value !== 'object') continue;

                        const fieldPath = path ? `${path}.${key}` : key;

                        // Skip nested fields - they require nested queries and can't be used in simple filters
                        if (value.type === 'nested') {
                            continue;
                        }

                        if (value.type === targetType) {
                            result.push(fieldPath);
                        }

                        // Check for .keyword sub-field in text fields
                        if (targetType === 'keyword' && value.type === 'text' && value.fields?.keyword) {
                            result.push(`${fieldPath}.keyword`);
                        }

                        // Only traverse into object type fields, not nested
                        if (value.properties && value.type !== 'nested') {
                            traverse(value.properties, fieldPath);
                        }
                    }
                };

                traverse(properties, parentPath);
                return result;
            };

            const dates = extractTypedFields(mapping, 'date');
            const keywords = extractTypedFields(mapping, 'keyword');

            // For facets, prefer shorter field names (without .keyword suffix) for display
            // but store mapping of display name -> actual field name
            const keywordFieldsWithInfo = keywords.map(field => {
                const displayName = field.endsWith('.keyword') ? field.replace('.keyword', '') : field;
                return { field, displayName };
            });

            // Dedupe: if both 'brand' and 'brand.keyword' exist, prefer 'brand.keyword'
            const keywordMap = new Map<string, string>();
            for (const { field, displayName } of keywordFieldsWithInfo) {
                // .keyword version takes priority
                if (field.endsWith('.keyword') || !keywordMap.has(displayName)) {
                    keywordMap.set(displayName, field);
                }
            }

            setDateFields(dates);
            setKeywordFields(Array.from(keywordMap.values()));

            const savedColumns = getColumnsForPrefix(prefix);
            if (savedColumns && savedColumns.length > 0) {
                const validColumns = savedColumns.filter((col) => fields.includes(col));
                setSelectedColumns(validColumns);
            } else {
                const defaultColumns = fields.slice(0, 3);
                setSelectedColumns(defaultColumns);
            }

            const savedSearchField = getSearchFieldsForPrefix(prefix);
            if (savedSearchField && savedSearchField.length > 0 && searchable.includes(savedSearchField[0])) {
                setSearchField(savedSearchField[0]);
            } else if (searchable.includes('name')) {
                // Default to 'name' field if it exists
                setSearchField('name');
            } else {
                setSearchField('');
            }
        } catch (error) {
            console.error('Field listesi alınamadı:', error);
        }
    };

    const performSearch = useCallback(
        async (query: object | null, newPage = 0, customSort?: object) => {
            setLoading(true);
            try {
                let sortObj: object | undefined = customSort;
                if (!sortObj && sortField) {
                    sortObj = [{ [sortField]: { order: sortOrder } }];
                }

                const result = await searchDocuments(
                    indexName,
                    query || undefined,
                    newPage * pageSize,
                    pageSize,
                    sortObj
                );
                setDocuments(result.hits);
                setTotal(result.total);
                setTook(result.took);
                setCurrentQuery(query);
                setPage(newPage);
            } catch (error) {
                console.error('Arama hatası:', error);
                setDocuments([]);
                setTotal(0);
            } finally {
                setLoading(false);
            }
        },
        [indexName, pageSize, sortField, sortOrder]
    );

    const handleSimpleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setSearchError(null);

        if (!simpleQuery.trim()) {
            performSearch(null);
            return;
        }

        let query;
        if (searchField) {
            // Belirli alanda ara - match kullan
            query = {
                match_phrase_prefix: {
                    [searchField]: simpleQuery,
                },
            };
        } else {
            query = {
                query_string: {
                    query: `*${simpleQuery}*`,
                    default_operator: 'AND',
                },
            };
        }
        performSearch(query);
    };

    const handleSelectSearchField = (field: string) => {
        setSearchField(field);
        saveSearchFieldsForPrefix(prefix, field ? [field] : []);
        setSearchFieldDropdownOpen(false);
        setSearchFieldSearch('');
    };

    const filteredSearchFields = searchableFields
        .filter((field) => field.toLowerCase().includes(searchFieldSearch.toLowerCase()))
        .sort((a, b) => {
            if (a === searchField) return -1;
            if (b === searchField) return 1;
            return a.localeCompare(b);
        });

    const handlePageChange = (newPage: number) => {
        performSearch(currentQuery, newPage);
    };

    const handleRefresh = () => {
        performSearch(currentQuery, page);
    };

    const handleOpenCloseIndex = async () => {
        if (!indexInfo) return;

        setOpenCloseLoading(true);
        try {
            if (indexInfo.status === 'close') {
                await openIndex(indexName);
            } else {
                await closeIndex(indexName);
            }
            // Refresh index info
            await loadIndexInfo();
            // If we just opened the index, refresh documents
            if (indexInfo.status === 'close') {
                performSearch(null);
            }
        } catch (error) {
            console.error('Open/Close error:', error);
        } finally {
            setOpenCloseLoading(false);
        }
    };

    const handlePageSizeChange = (newSize: number) => {
        setPageSize(newSize);
        pageSizeStorage.set(newSize);
        setPage(0);
        performSearch(currentQuery, 0);
    };

    // Settings/Mappings handlers
    const handleShowIndexInfo = async (tab: 'settings' | 'mappings' = 'settings') => {
        setIndexInfoTab(tab);
        setShowIndexInfoModal(true);
        setLoadingIndexInfo(true);

        try {
            const [settings, mappings] = await Promise.all([
                getIndexSettings(indexName),
                getIndexMapping(indexName)
            ]);
            setSettingsData(settings);
            setMappingsData(mappings);
        } catch (error) {
            console.error('Index bilgisi alınamadı:', error);
        } finally {
            setLoadingIndexInfo(false);
        }
    };

    // Column selector handlers
    const toggleColumn = (field: string) => {
        setSelectedColumns((prev) =>
            prev.includes(field) ? prev.filter((c) => c !== field) : [...prev, field]
        );
    };

    const handleApplyColumns = () => {
        saveColumnsForPrefix(prefix, selectedColumns);
        setColumnDropdownOpen(false);
    };

    const filteredFields = availableFields
        .filter((field) => field.toLowerCase().includes(columnSearch.toLowerCase()))
        .sort((a, b) => {
            const aSelected = selectedColumns.includes(a);
            const bSelected = selectedColumns.includes(b);
            if (aSelected && !bSelected) return -1;
            if (!aSelected && bSelected) return 1;
            return a.localeCompare(b);
        });

    // Sort handlers
    const filteredSortFields = searchableFields.filter((field) =>
        field.toLowerCase().includes(sortFieldSearch.toLowerCase())
    );

    const handleSortFieldSelect = (field: string) => {
        if (sortField === field) {
            setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortField(field);
            setSortOrder('desc');
        }
    };

    const handleApplySort = () => {
        setSortDropdownOpen(false);
        performSearch(currentQuery, 0);
    };

    const handleClearSort = () => {
        setSortField('');
        setSortOrder('desc');
        setSortDropdownOpen(false);
        performSearch(currentQuery, 0, undefined);
    };

    // Alias handlers
    const handleAddAlias = async () => {
        if (!newAlias.trim()) {
            setAliasError(t('indexPage.aliasNameRequired'));
            return;
        }

        setAliasLoading(true);
        setAliasError(null);

        try {
            await addAlias(indexName, newAlias.trim());
            setNewAlias('');
            setShowAliasModal(false);
            loadIndexInfo(); // Refresh index info to show new alias
        } catch (error: any) {
            setAliasError(translateError(error));
        } finally {
            setAliasLoading(false);
        }
    };

    const handleDeleteAlias = async (alias: string) => {
        if (!confirm(t('indexPage.deleteAliasConfirm', { alias }))) {
            return;
        }

        try {
            await deleteAlias(indexName, alias);
            loadIndexInfo(); // Refresh index info
        } catch (error: any) {
            alert(translateError(error));
        }
    };

    // Add new document handler
    const handleAddDocument = async () => {
        setAddDocLoading(true);
        setAddDocError(null);

        try {
            // JSON'u parse et
            let docBody: Record<string, any>;
            try {
                docBody = JSON.parse(newDocBody);
            } catch {
                setAddDocError(t('common.invalidJson'));
                setAddDocLoading(false);
                return;
            }

            await saveDocument(indexName, docBody, newDocId || undefined);

            setShowAddDocModal(false);
            setNewDocId('');
            setNewDocBody('{\n  \n}');
            handleRefresh();
        } catch (error: any) {
            setAddDocError(error.message || t('indexPage.documentAddFailed'));
        } finally {
            setAddDocLoading(false);
        }
    };

    // Delete handlers
    const handleDelete = async () => {
        if (deleteConfirmText !== indexName) return;

        setDeleting(true);
        setDeleteError(null);

        try {
            await deleteIndex(indexName);
            setShowDeleteModal(false);
            onIndexDeleted();
        } catch (error: any) {
            setDeleteError(translateError(error));
        } finally {
            setDeleting(false);
        }
    };

    const totalPages = Math.ceil(total / pageSize);

    return (
        <div className="index-page">
            {/* Toolbar */}
            <div className="index-toolbar">
                {/* Top row: Index info + Actions */}
                <div className="index-toolbar-top">
                    <div className="index-info">
                        <div className="index-title-row">
                            <div className="index-title-section">
                                <span
                                    className={`index-health-dot ${indexInfo?.health || ''}`}
                                    title={`Health: ${indexInfo?.health || 'unknown'}`}
                                />
                                <h2 className="index-title">{indexName}</h2>
                            </div>

                            {indexInfo?.aliases && indexInfo.aliases.length > 0 && (
                                <div className="index-aliases-section">
                                    {indexInfo.aliases.map((alias) => (
                                        <span key={alias} className="index-alias-tag">
                                            <Tag size={10} />
                                            {alias}
                                            <button
                                                className="alias-delete-btn"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDeleteAlias(alias);
                                                }}
                                                title={t('common.delete')}
                                            >
                                                <X size={10} />
                                            </button>
                                        </span>
                                    ))}
                                    <button
                                        className="btn-add-alias"
                                        onClick={() => setShowAliasModal(true)}
                                        title="Alias Ekle"
                                    >
                                        <Plus size={10} />
                                        Alias Ekle
                                    </button>
                                </div>
                            )}
                            {(!indexInfo?.aliases || indexInfo.aliases.length === 0) && (
                                <div className="index-aliases-section">
                                    <button
                                        className="btn-add-alias"
                                        onClick={() => setShowAliasModal(true)}
                                        title={t('indexPage.addAlias')}
                                    >
                                        <Plus size={10} />
                                        {t('indexPage.addAlias')}
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="index-stats">
                            {!indexInfo ? (
                                <>
                                    <div className="index-stat skeleton-stat">
                                        <span className="skeleton-text" style={{ width: '60px' }} />
                                    </div>
                                    <div className="index-stat skeleton-stat">
                                        <span className="skeleton-text" style={{ width: '50px' }} />
                                    </div>
                                    <div className="index-stat skeleton-stat">
                                        <span className="skeleton-text" style={{ width: '40px' }} />
                                    </div>
                                    <div className="index-stat skeleton-stat">
                                        <span className="skeleton-text" style={{ width: '100px' }} />
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="index-stat">
                                        <FileText size={12} />
                                        <span className="index-stat-value">
                                            {indexInfo?.['docs.count'] ? formatDocCount(indexInfo['docs.count']) : '-'}
                                        </span>
                                    </div>
                                    <div className="index-stat">
                                        <HardDrive size={12} />
                                        <span className="index-stat-value">
                                            {indexInfo?.['store.size'] || '-'}
                                        </span>
                                    </div>
                                    <div className="index-stat">
                                        <Layers size={12} />
                                        <span className="index-stat-value">
                                            {indexInfo?.number_of_shards ?? '-'}s/{indexInfo?.number_of_replicas ?? '-'}r
                                        </span>
                                    </div>
                                    <div className="index-stat">
                                        <Calendar size={12} />
                                        <span className="index-stat-value">
                                            {formatDate(indexInfo?.creation_date)}
                                        </span>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="index-actions">
                        <button
                            className="btn btn-primary btn-sm"
                            onClick={() => setShowAddDocModal(true)}
                            title={t('indexPage.addDocument')}
                        >
                            <Plus size={14} />
                            {t('indexPage.addDocument')}
                        </button>
                        <div className="rest-buttons">
                            <button
                                className="btn-rest"
                                onClick={() => {
                                    setRestEndpoint('search');
                                    setShowRestModal(true);
                                }}
                                title="REST Search"
                            >
                                <Play size={12} />
                                _search
                            </button>
                            <button
                                className="btn-rest"
                                onClick={() => {
                                    setRestEndpoint('count');
                                    setShowRestModal(true);
                                }}
                                title="REST Count"
                            >
                                <Hash size={12} />
                                _count
                            </button>
                            <button
                                className="btn-rest"
                                onClick={() => {
                                    setRestEndpoint('general');
                                    setShowRestModal(true);
                                }}
                                title="REST API"
                            >
                                <Code size={12} />
                                REST
                            </button>
                        </div>
                        <button
                            className="btn btn-ghost"
                            onClick={() => handleShowIndexInfo('settings')}
                            title="Settings & Mappings"
                        >
                            <Settings size={16} />
                        </button>
                        <button
                            className="btn btn-ghost"
                            onClick={handleRefresh}
                            title={t('common.refresh')}
                        >
                            <RefreshCw size={16} className={loading ? 'spin' : ''} />
                        </button>
                        <button
                            className={`btn btn-ghost ${indexInfo?.status === 'close' ? 'btn-warning-subtle' : ''}`}
                            onClick={handleOpenCloseIndex}
                            title={indexInfo?.status === 'close' ? t('indexPage.openIndex') : t('indexPage.closeIndex')}
                            disabled={openCloseLoading}
                        >
                            {openCloseLoading ? (
                                <Loader size={16} className="spin" />
                            ) : indexInfo?.status === 'close' ? (
                                <Unlock size={16} />
                            ) : (
                                <Lock size={16} />
                            )}
                        </button>
                        <button
                            className="btn btn-danger btn-sm"
                            onClick={() => setShowDeleteModal(true)}
                            title={t('indexPage.deleteIndex')}
                        >
                            <Trash2 size={14} />
                            {t('common.delete')}
                        </button>
                    </div>
                </div>

                {/* Bottom row: Search + Column Selector */}
                <div className="index-toolbar-bottom">
                    {/* Search */}
                    <div className="search-container">
                        <form
                            onSubmit={handleSimpleSearch}
                            style={{ display: 'flex', flex: 1, alignItems: 'center', gap: '8px' }}
                        >
                            {/* Search Field Selector */}
                            <div
                                className="search-field-selector-container"
                                ref={searchFieldDropdownRef}
                            >
                                <div className="search-field-selector">
                                    <button
                                        type="button"
                                        className="search-field-trigger"
                                        onClick={() => setSearchFieldDropdownOpen(!searchFieldDropdownOpen)}
                                        title={t('indexPage.searchField')}
                                    >
                                        <Tag size={14} />
                                        <span className="search-field-value">
                                            {searchField || t('indexPage.allFields')}
                                        </span>
                                        <ChevronDown
                                            size={12}
                                            style={{
                                                transform: searchFieldDropdownOpen
                                                    ? 'rotate(180deg)'
                                                    : 'rotate(0deg)',
                                                transition: 'transform 0.15s ease',
                                            }}
                                        />
                                    </button>

                                    {searchFieldDropdownOpen && (
                                        <div className="search-field-dropdown">
                                            <div className="search-field-search">
                                                <Search size={14} />
                                                <input
                                                    type="text"
                                                    placeholder={t('common.search') + '...'}
                                                    value={searchFieldSearch}
                                                    onChange={(e) => setSearchFieldSearch(e.target.value)}
                                                    autoFocus
                                                />
                                            </div>

                                            <div className="search-field-list">
                                                {/* All Fields option */}
                                                <div
                                                    className={`search-field-item ${!searchField ? 'selected' : ''}`}
                                                    onClick={() => handleSelectSearchField('')}
                                                >
                                                    <span className="search-field-label">
                                                        {t('indexPage.allFields')}
                                                    </span>
                                                    {!searchField && <Check size={12} />}
                                                </div>

                                                {filteredSearchFields.length === 0 ? (
                                                    <div className="search-field-empty">
                                                        {t('common.noResults')}
                                                    </div>
                                                ) : (
                                                    filteredSearchFields.map((field) => (
                                                        <div
                                                            key={field}
                                                            className={`search-field-item ${searchField === field ? 'selected' : ''}`}
                                                            onClick={() => handleSelectSearchField(field)}
                                                        >
                                                            <span className="search-field-label">
                                                                {field}
                                                            </span>
                                                            {searchField === field && <Check size={12} />}
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <input
                                type="text"
                                value={simpleQuery}
                                onChange={(e) => setSimpleQuery(e.target.value)}
                                placeholder={searchField ? `${t('indexPage.searchIn')} ${searchField}...` : t('indexPage.searchPlaceholder')}
                                style={{ flex: 1 }}
                            />
                        </form>
                    </div>

                    <button
                        className="search-btn"
                        onClick={handleSimpleSearch}
                        disabled={loading}
                    >
                        {loading ? <Loader size={14} className="spin" /> : <Search size={14} />}
                        {t('common.search')}
                    </button>

                    {/* Column Selector */}
                    <div
                        className="column-selector-container"
                        ref={columnDropdownRef}
                    >
                        <div className="column-selector">
                            <button
                                className="column-selector-trigger"
                                onClick={() => setColumnDropdownOpen(!columnDropdownOpen)}
                            >
                                <Settings size={14} />
                                <span>{t('indexPage.columns')}</span>
                                <span className="column-selector-count">
                                    {selectedColumns.length}
                                </span>
                                <ChevronDown
                                    size={12}
                                    style={{
                                        transform: columnDropdownOpen
                                            ? 'rotate(180deg)'
                                            : 'rotate(0deg)',
                                        transition: 'transform 0.15s ease',
                                    }}
                                />
                            </button>

                            {columnDropdownOpen && (
                                <div className="column-selector-dropdown">
                                    <div className="column-selector-header">
                                        <span className="column-selector-title">
                                            {prefix}
                                        </span>
                                        <div className="column-selector-actions">
                                            <button
                                                className="column-selector-action-btn"
                                                onClick={() =>
                                                    setSelectedColumns([...availableFields])
                                                }
                                            >
                                                {t('indexPage.allFields')}
                                            </button>
                                            <button
                                                className="column-selector-action-btn"
                                                onClick={() => setSelectedColumns([])}
                                            >
                                                {t('common.clear')}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="column-selector-search">
                                        <input
                                            type="text"
                                            placeholder={t('common.search') + '...'}
                                            value={columnSearch}
                                            onChange={(e) => setColumnSearch(e.target.value)}
                                        />
                                    </div>

                                    <div className="column-selector-list">
                                        {filteredFields.length === 0 ? (
                                            <div className="column-selector-empty">
                                                {t('common.noResults')}
                                            </div>
                                        ) : (
                                            filteredFields.map((field) => (
                                                <div
                                                    key={field}
                                                    className={`column-selector-item ${selectedColumns.includes(field)
                                                        ? 'selected'
                                                        : ''
                                                        }`}
                                                    onClick={() => toggleColumn(field)}
                                                >
                                                    <div className="column-selector-checkbox">
                                                        {selectedColumns.includes(field) && (
                                                            <Check size={10} />
                                                        )}
                                                    </div>
                                                    <span className="column-selector-label">
                                                        {field}
                                                    </span>
                                                </div>
                                            ))
                                        )}
                                    </div>

                                    <div className="modal-footer">
                                        <button
                                            className="btn btn-secondary btn-sm"
                                            onClick={() => setColumnDropdownOpen(false)}
                                        >
                                            {t('common.cancel')}
                                        </button>
                                        <button
                                            className="btn btn-primary btn-sm"
                                            onClick={handleApplyColumns}
                                        >
                                            {t('common.apply')}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Sort Selector */}
                    <div
                        className="column-selector-container"
                        ref={sortDropdownRef}
                    >
                        <div className="column-selector">
                            <button
                                className={`column-selector-trigger ${sortField ? 'active' : ''}`}
                                onClick={() => setSortDropdownOpen(!sortDropdownOpen)}
                            >
                                <ArrowUpDown size={14} />
                                <span>{sortField ? `${sortField}` : t('indexPage.sortBy')}</span>
                                {sortField && (
                                    <span className="sort-order-badge">
                                        {sortOrder === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
                                    </span>
                                )}
                                <ChevronDown
                                    size={12}
                                    style={{
                                        transform: sortDropdownOpen
                                            ? 'rotate(180deg)'
                                            : 'rotate(0deg)',
                                        transition: 'transform 0.15s ease',
                                    }}
                                />
                            </button>

                            {sortDropdownOpen && (
                                <div className="column-selector-dropdown">
                                    <div className="column-selector-header">
                                        <span className="column-selector-title">
                                            {t('indexPage.sortBy')}
                                        </span>
                                        {sortField && (
                                            <button
                                                className="column-selector-action-btn"
                                                onClick={handleClearSort}
                                            >
                                                {t('common.clear')}
                                            </button>
                                        )}
                                    </div>

                                    <div className="column-selector-search">
                                        <input
                                            type="text"
                                            placeholder={t('common.search') + '...'}
                                            value={sortFieldSearch}
                                            onChange={(e) => setSortFieldSearch(e.target.value)}
                                        />
                                    </div>

                                    <div className="column-selector-list">
                                        {filteredSortFields.length === 0 ? (
                                            <div className="column-selector-empty">
                                                {t('common.noResults')}
                                            </div>
                                        ) : (
                                            filteredSortFields.map((field) => (
                                                <div
                                                    key={field}
                                                    className={`column-selector-item ${sortField === field ? 'selected' : ''}`}
                                                    onClick={() => handleSortFieldSelect(field)}
                                                >
                                                    <div className="column-selector-checkbox">
                                                        {sortField === field && (
                                                            sortOrder === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />
                                                        )}
                                                    </div>
                                                    <span className="column-selector-label">
                                                        {field}
                                                    </span>
                                                </div>
                                            ))
                                        )}
                                    </div>

                                    <div className="modal-footer">
                                        <button
                                            className="btn btn-secondary btn-sm"
                                            onClick={() => setSortDropdownOpen(false)}
                                        >
                                            {t('common.cancel')}
                                        </button>
                                        <button
                                            className="btn btn-primary btn-sm"
                                            onClick={handleApplySort}
                                            disabled={!sortField}
                                        >
                                            {t('common.apply')}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Filter Toggle Button */}
                    {(dateFields.length > 0 || keywordFields.length > 0) && (
                        <button
                            className={`filter-toggle-btn ${showFilters ? 'active' : ''} ${activeFilters.length > 0 ? 'has-filters' : ''}`}
                            onClick={() => setShowFilters(!showFilters)}
                        >
                            <Filter size={14} />
                            {activeFilters.length > 0 && (
                                <span className="filter-count">{activeFilters.length}</span>
                            )}
                        </button>
                    )}
                </div>

                {searchError && (
                    <div className="error-message" style={{ marginTop: '8px' }}>
                        {searchError}
                    </div>
                )}
            </div>

            {/* Quick Filters */}
            {showFilters && (dateFields.length > 0 || keywordFields.length > 0) && (
                <QuickFilters
                    indexName={indexName}
                    dateFields={dateFields}
                    keywordFields={keywordFields}
                    activeFilters={activeFilters}
                    onFiltersChange={setActiveFilters}
                    onQueryChange={(filterQuery) => {
                        // Merge with search query if exists
                        if (!filterQuery && !simpleQuery.trim()) {
                            performSearch(null);
                        } else if (filterQuery) {
                            performSearch(filterQuery);
                        }
                    }}
                />
            )}

            {/* Documents Section */}
            <div className="documents-section">
                <div className="documents-header">
                    <div className="documents-count">
                        <span>{formatDocCount(total)}</span> {t('indexPage.pagination.results')}
                        {took > 0 && (
                            <span style={{ marginLeft: '8px', opacity: 0.7 }}>
                                ({took}{t('indexPage.pagination.ms')})
                            </span>
                        )}
                    </div>

                    <div className="documents-header-actions">
                        {/* Page Size Selector */}
                        <div className="page-size-selector">
                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', marginRight: '8px' }}>
                                {t('indexPage.pagination.showing')}:
                            </span>
                            <select
                                className="page-size-select"
                                value={pageSize}
                                onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                            >
                                {PAGE_SIZE_OPTIONS.map(size => (
                                    <option key={size} value={size}>
                                        {size}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="documents-pagination">
                                <button
                                    className="btn btn-icon btn-sm"
                                    onClick={() => handlePageChange(page - 1)}
                                    disabled={page === 0 || loading}
                                >
                                    <ChevronLeft size={16} />
                                </button>
                                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                    {page + 1} / {totalPages}
                                </span>
                                <button
                                    className="btn btn-icon btn-sm"
                                    onClick={() => handlePageChange(page + 1)}
                                    disabled={page >= totalPages - 1 || loading}
                                >
                                    <ChevronRight size={16} />
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="documents-list">
                    <DocumentViewer
                        documents={documents}
                        onRefresh={handleRefresh}
                        loading={loading}
                        selectedIndex={indexName}
                        selectedColumns={selectedColumns}
                        onAddToComparison={onAddToComparison}
                        onRemoveFromComparison={onRemoveFromComparison}
                        isInComparison={isInComparison}
                        onCopyDocument={(docs) => {
                            setCopyDocuments(docs);
                            setShowCopyModal(true);
                        }}
                    />
                </div>
            </div>

            {/* Delete Modal */}
            <Modal
                isOpen={showDeleteModal}
                onClose={() => {
                    setShowDeleteModal(false);
                    setDeleteConfirmText('');
                    setDeleteError(null);
                }}
                title=""
            >
                <div className="delete-modal-content">
                    <p className="delete-modal-desc">
                        <AlertTriangle size={16} className="inline-icon" />
                        {t('indexPage.deleteWarning')} <strong>{indexName}</strong>
                    </p>

                    {indexInfo?.aliases && indexInfo.aliases.length > 0 && (
                        <div className="delete-modal-alias-warning">
                            <AlertTriangle size={16} />
                            <div>
                                <strong>{t('indexPage.deleteAliasWarning')}</strong>
                                <div className="delete-modal-alias-list">
                                    {indexInfo.aliases.map((alias) => (
                                        <code key={alias}>{alias}</code>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="delete-modal-input-wrapper">
                        <label>
                            {t('indexPage.deleteConfirm')} <code>{indexName}</code>
                        </label>
                        <input
                            type="text"
                            value={deleteConfirmText}
                            onChange={(e) => setDeleteConfirmText(e.target.value)}
                            placeholder={indexName}
                            autoFocus
                        />
                    </div>

                    {deleteError && (
                        <div className="error-message" style={{ marginBottom: '16px' }}>
                            {deleteError}
                        </div>
                    )}

                    <div className="delete-modal-actions">
                        <button
                            className="btn btn-secondary"
                            onClick={() => {
                                setShowDeleteModal(false);
                                setDeleteConfirmText('');
                                setDeleteError(null);
                            }}
                            disabled={deleting}
                        >
                            {t('common.cancel')}
                        </button>
                        <button
                            className="btn btn-danger"
                            onClick={handleDelete}
                            disabled={deleteConfirmText !== indexName || deleting}
                        >
                            {deleting ? (
                                <>
                                    <Loader size={14} className="spin" />
                                    {t('common.loading')}
                                </>
                            ) : (
                                <>
                                    <Trash2 size={14} />
                                    {t('common.delete')}
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Index Info Modal (Settings & Mappings) */}
            <Modal
                isOpen={showIndexInfoModal}
                onClose={() => setShowIndexInfoModal(false)}
                title={`Index: ${indexName}`}
                size="lg"
            >
                <div className="index-info-modal">
                    <div className="index-info-tabs">
                        <button
                            className={`index-info-tab ${indexInfoTab === 'settings' ? 'active' : ''}`}
                            onClick={() => setIndexInfoTab('settings')}
                        >
                            <Settings size={14} />
                            Settings
                        </button>
                        <button
                            className={`index-info-tab ${indexInfoTab === 'mappings' ? 'active' : ''}`}
                            onClick={() => setIndexInfoTab('mappings')}
                        >
                            <FileJson size={14} />
                            Mappings
                        </button>
                    </div>
                    <div className="index-info-content">
                        {loadingIndexInfo ? (
                            <div className="index-info-loading">
                                <Loader size={24} className="spin" />
                                <span>{t('common.loading')}</span>
                            </div>
                        ) : (
                            <>
                                {indexInfoTab === 'settings' && settingsData && (
                                    <JsonViewer data={settingsData} defaultExpanded={true} expandAllByDefault={true} showSearchBar={true} enableCopy={true} />
                                )}
                                {indexInfoTab === 'mappings' && mappingsData && (
                                    <JsonViewer data={mappingsData} defaultExpanded={true} expandAllByDefault={true} showSearchBar={true} enableCopy={true} />
                                )}
                            </>
                        )}
                    </div>
                </div>
            </Modal>

            {/* Alias Modal */}
            <Modal
                isOpen={showAliasModal}
                onClose={() => {
                    setShowAliasModal(false);
                    setNewAlias('');
                    setAliasError(null);
                }}
                title={t('indexPage.addAlias')}
            >
                <div className="alias-modal-content">
                    <div className="alias-input-group">
                        <label className="alias-label">
                            <Tag size={14} />
                            {t('indexPage.aliasName')}
                        </label>
                        <div className="alias-input-wrapper">
                            <input
                                type="text"
                                className="alias-input"
                                value={newAlias}
                                onChange={(e) => {
                                    setNewAlias(e.target.value);
                                    setAliasError(null);
                                }}
                                placeholder="products-current, users-v2, logs-latest..."
                                autoFocus
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && newAlias.trim()) {
                                        handleAddAlias();
                                    }
                                }}
                            />
                        </div>
                        {newAlias && (
                            <div className="alias-preview">
                                <span className="alias-preview-label">{t('common.preview')}:</span>
                                <span className="alias-preview-tag">
                                    <Tag size={10} />
                                    {newAlias}
                                </span>
                            </div>
                        )}
                    </div>

                    {aliasError && (
                        <div className="alias-error">
                            <AlertTriangle size={16} />
                            {aliasError}
                        </div>
                    )}

                    <div className="alias-modal-footer">
                        <button
                            className="btn btn-secondary"
                            onClick={() => {
                                setShowAliasModal(false);
                                setNewAlias('');
                                setAliasError(null);
                            }}
                            disabled={aliasLoading}
                        >
                            {t('common.cancel')}
                        </button>
                        <button
                            className="btn btn-primary"
                            onClick={handleAddAlias}
                            disabled={aliasLoading || !newAlias.trim()}
                        >
                            {aliasLoading ? (
                                <>
                                    <Loader size={14} className="spin" />
                                    {t('common.loading')}
                                </>
                            ) : (
                                <>
                                    <Plus size={14} />
                                    {t('common.add')}
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </Modal>

            {/* REST Modal */}
            <RestModal
                isOpen={showRestModal}
                onClose={() => setShowRestModal(false)}
                indexName={indexName}
                initialEndpoint={restEndpoint}
            />

            {/* Copy Document Modal */}
            <CopyDocumentModal
                isOpen={showCopyModal}
                onClose={() => {
                    setShowCopyModal(false);
                    setCopyDocuments([]);
                }}
                sourceIndex={indexName}
                documents={copyDocuments}
                currentConnectionId={connectionId ?? undefined}
            />

            {/* Add Document Modal */}
            <Modal
                isOpen={showAddDocModal}
                onClose={() => {
                    setShowAddDocModal(false);
                    setNewDocId('');
                    setNewDocBody('{\n  \n}');
                    setAddDocError(null);
                }}
                title={t('indexPage.addDocument')}
                size="lg"
            >
                <div className="add-document-modal">
                    <div className="add-doc-field">
                        <label className="add-doc-label">
                            {t('indexPage.documentId')}
                        </label>
                        <input
                            type="text"
                            value={newDocId}
                            onChange={(e) => setNewDocId(e.target.value)}
                            placeholder={t('indexPage.documentId')}
                            className="add-doc-input"
                        />
                    </div>

                    <div className="add-doc-field">
                        <label className="add-doc-label">
                            {t('indexPage.documentBody')} (JSON)
                        </label>
                        <textarea
                            value={newDocBody}
                            onChange={(e) => setNewDocBody(e.target.value)}
                            className="add-doc-textarea"
                            placeholder='{"field": "value"}'
                            rows={15}
                            spellCheck={false}
                        />
                    </div>

                    {addDocError && (
                        <div className="add-doc-error">
                            <AlertTriangle size={14} />
                            <span>{addDocError}</span>
                        </div>
                    )}

                    <div className="add-doc-actions">
                        <button
                            className="btn btn-secondary"
                            onClick={() => {
                                setShowAddDocModal(false);
                                setNewDocId('');
                                setNewDocBody('{\n  \n}');
                                setAddDocError(null);
                            }}
                        >
                            <X size={14} />
                            {t('common.cancel')}
                        </button>
                        <button
                            className="btn btn-primary"
                            onClick={handleAddDocument}
                            disabled={addDocLoading || !newDocBody.trim()}
                        >
                            {addDocLoading ? (
                                <>
                                    <Loader size={14} className="spin" />
                                    {t('common.loading')}
                                </>
                            ) : (
                                <>
                                    <Plus size={14} />
                                    {t('common.add')}
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};
