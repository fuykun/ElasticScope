import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Play, Loader, Clock, AlertCircle, CheckCircle, Save, FolderOpen,
    Trash2, ChevronDown, Plus, X, Maximize2, Tag
} from 'lucide-react';
import {
    executeRestRequest, getSavedQueries, createSavedQuery, deleteSavedQuery, SavedQuery,
    getIndices, IndexInfo
} from '../api/elasticsearchClient';
import { JsonViewer } from './JsonViewer';
import { MethodSelector } from './MethodSelector';
import { IndexList } from './IndexList';
import { restPanelWidthStorage } from '../utils/storage';
import { DEFAULT_SEARCH_BODY } from '../constants';
import '../styles/components/rest-page.css';
import '../styles/components/rest-modal.css';

interface RestTab {
    id: string;
    name: string;
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    path: string;
    body: string;
    response: any;
    loading: boolean;
    error: string | null;
    executionTime: number | null;
    statusCode: number | null;
}

const DEFAULT_TAB: RestTab = {
    id: '1',
    name: 'New Request',
    method: 'POST',
    path: '/_search',
    body: JSON.stringify(DEFAULT_SEARCH_BODY, null, 2),
    response: null,
    loading: false,
    error: null,
    executionTime: null,
    statusCode: null
};

interface RestPageProps {
    initialIndex?: string;
    connectionId: number;
}

export const RestPage: React.FC<RestPageProps> = ({ initialIndex, connectionId }) => {
    const { t } = useTranslation();

    // -------------------------------------------------------------------------
    // STATE
    // -------------------------------------------------------------------------

    // Indices for pills
    const [indices, setIndices] = useState<IndexInfo[]>([]);

    // Index List State
    const [selectedListIndex, setSelectedListIndex] = useState<string | null>(null);
    const [indexListRefreshTrigger, setIndexListRefreshTrigger] = useState(0);

    // Tabs State - Initialize from storage based on connectionId
    const [tabs, setTabs] = useState<RestTab[]>(() => {
        try {
            const stored = localStorage.getItem(`rest_tabs_${connectionId}`);
            if (stored) {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    return parsed;
                }
            }
        } catch { }

        return [{
            ...DEFAULT_TAB,
            id: Date.now().toString(),
            path: initialIndex ? `/${initialIndex}/_search` : '/_search'
        }];
    });

    const [activeTabId, setActiveTabId] = useState<string>(() => {
        try {
            const storedId = localStorage.getItem(`rest_active_tab_id_${connectionId}`);
            const storedTabsStr = localStorage.getItem(`rest_tabs_${connectionId}`);

            if (storedTabsStr) {
                const storedTabs = JSON.parse(storedTabsStr);
                if (Array.isArray(storedTabs) && storedTabs.length > 0) {
                    if (storedId && storedTabs.some((t: any) => t.id === storedId)) {
                        return storedId;
                    }
                    return storedTabs[0].id;
                }
            }
        } catch { }
        // If we initialized tabs with defaults (in tabs useState), we can't easily guess the ID here 
        // because Date.now() is dynamic.
        // We'll fix it in the useEffect below.
        return '';
    });

    // Tab Editing State
    const [editingTabId, setEditingTabId] = useState<string | null>(null);
    const [editingName, setEditingName] = useState('');
    const editInputRef = useRef<HTMLInputElement>(null);

    // Other state
    const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([]);
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [queryName, setQueryName] = useState('');
    const [saveError, setSaveError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [showQueriesDropdown, setShowQueriesDropdown] = useState(false);
    const [loadingQueries, setLoadingQueries] = useState(false);

    // Panel Resize state
    const [panelWidthPercent, setPanelWidthPercent] = useState(() => restPanelWidthStorage.get());
    const isResizingPanel = useRef(false);
    const contentRef = useRef<HTMLDivElement>(null);

    // -------------------------------------------------------------------------
    // EFFECTS
    // -------------------------------------------------------------------------

    // Load indices for pills
    useEffect(() => {
        const fetchIndices = async () => {
            try {
                const list = await getIndices();
                // Sort: Indices with aliases first, then by name
                const sorted = list.sort((a, b) => {
                    if (a.index < b.index) return -1;
                    if (a.index > b.index) return 1;
                    return 0;
                });
                setIndices(sorted);
            } catch (e) {
                console.error("Failed to load indices", e);
            }
        };
        fetchIndices();
    }, [connectionId]);

    // Ensure activeTabId is valid
    useEffect(() => {
        if (tabs.length > 0) {
            const exists = tabs.some(t => t.id === activeTabId);
            if (!exists) {
                setActiveTabId(tabs[0].id);
            }
        }
    }, [tabs, activeTabId]);

    // Persist State
    useEffect(() => {
        if (tabs.length > 0) {
            localStorage.setItem(`rest_tabs_${connectionId}`, JSON.stringify(tabs));
        }
    }, [tabs, connectionId]);

    useEffect(() => {
        if (activeTabId) {
            localStorage.setItem(`rest_active_tab_id_${connectionId}`, activeTabId);
        }
    }, [activeTabId, connectionId]);

    // Load saved queries
    const loadSavedQueries = useCallback(async () => {
        setLoadingQueries(true);
        try {
            const queries = await getSavedQueries();
            setSavedQueries(queries);
        } catch (err) {
            console.error('Failed to load queries:', err);
        } finally {
            setLoadingQueries(false);
        }
    }, []);

    useEffect(() => {
        loadSavedQueries();
    }, [loadSavedQueries]);

    // Focus input when editing starts
    useEffect(() => {
        if (editingTabId && editInputRef.current) {
            editInputRef.current.focus();
            editInputRef.current.select();
        }
    }, [editingTabId]);

    // -------------------------------------------------------------------------
    // HELPERS & HANDLERS
    // -------------------------------------------------------------------------

    // Derived active tab
    const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];

    const updateActiveTab = (updates: Partial<RestTab>) => {
        setTabs(prev => prev.map(tab =>
            tab.id === activeTabId ? { ...tab, ...updates } : tab
        ));
    };

    const updateTab = (id: string, updates: Partial<RestTab>) => {
        setTabs(prev => prev.map(tab =>
            tab.id === id ? { ...tab, ...updates } : tab
        ));
    };

    const handleNewTab = () => {
        const newTab: RestTab = {
            ...DEFAULT_TAB,
            id: Date.now().toString(),
            name: `Request ${tabs.length + 1}`,
            path: initialIndex ? `/${initialIndex}/_search` : '/_search'
        };
        setTabs(prev => [...prev, newTab]);
        setActiveTabId(newTab.id);
    };

    const handleCloseTab = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (tabs.length === 1) {
            updateTab(id, {
                ...DEFAULT_TAB,
                id: id,
                name: 'New Request'
            });
            return;
        }

        const newTabs = tabs.filter(t => t.id !== id);
        setTabs(newTabs);
        if (activeTabId === id) {
            setActiveTabId(newTabs[newTabs.length - 1].id);
        }
    };

    // Tab Editing
    const handleStartEdit = (e: React.MouseEvent, tab: RestTab) => {
        e.stopPropagation();
        setEditingTabId(tab.id);
        setEditingName(tab.name);
    };

    const handleSaveEdit = () => {
        if (editingTabId && editingName.trim()) {
            updateTab(editingTabId, { name: editingName.trim() });
        }
        setEditingTabId(null);
        setEditingName('');
    };

    const handleCancelEdit = () => {
        setEditingTabId(null);
        setEditingName('');
    };

    const handleEditKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSaveEdit();
        } else if (e.key === 'Escape') {
            handleCancelEdit();
        }
    };

    // Index Pill Click
    const handlePillClick = (indexName: string) => {
        const currentPath = activeTab.path.trim();
        let path = currentPath.startsWith('/') ? currentPath : '/' + currentPath;

        let newPath = '';
        if (path === '/' || path === '') {
            newPath = `/${indexName}`;
        } else if (path.startsWith('/_')) {
            // e.g. /_search -> /index/_search
            newPath = `/${indexName}${path}`;
        } else {
            // Replace first segment
            const parts = path.split('/');
            // parts[0] is empty, parts[1] is index/segment
            const suffix = parts.slice(2).join('/');
            newPath = `/${indexName}${suffix ? '/' + suffix : ''}`;
        }

        updateActiveTab({ path: newPath });
    };

    // Index List handlers
    const handleIndexListSelect = (indexName: string | null) => {
        setSelectedListIndex(indexName);
        if (indexName) {
            updateActiveTab({ path: `/${indexName}/_search` });
        }
    };

    const handleRefreshIndices = () => {
        setIndexListRefreshTrigger(prev => prev + 1);
    };

    // Execution Logic
    const handleExecute = async () => {
        const currentTab = activeTab;

        updateActiveTab({
            loading: true,
            error: null,
            response: null,
            executionTime: null,
            statusCode: null
        });

        const startTime = performance.now();

        try {
            let parsedBody: object | undefined;
            if (currentTab.body.trim()) {
                try {
                    parsedBody = JSON.parse(currentTab.body);
                } catch (e) {
                    updateActiveTab({
                        loading: false,
                        error: t('common.invalidJson')
                    });
                    return;
                }
            }

            const result = await executeRestRequest({
                method: currentTab.method,
                path: currentTab.path,
                body: parsedBody,
            });

            const endTime = performance.now();
            updateActiveTab({
                loading: false,
                response: result,
                statusCode: 200,
                executionTime: Math.round(endTime - startTime)
            });
        } catch (err: any) {
            const endTime = performance.now();

            let response = null;
            let statusCode = 500;
            let errorMessage = err.message || t('common.unknownError');

            if (err.message) {
                try {
                    const errorObj = JSON.parse(err.message);
                    response = errorObj;
                    statusCode = errorObj.status || 400;
                    errorMessage = null;
                } catch {
                    // plain text error
                }
            }

            updateActiveTab({
                loading: false,
                response: response,
                error: errorMessage,
                statusCode: statusCode,
                executionTime: Math.round(endTime - startTime)
            });
        }
    };

    // Saved Queries Logic
    const handleSaveQuery = async () => {
        if (!queryName.trim()) {
            setSaveError('Query name is required');
            return;
        }

        setSaving(true);
        setSaveError(null);

        try {
            await createSavedQuery({
                name: queryName.trim(),
                method: activeTab.method,
                path: activeTab.path,
                body: activeTab.body,
            });
            setShowSaveModal(false);
            setQueryName('');
            loadSavedQueries();
            updateActiveTab({ name: queryName.trim() });
        } catch (err: any) {
            setSaveError(err.message || t('restModal.saveError'));
        } finally {
            setSaving(false);
        }
    };

    const handleLoadQuery = (query: SavedQuery) => {
        updateActiveTab({
            method: query.method as any,
            path: query.path,
            body: query.body || '',
            name: query.name,
            response: null,
            statusCode: null,
            executionTime: null,
            error: null
        });
        setShowQueriesDropdown(false);
    };

    const handleDeleteQuery = async (id: number, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            await deleteSavedQuery(id);
            loadSavedQueries();
        } catch (err) {
            console.error('Failed to delete query:', err);
        }
    };

    const formatJson = () => {
        try {
            const parsed = JSON.parse(activeTab.body);
            updateActiveTab({ body: JSON.stringify(parsed, null, 2) });
        } catch (e) {
        }
    };

    // Resizing Logic
    const handlePanelResizeStart = (e: React.MouseEvent) => {
        e.preventDefault();
        isResizingPanel.current = true;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    };

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (isResizingPanel.current && contentRef.current) {
            const contentRect = contentRef.current.getBoundingClientRect();
            const newPercent = ((e.clientX - contentRect.left) / contentRect.width) * 100;
            if (newPercent >= 20 && newPercent <= 80) {
                setPanelWidthPercent(newPercent);
            }
        }
    }, []);

    const handleMouseUp = useCallback(() => {
        if (isResizingPanel.current) {
            isResizingPanel.current = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            restPanelWidthStorage.set(panelWidthPercent);
        }
    }, [panelWidthPercent]);

    useEffect(() => {
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [handleMouseMove, handleMouseUp]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            handleExecute();
        }
    };

    return (
        <div className="rest-page">
            <div className="rest-page-with-sidebar">
                <div className="rest-sidebar">
                    <IndexList
                        onSelectIndex={handleIndexListSelect}
                        selectedIndex={selectedListIndex}
                        refreshTrigger={indexListRefreshTrigger}
                        onRefreshNeeded={handleRefreshIndices}
                    />
                </div>
                <div className="rest-main-content">
                    <div className="rest-page-header">
                        <h3><Maximize2 size={18} /> REST Console</h3>

                        <div className="rest-header-actions">
                            <div className="rest-queries-dropdown">
                                <button
                                    className="btn btn-ghost btn-sm"
                                    onClick={() => setShowQueriesDropdown(!showQueriesDropdown)}
                                    title={t('restModal.savedQueries')}
                                >
                                    <FolderOpen size={16} />
                                    {t('restModal.queries')}
                                    <ChevronDown size={14} style={{
                                        transform: showQueriesDropdown ? 'rotate(180deg)' : 'rotate(0deg)',
                                        transition: 'transform 0.15s ease'
                                    }} />
                                </button>
                                {showQueriesDropdown && (
                                    <div className="rest-queries-menu">
                                        {loadingQueries ? (
                                            <div className="rest-queries-loading">
                                                <Loader size={16} className="spin" />
                                            </div>
                                        ) : savedQueries.length === 0 ? (
                                            <div className="rest-queries-empty">
                                                {t('restModal.noSavedQueries')}
                                            </div>
                                        ) : (
                                            savedQueries.map((query) => (
                                                <div
                                                    key={query.id}
                                                    className="rest-query-item"
                                                    onClick={() => handleLoadQuery(query)}
                                                >
                                                    <div className="rest-query-info">
                                                        <span className={`rest-query-method method-${query.method.toLowerCase()}`}>
                                                            {query.method}
                                                        </span>
                                                        <span className="rest-query-name">{query.name}</span>
                                                    </div>
                                                    <button
                                                        className="rest-query-delete"
                                                        onClick={(e) => handleDeleteQuery(query.id, e)}
                                                        title={t('common.delete')}
                                                    >
                                                        <Trash2 size={12} />
                                                    </button>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>

                            <button
                                className="btn btn-ghost btn-sm"
                                onClick={() => setShowSaveModal(true)}
                                title={t('restModal.saveQuery')}
                            >
                                <Save size={16} />
                                {t('common.save')}
                            </button>
                        </div>
                    </div>

                    <div className="rest-tabs-bar">
                        {tabs.map(tab => (
                            <div
                                key={tab.id}
                                className={`rest-tab ${activeTabId === tab.id ? 'active' : ''}`}
                                onClick={() => setActiveTabId(tab.id)}
                                onDoubleClick={(e) => handleStartEdit(e, tab)}
                                style={{ paddingRight: editingTabId === tab.id ? '8px' : '36px' }}
                            >
                                {editingTabId === tab.id ? (
                                    <input
                                        ref={editInputRef}
                                        type="text"
                                        className="rest-tab-edit-input"
                                        value={editingName}
                                        onChange={(e) => setEditingName(e.target.value)}
                                        onKeyDown={handleEditKeyDown}
                                        onBlur={handleSaveEdit}
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                ) : (
                                    <>
                                        {tab.method && (
                                            <span className={`rest-tab-method method-${tab.method.toLowerCase()}`}
                                                style={{
                                                    color: tab.method === 'GET' ? 'var(--success)' :
                                                        tab.method === 'POST' ? 'var(--accent)' :
                                                            tab.method === 'DELETE' ? 'var(--danger)' : '#fbbf24'
                                                }}>
                                                {tab.method}
                                            </span>
                                        )}
                                        <span className="rest-tab-name" title={tab.name}>{tab.name}</span>
                                        <div
                                            className="rest-tab-close"
                                            onClick={(e) => handleCloseTab(e, tab.id)}
                                        >
                                            <X size={12} />
                                        </div>
                                    </>
                                )}
                            </div>
                        ))}
                        <div className="rest-new-tab" onClick={handleNewTab} title="New Tab">
                            <Plus size={18} />
                        </div>
                    </div>

                    <div className="rest-page-toolbar">
                        <MethodSelector
                            value={activeTab.method}
                            onChange={(method) => updateActiveTab({ method })}
                        />

                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <input
                                type="text"
                                value={activeTab.path}
                                onChange={(e) => updateActiveTab({ path: e.target.value })}
                                className="rest-path-input"
                                placeholder="/index/_search"
                            />

                            {indices.length > 0 && (
                                <div className="rest-index-pills">
                                    {indices.map(idx => (
                                        <div
                                            key={idx.index}
                                            className="rest-index-pill"
                                            onClick={() => handlePillClick(idx.index)}
                                            title={idx.aliases && idx.aliases.length > 0 ? `Aliases: ${idx.aliases.join(', ')}` : undefined}
                                        >
                                            <Tag size={10} />
                                            <span>{idx.index}</span>
                                            {idx.aliases && idx.aliases.length > 0 && (
                                                <span className="rest-index-pill-alias">
                                                    ({idx.aliases[0]}{idx.aliases.length > 1 ? ` +${idx.aliases.length - 1}` : ''})
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div style={{ alignSelf: 'flex-start' }}>
                            <button
                                className="btn btn-primary"
                                onClick={handleExecute}
                                disabled={activeTab.loading || !activeTab.path.trim()}
                            >
                                {activeTab.loading ? (
                                    <Loader size={16} className="spin" />
                                ) : (
                                    <Play size={16} />
                                )}
                                {t('restModal.send')}
                            </button>
                        </div>
                    </div>

                    <div className="rest-page-content" ref={contentRef}>
                        <div
                            className="rest-panel rest-request-panel"
                            style={{ width: `${panelWidthPercent}%` }}
                        >
                            <div className="rest-panel-header">
                                <span>Request Body</span>
                                <button
                                    className="btn btn-ghost btn-sm"
                                    onClick={formatJson}
                                    title={t('restModal.formatJson')}
                                >
                                    {t('restModal.format')}
                                </button>
                            </div>
                            <textarea
                                className="rest-editor"
                                value={activeTab.body}
                                onChange={(e) => updateActiveTab({ body: e.target.value })}
                                onKeyDown={handleKeyDown}
                                placeholder="JSON request body..."
                                spellCheck={false}
                            />
                        </div>

                        <div
                            className="rest-panel-resizer"
                            onMouseDown={handlePanelResizeStart}
                        />

                        <div
                            className="rest-panel rest-response-panel"
                            style={{ width: `${100 - panelWidthPercent}%` }}
                        >
                            <div className="rest-panel-header">
                                <span>Response</span>
                                <div className="rest-response-info">
                                    {activeTab.statusCode !== null && (
                                        <span className={`rest-status ${activeTab.statusCode >= 200 && activeTab.statusCode < 300 ? 'success' : 'error'}`}>
                                            {activeTab.statusCode >= 200 && activeTab.statusCode < 300 ? (
                                                <CheckCircle size={12} />
                                            ) : (
                                                <AlertCircle size={12} />
                                            )}
                                            {activeTab.statusCode}
                                        </span>
                                    )}
                                    {activeTab.executionTime !== null && (
                                        <span className="rest-time">
                                            <Clock size={12} />
                                            {activeTab.executionTime}ms
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="rest-response-content">
                                {activeTab.loading && (
                                    <div className="rest-loading">
                                        <Loader size={24} className="spin" />
                                        <span>{t('restModal.sending')}</span>
                                    </div>
                                )}
                                {activeTab.error && !activeTab.response && (
                                    <div className="rest-error">
                                        <AlertCircle size={16} />
                                        {typeof activeTab.error === 'string' ? activeTab.error : JSON.stringify(activeTab.error)}
                                    </div>
                                )}
                                {activeTab.response && (
                                    <div className="rest-response-viewer">
                                        <JsonViewer
                                            data={activeTab.response}
                                            defaultExpanded={true}
                                            showSearchBar={true}
                                        />
                                    </div>
                                )}
                                {!activeTab.loading && !activeTab.error && !activeTab.response && (
                                    <div className="rest-placeholder">
                                        {t('restModal.placeholder')}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Save Query Modal */}
                    {showSaveModal && (
                        <div className="rest-save-modal-overlay" onClick={() => setShowSaveModal(false)}>
                            <div className="rest-save-modal" onClick={(e) => e.stopPropagation()}>
                                <div className="rest-save-modal-header">
                                    <h4>{t('restModal.saveQuery')}</h4>
                                    <button className="btn btn-ghost btn-icon" onClick={() => setShowSaveModal(false)}>
                                        <X size={16} />
                                    </button>
                                </div>
                                <div className="rest-save-modal-body">
                                    <label>
                                        {t('restModal.queryName')} <span className="required">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={queryName}
                                        onChange={(e) => setQueryName(e.target.value)}
                                        placeholder={t('restModal.queryNamePlaceholder')}
                                        autoFocus
                                    />
                                    {saveError && (
                                        <div className="rest-save-error">
                                            <AlertCircle size={14} />
                                            {saveError}
                                        </div>
                                    )}
                                    <div className="rest-save-preview">
                                        <span className={`rest-query-method method-${activeTab.method.toLowerCase()}`}>
                                            {activeTab.method}
                                        </span>
                                        <span className="rest-save-path">{activeTab.path}</span>
                                    </div>
                                </div>
                                <div className="rest-save-modal-footer">
                                    <button
                                        className="btn btn-secondary"
                                        onClick={() => setShowSaveModal(false)}
                                        disabled={saving}
                                    >
                                        {t('common.cancel')}
                                    </button>
                                    <button
                                        className="btn btn-primary"
                                        onClick={handleSaveQuery}
                                        disabled={saving || !queryName.trim()}
                                    >
                                        {saving ? (
                                            <Loader size={14} className="spin" />
                                        ) : (
                                            <Save size={14} />
                                        )}
                                        {t('common.save')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
