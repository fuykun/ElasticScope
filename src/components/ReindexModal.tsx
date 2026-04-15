import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Loader, AlertCircle, Search, Check, ChevronDown, X, Database,
    GitMerge, Plus,
} from 'lucide-react';
import CodeMirror from '@uiw/react-codemirror';
import { json, jsonParseLinter } from '@codemirror/lang-json';
import { linter, lintGutter } from '@codemirror/lint';
import { oneDark } from '@codemirror/theme-one-dark';
import { foldGutter } from '@codemirror/language';
import { EditorView } from '@codemirror/view';
import {
    getIndices,
    getIndexMapping,
    getIndexSettings,
    reindex,
    IndexInfo,
} from '../api/elasticsearchClient';
import { useClickOutside } from '../hooks/useClickOutside';

interface ReindexModalProps {
    sourceIndex: string;
    onSuccess: () => void;
    onCancel: () => void;
}

type TargetMode = 'existing' | 'new';

const COPYABLE_SETTINGS = [
    'number_of_shards',
    'number_of_replicas',
    'refresh_interval',
    'max_result_window',
    'analysis',
];

export const ReindexModal: React.FC<ReindexModalProps> = ({
    sourceIndex,
    onSuccess,
    onCancel,
}) => {
    const { t } = useTranslation();

    const [mode, setMode] = useState<TargetMode>('existing');
    const [indices, setIndices] = useState<IndexInfo[]>([]);
    const [loadingIndices, setLoadingIndices] = useState(true);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Existing index selection
    const [targetIndex, setTargetIndex] = useState('');
    const [targetSearch, setTargetSearch] = useState('');
    const [targetDropdownOpen, setTargetDropdownOpen] = useState(false);
    const targetDropdownRef = useRef<HTMLDivElement>(null);
    useClickOutside(
        targetDropdownRef as React.RefObject<HTMLElement>,
        () => setTargetDropdownOpen(false),
        targetDropdownOpen,
    );

    // New index
    const [newIndexName, setNewIndexName] = useState('');
    const [settingsJson, setSettingsJson] = useState('{}');
    const [mappingsJson, setMappingsJson] = useState('{}');
    const [loadingSourceInfo, setLoadingSourceInfo] = useState(false);

    const filteredIndices = useMemo(() => {
        const q = targetSearch.toLowerCase();
        return indices.filter(
            idx => idx.index !== sourceIndex && idx.index.toLowerCase().includes(q),
        );
    }, [indices, targetSearch, sourceIndex]);

    useEffect(() => {
        loadIndices();
    }, []);

    useEffect(() => {
        if (mode === 'new') {
            loadSourceInfo();
        }
    }, [mode]);

    const loadIndices = async () => {
        try {
            const data = await getIndices();
            setIndices(data.sort((a, b) => a.index.localeCompare(b.index)));
        } catch {
            // silently fail
        } finally {
            setLoadingIndices(false);
        }
    };

    const loadSourceInfo = async () => {
        setLoadingSourceInfo(true);
        try {
            const [settingsResponse, mappingsResponse] = await Promise.all([
                getIndexSettings(sourceIndex),
                getIndexMapping(sourceIndex),
            ]);

            const sourceSettings = (settingsResponse as any)[sourceIndex]?.settings?.index || {};
            const cleanSettings: Record<string, any> = {};
            for (const key of COPYABLE_SETTINGS) {
                if (sourceSettings[key] !== undefined) {
                    cleanSettings[key] = sourceSettings[key];
                }
            }

            const sourceMappings = (mappingsResponse as any)[sourceIndex]?.mappings || {};

            setSettingsJson(JSON.stringify(cleanSettings, null, 2));
            setMappingsJson(JSON.stringify(sourceMappings, null, 2));
        } catch {
            // silently fail
        } finally {
            setLoadingSourceInfo(false);
        }
    };

    const validateNewIndexName = (name: string): string | null => {
        if (!name) return t('reindex.validation.nameRequired');
        if (name.startsWith('.')) return t('reindex.validation.noStartWithDot');
        if (name.startsWith('-') || name.startsWith('_')) return t('reindex.validation.noStartWithDashUnderscore');
        if (name !== name.toLowerCase()) return t('reindex.validation.mustBeLowercase');
        if (!/^[a-z0-9][a-z0-9_\-]*$/.test(name)) return t('reindex.validation.invalidCharacters');
        if (indices.some(idx => idx.index === name)) return t('reindex.validation.indexExists');
        return null;
    };

    const parseJson = (text: string): { value: any; error: string | null } => {
        try {
            return { value: JSON.parse(text), error: null };
        } catch {
            return { value: null, error: t('indexPage.invalidJson') };
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (mode === 'existing') {
            if (!targetIndex) {
                setError(t('reindex.selectTargetIndex'));
                return;
            }
            setLoading(true);
            try {
                await reindex({ sourceIndex, targetIndex, createNew: false });
                onSuccess();
            } catch (err: any) {
                setError(err.message || t('reindex.reindexError'));
            } finally {
                setLoading(false);
            }
        } else {
            const nameError = validateNewIndexName(newIndexName);
            if (nameError) {
                setError(nameError);
                return;
            }

            const { value: settings, error: settingsError } = parseJson(settingsJson);
            if (settingsError) {
                setError(t('reindex.invalidSettings'));
                return;
            }

            const { value: mappings, error: mappingsError } = parseJson(mappingsJson);
            if (mappingsError) {
                setError(t('reindex.invalidMappings'));
                return;
            }

            setLoading(true);
            try {
                await reindex({
                    sourceIndex,
                    targetIndex: newIndexName,
                    createNew: true,
                    settings,
                    mappings,
                });
                onSuccess();
            } catch (err: any) {
                setError(err.message || t('reindex.reindexError'));
            } finally {
                setLoading(false);
            }
        }
    };

    return (
        <form onSubmit={handleSubmit} className="create-index-form">
            {/* Source info */}
            <div className="reindex-source-info">
                <span className="reindex-source-label">{t('reindex.source')}</span>
                <span className="reindex-source-name">
                    <Database size={13} />
                    {sourceIndex}
                </span>
            </div>

            {/* Mode tabs */}
            <div className="create-mode-tabs">
                <button
                    type="button"
                    className={`mode-tab ${mode === 'existing' ? 'active' : ''}`}
                    onClick={() => setMode('existing')}
                >
                    <Database size={16} />
                    {t('reindex.existingIndex')}
                </button>
                <button
                    type="button"
                    className={`mode-tab ${mode === 'new' ? 'active' : ''}`}
                    onClick={() => setMode('new')}
                >
                    <Plus size={16} />
                    {t('reindex.newIndex')}
                </button>
            </div>

            {mode === 'existing' ? (
                <div className="form-group">
                    <label className="form-label">{t('reindex.targetIndex')}</label>
                    {loadingIndices ? (
                        <div className="loading-inline">
                            <Loader size={14} className="spin" />
                            {t('createIndex.loadingIndices')}
                        </div>
                    ) : (
                        <div className="source-index-dropdown" ref={targetDropdownRef}>
                            <button
                                type="button"
                                className={`source-index-trigger ${targetDropdownOpen ? 'open' : ''}`}
                                onClick={() => {
                                    setTargetDropdownOpen(!targetDropdownOpen);
                                    setTargetSearch('');
                                }}
                            >
                                {targetIndex ? (
                                    <span className="source-index-selected">
                                        <Database size={14} />
                                        {targetIndex}
                                    </span>
                                ) : (
                                    <span className="source-index-placeholder">
                                        {t('createIndex.selectAnIndex')}
                                    </span>
                                )}
                                <div className="source-index-actions">
                                    {targetIndex && (
                                        <span
                                            className="source-index-clear"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setTargetIndex('');
                                            }}
                                        >
                                            <X size={14} />
                                        </span>
                                    )}
                                    <ChevronDown
                                        size={14}
                                        className={`source-index-chevron ${targetDropdownOpen ? 'rotated' : ''}`}
                                    />
                                </div>
                            </button>
                            {targetDropdownOpen && (
                                <div className="source-index-panel">
                                    <div className="source-index-search">
                                        <Search size={14} />
                                        <input
                                            type="text"
                                            value={targetSearch}
                                            onChange={(e) => setTargetSearch(e.target.value)}
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
                                                    className={`source-index-option ${targetIndex === idx.index ? 'selected' : ''}`}
                                                    onClick={() => {
                                                        setTargetIndex(idx.index);
                                                        setTargetDropdownOpen(false);
                                                        setTargetSearch('');
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
                                                        {targetIndex === idx.index && <Check size={14} />}
                                                    </div>
                                                </button>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            ) : (
                <>
                    <div className="form-group">
                        <label className="form-label">{t('reindex.newIndexName')}</label>
                        <input
                            type="text"
                            className="form-input"
                            value={newIndexName}
                            onChange={(e) => setNewIndexName(e.target.value.toLowerCase())}
                            placeholder="yeni-index-adi"
                            autoFocus
                        />
                        <span className="form-hint">{t('createIndex.indexNameHint')}</span>
                    </div>

                    {loadingSourceInfo ? (
                        <div className="loading-inline" style={{ padding: '16px 0' }}>
                            <Loader size={14} className="spin" />
                            {t('reindex.loadingSourceInfo')}
                        </div>
                    ) : (
                        <>
                            <div className="form-group">
                                <label className="form-label">{t('indexPage.settings')}</label>
                                <div className="reindex-json-editor">
                                    <CodeMirror
                                        className="rest-codemirror"
                                        value={settingsJson}
                                        height="180px"
                                        theme={oneDark}
                                        extensions={[
                                            json(),
                                            linter(jsonParseLinter()),
                                            lintGutter(),
                                            foldGutter(),
                                            EditorView.lineWrapping,
                                        ]}
                                        onChange={(val) => setSettingsJson(val)}
                                        basicSetup={{ foldGutter: false, searchKeymap: false }}
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">{t('indexPage.mappings')}</label>
                                <div className="reindex-json-editor">
                                    <CodeMirror
                                        className="rest-codemirror"
                                        value={mappingsJson}
                                        height="220px"
                                        theme={oneDark}
                                        extensions={[
                                            json(),
                                            linter(jsonParseLinter()),
                                            lintGutter(),
                                            foldGutter(),
                                            EditorView.lineWrapping,
                                        ]}
                                        onChange={(val) => setMappingsJson(val)}
                                        basicSetup={{ foldGutter: false, searchKeymap: false }}
                                    />
                                </div>
                            </div>
                        </>
                    )}
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
                    disabled={loading || loadingSourceInfo}
                >
                    {loading ? (
                        <>
                            <Loader size={14} className="spin" />
                            {t('reindex.reindexing')}
                        </>
                    ) : (
                        <>
                            <GitMerge size={14} />
                            {t('reindex.startReindex')}
                        </>
                    )}
                </button>
            </div>
        </form>
    );
};
