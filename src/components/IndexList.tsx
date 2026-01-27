import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, Tag, Home, Plus } from 'lucide-react';
import { getIndices, IndexInfo } from '../api/elasticsearchClient';
import { Modal } from './Modal';
import { CreateIndexModal } from './CreateIndexModal';
import { SkeletonLoader } from './SkeletonLoader';
import { formatRelativeDate, formatDate } from '../utils/formatters';

interface IndexListProps {
    onSelectIndex: (index: string | null) => void;
    selectedIndex: string | null;
    refreshTrigger: number;
    onRefreshNeeded: () => void;
}

export const IndexList: React.FC<IndexListProps> = ({
    onSelectIndex,
    selectedIndex,
    refreshTrigger,
    onRefreshNeeded,
}) => {
    const { t } = useTranslation();
    const [indices, setIndices] = useState<IndexInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState('');
    const [showCreateModal, setShowCreateModal] = useState(false);

    useEffect(() => {
        loadIndices();
    }, [refreshTrigger]);

    const loadIndices = async () => {
        setLoading(true);
        setError(null);

        try {
            const data = await getIndices();
            setIndices(data.sort((a, b) => a.index.localeCompare(b.index)));
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const filteredIndices = indices.filter((idx) => {
        const searchTerm = filter.toLowerCase();
        const matchesIndex = idx.index.toLowerCase().includes(searchTerm);
        const matchesAlias = idx.aliases?.some(a => a.toLowerCase().includes(searchTerm));
        return matchesIndex || matchesAlias;
    });

    const getHealthColor = (health: string) => {
        switch (health) {
            case 'green':
                return '#22c55e';
            case 'yellow':
                return '#eab308';
            case 'red':
                return '#ef4444';
            default:
                return '#6b7280';
        }
    };

    if (loading) {
        return (
            <div className="index-list">
                <div className="index-list-header">
                    <button
                        onClick={() => onSelectIndex(null)}
                        className={`btn btn-dashboard ${selectedIndex === null ? 'active' : ''}`}
                        title={t('dashboard.title')}
                    >
                        <Home size={14} />
                        {t('dashboard.title')}
                    </button>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="btn btn-icon"
                        title={t('indexList.createNew')}
                        disabled
                    >
                        <Plus size={14} />
                    </button>
                    <button onClick={loadIndices} className="btn btn-icon" title={t('common.refresh')} disabled>
                        <RefreshCw size={14} />
                    </button>
                </div>
                <input
                    type="text"
                    placeholder={t('indexList.searchPlaceholder')}
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="index-filter"
                    disabled
                />
                <SkeletonLoader type="index-list" count={8} />
            </div>
        );
    }

    if (error) {
        return (
            <div className="index-list">
                <div className="error-message">{error}</div>
                <button onClick={loadIndices} className="btn btn-retry">
                    {t('common.retry')}
                </button>
            </div>
        );
    }

    return (
        <div className="index-list">
            <div className="index-list-header">
                <button
                    onClick={() => onSelectIndex(null)}
                    className={`btn btn-dashboard ${selectedIndex === null ? 'active' : ''}`}
                    title={t('dashboard.title')}
                >
                    <Home size={14} />
                    {t('dashboard.title')}
                </button>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="btn btn-icon"
                    title={t('indexList.createNew')}
                >
                    <Plus size={14} />
                </button>
                <button onClick={loadIndices} className="btn btn-icon" title={t('common.refresh')}>
                    <RefreshCw size={14} />
                </button>
            </div>

            <input
                type="text"
                placeholder={t('indexList.searchPlaceholder')}
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="index-filter"
            />

            <div className="index-items">
                {filteredIndices.length === 0 ? (
                    <div className="no-results">{t('common.noResults')}</div>
                ) : (
                    filteredIndices.map((idx) => (
                        <div
                            key={idx.index}
                            className={`index-item ${selectedIndex === idx.index ? 'selected' : ''} ${idx.aliases?.length > 0 ? 'has-alias' : ''}`}
                            onClick={() => onSelectIndex(idx.index)}
                            title={idx.index}
                        >
                            <span
                                className="health-dot"
                                style={{ backgroundColor: getHealthColor(idx.health) }}
                            />
                            <div className="index-content">
                                <span className="index-name">{idx.index}</span>
                                {idx.aliases?.length > 0 && (
                                    <div className="index-aliases">
                                        <Tag size={10} className="alias-icon" />
                                        {idx.aliases.slice(0, 2).map((alias) => (
                                            <span key={alias} className="alias-tag">
                                                {alias}
                                            </span>
                                        ))}
                                        {idx.aliases.length > 2 && (
                                            <span className="alias-more">+{idx.aliases.length - 2}</span>
                                        )}
                                    </div>
                                )}
                            </div>
                            <div className="index-meta-right">
                                {idx.creation_date && (
                                    <span className="index-date" title={formatDate(idx.creation_date)}>
                                        {formatRelativeDate(idx.creation_date)}
                                    </span>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Create Index Modal */}
            <Modal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                title={t('indexList.createNew')}
            >
                <CreateIndexModal
                    onSuccess={() => {
                        setShowCreateModal(false);
                        loadIndices();
                        onRefreshNeeded();
                    }}
                    onCancel={() => setShowCreateModal(false)}
                />
            </Modal>
        </div>
    );
};
