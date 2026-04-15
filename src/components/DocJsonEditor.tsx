import React, { useState, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import CodeMirror from '@uiw/react-codemirror';
import { json, jsonParseLinter } from '@codemirror/lang-json';
import { oneDark } from '@codemirror/theme-one-dark';
import { foldGutter, foldAll, unfoldAll } from '@codemirror/language';
import { linter, lintGutter } from '@codemirror/lint';
import { EditorView, keymap } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { Pin, Plus, X, Pencil, ChevronsDownUp, ChevronsUpDown, Copy, CheckCircle } from 'lucide-react';
import type { EditorView as EditorViewType } from '@codemirror/view';

const PINNED_FIELDS_KEY = 'es_viewer_pinned_fields';

const loadPinnedFields = (): string[] => {
    try {
        const saved = localStorage.getItem(PINNED_FIELDS_KEY);
        return saved ? JSON.parse(saved) : [];
    } catch { return []; }
};

const persistPinnedFields = (fields: string[]) => {
    localStorage.setItem(PINNED_FIELDS_KEY, JSON.stringify(fields));
};

const sortByPinned = (data: Record<string, any>, pinned: string[]): Record<string, any> => {
    const result: Record<string, any> = {};
    for (const f of pinned) {
        if (f in data) result[f] = data[f];
    }
    for (const k of Object.keys(data)) {
        if (!pinned.includes(k)) result[k] = data[k];
    }
    return result;
};

interface DocJsonEditorProps {
    data: Record<string, any>;
    forcePinnedFields?: string[];
    editable?: boolean;
    onSave?: (newData: any) => void;
    onCancel?: () => void;
    loading?: boolean;
    fluid?: boolean; // grow with content instead of fixed height
}

export const DocJsonEditor: React.FC<DocJsonEditorProps> = ({
    data,
    forcePinnedFields = [],
    editable = false,
    onSave,
    onCancel,
    loading = false,
    fluid = false,
}) => {
    const { t } = useTranslation();
    const viewRef = useRef<EditorViewType | null>(null);

    const [userPinned, setUserPinned] = useState<string[]>(loadPinnedFields);
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState('');
    const [parseError, setParseError] = useState<string | null>(null);
    const [showAddPin, setShowAddPin] = useState(false);
    const [copyDone, setCopyDone] = useState(false);

    const allPinned = useMemo(() => {
        const combined = [...forcePinnedFields];
        for (const f of userPinned) {
            if (!combined.includes(f)) combined.push(f);
        }
        // Only include fields that exist in data
        return combined.filter(f => f in data);
    }, [forcePinnedFields, userPinned, data]);

    const sortedData = useMemo(() => sortByPinned(data, allPinned), [data, allPinned]);

    const unpinnedFields = Object.keys(data).filter(f => !allPinned.includes(f));

    const togglePin = (field: string) => {
        if (forcePinnedFields.includes(field)) return;
        const next = userPinned.includes(field)
            ? userPinned.filter(f => f !== field)
            : [...userPinned, field];
        setUserPinned(next);
        persistPinnedFields(next);
    };

    const handleStartEdit = () => {
        setEditValue(JSON.stringify(sortedData, null, 2));
        setIsEditing(true);
        setParseError(null);
    };

    const handleSave = () => {
        try {
            const parsed = JSON.parse(editValue);
            setIsEditing(false);
            setParseError(null);
            onSave?.(parsed);
        } catch {
            setParseError(t('common.invalidJson'));
        }
    };

    const handleCancel = () => {
        setIsEditing(false);
        setParseError(null);
        onCancel?.();
    };

    if (loading) {
        return (
            <div className="doc-json-editor-loading">
                <span className="spinner" />
            </div>
        );
    }

    const showPinBar = allPinned.length > 0 || (editable && unpinnedFields.length > 0);

    return (
        <div className={`doc-json-editor${fluid ? ' fluid' : ''}`}>
            {/* Pin bar */}
            {showPinBar && (
                <div className="doc-json-pin-bar">
                    {allPinned.map(field => {
                        const isForce = forcePinnedFields.includes(field);
                        return (
                            <span
                                key={field}
                                className={`doc-json-pin-badge${isForce ? ' force' : ''}`}
                                title={isForce ? field : `${field} — click to unpin`}
                            >
                                <Pin size={9} />
                                {field}
                                {!isForce && (
                                    <button
                                        className="doc-json-pin-remove"
                                        onClick={() => togglePin(field)}
                                    >
                                        <X size={9} />
                                    </button>
                                )}
                            </span>
                        );
                    })}
                    {editable && unpinnedFields.length > 0 && (
                        <div className="doc-json-add-pin">
                            <button
                                className="doc-json-add-pin-btn"
                                onClick={() => setShowAddPin(v => !v)}
                                title="Pin a field"
                            >
                                <Plus size={11} />
                            </button>
                            {showAddPin && (
                                <div className="doc-json-add-pin-dropdown">
                                    {unpinnedFields.map(f => (
                                        <button
                                            key={f}
                                            className="doc-json-add-pin-option"
                                            onClick={() => { togglePin(f); setShowAddPin(false); }}
                                        >
                                            <Pin size={10} />
                                            {f}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Editor */}
            <div className="doc-json-editor-body">
                <CodeMirror
                    className="rest-codemirror"
                    value={isEditing ? editValue : JSON.stringify(sortedData, null, 2)}
                    height={fluid ? 'auto' : '100%'}
                    theme={oneDark}
                    extensions={[
                        json(),
                        foldGutter(),
                        EditorView.lineWrapping,
                        ...(isEditing
                            ? [
                                linter(jsonParseLinter()),
                                lintGutter(),
                                keymap.of([
                                    { key: 'Mod-s', run: () => { handleSave(); return true; } },
                                    { key: 'Escape', run: () => { handleCancel(); return true; } },
                                ]),
                            ]
                            : [EditorState.readOnly.of(true)]
                        ),
                    ]}
                    onChange={isEditing ? (val) => { setEditValue(val); setParseError(null); } : undefined}
                    onCreateEditor={(view) => { viewRef.current = view; }}
                    basicSetup={{
                        foldGutter: false,
                        searchKeymap: false,
                        highlightActiveLine: isEditing,
                        highlightActiveLineGutter: isEditing,
                    }}
                    editable={isEditing}
                />

                {/* Floating actions */}
                <div className="json-code-viewer-actions">
                    {!isEditing && (
                        <>
                            <button
                                className="json-code-viewer-btn"
                                onClick={() => viewRef.current && foldAll(viewRef.current)}
                                title="Collapse all"
                            >
                                <ChevronsDownUp size={13} />
                            </button>
                            <button
                                className="json-code-viewer-btn"
                                onClick={() => viewRef.current && unfoldAll(viewRef.current)}
                                title="Expand all"
                            >
                                <ChevronsUpDown size={13} />
                            </button>
                            <button
                                className="json-code-viewer-btn"
                                onClick={() => {
                                    navigator.clipboard.writeText(JSON.stringify(sortedData, null, 2))
                                        .then(() => { setCopyDone(true); setTimeout(() => setCopyDone(false), 1500); });
                                }}
                                title="Copy JSON"
                            >
                                {copyDone ? <CheckCircle size={13} /> : <Copy size={13} />}
                            </button>
                            {editable && (
                                <button
                                    className="json-code-viewer-btn"
                                    onClick={handleStartEdit}
                                    title="Edit"
                                >
                                    <Pencil size={13} />
                                </button>
                            )}
                        </>
                    )}
                    {isEditing && (
                        <>
                            {parseError && (
                                <span className="doc-json-parse-error">{parseError}</span>
                            )}
                            <button
                                className="json-code-viewer-btn json-code-viewer-btn-cancel"
                                onClick={handleCancel}
                                title="Cancel (Esc)"
                            >
                                <X size={13} />
                            </button>
                            <button
                                className="json-code-viewer-btn json-code-viewer-btn-save"
                                onClick={handleSave}
                                title="Save (Cmd+S)"
                            >
                                <CheckCircle size={13} />
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
