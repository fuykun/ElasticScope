import React from 'react';

interface SkeletonLoaderProps {
    type: 'index-list' | 'document-list';
    count?: number;
    viewMode?: 'card' | 'table';
    columnCount?: number;
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
    type,
    count = 5,
    viewMode = 'table',
    columnCount = 4
}) => {
    if (type === 'index-list') {
        return (
            <div className="skeleton-index-list">
                {Array.from({ length: count }).map((_, i) => (
                    <div key={i} className="skeleton-index-item">
                        <div className="skeleton-health-dot"></div>
                        <div className="skeleton-content">
                            <div className="skeleton-line skeleton-title"></div>
                            <div className="skeleton-line skeleton-subtitle"></div>
                        </div>
                        <div className="skeleton-badge"></div>
                    </div>
                ))}
            </div>
        );
    }

    if (type === 'document-list') {
        // Table view skeleton
        if (viewMode === 'table') {
            return (
                <div className="skeleton-table-wrapper">
                    <table className="skeleton-table">
                        <thead>
                            <tr>
                                <th className="skeleton-th-id">
                                    <div className="skeleton-line skeleton-header-id"></div>
                                </th>
                                {Array.from({ length: columnCount }).map((_, i) => (
                                    <th key={i}>
                                        <div className="skeleton-line skeleton-header"></div>
                                    </th>
                                ))}
                                <th className="skeleton-th-actions">
                                    <div className="skeleton-line skeleton-header-actions"></div>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {Array.from({ length: count }).map((_, rowIndex) => (
                                <tr key={rowIndex} className="skeleton-table-row">
                                    <td className="skeleton-td-id">
                                        <div className="skeleton-id-cell">
                                            <div className="skeleton-toggle"></div>
                                            <div className="skeleton-line skeleton-id"></div>
                                        </div>
                                    </td>
                                    {Array.from({ length: columnCount }).map((_, colIndex) => (
                                        <td key={colIndex}>
                                            <div className="skeleton-line skeleton-cell" style={{ width: `${60 + Math.random() * 30}%` }}></div>
                                        </td>
                                    ))}
                                    <td className="skeleton-td-actions">
                                        <div className="skeleton-actions-row">
                                            <div className="skeleton-circle-sm"></div>
                                            <div className="skeleton-circle-sm"></div>
                                            <div className="skeleton-circle-sm"></div>
                                            <div className="skeleton-circle-sm"></div>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            );
        }

        // Card view skeleton (original)
        return (
            <div className="skeleton-document-list">
                {Array.from({ length: count }).map((_, i) => (
                    <div key={i} className="skeleton-doc-card">
                        <div className="skeleton-doc-header">
                            <div className="skeleton-line skeleton-doc-id"></div>
                            <div className="skeleton-actions">
                                <div className="skeleton-circle"></div>
                                <div className="skeleton-circle"></div>
                                <div className="skeleton-circle"></div>
                            </div>
                        </div>
                        <div className="skeleton-doc-body">
                            <div className="skeleton-line skeleton-full"></div>
                            <div className="skeleton-line skeleton-full"></div>
                            <div className="skeleton-line skeleton-medium"></div>
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    return null;
};
