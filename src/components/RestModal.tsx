import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Play, Loader, Clock, AlertCircle, CheckCircle, Save, FolderOpen, Trash2, ChevronDown } from 'lucide-react';
import { executeRestRequest, getSavedQueries, createSavedQuery, deleteSavedQuery, SavedQuery } from '../api/elasticsearchClient';
import { JsonViewer } from './JsonViewer';
import { restModalWidthStorage, restModalHeightStorage, restPanelWidthStorage } from '../utils/storage';
import {
    MIN_REST_MODAL_WIDTH,
    MIN_REST_MODAL_HEIGHT,
    DEFAULT_SEARCH_BODY
} from '../constants';

interface RestModalProps {
    isOpen: boolean;
    onClose: () => void;
    indexName: string;
    initialEndpoint: 'search' | 'count' | 'general';
}

const DEFAULT_COUNT_BODY = {
    query: {
        match_all: {}
    }
};

export const RestModal: React.FC<RestModalProps> = ({
    isOpen,
    onClose,
    indexName,
    initialEndpoint,
}) => {
    const { t } = useTranslation();
    const [method, setMethod] = useState<'GET' | 'POST' | 'PUT' | 'DELETE'>('POST');
    const [path, setPath] = useState('');
    const [requestBody, setRequestBody] = useState('');
    const [response, setResponse] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [executionTime, setExecutionTime] = useState<number | null>(null);
    const [statusCode, setStatusCode] = useState<number | null>(null);

    // Saved queries state
    const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([]);
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [queryName, setQueryName] = useState('');
    const [saveError, setSaveError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [showQueriesDropdown, setShowQueriesDropdown] = useState(false);
    const [loadingQueries, setLoadingQueries] = useState(false);

    // Resize state - Modal (using storage utilities)
    const [modalSize, setModalSize] = useState(() => ({
        width: restModalWidthStorage.get(),
        height: restModalHeightStorage.get(),
    }));
    const [panelWidthPercent, setPanelWidthPercent] = useState(() => restPanelWidthStorage.get());

    // Resize refs
    const modalRef = useRef<HTMLDivElement>(null);
    const isResizingModal = useRef(false);
    const isResizingPanel = useRef(false);
    const resizeStartPos = useRef({ x: 0, y: 0 });
    const resizeStartSize = useRef({ width: 0, height: 0 });

    // Panel resize handlers
    const handlePanelResizeStart = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        isResizingPanel.current = true;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    }, []);

    // Modal resize handlers
    const handleModalResizeStart = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        isResizingModal.current = true;
        resizeStartPos.current = { x: e.clientX, y: e.clientY };
        resizeStartSize.current = { width: modalSize.width, height: modalSize.height };
        document.body.style.cursor = 'nwse-resize';
        document.body.style.userSelect = 'none';
    }, [modalSize]);

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (isResizingPanel.current && modalRef.current) {
            const modalRect = modalRef.current.getBoundingClientRect();
            const newPercent = ((e.clientX - modalRect.left) / modalRect.width) * 100;
            if (newPercent >= 20 && newPercent <= 80) {
                setPanelWidthPercent(newPercent);
            }
        }

        if (isResizingModal.current) {
            const deltaX = e.clientX - resizeStartPos.current.x;
            const deltaY = e.clientY - resizeStartPos.current.y;
            const newWidth = Math.max(MIN_REST_MODAL_WIDTH, resizeStartSize.current.width + deltaX * 2);
            const newHeight = Math.max(MIN_REST_MODAL_HEIGHT, resizeStartSize.current.height + deltaY * 2);
            setModalSize({ width: newWidth, height: newHeight });
        }
    }, []);

    const handleMouseUp = useCallback(() => {
        if (isResizingPanel.current) {
            isResizingPanel.current = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            restPanelWidthStorage.set(panelWidthPercent);
        }
        if (isResizingModal.current) {
            isResizingModal.current = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            restModalWidthStorage.set(modalSize.width);
            restModalHeightStorage.set(modalSize.height);
        }
    }, [panelWidthPercent, modalSize]);

    useEffect(() => {
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [handleMouseMove, handleMouseUp]);

    // Load saved queries
    const loadSavedQueries = useCallback(async () => {
        setLoadingQueries(true);
        try {
            const queries = await getSavedQueries();
            setSavedQueries(queries);
        } catch (err) {
            console.error('Sorgular yüklenemedi:', err);
        } finally {
            setLoadingQueries(false);
        }
    }, []);

    useEffect(() => {
        if (isOpen) {
            if (initialEndpoint === 'search') {
                setPath(`/${indexName}/_search`);
                setRequestBody(JSON.stringify(DEFAULT_SEARCH_BODY, null, 2));
                setMethod('POST');
            } else if (initialEndpoint === 'count') {
                setPath(`/${indexName}/_count`);
                setRequestBody(JSON.stringify(DEFAULT_COUNT_BODY, null, 2));
                setMethod('POST');
            } else if (initialEndpoint === 'general') {
                setPath(`/${indexName}/`);
                setRequestBody('{}');
                setMethod('GET');
            }
            setResponse(null);
            setError(null);
            setExecutionTime(null);
            setStatusCode(null);
            loadSavedQueries();
        }
    }, [isOpen, indexName, initialEndpoint, loadSavedQueries]);

    const handleExecute = async () => {
        setLoading(true);
        setError(null);
        setResponse(null);
        setExecutionTime(null);
        setStatusCode(null);

        const startTime = performance.now();

        try {
            let parsedBody: object | undefined;
            if (requestBody.trim()) {
                try {
                    parsedBody = JSON.parse(requestBody);
                } catch (e) {
                    setError(t('common.invalidJson'));
                    setLoading(false);
                    return;
                }
            }

            const result = await executeRestRequest({
                method,
                path,
                body: parsedBody,
            });

            const endTime = performance.now();
            setExecutionTime(Math.round(endTime - startTime));
            setStatusCode(200);
            setResponse(result);
        } catch (err: any) {
            const endTime = performance.now();
            setExecutionTime(Math.round(endTime - startTime));

            // Elasticsearch error response
            if (err.message) {
                try {
                    const errorObj = JSON.parse(err.message);
                    setResponse(errorObj);
                    setStatusCode(errorObj.status || 400);
                } catch {
                    setError(err.message);
                    setStatusCode(500);
                }
            } else {
                setError(t('common.unknownError'));
                setStatusCode(500);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleSaveQuery = async () => {
        if (!queryName.trim()) {
            setSaveError('Sorgu ismi gerekli');
            return;
        }

        setSaving(true);
        setSaveError(null);

        try {
            await createSavedQuery({
                name: queryName.trim(),
                method,
                path,
                body: requestBody,
            });
            setShowSaveModal(false);
            setQueryName('');
            loadSavedQueries();
        } catch (err: any) {
            setSaveError(err.message || t('restModal.saveError'));
        } finally {
            setSaving(false);
        }
    };

    const handleLoadQuery = (query: SavedQuery) => {
        setMethod(query.method as any);
        setPath(query.path);
        setRequestBody(query.body || '');
        setShowQueriesDropdown(false);
    };

    const handleDeleteQuery = async (id: number, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            await deleteSavedQuery(id);
            loadSavedQueries();
        } catch (err) {
            console.error('Sorgu silinemedi:', err);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            handleExecute();
        }
    };

    const formatJson = () => {
        try {
            const parsed = JSON.parse(requestBody);
            setRequestBody(JSON.stringify(parsed, null, 2));
        } catch (e) {
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div
                className="rest-modal"
                ref={modalRef}
                onClick={(e) => e.stopPropagation()}
                style={{
                    width: modalSize.width,
                    maxWidth: '95vw',
                    height: modalSize.height,
                    maxHeight: '95vh',
                }}
            >
                <div className="rest-modal-header">
                    <h3>REST API - {indexName}</h3>
                    <div className="rest-header-actions">
                        {/* Saved Queries Dropdown */}
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
                        {/* Save Button */}
                        <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => setShowSaveModal(true)}
                            title={t('restModal.saveQuery')}
                        >
                            <Save size={16} />
                            {t('common.save')}
                        </button>
                        <button className="btn btn-ghost btn-icon" onClick={onClose}>
                            <X size={18} />
                        </button>
                    </div>
                </div>

                <div className="rest-modal-toolbar">
                    <select
                        value={method}
                        onChange={(e) => setMethod(e.target.value as any)}
                        className="rest-method-select"
                    >
                        <option value="GET">GET</option>
                        <option value="POST">POST</option>
                        <option value="PUT">PUT</option>
                        <option value="DELETE">DELETE</option>
                    </select>
                    <input
                        type="text"
                        value={path}
                        onChange={(e) => setPath(e.target.value)}
                        className="rest-path-input"
                        placeholder="/index/_search"
                    />
                    <button
                        className="btn btn-primary"
                        onClick={handleExecute}
                        disabled={loading || !path.trim()}
                    >
                        {loading ? (
                            <Loader size={16} className="spin" />
                        ) : (
                            <Play size={16} />
                        )}
                        {t('restModal.send')}
                    </button>
                </div>

                <div className="rest-modal-content">
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
                            value={requestBody}
                            onChange={(e) => setRequestBody(e.target.value)}
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
                                {statusCode !== null && (
                                    <span className={`rest-status ${statusCode >= 200 && statusCode < 300 ? 'success' : 'error'}`}>
                                        {statusCode >= 200 && statusCode < 300 ? (
                                            <CheckCircle size={12} />
                                        ) : (
                                            <AlertCircle size={12} />
                                        )}
                                        {statusCode}
                                    </span>
                                )}
                                {executionTime !== null && (
                                    <span className="rest-time">
                                        <Clock size={12} />
                                        {executionTime}ms
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="rest-response-content">
                            {loading && (
                                <div className="rest-loading">
                                    <Loader size={24} className="spin" />
                                    <span>{t('restModal.sending')}</span>
                                </div>
                            )}
                            {error && !response && (
                                <div className="rest-error">
                                    <AlertCircle size={16} />
                                    {error}
                                </div>
                            )}
                            {response && (
                                <div className="rest-response-viewer">
                                    <JsonViewer
                                        data={response}
                                        defaultExpanded={true}
                                        showSearchBar={true}
                                    />
                                </div>
                            )}
                            {!loading && !error && !response && (
                                <div className="rest-placeholder">
                                    {t('restModal.placeholder')}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Modal Resize Handle */}
                <div
                    className="rest-modal-resize-handle"
                    onMouseDown={handleModalResizeStart}
                    title={t('common.resize')}
                />

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
                                    <span className={`rest-query-method method-${method.toLowerCase()}`}>
                                        {method}
                                    </span>
                                    <span className="rest-save-path">{path}</span>
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
    );
};
