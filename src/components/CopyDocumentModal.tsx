import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, Server, Database, AlertTriangle, CheckCircle, Loader2, X, Search, GitCompare } from 'lucide-react';
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
    const [indexSearch, setIndexSearch] = useState('');

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

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Dokuman Kopyala" size="md">
            <div className="copy-document-modal">
                {/* Kaynak Bilgisi */}
                <div className="copy-source-info">
                    <div className="copy-info-header">
                        <Database size={14} />
                        <span>Kaynak Bilgileri</span>
                    </div>
                    <div className="copy-info-row">
                        <span className="copy-info-label">Index:</span>
                        <span className="copy-info-value">{sourceIndex}</span>
                    </div>
                    <div className="copy-info-row">
                        <span className="copy-info-label">Dokuman:</span>
                        <span className="copy-info-value">
                            {documents.length === 1 ? documents[0].id : `${documents.length} dokuman`}
                        </span>
                    </div>
                </div>

                {/* Hedef Sunucu */}
                <div className="copy-section">
                    <label className="copy-label">
                        <Server size={14} />
                        Hedef Sunucu
                    </label>
                    <select
                        value={targetConnectionId || ''}
                        onChange={(e) => setTargetConnectionId(e.target.value ? parseInt(e.target.value) : null)}
                        className="copy-select"
                    >
                        <option value="">Sunucu seciniz...</option>
                        {connections
                            .filter(conn => conn.id !== currentConnectionId)
                            .map(conn => (
                                <option key={conn.id} value={conn.id}>
                                    {conn.name} ({conn.url})
                                </option>
                            ))}
                    </select>
                </div>

                {/* Hedef Index */}
                {targetConnectionId && (
                    <div className="copy-section">
                        <label className="copy-label">
                            <Database size={14} />
                            Hedef Index
                        </label>

                        <div className="copy-index-options">
                            <label className="copy-radio-label">
                                <input
                                    type="radio"
                                    checked={!createNewIndex}
                                    onChange={() => setCreateNewIndex(false)}
                                />
                                Mevcut index
                            </label>
                            <label className="copy-radio-label">
                                <input
                                    type="radio"
                                    checked={createNewIndex}
                                    onChange={() => setCreateNewIndex(true)}
                                />
                                Yeni index olustur
                            </label>
                        </div>

                        {!createNewIndex ? (
                            loadingIndices ? (
                                <div className="copy-loading">
                                    <Loader2 size={16} className="spin" />
                                    <span>Index listesi yukleniyor...</span>
                                </div>
                            ) : (
                                <div className="copy-index-selector">
                                    <div className="copy-search-wrapper">
                                        <Search size={14} />
                                        <input
                                            type="text"
                                            value={indexSearch}
                                            onChange={(e) => setIndexSearch(e.target.value)}
                                            placeholder="Index ara..."
                                            className="copy-search-input"
                                        />
                                        {indexSearch && (
                                            <button
                                                className="copy-search-clear"
                                                onClick={() => setIndexSearch('')}
                                            >
                                                <X size={12} />
                                            </button>
                                        )}
                                    </div>
                                    <div className="copy-index-list">
                                        {targetIndices
                                            .filter(idx =>
                                                idx.index.toLowerCase().includes(indexSearch.toLowerCase()) ||
                                                idx.aliases.some(a => a.toLowerCase().includes(indexSearch.toLowerCase()))
                                            )
                                            .map(idx => (
                                                <div
                                                    key={idx.index}
                                                    className={`copy-index-item ${targetIndex === idx.index ? 'selected' : ''}`}
                                                    onClick={() => setTargetIndex(idx.index)}
                                                >
                                                    <div className="copy-index-main">
                                                        <span className="copy-index-name">{idx.index}</span>
                                                        <span className="copy-index-stats">
                                                            {idx.docsCount} doc, {idx.storeSize}
                                                        </span>
                                                    </div>
                                                    {idx.aliases.length > 0 && (
                                                        <div className="copy-index-aliases">
                                                            {idx.aliases.map(alias => (
                                                                <span key={alias} className="copy-alias-tag">{alias}</span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        {targetIndices.filter(idx =>
                                            idx.index.toLowerCase().includes(indexSearch.toLowerCase()) ||
                                            idx.aliases.some(a => a.toLowerCase().includes(indexSearch.toLowerCase()))
                                        ).length === 0 && (
                                                <div className="copy-no-results">
                                                    Sonuc bulunamadi
                                                </div>
                                            )}
                                    </div>
                                </div>
                            )
                        ) : (
                            <div className="copy-new-index">
                                <input
                                    type="text"
                                    value={newIndexName}
                                    onChange={(e) => setNewIndexName(e.target.value)}
                                    placeholder="Yeni index adi..."
                                    className="copy-input"
                                />
                                <label className="copy-checkbox-label">
                                    <input
                                        type="checkbox"
                                        checked={copyMapping}
                                        onChange={(e) => setCopyMapping(e.target.checked)}
                                    />
                                    Mapping'i de kopyala
                                </label>
                            </div>
                        )}
                    </div>
                )}

                {/* Mapping Comparison Status */}
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
                                    className="btn btn-sm btn-outline"
                                    onClick={() => setShowMappingDiff(true)}
                                >
                                    <GitCompare size={12} />
                                    {t('copyModal.viewDifferences')}
                                </button>
                            </>
                        )}
                    </div>
                )}

                {/* Hata Mesajı */}
                {error && (
                    <div className="copy-error">
                        <AlertTriangle size={14} />
                        <span>{error}</span>
                    </div>
                )}

                {/* Başarı Mesajı */}
                {result && (
                    <div className={`copy-result ${result.success ? 'success' : 'error'}`}>
                        {result.success ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
                        <span>{result.message}</span>
                    </div>
                )}

                {/* Buttons */}
                <div className="copy-actions">
                    <button className="btn btn-secondary" onClick={onClose}>
                        <X size={14} />
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

                {/* Mapping Karşılaştırma Modal */}
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
