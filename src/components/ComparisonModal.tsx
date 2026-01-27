import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { X, ChevronUp, ChevronDown, Trash2 } from 'lucide-react';
import ReactDiffViewer, { DiffMethod } from 'react-diff-viewer-continued';
import { diffStyles } from '../utils/diffStyles';

interface ComparisonModalProps {
    docs: Array<{ _id: string; _index: string; _source: Record<string, any> }>;
    onClose: () => void;
    onReset?: () => void;
}

export const ComparisonModal: React.FC<ComparisonModalProps> = ({ docs, onClose, onReset }) => {
    const { t } = useTranslation();
    const containerRef = useRef<HTMLDivElement>(null);
    const [diffLines, setDiffLines] = useState<HTMLElement[]>([]);
    const [currentDiffIndex, setCurrentDiffIndex] = useState(0);

    const oldValue = docs[0] ? JSON.stringify(docs[0]._source, null, 2) : '';
    const newValue = docs[1] ? JSON.stringify(docs[1]._source, null, 2) : '';

    const leftTitle = docs[0] ? `${docs[0]._index} / ${docs[0]._id}` : '';
    const rightTitle = docs[1] ? `${docs[1]._index} / ${docs[1]._id}` : '';

    useEffect(() => {
        if (containerRef.current) {
            const timer = setTimeout(() => {
                const lines = containerRef.current?.querySelectorAll('tr[class*="diff-added"], tr[class*="diff-removed"]');
                if (lines) {
                    setDiffLines(Array.from(lines) as HTMLElement[]);
                }
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [oldValue, newValue]);

    const scrollToChange = useCallback((index: number) => {
        if (diffLines.length > 0 && diffLines[index]) {
            diffLines[index].scrollIntoView({ behavior: 'smooth', block: 'center' });
            setCurrentDiffIndex(index);
        }
    }, [diffLines]);

    const goToNextChange = useCallback(() => {
        const nextIndex = currentDiffIndex < diffLines.length - 1 ? currentDiffIndex + 1 : 0;
        scrollToChange(nextIndex);
    }, [currentDiffIndex, diffLines.length, scrollToChange]);

    const goToPrevChange = useCallback(() => {
        const prevIndex = currentDiffIndex > 0 ? currentDiffIndex - 1 : diffLines.length - 1;
        scrollToChange(prevIndex);
    }, [currentDiffIndex, diffLines.length, scrollToChange]);

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="comparison-modal-content" onClick={e => e.stopPropagation()}>
                <div className="comparison-modal-header">
                    <h2>{t('comparison.title')}</h2>
                    <div className="comparison-nav">
                        {diffLines.length > 0 && (
                            <>
                                <span className="comparison-nav-info">
                                    {currentDiffIndex + 1} / {diffLines.length} {t('comparison.changes')}
                                </span>
                                <button
                                    className="btn btn-icon-sm"
                                    onClick={goToPrevChange}
                                    title={t('comparison.previousChange')}
                                >
                                    <ChevronUp size={16} />
                                </button>
                                <button
                                    className="btn btn-icon-sm"
                                    onClick={goToNextChange}
                                    title={t('comparison.nextChange')}
                                >
                                    <ChevronDown size={16} />
                                </button>
                            </>
                        )}
                    </div>
                    <div className="comparison-header-actions">
                        {onReset && (
                            <button
                                className="btn btn-secondary btn-sm"
                                onClick={onReset}
                                title={t('comparison.resetComparison')}
                            >
                                <Trash2 size={14} />
                                {t('comparison.reset')}
                            </button>
                        )}
                        <button className="btn btn-icon" onClick={onClose}>
                            <X size={20} />
                        </button>
                    </div>
                </div>
                <div className="comparison-diff-container" ref={containerRef}>
                    {docs.length === 2 ? (
                        <ReactDiffViewer
                            oldValue={oldValue}
                            newValue={newValue}
                            splitView={true}
                            useDarkTheme={true}
                            leftTitle={leftTitle}
                            rightTitle={rightTitle}
                            compareMethod={DiffMethod.WORDS}
                            styles={diffStyles}
                            showDiffOnly={false}
                        />
                    ) : (
                        <div className="comparison-empty">
                            <p>{t('comparison.needTwoDocs')}</p>
                            <p>{t('comparison.selectedCount')}: {docs.length}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
