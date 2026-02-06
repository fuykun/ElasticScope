import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, Server, Database, AlertTriangle, CheckCircle, Loader2, X, Search, GitCompare, ChevronDown, Check } from 'lucide-react';
import { Modal } from './Modal';
import { MappingComparisonModal } from './MappingComparisonModal';
import {
    SavedConnection,
    getSavedConnections,
    getConnectionIndices,
    copyDocument,
    copyDocuments,
    ConnectionIndex,
    getIndexMapping,
    getConnectionIndexMapping
} from '../api/elasticsearchClient';

interface CopyDocumentModalProps {
    isOpen: boolean;
    onClose: () => void;
    sourceIndex: string;
    documents: Array<{ id: string; source?: any }>;
    currentConnectionId?: number;
}

// Searchable Select Component
interface SelectOption {
    id: string | number;
    label: string;
    sublabel?: string;
    health?: string;
    aliases?: string[];
    storeSize?: string;
}

interface SearchableSelectProps {
    value: string | number | null;
    onChange: (value: string | number | null) => void;
    options: SelectOption[];
    placeholder: string;
    icon?: React.ReactNode;
    loading?: boolean;
    loadingText?: string;
}

const SearchableSelect = ({
    value,
    onChange,
    options,
    placeholder,
    icon,
    loading,
    loadingText
}: SearchableSelectProps) => {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const filteredOptions = options.filter(opt =>
        opt.label.toLowerCase().includes(search.toLowerCase()) ||
        (opt.sublabel && opt.sublabel.toLowerCase().includes(search.toLowerCase()))
    );

    const selectedOption = options.find(opt => opt.id === value);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
                setSearch('');
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    if (loading) {
        return (
            <div className="copy-select-loading">
                <Loader2 size={14} className="spin" />
                <span>{loadingText}</span>
            </div>
        );
    }

    return (
        <div className="copy-searchable-select" ref={containerRef}>
            <button
                type="button"
                className={`copy-select-trigger ${isOpen ? 'open' : ''}`}
                onClick={() => setIsOpen(!isOpen)}
            >
                {icon}
                <span className={selectedOption ? '' : 'placeholder'}>
                    {selectedOption ? (
                        <span className="copy-select-selected-text">
                            {selectedOption.health && <span className={`copy-select-health health-${selectedOption.health}`} />}
                            {selectedOption.label}
                        </span>
                    ) : placeholder}
                </span>
                <div className="copy-select-trigger-actions">
                    {selectedOption && (
                        <span
                            className="copy-select-trigger-clear"
                            onClick={(e) => {
                                e.stopPropagation();
                                onChange(null);
                                setSearch('');
                            }}
                        >
                            <X size={14} />
                        </span>
                    )}
                    <ChevronDown size={14} className={isOpen ? 'rotated' : ''} />
                </div>
            </button>
            {isOpen && (
                <div className="copy-select-dropdown">
                    <div className="copy-select-search">
                        <Search size={14} />
                        <input
                            ref={inputRef}
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder={t('common.search')}
                            onClick={(e) => e.stopPropagation()}
                        />
                        {search && (
                            <button onClick={() => setSearch('')} className="copy-select-clear">
                                <X size={12} />
                            </button>
                        )}
                    </div>
                    <div className="copy-select-options">
                        {filteredOptions.length === 0 ? (
                            <div className="copy-select-no-results">{t('common.noResults')}</div>
                        ) : (
                            filteredOptions.map(opt => (
                                <button
                                    key={opt.id}
                                    type="button"
                                    className={`copy-select-option ${opt.id === value ? 'selected' : ''}`}
                                    onClick={() => {
                                        onChange(opt.id);
                                        setIsOpen(false);
                                        setSearch('');
                                    }}
                                >
                                    <div className="copy-select-option-content">
                                        <div className="copy-select-option-main">
                                            {opt.health && <span className={`copy-select-health health-${opt.health}`} />}
                                            <span className="copy-select-option-label">{opt.label}</span>
                                            {opt.aliases && opt.aliases.length > 0 && (
                                                <span className="copy-select-aliases">
                                                    <span className="copy-select-alias-tag">{opt.aliases[0]}</span>
                                                    {opt.aliases.length > 1 && (
                                                        <span className="copy-select-alias-more">+{opt.aliases.length - 1}</span>
                                                    )}
                                                </span>
                                            )}
                                        </div>
                                        {opt.sublabel && !opt.health && (
                                            <span className="copy-select-option-sublabel">{opt.sublabel}</span>
                                        )}
                                    </div>
                                    <div className="copy-select-option-meta">
                                        {opt.storeSize && <span className="copy-select-store-size">{opt.storeSize}</span>}
                                        {opt.id === value && <Check size={14} />}
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export const CopyDocumentModal = ({
    isOpen,
    onClose,
    sourceIndex,
    documents,
    currentConnectionId
}: CopyDocumentModalProps) => {
    const { t } = useTranslation();
    const [connections, setConnections] = useState<SavedConnection[]>([]);
    const [targetConnectionId, setTargetConnectionId] = useState<number | null>(null);
    const [targetIndices, setTargetIndices] = useState<ConnectionIndex[]>([]);
    const [targetIndex, setTargetIndex] = useState('');
    const [newIndexName, setNewIndexName] = useState('');
    const [createNewIndex, setCreateNewIndex] = useState(false);
    const [copyMapping, setCopyMapping] = useState(true);
    const [loading, setLoading] = useState(false);
    const [loadingIndices, setLoadingIndices] = useState(false);
    const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
    const [error, setError] = useState<string | null>(null);

    const [checkingMapping, setCheckingMapping] = useState(false);
    const [mappingStatus, setMappingStatus] = useState<'idle' | 'checking' | 'match' | 'mismatch'>('idle');
    const [sourceMapping, setSourceMapping] = useState<Record<string, any> | null>(null);
    const [targetMappingData, setTargetMappingData] = useState<Record<string, any> | null>(null);
    const [showMappingDiff, setShowMappingDiff] = useState(false);

    useEffect(() => {
        if (isOpen) {
            loadConnections();
            setResult(null);
            setError(null);
            setMappingStatus('idle');
            setSourceMapping(null);
            setTargetMappingData(null);
        }
    }, [isOpen]);

    useEffect(() => {
        if (targetConnectionId) {
            loadTargetIndices(targetConnectionId);
        } else {
            setTargetIndices([]);
            setTargetIndex('');
        }
        setMappingStatus('idle');
        setTargetMappingData(null);
    }, [targetConnectionId]);

    useEffect(() => {
        if (targetIndex && targetConnectionId && !createNewIndex) {
            compareMappings();
        } else {
            setMappingStatus('idle');
        }
    }, [targetIndex, targetConnectionId, createNewIndex]);

    const compareMappings = async () => {
        if (!targetConnectionId || !targetIndex) return;

        setCheckingMapping(true);
        setMappingStatus('checking');

        try {
            // Kaynak ve hedef mapping'leri paralel olarak al
            const [sourceMappingResult, targetMappingResult] = await Promise.all([
                getIndexMapping(sourceIndex),
                getConnectionIndexMapping(targetConnectionId, targetIndex)
            ]);

            const normalizeMapping = (mappingData: Record<string, any>) => {
                const keys = Object.keys(mappingData);
                if (keys.length > 0) {
                    return mappingData[keys[0]]?.mappings || {};
                }
                return {};
            };

            const normalizedSource = normalizeMapping(sourceMappingResult);
            const normalizedTarget = normalizeMapping(targetMappingResult);

            setSourceMapping(normalizedSource);
            setTargetMappingData(normalizedTarget);

            const sourceStr = JSON.stringify(normalizedSource, null, 2);
            const targetStr = JSON.stringify(normalizedTarget, null, 2);

            if (sourceStr === targetStr) {
                setMappingStatus('match');
            } else {
                setMappingStatus('mismatch');
            }
        } catch (err: any) {
            console.error('Mapping karşılaştırma hatası:', err);
            setMappingStatus('idle');
        } finally {
            setCheckingMapping(false);
        }
    };

    const loadConnections = async () => {
        try {
            const conns = await getSavedConnections();
            setConnections(conns);
        } catch (err: any) {
            setError(err.message);
        }
    };

    const loadTargetIndices = async (connectionId: number) => {
        setLoadingIndices(true);
        setError(null);
        try {
            const indices = await getConnectionIndices(connectionId);
            setTargetIndices(indices);
            setTargetIndex('');
        } catch (err: any) {
            setError(t('copyModal.indexListError', { message: err.message }));
            setTargetIndices([]);
        } finally {
            setLoadingIndices(false);
        }
    };

    const handleCopy = async () => {
        if (!targetConnectionId) {
            setError(t('copyModal.selectTargetConnection'));
            return;
        }

        const finalTargetIndex = createNewIndex ? newIndexName : targetIndex;

        if (!finalTargetIndex) {
            setError(t('copyModal.selectTargetIndex'));
            return;
        }

        setLoading(true);
        setError(null);
        setResult(null);

        try {
            if (documents.length === 1) {
                const res = await copyDocument({
                    sourceConnectionId: currentConnectionId,
                    sourceIndex,
                    documentId: documents[0].id,
                    targetConnectionId,
                    targetIndex: finalTargetIndex,
                    createIndexIfNotExists: createNewIndex,
                    copyMapping
                });
                setResult({ success: res.success, message: res.message });
            } else {
                const res = await copyDocuments({
                    sourceConnectionId: currentConnectionId,
                    documents: documents.map(d => ({ index: sourceIndex, id: d.id })),
                    targetConnectionId,
                    targetIndex: finalTargetIndex,
                    createIndexIfNotExists: createNewIndex,
                    copyMapping
                });
                setResult({ success: res.success, message: res.message });
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const modalTitle = documents.length === 1 ? t('copyModal.title') : t('copyModal.titleMultiple');

    // Connection options for searchable select
    const connectionOptions = connections
        .filter(conn => conn.id !== currentConnectionId)
        .map(conn => ({
            id: conn.id,
            label: conn.name,
            sublabel: conn.url
        }));

    // Index options for searchable select
    const indexOptions: SelectOption[] = targetIndices.map(idx => ({
        id: idx.index,
        label: idx.index,
        health: idx.health,
        aliases: idx.aliases,
        storeSize: idx.storeSize
    }));

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={modalTitle} size="md">
            <div className="copy-modal">
                {/* Source Info - Compact */}
                <div className="copy-source">
                    <div className="copy-source-item">
                        <span className="copy-source-label">{t('copyModal.sourceIndex')}</span>
                        <span className="copy-source-value">{sourceIndex}</span>
                    </div>
                    <div className="copy-source-divider" />
                    <div className="copy-source-item">
                        <span className="copy-source-label">{t('copyModal.sourceDocuments')}</span>
                        <span className="copy-source-value">
                            {documents.length === 1 ? documents[0].id : t('copyModal.documentsCount', { count: documents.length })}
                        </span>
                    </div>
                </div>

                {/* Target Connection */}
                <div className="copy-field">
                    <label className="copy-field-label">{t('copyModal.targetConnection')}</label>
                    <SearchableSelect
                        value={targetConnectionId}
                        onChange={(val) => setTargetConnectionId(val as number | null)}
                        options={connectionOptions}
                        placeholder={t('copyModal.selectConnection')}
                        icon={<Server size={14} />}
                    />
                </div>

                {/* Target Index */}
                {targetConnectionId && (
                    <div className="copy-field">
                        <label className="copy-field-label">{t('copyModal.targetIndex')}</label>

                        {/* Toggle: Existing / New */}
                        <div className="copy-toggle">
                            <button
                                type="button"
                                className={`copy-toggle-btn ${!createNewIndex ? 'active' : ''}`}
                                onClick={() => setCreateNewIndex(false)}
                            >
                                {t('copyModal.existingIndex')}
                            </button>
                            <button
                                type="button"
                                className={`copy-toggle-btn ${createNewIndex ? 'active' : ''}`}
                                onClick={() => setCreateNewIndex(true)}
                            >
                                {t('copyModal.newIndex')}
                            </button>
                        </div>

                        {!createNewIndex ? (
                            <SearchableSelect
                                value={targetIndex}
                                onChange={(val) => setTargetIndex(val as string)}
                                options={indexOptions}
                                placeholder={t('copyModal.selectIndex')}
                                icon={<Database size={14} />}
                                loading={loadingIndices}
                                loadingText={t('copyModal.loadingIndices')}
                            />
                        ) : (
                            <div className="copy-new-index">
                                <input
                                    type="text"
                                    value={newIndexName}
                                    onChange={(e) => setNewIndexName(e.target.value)}
                                    placeholder={t('copyModal.newIndexPlaceholder')}
                                    className="copy-input"
                                />
                                <label className="copy-checkbox">
                                    <input
                                        type="checkbox"
                                        checked={copyMapping}
                                        onChange={(e) => setCopyMapping(e.target.checked)}
                                    />
                                    <span>{t('copyModal.copyMappingToo')}</span>
                                </label>
                            </div>
                        )}
                    </div>
                )}

                {/* Mapping Status */}
                {!createNewIndex && targetIndex && (
                    <div className={`copy-mapping-status ${mappingStatus}`}>
                        {mappingStatus === 'checking' && (
                            <>
                                <Loader2 size={14} className="spin" />
                                <span>{t('copyModal.checkingMappings')}</span>
                            </>
                        )}
                        {mappingStatus === 'match' && (
                            <>
                                <CheckCircle size={14} />
                                <span>{t('copyModal.mappingsMatch')}</span>
                            </>
                        )}
                        {mappingStatus === 'mismatch' && (
                            <>
                                <AlertTriangle size={14} />
                                <span>{t('copyModal.mappingsMismatch')}</span>
                                <button
                                    className="copy-diff-btn"
                                    onClick={() => setShowMappingDiff(true)}
                                >
                                    <GitCompare size={12} />
                                    {t('copyModal.viewDifferences')}
                                </button>
                            </>
                        )}
                    </div>
                )}

                {/* Error */}
                {error && (
                    <div className="copy-error">
                        <AlertTriangle size={14} />
                        <span>{error}</span>
                    </div>
                )}

                {/* Success */}
                {result && (
                    <div className={`copy-result ${result.success ? 'success' : 'error'}`}>
                        {result.success ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
                        <span>{result.message}</span>
                    </div>
                )}

                {/* Actions */}
                <div className="copy-actions">
                    <button className="btn btn-secondary" onClick={onClose}>
                        {t('common.close')}
                    </button>
                    <button
                        className="btn btn-primary"
                        onClick={handleCopy}
                        disabled={loading || checkingMapping || !targetConnectionId || (!targetIndex && !newIndexName)}
                    >
                        {loading ? (
                            <>
                                <Loader2 size={14} className="spin" />
                                {t('copyModal.copying')}
                            </>
                        ) : checkingMapping ? (
                            <>
                                <Loader2 size={14} className="spin" />
                                {t('copyModal.checking')}
                            </>
                        ) : (
                            <>
                                <Copy size={14} />
                                {t('copyModal.copy')}
                            </>
                        )}
                    </button>
                </div>

                {/* Mapping Comparison Modal */}
                {showMappingDiff && sourceMapping && targetMappingData && (
                    <MappingComparisonModal
                        isOpen={showMappingDiff}
                        onClose={() => setShowMappingDiff(false)}
                        sourceIndex={sourceIndex}
                        targetIndex={targetIndex}
                        sourceMapping={sourceMapping}
                        targetMapping={targetMappingData}
                        sourceConnectionName={connections.find(c => c.id === currentConnectionId)?.name}
                        targetConnectionName={connections.find(c => c.id === targetConnectionId)?.name}
                    />
                )}
            </div>
        </Modal>
    );
};
