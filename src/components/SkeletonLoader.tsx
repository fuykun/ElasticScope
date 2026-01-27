import React from 'react';

interface SkeletonLoaderProps {
    type: 'index-list' | 'document-list';
    count?: number;
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({ type, count = 5 }) => {
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
