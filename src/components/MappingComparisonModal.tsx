import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import ReactDiffViewer, { DiffMethod } from 'react-diff-viewer-continued';
import { diffStyles } from '../utils/diffStyles';

interface MappingComparisonModalProps {
    isOpen: boolean;
    onClose: () => void;
    sourceIndex: string;
    targetIndex: string;
    sourceMapping: Record<string, any>;
    targetMapping: Record<string, any>;
    sourceConnectionName?: string;
    targetConnectionName?: string;
}

export const MappingComparisonModal: React.FC<MappingComparisonModalProps> = ({
    isOpen,
    onClose,
    sourceIndex,
    targetIndex,
    sourceMapping,
    targetMapping,
    sourceConnectionName,
    targetConnectionName,
}) => {
    const { t } = useTranslation();
    const containerRef = useRef<HTMLDivElement>(null);

    if (!isOpen) return null;

    const oldValue = JSON.stringify(sourceMapping, null, 2);
    const newValue = JSON.stringify(targetMapping, null, 2);

    const showConnectionNames = sourceConnectionName && targetConnectionName && sourceConnectionName !== targetConnectionName;
    const leftTitle = showConnectionNames
        ? `[${sourceConnectionName}] ${sourceIndex}`
        : `${t('comparison.source')}: ${sourceIndex}`;
    const rightTitle = showConnectionNames
        ? `[${targetConnectionName}] ${targetIndex}`
        : `${t('comparison.target')}: ${targetIndex}`;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="comparison-modal-content" onClick={e => e.stopPropagation()}>
                <div className="comparison-modal-header">
                    <h2>{t('comparison.mappingTitle')}</h2>
                    <button className="btn btn-icon" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>
                <div className="comparison-diff-container" ref={containerRef}>
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
                </div>
            </div>
        </div>
    );
};
