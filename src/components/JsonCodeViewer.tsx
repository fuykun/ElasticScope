import React, { useState, useRef } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { json } from '@codemirror/lang-json';
import { oneDark } from '@codemirror/theme-one-dark';
import { foldGutter, unfoldAll } from '@codemirror/language';
import { EditorView, keymap } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { search, searchKeymap, openSearchPanel } from '@codemirror/search';
import { CheckCircle, Copy, ChevronsDownUp, ChevronsUpDown, Search } from 'lucide-react';
import type { EditorView as EditorViewType } from '@codemirror/view';
import { foldAllExceptRoot } from '../utils/codemirrorFold';

interface JsonCodeViewerProps {
    data: any;
    enableCopy?: boolean;
    height?: string;
}

export const JsonCodeViewer: React.FC<JsonCodeViewerProps> = ({
    data,
    enableCopy = false,
    height = '100%',
}) => {
    const viewRef = useRef<EditorViewType | null>(null);
    const [copyDone, setCopyDone] = useState(false);

    const collapseAll = () => { if (viewRef.current) foldAllExceptRoot(viewRef.current); };
    const expandAll = () => { if (viewRef.current) unfoldAll(viewRef.current); };
    const openSearch = () => {
        if (viewRef.current) {
            viewRef.current.focus();
            openSearchPanel(viewRef.current);
        }
    };

    const copy = () => {
        navigator.clipboard.writeText(JSON.stringify(data, null, 2)).then(() => {
            setCopyDone(true);
            setTimeout(() => setCopyDone(false), 1500);
        });
    };

    return (
        <div className="json-code-viewer" style={{ height }}>
            <CodeMirror
                className="rest-codemirror"
                value={JSON.stringify(data, null, 2)}
                height="100%"
                theme={oneDark}
                extensions={[
                    json(),
                    foldGutter(),
                    search({ top: true }),
                    keymap.of(searchKeymap),
                    EditorState.readOnly.of(true),
                    EditorView.lineWrapping,
                ]}
                onCreateEditor={(view) => { viewRef.current = view; }}
                basicSetup={{
                    foldGutter: false,
                    highlightActiveLine: false,
                    highlightActiveLineGutter: false,
                    searchKeymap: false,
                }}
            />
            <div className="json-code-viewer-actions">
                <button className="json-code-viewer-btn" onClick={openSearch} title="Search (Ctrl+F)">
                    <Search size={13} />
                </button>
                <button className="json-code-viewer-btn" onClick={collapseAll} title="Collapse all">
                    <ChevronsDownUp size={13} />
                </button>
                <button className="json-code-viewer-btn" onClick={expandAll} title="Expand all">
                    <ChevronsUpDown size={13} />
                </button>
                {enableCopy && (
                    <button className="json-code-viewer-btn" onClick={copy} title="Copy JSON">
                        {copyDone ? <CheckCircle size={13} /> : <Copy size={13} />}
                    </button>
                )}
            </div>
        </div>
    );
};
