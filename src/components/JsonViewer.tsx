import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight, ChevronDown, Search, X, ChevronUp, Check, Pencil, Pin, PinOff, ChevronsUpDown, ChevronsDownUp, Copy } from 'lucide-react';

// Pin storage helper functions
const PINNED_FIELDS_KEY = 'es_viewer_pinned_fields';

const getPinnedFields = (): string[] => {
    try {
        const saved = localStorage.getItem(PINNED_FIELDS_KEY);
        return saved ? JSON.parse(saved) : [];
    } catch {
        return [];
    }
};

const savePinnedFields = (fields: string[]) => {
    localStorage.setItem(PINNED_FIELDS_KEY, JSON.stringify(fields));
};

interface JsonViewerProps {
    data: any;
    searchQuery?: string;
    defaultExpanded?: boolean;
    expandAllByDefault?: boolean; // If true, expand ALL levels by default
    showSearchBar?: boolean;
    editable?: boolean;
    onSave?: (newData: any) => void;
    onCancel?: () => void;
    enablePinning?: boolean;
    forcePinnedFields?: string[]; // Fields that are always pinned and cannot be unpinned
    enableCopy?: boolean; // Enable copy button for JSON
}

interface JsonNodeProps {
    keyName: string | null;
    value: any;
    depth: number;
    searchQuery: string;
    defaultExpanded: boolean;
    expandAllByDefault: boolean;
    path: string;
    currentMatchIndex: number;
    matchCounter: { current: number };
    pinnedFields?: string[];
    forcePinnedFields?: string[]; // Fields that cannot be unpinned
    onTogglePin?: (fieldName: string) => void;
    showPinButton?: boolean;
    expandTrigger?: number; // 0: no action, positive: expand all, negative: collapse all
    isLastItem?: boolean; // Whether this is the last item in parent array/object
}

const getValueColor = (value: any): string => {
    if (value === null) return '#f472b6'; // pink
    if (typeof value === 'boolean') return '#c084fc'; // purple
    if (typeof value === 'number') return '#4ade80'; // green
    if (typeof value === 'string') return '#fbbf24'; // amber
    return '#94a3b8'; // gray
};

const formatValue = (value: any): string => {
    if (value === null) return 'null';
    if (typeof value === 'string') return `"${value}"`;
    return String(value);
};

const highlightMatch = (
    text: string,
    query: string,
    matchCounter: { current: number },
    currentMatchIndex: number
): React.ReactNode => {
    if (!query) return text;

    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const index = lowerText.indexOf(lowerQuery);

    if (index === -1) return text;

    const matchIndex = matchCounter.current++;
    const isCurrentMatch = matchIndex === currentMatchIndex;

    return (
        <>
            {text.slice(0, index)}
            <mark
                className={`json-highlight ${isCurrentMatch ? 'json-highlight-active' : ''}`}
                data-match-index={matchIndex}
            >
                {text.slice(index, index + query.length)}
            </mark>
            {text.slice(index + query.length)}
        </>
    );
};

const containsSearchTerm = (value: any, key: string | null, query: string): boolean => {
    if (!query) return false;
    const lowerQuery = query.toLowerCase();

    if (key && key.toLowerCase().includes(lowerQuery)) return true;

    if (value === null) return 'null'.includes(lowerQuery);
    if (typeof value === 'object') {
        return Object.entries(value).some(([k, v]) => containsSearchTerm(v, k, query));
    }
    return String(value).toLowerCase().includes(lowerQuery);
};

const JsonNode: React.FC<JsonNodeProps> = ({
    keyName,
    value,
    depth,
    searchQuery,
    defaultExpanded,
    expandAllByDefault,
    path,
    currentMatchIndex,
    matchCounter,
    pinnedFields = [],
    forcePinnedFields = [],
    onTogglePin,
    showPinButton = false,
    expandTrigger = 0,
    isLastItem = false,
}) => {
    const { t } = useTranslation();
    const isObject = value !== null && typeof value === 'object';
    const isArray = Array.isArray(value);
    const isForcePinned = depth === 1 && keyName !== null && forcePinnedFields.includes(keyName);
    const isUserPinned = depth === 1 && keyName !== null && pinnedFields.includes(keyName);
    const isPinned = isForcePinned || isUserPinned;

    const hasMatch = useMemo(() => containsSearchTerm(value, keyName, searchQuery), [value, keyName, searchQuery]);

    const [isExpanded, setIsExpanded] = useState(() => {
        if (searchQuery && hasMatch) return true;
        if (expandAllByDefault) return true;
        if (depth === 0) return true; // Root is always expanded
        if (defaultExpanded && depth < 2) return true;
        return false;
    });

    useEffect(() => {
        if (expandTrigger > 0) {
            setIsExpanded(true);
        } else if (expandTrigger < 0 && depth > 0) {
            setIsExpanded(false);
        }
    }, [expandTrigger, depth]);

    React.useEffect(() => {
        if (searchQuery && hasMatch) {
            setIsExpanded(true);
        }
    }, [searchQuery, hasMatch]);

    const toggleExpand = () => setIsExpanded(!isExpanded);

    if (!isObject) {
        const valueStr = formatValue(value);
        const valueColor = getValueColor(value);
        const keyMatches = keyName && searchQuery && keyName.toLowerCase().includes(searchQuery.toLowerCase());
        const valueMatches = searchQuery && valueStr.toLowerCase().includes(searchQuery.toLowerCase());

        return (
            <div className={`json-line ${isPinned ? 'json-pinned' : ''}`}>
                {/* Indent */}
                <span className="json-indent" style={{ width: `${depth * 20}px` }} />
                {/* Toggle alanı için boş placeholder - hizalama için */}
                <span className="json-toggle">&nbsp;</span>
                {keyName !== null && (
                    <>
                        {showPinButton && depth === 1 && onTogglePin && (
                            isForcePinned ? (
                                <span
                                    className="json-pin-btn pinned force-pinned"
                                    title={t('jsonViewer.columnPinned')}
                                >
                                    <Pin size={10} />
                                </span>
                            ) : (
                                <button
                                    className={`json-pin-btn ${isUserPinned ? 'pinned' : ''}`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onTogglePin(keyName);
                                    }}
                                    title={isUserPinned ? t('jsonViewer.unpin') : t('jsonViewer.pin')}
                                >
                                    {isUserPinned ? <PinOff size={10} /> : <Pin size={10} />}
                                </button>
                            )
                        )}
                        <span className={`json-key ${keyMatches ? 'json-match' : ''} ${isPinned ? 'json-key-pinned' : ''}`}>
                            {searchQuery ? highlightMatch(keyName, searchQuery, matchCounter, currentMatchIndex) : keyName}
                        </span>
                        <span className="json-colon">: </span>
                    </>
                )}
                <span className={`json-value ${valueMatches ? 'json-match' : ''}`} style={{ color: valueColor }}>
                    {searchQuery ? highlightMatch(valueStr, searchQuery, matchCounter, currentMatchIndex) : valueStr}
                </span>
                {!isLastItem && <span className="json-comma">,</span>}
            </div>
        );
    }

    const entries = Object.entries(value);
    const bracketOpen = isArray ? '[' : '{';
    const bracketClose = isArray ? ']' : '}';
    const previewCount = 3;
    const keyMatches = keyName && searchQuery && keyName.toLowerCase().includes(searchQuery.toLowerCase());

    const sortedEntries = useMemo(() => {
        const allPinnedFields = [...new Set([...forcePinnedFields, ...pinnedFields])];
        if (depth === 0 && !isArray && allPinnedFields.length > 0) {
            const pinned = entries.filter(([k]) => allPinnedFields.includes(k));
            const unpinned = entries.filter(([k]) => !allPinnedFields.includes(k));
            // Sort pinned: forcePinned first, then userPinned
            pinned.sort((a, b) => {
                const aForce = forcePinnedFields.includes(a[0]);
                const bForce = forcePinnedFields.includes(b[0]);
                if (aForce && !bForce) return -1;
                if (!aForce && bForce) return 1;
                // Same type, keep original order within that type
                if (aForce && bForce) {
                    return forcePinnedFields.indexOf(a[0]) - forcePinnedFields.indexOf(b[0]);
                }
                return pinnedFields.indexOf(a[0]) - pinnedFields.indexOf(b[0]);
            });
            return [...pinned, ...unpinned];
        }
        return entries;
    }, [entries, depth, isArray, pinnedFields, forcePinnedFields]);

    return (
        <div className="json-node">
            <div
                className={`json-line json-expandable ${isPinned ? 'json-pinned' : ''}`}
                onClick={toggleExpand}
            >
                {/* Indent */}
                <span className="json-indent" style={{ width: `${depth * 20}px` }} />
                <span className="json-toggle">
                    {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                </span>
                {keyName !== null && (
                    <>
                        {showPinButton && depth === 1 && onTogglePin && (
                            isForcePinned ? (
                                <span
                                    className="json-pin-btn pinned force-pinned"
                                    title={t('jsonViewer.columnPinned')}
                                >
                                    <Pin size={10} />
                                </span>
                            ) : (
                                <button
                                    className={`json-pin-btn ${isUserPinned ? 'pinned' : ''}`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onTogglePin(keyName);
                                    }}
                                    title={isUserPinned ? t('jsonViewer.unpin') : t('jsonViewer.pin')}
                                >
                                    {isUserPinned ? <PinOff size={10} /> : <Pin size={10} />}
                                </button>
                            )
                        )}
                        <span className={`json-key ${keyMatches ? 'json-match' : ''} ${isPinned ? 'json-key-pinned' : ''}`}>
                            {searchQuery ? highlightMatch(keyName, searchQuery, matchCounter, currentMatchIndex) : keyName}
                        </span>
                        <span className="json-colon">: </span>
                    </>
                )}
                <span className="json-bracket">{bracketOpen}</span>
                {!isExpanded && (
                    <>
                        <span className="json-preview">
                            {sortedEntries.slice(0, previewCount).map(([k, v], i) => (
                                <span key={k}>
                                    {isArray ? '' : <span className="json-key">{k}</span>}
                                    {isArray ? '' : ': '}
                                    <span style={{ color: getValueColor(v) }}>
                                        {typeof v === 'object' && v !== null
                                            ? (Array.isArray(v) ? '[...]' : '{...}')
                                            : formatValue(v).substring(0, 20)}
                                    </span>
                                    {i < Math.min(previewCount - 1, sortedEntries.length - 1) ? ', ' : ''}
                                </span>
                            ))}
                            {sortedEntries.length > previewCount && <span className="json-more"> ...+{sortedEntries.length - previewCount}</span>}
                        </span>
                        <span className="json-bracket">{bracketClose}</span>
                    </>
                )}
                {!isExpanded && (
                    <span className="json-count">{sortedEntries.length} {isArray ? 'items' : 'keys'}</span>
                )}
            </div>

            {isExpanded && (
                <>
                    {sortedEntries.map(([k, v], index) => (
                        <JsonNode
                            key={k}
                            keyName={isArray ? null : k}
                            value={v}
                            depth={depth + 1}
                            searchQuery={searchQuery}
                            defaultExpanded={defaultExpanded}
                            expandAllByDefault={expandAllByDefault}
                            path={`${path}.${k}`}
                            currentMatchIndex={currentMatchIndex}
                            matchCounter={matchCounter}
                            pinnedFields={pinnedFields}
                            forcePinnedFields={forcePinnedFields}
                            onTogglePin={onTogglePin}
                            showPinButton={showPinButton}
                            expandTrigger={expandTrigger}
                            isLastItem={index === sortedEntries.length - 1}
                        />
                    ))}
                    <div className="json-line">
                        <span className="json-indent" style={{ width: `${depth * 20}px` }} />
                        <span className="json-toggle">&nbsp;</span>
                        <span className="json-bracket">{bracketClose}</span>
                    </div>
                </>
            )}
        </div>
    );
};

export const JsonViewer: React.FC<JsonViewerProps> = ({
    data,
    searchQuery: externalSearch,
    defaultExpanded = true,
    expandAllByDefault = false,
    showSearchBar = true,
    editable = false,
    onSave,
    onCancel,
    enablePinning = false,
    forcePinnedFields = [],
    enableCopy = false,
}) => {
    const { t } = useTranslation();
    const [internalSearch, setInternalSearch] = useState('');
    const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
    const contentRef = useRef<HTMLDivElement>(null);

    // Expand/Collapse all trigger
    const [expandTrigger, setExpandTrigger] = useState(0);
    const [copied, setCopied] = useState(false);

    const handleCopyJson = useCallback(() => {
        try {
            const jsonString = JSON.stringify(data, null, 2);
            navigator.clipboard.writeText(jsonString);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (error) {
            console.error('Failed to copy JSON:', error);
        }
    }, [data]);

    const handleExpandAll = useCallback(() => {
        setExpandTrigger(prev => Math.abs(prev) + 1);
    }, []);

    const handleCollapseAll = useCallback(() => {
        setExpandTrigger(prev => -(Math.abs(prev) + 1));
    }, []);

    // Editable mode states
    const [isEditing, setIsEditing] = useState(false);
    const [editedJson, setEditedJson] = useState('');
    const [jsonError, setJsonError] = useState<string | null>(null);

    // Pinned fields state
    const [pinnedFields, setPinnedFields] = useState<string[]>(() => getPinnedFields());

    const handleTogglePin = useCallback((fieldName: string) => {
        setPinnedFields(prev => {
            let newPinned: string[];
            if (prev.includes(fieldName)) {
                newPinned = prev.filter(f => f !== fieldName);
            } else {
                newPinned = [...prev, fieldName];
            }
            savePinnedFields(newPinned);
            return newPinned;
        });
    }, []);

    const searchQuery = externalSearch !== undefined ? externalSearch : internalSearch;

    // Edit mode handlers
    const handleEdit = useCallback(() => {
        setIsEditing(true);
        setEditedJson(JSON.stringify(data, null, 2));
        setJsonError(null);
    }, [data]);

    const handleCancelEdit = useCallback(() => {
        setIsEditing(false);
        setEditedJson('');
        setJsonError(null);
        if (onCancel) {
            onCancel();
        }
    }, [onCancel]);

    const handleSaveEdit = useCallback(() => {
        try {
            const parsed = JSON.parse(editedJson);
            setJsonError(null);
            setIsEditing(false);
            if (onSave) {
                onSave(parsed);
            }
        } catch (error: any) {
            setJsonError(t('common.invalidJson'));
        }
    }, [editedJson, onSave, t]);

    const handleJsonChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setEditedJson(e.target.value);
        setJsonError(null);
    }, []);

    const matchCount = useMemo(() => {
        if (!searchQuery) return 0;
        const jsonStr = JSON.stringify(data, null, 2).toLowerCase();
        const query = searchQuery.toLowerCase();
        let count = 0;
        let pos = 0;
        while ((pos = jsonStr.indexOf(query, pos)) !== -1) {
            count++;
            pos += query.length;
        }
        return count;
    }, [data, searchQuery]);

    useEffect(() => {
        setCurrentMatchIndex(0);
    }, [searchQuery]);

    const scrollToMatch = useCallback((index: number) => {
        if (!contentRef.current) return;

        setTimeout(() => {
            const activeElement = contentRef.current?.querySelector(`[data-match-index="${index}"]`);
            if (activeElement) {
                activeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 50);
    }, []);

    useEffect(() => {
        if (matchCount > 0) {
            scrollToMatch(currentMatchIndex);
        }
    }, [currentMatchIndex, matchCount, scrollToMatch]);

    useEffect(() => {
        if (searchQuery && matchCount > 0) {
            scrollToMatch(0);
        }
    }, [searchQuery, matchCount, scrollToMatch]);

    const handlePrevMatch = useCallback(() => {
        if (matchCount <= 0) return;
        setCurrentMatchIndex(prev => (prev - 1 + matchCount) % matchCount);
    }, [matchCount]);

    const handleNextMatch = useCallback(() => {
        if (matchCount <= 0) return;
        setCurrentMatchIndex(prev => (prev + 1) % matchCount);
    }, [matchCount]);

    const matchCounter = useRef({ current: 0 });
    matchCounter.current = { current: 0 };

    // Keyboard handler
    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && matchCount > 0) {
            e.preventDefault();
            if (e.shiftKey) {
                setCurrentMatchIndex(prev => (prev - 1 + matchCount) % matchCount);
            } else {
                setCurrentMatchIndex(prev => (prev + 1) % matchCount);
            }
        }
    }, [matchCount]);

    return (
        <div className="json-viewer">
            {showSearchBar && !isEditing && (
                <div className="json-toolbar">
                    <div className="json-search">
                        <Search size={14} />
                        <input
                            type="text"
                            placeholder={t('jsonViewer.searchPlaceholder')}
                            value={internalSearch}
                            onChange={(e) => setInternalSearch(e.target.value)}
                            onKeyDown={handleKeyDown}
                        />
                        {internalSearch && matchCount > 0 && (
                            <>
                                <span className="search-count">
                                    {currentMatchIndex + 1}/{matchCount}
                                </span>
                                <div className="search-nav">
                                    <button
                                        className="btn-nav"
                                        onClick={handlePrevMatch}
                                        title={t('jsonViewer.previous')}
                                        disabled={matchCount <= 1}
                                    >
                                        <ChevronUp size={14} />
                                    </button>
                                    <button
                                        className="btn-nav"
                                        onClick={handleNextMatch}
                                        title={t('jsonViewer.next')}
                                        disabled={matchCount <= 1}
                                    >
                                        <ChevronDown size={14} />
                                    </button>
                                </div>
                                <button className="btn-clear" onClick={() => setInternalSearch('')}>
                                    <X size={14} />
                                </button>
                            </>
                        )}
                        {internalSearch && matchCount === 0 && (
                            <>
                                <span className="search-count search-no-match">{t('jsonViewer.notFound')}</span>
                                <button className="btn-clear" onClick={() => setInternalSearch('')}>
                                    <X size={14} />
                                </button>
                            </>
                        )}
                    </div>
                    <div className="json-toolbar-actions">
                        <button
                            className="btn btn-icon-sm"
                            onClick={handleExpandAll}
                            title={t('jsonViewer.expandAll')}
                        >
                            <ChevronsDownUp size={14} />
                        </button>
                        <button
                            className="btn btn-icon-sm"
                            onClick={handleCollapseAll}
                            title={t('jsonViewer.collapseAll')}
                        >
                            <ChevronsUpDown size={14} />
                        </button>
                        {enableCopy && (
                            <button
                                className="btn btn-icon-sm"
                                onClick={handleCopyJson}
                                title={copied ? t('common.copied') : t('common.copy')}
                            >
                                {copied ? <Check size={14} /> : <Copy size={14} />}
                            </button>
                        )}
                        {editable && (
                            <button
                                className="btn btn-icon-sm json-edit-btn"
                                onClick={handleEdit}
                                title={t('common.edit')}
                            >
                                <Pencil size={14} />
                            </button>
                        )}
                    </div>
                </div>
            )}
            {!showSearchBar && !isEditing && (
                <div className="json-toolbar json-toolbar-minimal">
                    <button
                        className="btn btn-icon-sm"
                        onClick={handleExpandAll}
                        title={t('jsonViewer.expandAll')}
                    >
                        <ChevronsDownUp size={14} />
                    </button>
                    <button
                        className="btn btn-icon-sm"
                        onClick={handleCollapseAll}
                        title={t('jsonViewer.collapseAll')}
                    >
                        <ChevronsUpDown size={14} />
                    </button>
                    {enableCopy && (
                        <button
                            className="btn btn-icon-sm"
                            onClick={handleCopyJson}
                            title={copied ? t('common.copied') : t('common.copy')}
                        >
                            {copied ? <Check size={14} /> : <Copy size={14} />}
                        </button>
                    )}
                    {editable && (
                        <button
                            className="btn btn-icon-sm json-edit-btn"
                            onClick={handleEdit}
                            title={t('common.edit')}
                        >
                            <Pencil size={14} />
                        </button>
                    )}
                </div>
            )}
            {isEditing && (
                <div className="json-toolbar json-edit-toolbar">
                    <div className="json-edit-actions">
                        <button
                            className="btn btn-secondary btn-sm"
                            onClick={handleCancelEdit}
                        >
                            {t('common.cancel')}
                        </button>
                        <button
                            className="btn btn-primary btn-sm"
                            onClick={handleSaveEdit}
                        >
                            <Check size={14} />
                            {t('common.save')}
                        </button>
                    </div>
                </div>
            )}
            {isEditing ? (
                <div className="json-editor">
                    <textarea
                        className="json-textarea"
                        value={editedJson}
                        onChange={handleJsonChange}
                        spellCheck={false}
                        autoFocus
                    />
                    {jsonError && (
                        <div className="json-error">
                            {jsonError}
                        </div>
                    )}
                </div>
            ) : (
                <div className="json-content" ref={contentRef}>
                    <JsonNode
                        keyName={null}
                        value={data}
                        depth={0}
                        searchQuery={searchQuery}
                        defaultExpanded={defaultExpanded}
                        expandAllByDefault={expandAllByDefault}
                        path="root"
                        currentMatchIndex={currentMatchIndex}
                        matchCounter={matchCounter.current}
                        pinnedFields={enablePinning ? pinnedFields : []}
                        forcePinnedFields={forcePinnedFields}
                        onTogglePin={enablePinning ? handleTogglePin : undefined}
                        showPinButton={enablePinning}
                        expandTrigger={expandTrigger}
                    />
                </div>
            )}
        </div>
    );
};
