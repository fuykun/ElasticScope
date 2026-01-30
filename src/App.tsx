import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, GitCompare, Github, Star, Terminal } from 'lucide-react';
import { ConnectionSelector } from './components/ConnectionSelector';
import { ConnectionFormModal } from './components/ConnectionFormModal';
import { LanguageSwitcher } from './components/LanguageSwitcher';
import { Modal } from './components/Modal';
import { IndexList } from './components/IndexList';
import { IndexPage } from './components/IndexPage';
import { Dashboard } from './components/Dashboard';
import { RestPage } from './components/RestPage';
import { WelcomeScreen } from './components/WelcomeScreen';
import { ComparisonModal } from './components/ComparisonModal';
import { getConnectionStatus, SavedConnection } from './api/elasticsearchClient';
import { useResizable } from './hooks/useResizable';
import { sidebarWidthStorage } from './utils/storage';
import { MIN_SIDEBAR_WIDTH, MAX_SIDEBAR_WIDTH } from './constants';
import './styles/index.css';

function App() {
    const { t } = useTranslation();

    const [isConnected, setIsConnected] = useState(false);
    const [connectionId, setConnectionId] = useState<number | null>(null);
    const [connectionName, setConnectionName] = useState('');
    const [connectionColor, setConnectionColor] = useState('');
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingConnection, setEditingConnection] = useState<SavedConnection | null>(null);

    const [selectedIndex, setSelectedIndex] = useState<string | null>(() => {
        const params = new URLSearchParams(window.location.search);
        return params.get('index');
    });

    const [isRestMode, setIsRestMode] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        return params.get('page') === 'rest';
    });

    useEffect(() => {
        const handlePopState = () => {
            const params = new URLSearchParams(window.location.search);
            setSelectedIndex(params.get('index'));
            setIsRestMode(params.get('page') === 'rest');
        };
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, []);

    const [comparisonDocs, setComparisonDocs] = useState<Array<{
        _id: string;
        _index: string;
        _source: Record<string, any>;
    }>>([]);
    const [showComparisonModal, setShowComparisonModal] = useState(false);

    // Sidebar resize with hook
    const { value: sidebarWidth, handleMouseDown } = useResizable({
        initialValue: sidebarWidthStorage.get(),
        min: MIN_SIDEBAR_WIDTH,
        max: MAX_SIDEBAR_WIDTH,
        direction: 'horizontal',
        onResizeEnd: (width) => sidebarWidthStorage.set(width),
    });

    useEffect(() => {
        checkConnection();
    }, []);

    const checkConnection = async () => {
        try {
            const status = await getConnectionStatus();
            setIsConnected(status.connected);
            setConnectionId(status.id);
            setConnectionName(status.name);
            setConnectionColor(status.color || '');
        } catch {
            setIsConnected(false);
        }
    };

    useEffect(() => {
        if (isConnected && connectionName) {
            document.title = `ElasticScope - ${connectionName}`;
        } else {
            document.title = 'ElasticScope';
        }
    }, [isConnected, connectionName]);

    const handleConnectionChange = () => {
        checkConnection();
        setRefreshTrigger((prev) => prev + 1);
        handleSelectIndex(null);
    };

    const handleSelectIndex = (index: string | null) => {
        setSelectedIndex(index);
        setIsRestMode(false);

        const url = new URL(window.location.href);
        if (index) {
            url.searchParams.set('index', index);
            url.searchParams.delete('page');
        } else {
            url.searchParams.delete('index');
            url.searchParams.delete('page');
        }
        window.history.pushState({}, '', url.toString());
    };

    const handleOpenRest = () => {
        setIsRestMode(true);
        // Maybe keep selected index internally but clear from URL to avoid confusion?
        // Or keep it. Let's clear index from URL but can keep internal state if needed.
        // Actually, if we go to REST, we probably want to support "context" of selected index if we were to support it.
        // But for now, let's just clean URL.
        const url = new URL(window.location.href);
        url.searchParams.set('page', 'rest');
        // url.searchParams.delete('index'); // Optional: keep index param if we want to use it as context
        window.history.pushState({}, '', url.toString());
    };

    const handleIndexDeleted = () => {
        handleSelectIndex(null);
        setRefreshTrigger((prev) => prev + 1);
    };

    const addToComparison = (doc: { _id: string; _index: string; _source: Record<string, any> }) => {
        setComparisonDocs((prev) => {
            if (prev.some(d => d._id === doc._id && d._index === doc._index)) {
                return prev;
            }
            if (prev.length >= 2) {
                return [prev[1], doc];
            }
            return [...prev, doc];
        });
    };

    const removeFromComparison = (docId: string, indexName: string) => {
        setComparisonDocs((prev) => prev.filter(d => !(d._id === docId && d._index === indexName)));
    };

    const clearComparison = () => {
        setComparisonDocs([]);
    };

    const isInComparison = (docId: string, indexName: string) => {
        return comparisonDocs.some(d => d._id === docId && d._index === indexName);
    };

    const handleGoHome = () => {
        setIsConnected(false);
        setConnectionId(null);
        setConnectionName('');
        setConnectionColor('');
        handleSelectIndex(null); // This clears isRestMode too via logic above
    };

    return (
        <div className="app">
            <header className="app-header">
                <div className="header-left">
                    <div
                        className="header-brand"
                        onClick={handleGoHome}
                        title={t('header.home')}
                        style={{ cursor: 'pointer' }}
                    >
                        <div className="brand-logo">
                            <Search size={22} />
                        </div>
                        <span className="brand-name">Elastic<span className="brand-accent">Scope</span></span>
                    </div>
                    {connectionColor && isConnected && (
                        <div className="header-connection-badge">
                            <div
                                className="connection-dot"
                                style={{ backgroundColor: connectionColor }}
                            />
                            <span className="connection-name">{connectionName}</span>
                        </div>
                    )}
                </div>
                <div className="header-right">
                    {isConnected && (
                        <button
                            className={`btn btn-secondary ${isRestMode ? 'active' : ''}`}
                            onClick={handleOpenRest}
                            title="REST Console"
                            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                            <Terminal size={16} />
                            <span>REST Console</span>
                        </button>
                    )}
                    {comparisonDocs.length > 0 && (
                        <button
                            className="btn btn-comparison"
                            onClick={() => setShowComparisonModal(true)}
                            title={t('comparison.title')}
                        >
                            <GitCompare size={18} />
                            <span className="comparison-badge">{comparisonDocs.length}</span>
                            {t('documentViewer.compare')}
                        </button>
                    )}
                    <LanguageSwitcher />
                    <ConnectionSelector
                        isConnected={isConnected}
                        currentConnectionId={connectionId}
                        currentConnectionName={connectionName}
                        onConnectionChange={handleConnectionChange}
                        onAddNew={() => {
                            setEditingConnection(null);
                            setIsModalOpen(true);
                        }}
                        onEdit={(connection) => {
                            setEditingConnection(connection);
                            setIsModalOpen(true);
                        }}
                    />
                </div>
            </header>

            <Modal
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    setEditingConnection(null);
                }}
                title={editingConnection ? t('connection.edit') : t('connection.addNew')}
            >
                <ConnectionFormModal
                    editConnection={editingConnection}
                    onSuccess={() => {
                        handleConnectionChange();
                        setIsModalOpen(false);
                        setEditingConnection(null);
                    }}
                    onCancel={() => {
                        setIsModalOpen(false);
                        setEditingConnection(null);
                    }}
                />
            </Modal>

            {isConnected ? (
                <main className="app-main">
                    {!isRestMode && (
                        <>
                            <aside
                                className="sidebar"
                                style={{ width: sidebarWidth, minWidth: sidebarWidth }}
                            >
                                <IndexList
                                    onSelectIndex={handleSelectIndex}
                                    selectedIndex={selectedIndex}
                                    refreshTrigger={refreshTrigger}
                                    onRefreshNeeded={() => setRefreshTrigger((prev) => prev + 1)}
                                />
                            </aside>
                            <div
                                className="sidebar-resizer"
                                onMouseDown={handleMouseDown}
                            />
                        </>
                    )}
                    <section className="content">
                        {isRestMode ? (
                            <RestPage
                                key={connectionId}
                                initialIndex={selectedIndex || undefined}
                                connectionId={connectionId || 0}
                            />
                        ) : selectedIndex ? (
                            <IndexPage
                                indexName={selectedIndex}
                                onIndexDeleted={handleIndexDeleted}
                                onAddToComparison={addToComparison}
                                onRemoveFromComparison={removeFromComparison}
                                isInComparison={isInComparison}
                                connectionId={connectionId}
                            />
                        ) : (
                            <Dashboard
                                connectionName={connectionName}
                                connectionColor={connectionColor}
                            />
                        )}
                    </section>
                </main>
            ) : (
                <WelcomeScreen
                    onConnectionSuccess={handleConnectionChange}
                    onAddNewConnection={() => setIsModalOpen(true)}
                />
            )}

            {showComparisonModal && comparisonDocs.length > 0 && (
                <ComparisonModal
                    docs={comparisonDocs}
                    onClose={() => setShowComparisonModal(false)}
                    onReset={() => {
                        clearComparison();
                        setShowComparisonModal(false);
                    }}
                />
            )}

            <footer className="app-footer">
                <span>ElasticScope v{__APP_VERSION__}</span>
                <span className="footer-separator">•</span>
                <a
                    href="https://github.com/fuykun/ElasticScope"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="footer-github-link"
                >
                    <Github size={14} />
                    GitHub
                </a>
                <span className="footer-separator">•</span>
                <a
                    href="https://github.com/fuykun/ElasticScope"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="footer-star-link"
                >
                    <Star size={14} />
                    Star on GitHub
                </a>
            </footer>
        </div>
    );
}

export default App;
