import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Copy, Loader, AlertCircle, Search, Check, ChevronDown, X, Database } from 'lucide-react';
import {
    getIndices,
    getIndexMapping,
    getIndexSettings,
    createIndex,
    IndexInfo
} from '../api/elasticsearchClient';
import { useClickOutside } from '../hooks/useClickOutside';

interface CreateIndexModalProps {
    onSuccess: () => void;
    onCancel: () => void;
}

type CreateMode = 'empty' | 'copy';

export const CreateIndexModal: React.FC<CreateIndexModalProps> = ({
    onSuccess,
    onCancel
}) => {
    const { t } = useTranslation();
    const [mode, setMode] = useState<CreateMode>('empty');
    const [indexName, setIndexName] = useState('');
    const [sourceIndex, setSourceIndex] = useState('');
    const [indices, setIndices] = useState<IndexInfo[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingIndices, setLoadingIndices] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Source index searchable dropdown
    const [sourceSearch, setSourceSearch] = useState('');
    const [sourceDropdownOpen, setSourceDropdownOpen] = useState(false);
    const sourceDropdownRef = useRef<HTMLDivElement>(null);
    useClickOutside(sourceDropdownRef as React.RefObject<HTMLElement>, () => setSourceDropdownOpen(false), sourceDropdownOpen);

    const filteredIndices = useMemo(() => {
        if (!sourceSearch.trim()) return indices;
        const q = sourceSearch.toLowerCase();
        return indices.filter(idx => idx.index.toLowerCase().includes(q));
    }, [indices, sourceSearch]);

    const [numberOfShards, setNumberOfShards] = useState('1');
    const [numberOfReplicas, setNumberOfReplicas] = useState('1');

    useEffect(() => {
        loadIndices();
    }, []);

    const loadIndices = async () => {
        try {
            const data = await getIndices();
            setIndices(data.sort((a, b) => a.index.localeCompare(b.index)));
        } catch (err: any) {
            console.error('Index listesi alınamadı:', err);
        } finally {
            setLoadingIndices(false);
        }
    };

    const validateIndexName = (name: string): string | null => {
        if (!name) return t('createIndex.validation.nameRequired');
        if (name.startsWith('.')) return t('createIndex.validation.noStartWithDot');
        if (name.startsWith('-') || name.startsWith('_')) return t('createIndex.validation.noStartWithDashUnderscore');
        if (name !== name.toLowerCase()) return t('createIndex.validation.mustBeLowercase');
        if (!/^[a-z0-9][a-z0-9_\-]*$/.test(name)) return t('createIndex.validation.invalidCharacters');
        if (indices.some(idx => idx.index === name)) return t('createIndex.validation.indexExists');
        return null;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        const nameError = validateIndexName(indexName);
        if (nameError) {
            setError(nameError);
            return;
        }

        setLoading(true);

        try {
            if (mode === 'empty') {
                await createIndex({
                    indexName,
                    settings: {
                        number_of_shards: parseInt(numberOfShards) || 1,
                        number_of_replicas: parseInt(numberOfReplicas) || 1
                    }
                });
            } else {
                // Mevcut indexten kopyala
                if (!sourceIndex) {
                    setError(t('createIndex.selectSourceIndex'));
                    setLoading(false);
                    return;
                }

                // Kaynak indexin settings ve mappings'ini al
                const [settingsResponse, mappingsResponse] = await Promise.all([
                    getIndexSettings(sourceIndex),
                    getIndexMapping(sourceIndex)
                ]);

                const sourceSettings = (settingsResponse as any)[sourceIndex]?.settings?.index || {};
                const cleanSettings: Record<string, any> = {};

                const copyableSettings = [
                    'number_of_shards',
                    'number_of_replicas',
                    'refresh_interval',
                    'max_result_window',
                    'analysis'
                ];

                for (const key of copyableSettings) {
                    if (sourceSettings[key] !== undefined) {
                        cleanSettings[key] = sourceSettings[key];
                    }
                }

                // Mappings'i al
                const sourceMappings = (mappingsResponse as any)[sourceIndex]?.mappings || {};

                await createIndex({
                    indexName,
                    settings: cleanSettings,
                    mappings: sourceMappings
                });
            }

            onSuccess();
        } catch (err: any) {
            setError(err.message || t('createIndex.createError'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="create-index-form">
            {/* Mode Selection */}
            <div className="create-mode-tabs">
                <button
                    type="button"
                    className={`mode-tab ${mode === 'empty' ? 'active' : ''}`}
                    onClick={() => setMode('empty')}
                >
                    <Plus size={16} />
                    {t('createIndex.emptyIndex')}
                </button>
                <button
                    type="button"
                    className={`mode-tab ${mode === 'copy' ? 'active' : ''}`}
                    onClick={() => setMode('copy')}
                >
                    <Copy size={16} />
                    {t('createIndex.copyFromExisting')}
                </button>
            </div>

            {/* Index Name */}
            <div className="form-group">
                <label className="form-label">{t('createIndex.indexName')}</label>
                <input
                    type="text"
                    className="form-input"
                    value={indexName}
                    onChange={(e) => setIndexName(e.target.value.toLowerCase())}
                    placeholder="yeni-index-adi"
                    autoFocus
                />
                <span className="form-hint">
                    {t('createIndex.indexNameHint')}
                </span>
            </div>

            {mode === 'empty' ? (
                <>
                    {/* Shard Settings */}
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">{t('createIndex.numberOfShards')}</label>
                            <input
                                type="number"
                                className="form-input"
                                value={numberOfShards}
                                onChange={(e) => setNumberOfShards(e.target.value)}
                                min="1"
                                max="100"
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">{t('createIndex.numberOfReplicas')}</label>
                            <input
                                type="number"
                                className="form-input"
                                value={numberOfReplicas}
                                onChange={(e) => setNumberOfReplicas(e.target.value)}
                                min="0"
                                max="10"
                            />
                        </div>
                    </div>
                </>
            ) : (
                <>
                    {/* Source Index Selection */}
                    <div className="form-group">
                        <label className="form-label">{t('createIndex.sourceIndex')}</label>
                        {loadingIndices ? (
                            <div className="loading-inline">
                                <Loader size={14} className="spin" />
                                {t('createIndex.loadingIndices')}
                            </div>
                        ) : (
                            <div className="source-index-dropdown" ref={sourceDropdownRef}>
                                <button
                                    type="button"
                                    className={`source-index-trigger ${sourceDropdownOpen ? 'open' : ''}`}
                                    onClick={() => {
                                        setSourceDropdownOpen(!sourceDropdownOpen);
                                        setSourceSearch('');
                                    }}
                                >
                                    {sourceIndex ? (
                                        <span className="source-index-selected">
                                            <Database size={14} />
                                            {sourceIndex}
                                        </span>
                                    ) : (
                                        <span className="source-index-placeholder">
                                            {t('createIndex.selectAnIndex')}
                                        </span>
                                    )}
                                    <div className="source-index-actions">
                                        {sourceIndex && (
                                            <span
                                                className="source-index-clear"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSourceIndex('');
                                                }}
                                            >
                                                <X size={14} />
                                            </span>
                                        )}
                                        <ChevronDown size={14} className={`source-index-chevron ${sourceDropdownOpen ? 'rotated' : ''}`} />
                                    </div>
                                </button>
                                {sourceDropdownOpen && (
                                    <div className="source-index-panel">
                                        <div className="source-index-search">
                                            <Search size={14} />
                                            <input
                                                type="text"
                                                value={sourceSearch}
                                                onChange={(e) => setSourceSearch(e.target.value)}
                                                placeholder={t('common.search')}
                                                autoFocus
                                            />
                                        </div>
                                        <div className="source-index-list">
                                            {filteredIndices.length === 0 ? (
                                                <div className="source-index-empty">
                                                    {t('common.noResults')}
                                                </div>
                                            ) : (
                                                filteredIndices.map((idx) => (
                                                    <button
                                                        type="button"
                                                        key={idx.index}
                                                        className={`source-index-option ${sourceIndex === idx.index ? 'selected' : ''}`}
                                                        onClick={() => {
                                                            setSourceIndex(idx.index);
                                                            setSourceDropdownOpen(false);
                                                            setSourceSearch('');
                                                        }}
                                                    >
                                                        <div className="source-index-option-info">
                                                            <span className={`source-index-health health-${idx.health}`} />
                                                            <span className="source-index-name">{idx.index}</span>
                                                            {idx.aliases && idx.aliases.length > 0 && (
                                                                <span className="source-index-aliases">
                                                                    <span className="source-index-alias-tag">{idx.aliases[0]}</span>
                                                                    {idx.aliases.length > 1 && (
                                                                        <span className="source-index-alias-more">+{idx.aliases.length - 1}</span>
                                                                    )}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="source-index-option-meta">
                                                            <span>{idx['store.size'] || ''}</span>
                                                            {sourceIndex === idx.index && <Check size={14} />}
                                                        </div>
                                                    </button>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                        <span className="form-hint">
                            {t('createIndex.copyHint')}
                        </span>
                    </div>
                </>
            )}

            {error && (
                <div className="error-message">
                    <AlertCircle size={14} />
                    {error}
                </div>
            )}

            <div className="form-actions">
                <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={onCancel}
                    disabled={loading}
                >
                    {t('common.cancel')}
                </button>
                <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={loading || !indexName}
                >
                    {loading ? (
                        <>
                            <Loader size={14} className="spin" />
                            {t('createIndex.creating')}
                        </>
                    ) : (
                        <>
                            <Plus size={14} />
                            {t('createIndex.createButton')}
                        </>
                    )}
                </button>
            </div>
        </form>
    );
};
