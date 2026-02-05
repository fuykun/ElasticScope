import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, Trash2, ChevronDown, ChevronRight, X, Check, Maximize2, GitCompare, Upload, RefreshCw } from 'lucide-react';
import { SearchHit } from '../types';
import { deleteDocument, saveDocument } from '../api/elasticsearchClient';
import { JsonViewer } from './JsonViewer';
import { SkeletonLoader } from './SkeletonLoader';

interface DocumentViewerProps {
    documents: SearchHit[];
    onRefresh: () => void;
    loading: boolean;
    selectedIndex: string;
    selectedColumns: string[];
    onAddToComparison: (doc: { _id: string; _index: string; _source: Record<string, any> }) => void;
    onRemoveFromComparison: (docId: string, indexName: string) => void;
    isInComparison: (docId: string, indexName: string) => boolean;
    onCopyDocument?: (documents: Array<{ id: string; source?: any }>) => void;
    viewMode?: 'card' | 'table';
}

const getNestedValue = (obj: Record<string, any>, path: string): any => {
    return path.split('.').reduce((current, key) => {
        return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
};

const formatDisplayValue = (value: any, maxLength = 100): string => {
    if (value === null) return 'null';
    if (value === undefined) return '-';

    if (Array.isArray(value)) {
        return `[${value.length} items]`;
    }

    if (typeof value === 'object') {
        return '{...}';
    }

    const str = String(value);
    return str.length > maxLength ? str.substring(0, maxLength) + '...' : str;
};

export const DocumentViewer: React.FC<DocumentViewerProps> = ({
    documents,
    onRefresh,
    loading,
    selectedIndex,
    selectedColumns,
    onAddToComparison,
    onRemoveFromComparison,
    isInComparison,
    onCopyDocument,
    viewMode = 'card',
}) => {
    const { t } = useTranslation();
    const [expandedDoc, setExpandedDoc] = useState<string | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [fullscreenDoc, setFullscreenDoc] = useState<string | null>(null);
    const [editingDoc, setEditingDoc] = useState<string | null>(null);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [localDocuments, setLocalDocuments] = useState<SearchHit[]>(documents);
    const [refreshingDoc, setRefreshingDoc] = useState<string | null>(null);

    React.useEffect(() => {
        setLocalDocuments(documents);
    }, [documents]);

    const handleRefreshDocument = async (docId: string) => {
        setRefreshingDoc(docId);
        try {
            // Trigger parent refresh - it will update the documents prop
            await onRefresh();
        } finally {
            setRefreshingDoc(null);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await deleteDocument(selectedIndex, id);
            setDeleteConfirm(null);
            onRefresh();
        } catch (error) {
            console.error('Silme hatası:', error);
        }
    };

    const handleSave = async (docId: string, newData: any) => {
        setSaveError(null);
        try {
            await saveDocument(selectedIndex, newData, docId);

            setLocalDocuments(prev =>
                prev.map(doc =>
                    doc._id === docId
                        ? { ...doc, _source: newData }
                        : doc
                )
            );

            setEditingDoc(null);
        } catch (error: any) {
            console.error('Kaydetme hatası:', error);
            setSaveError(error.message || t('documentViewer.saveFailed'));
        }
    };

    const handleCancelEdit = () => {
        setEditingDoc(null);
        setSaveError(null);
    };

    const toggleExpand = (id: string) => {
        setExpandedDoc(expandedDoc === id ? null : id);
    };

    const copyToClipboard = (text: string, docId: string) => {
        navigator.clipboard.writeText(text);
        setCopiedId(docId);
        setTimeout(() => setCopiedId(null), 2000);
    };

    if (loading) {
        return <SkeletonLoader type="document-list" count={6} />;
    }

    // Fullscreen modal
    const fullscreenDocument = fullscreenDoc ? localDocuments.find(d => d._id === fullscreenDoc) : null;

    if (localDocuments.length === 0) {
        return (
            <div className="documents-empty">
                <p>{t('documentViewer.noDocuments')}</p>
            </div>
        );
    }

    // Get columns for table view
    const tableColumns = selectedColumns.length > 0
        ? selectedColumns
        : [...new Set(localDocuments.flatMap(doc => Object.keys(doc._source)))].slice(0, 6);

    return (
        <>
            {viewMode === 'table' ? (
                /* Table View */
                <div className="documents-table-wrapper">
                    <table className="documents-table">
                        <thead>
                            <tr>
                                <th className="doc-table-id-col">ID</th>
                                {tableColumns.map((col) => (
                                    <th key={col}>{col}</th>
                                ))}
                                <th className="doc-table-actions-col">{t('documentViewer.actions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {localDocuments.map((doc) => (
                                <React.Fragment key={doc._id}>
                                    <tr
                                        className={`doc-table-row ${expandedDoc === doc._id ? 'expanded' : ''} ${refreshingDoc === doc._id ? 'refreshing' : ''}`}
                                        onClick={() => toggleExpand(doc._id)}
                                    >
                                        <td className="doc-table-id">
                                            <span className="doc-toggle">
                                                {expandedDoc === doc._id ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                            </span>
                                            <span className="doc-id-text">{doc._id}</span>
                                            {doc._score !== null && doc._score > 0 && (
                                                <span className="doc-score-badge-sm">{doc._score.toFixed(2)}</span>
                                            )}
                                        </td>
                                        {tableColumns.map((col) => (
                                            <td key={col} className="doc-table-cell">
                                                {formatDisplayValue(getNestedValue(doc._source, col), 60)}
                                            </td>
                                        ))}
                                        <td className="doc-table-actions" onClick={(e) => e.stopPropagation()}>
                                            <button
                                                className={`btn btn-icon-sm ${refreshingDoc === doc._id ? 'btn-loading' : ''}`}
                                                onClick={() => handleRefreshDocument(doc._id)}
                                                title={t('common.refresh')}
                                                disabled={refreshingDoc === doc._id}
                                            >
                                                <RefreshCw size={12} className={refreshingDoc === doc._id ? 'spin' : ''} />
                                            </button>
                                            <button
                                                className={`btn btn-icon-sm ${isInComparison(doc._id, selectedIndex) ? 'btn-primary' : ''}`}
                                                onClick={() =>
                                                    isInComparison(doc._id, selectedIndex)
                                                        ? onRemoveFromComparison(doc._id, selectedIndex)
                                                        : onAddToComparison({ _id: doc._id, _index: selectedIndex, _source: doc._source })
                                                }
                                                title={isInComparison(doc._id, selectedIndex) ? t('documentViewer.removeFromComparison') : t('documentViewer.addToComparison')}
                                            >
                                                <GitCompare size={12} />
                                            </button>
                                            {onCopyDocument && (
                                                <button
                                                    className="btn btn-icon-sm"
                                                    onClick={() => onCopyDocument([{ id: doc._id, source: doc._source }])}
                                                    title={t('documentViewer.copyToServer')}
                                                >
                                                    <Upload size={12} />
                                                </button>
                                            )}
                                            <button
                                                className="btn btn-icon-sm"
                                                onClick={() => setFullscreenDoc(doc._id)}
                                                title={t('documentViewer.fullscreen')}
                                            >
                                                <Maximize2 size={12} />
                                            </button>
                                            <button
                                                className="btn btn-icon-sm"
                                                onClick={() => copyToClipboard(JSON.stringify(doc._source, null, 2), doc._id)}
                                                title={t('documentViewer.copyJson')}
                                            >
                                                {copiedId === doc._id ? <Check size={12} /> : <Copy size={12} />}
                                            </button>
                                            <button
                                                className="btn btn-icon-sm btn-danger-subtle"
                                                onClick={() => setDeleteConfirm(doc._id)}
                                                title={t('common.delete')}
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        </td>
                                    </tr>
                                    {/* Expanded Row */}
                                    {expandedDoc === doc._id && (
                                        <tr className="doc-table-expanded-row">
                                            <td colSpan={tableColumns.length + 2}>
                                                <div className="doc-table-expanded-content">
                                                    {saveError && editingDoc === doc._id && (
                                                        <div className="error-message" style={{ marginBottom: '8px' }}>
                                                            {saveError}
                                                        </div>
                                                    )}
                                                    <JsonViewer
                                                        data={doc._source}
                                                        defaultExpanded={true}
                                                        showSearchBar={true}
                                                        editable={true}
                                                        onSave={(newData) => handleSave(doc._id, newData)}
                                                        onCancel={handleCancelEdit}
                                                        enablePinning={true}
                                                    />
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                    {/* Delete Confirm */}
                                    {deleteConfirm === doc._id && (
                                        <tr className="doc-table-delete-row">
                                            <td colSpan={tableColumns.length + 2}>
                                                <div className="delete-dialog-inline">
                                                    <p>{t('documentViewer.deleteConfirm')}</p>
                                                    <div className="delete-actions">
                                                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(doc._id)}>
                                                            {t('common.delete')}
                                                        </button>
                                                        <button className="btn btn-secondary btn-sm" onClick={() => setDeleteConfirm(null)}>
                                                            {t('common.cancel')}
                                                        </button>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                /* Card View (Default) */
                <div className="documents-grid">
                    {localDocuments.map((doc) => (
                        <div
                            key={doc._id}
                            className={`doc-card ${expandedDoc === doc._id ? 'expanded' : ''} ${refreshingDoc === doc._id ? 'doc-refreshing' : ''}`}
                        >
                            {/* Card Header */}
                            <div className="doc-card-header">
                                <div className="doc-card-title" onClick={() => toggleExpand(doc._id)}>
                                    <span className="doc-toggle">
                                        {expandedDoc === doc._id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                    </span>
                                    <span className="doc-id-badge">{doc._id}</span>
                                    {doc._source?.name && (
                                        <span className="doc-name-badge" title={doc._source.name}>
                                            {doc._source.name.length > 100 ? doc._source.name.substring(0, 100) + '...' : doc._source.name}
                                        </span>
                                    )}
                                    {doc._score !== null && doc._score > 0 && (
                                        <span className="doc-score-badge">
                                            {doc._score.toFixed(2)}
                                        </span>
                                    )}
                                </div>
                                <div className="doc-card-actions">
                                    <button
                                        className={`btn btn-icon-sm ${refreshingDoc === doc._id ? 'btn-loading' : ''}`}
                                        onClick={() => handleRefreshDocument(doc._id)}
                                        title={t('common.refresh')}
                                        disabled={refreshingDoc === doc._id}
                                    >
                                        <RefreshCw size={12} className={refreshingDoc === doc._id ? 'spin' : ''} />
                                    </button>
                                    <button
                                        className={`btn btn-icon-sm ${isInComparison(doc._id, selectedIndex) ? 'btn-primary' : ''}`}
                                        onClick={() =>
                                            isInComparison(doc._id, selectedIndex)
                                                ? onRemoveFromComparison(doc._id, selectedIndex)
                                                : onAddToComparison({ _id: doc._id, _index: selectedIndex, _source: doc._source })
                                        }
                                        title={isInComparison(doc._id, selectedIndex) ? t('documentViewer.removeFromComparison') : t('documentViewer.addToComparison')}
                                    >
                                        <GitCompare size={12} />
                                    </button>
                                    {onCopyDocument && (
                                        <button
                                            className="btn btn-icon-sm"
                                            onClick={() => onCopyDocument([{ id: doc._id, source: doc._source }])}
                                            title={t('documentViewer.copyToServer')}
                                        >
                                            <Upload size={12} />
                                        </button>
                                    )}
                                    <button
                                        className="btn btn-icon-sm"
                                        onClick={() => setFullscreenDoc(doc._id)}
                                        title={t('documentViewer.fullscreen')}
                                    >
                                        <Maximize2 size={12} />
                                    </button>
                                    <button
                                        className="btn btn-icon-sm"
                                        onClick={() => copyToClipboard(JSON.stringify(doc._source, null, 2), doc._id)}
                                        title={t('documentViewer.copyJson')}
                                    >
                                        {copiedId === doc._id ? <Check size={12} /> : <Copy size={12} />}
                                    </button>
                                    <button
                                        className="btn btn-icon-sm btn-danger-subtle"
                                        onClick={() => setDeleteConfirm(doc._id)}
                                        title={t('common.delete')}
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            </div>

                            {/* Preview Fields - Tablo görünümü */}
                            {expandedDoc !== doc._id && (
                                <div className="doc-card-preview">
                                    <table className="preview-table">
                                        <tbody>
                                            {(selectedColumns.length > 0 ? selectedColumns : Object.keys(doc._source).slice(0, 4)).map((column) => {
                                                const value = selectedColumns.length > 0
                                                    ? getNestedValue(doc._source, column)
                                                    : doc._source[column];
                                                if (value === undefined) return null;
                                                return (
                                                    <tr key={column}>
                                                        <td className="preview-key">{column}</td>
                                                        <td className="preview-value">{formatDisplayValue(value)}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* Expanded JSON Viewer */}
                            {expandedDoc === doc._id && (
                                <div className="doc-card-body">
                                    {saveError && editingDoc === doc._id && (
                                        <div className="error-message" style={{ marginBottom: '8px' }}>
                                            {saveError}
                                        </div>
                                    )}
                                    <JsonViewer
                                        data={doc._source}
                                        defaultExpanded={true}
                                        showSearchBar={true}
                                        editable={true}
                                        onSave={(newData) => handleSave(doc._id, newData)}
                                        onCancel={handleCancelEdit}
                                        enablePinning={true}
                                    />
                                </div>
                            )}

                            {/* Delete Confirm */}
                            {deleteConfirm === doc._id && (
                                <div className="delete-overlay">
                                    <div className="delete-dialog">
                                        <p>{t('documentViewer.deleteConfirm')}</p>
                                        <div className="delete-actions">
                                            <button className="btn btn-danger btn-sm" onClick={() => handleDelete(doc._id)}>
                                                {t('common.delete')}
                                            </button>
                                            <button className="btn btn-secondary btn-sm" onClick={() => setDeleteConfirm(null)}>
                                                {t('common.cancel')}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Fullscreen Modal */}
            {fullscreenDocument && (
                <div className="fullscreen-modal" onClick={() => setFullscreenDoc(null)}>
                    <div className="fullscreen-content" onClick={(e) => e.stopPropagation()}>
                        <div className="fullscreen-header">
                            <span className="doc-id-badge">{fullscreenDocument._id}</span>
                            {fullscreenDocument._source?.name && (
                                <span className="doc-name-badge" title={fullscreenDocument._source.name}>
                                    {fullscreenDocument._source.name.length > 100
                                        ? fullscreenDocument._source.name.substring(0, 100) + '...'
                                        : fullscreenDocument._source.name}
                                </span>
                            )}
                            <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <button
                                    className={`btn btn-icon ${refreshingDoc === fullscreenDocument._id ? 'btn-loading' : ''}`}
                                    onClick={() => handleRefreshDocument(fullscreenDocument._id)}
                                    title={t('common.refresh')}
                                    disabled={refreshingDoc === fullscreenDocument._id}
                                >
                                    <RefreshCw size={18} className={refreshingDoc === fullscreenDocument._id ? 'spin' : ''} />
                                </button>
                                <button className="btn btn-icon" onClick={() => setFullscreenDoc(null)}>
                                    <X size={18} />
                                </button>
                            </div>
                        </div>
                        <div className="fullscreen-body">
                            {saveError && editingDoc === fullscreenDocument._id && (
                                <div className="error-message" style={{ marginBottom: '8px' }}>
                                    {saveError}
                                </div>
                            )}
                            <JsonViewer
                                data={fullscreenDocument._source}
                                defaultExpanded={true}
                                showSearchBar={true}
                                editable={true}
                                onSave={(newData) => handleSave(fullscreenDocument._id, newData)}
                                onCancel={handleCancelEdit}
                                enablePinning={true}
                            />
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
