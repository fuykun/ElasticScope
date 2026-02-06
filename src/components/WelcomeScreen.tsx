import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Database, Search, Code, Plus, Loader, Server } from 'lucide-react';
import { getSavedConnections, connectWithSavedConnection, SavedConnection } from '../api/elasticsearchClient';

interface WelcomeScreenProps {
    onConnectionSuccess: () => void;
    onAddNewConnection: () => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
    onConnectionSuccess,
    onAddNewConnection
}) => {
    const { t } = useTranslation();
    const [connections, setConnections] = useState<SavedConnection[]>([]);
    const [loading, setLoading] = useState(true);
    const [connecting, setConnecting] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadConnections();
    }, []);

    const loadConnections = async () => {
        try {
            const data = await getSavedConnections();
            setConnections(data);
        } catch (err) {
            console.error('Bağlantı listesi yüklenemedi:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleConnect = async (connectionId: number) => {
        setConnecting(connectionId);
        setError(null);

        try {
            await connectWithSavedConnection(connectionId);
            onConnectionSuccess();
        } catch (err: any) {
            setError(err.message || t('connection.connectionFailed'));
        } finally {
            setConnecting(null);
        }
    };

    return (
        <main className="app-main welcome-screen">
            <div className="welcome-container">
                <div className="welcome-header">
                    <h1>{t('welcome.title')}</h1>
                    <p className="welcome-subtitle">
                        {t('welcome.subtitle')}
                    </p>
                </div>

                {loading ? (
                    <div className="welcome-loading">
                        <Loader size={24} className="spin" />
                        <p>{t('welcome.loading')}</p>
                    </div>
                ) : connections.length > 0 ? (
                    <div className="welcome-connections">
                        <h3>{t('welcome.savedConnections')}</h3>
                        <p className="welcome-hint">{t('welcome.selectHint')}</p>

                        <div className="connection-grid">
                            {connections.map((conn) => (
                                <button
                                    key={conn.id}
                                    className="connection-card"
                                    onClick={() => handleConnect(conn.id)}
                                    disabled={connecting !== null}
                                >
                                    <div
                                        className="connection-card-color"
                                        style={{ backgroundColor: conn.color }}
                                    />
                                    <div className="connection-card-content">
                                        <div className="connection-card-header">
                                            <Server size={16} />
                                            <span className="connection-card-name">{conn.name}</span>
                                        </div>
                                        <span className="connection-card-url">{conn.url}</span>
                                    </div>
                                    {connecting === conn.id && (
                                        <Loader size={16} className="spin connection-card-loader" />
                                    )}
                                </button>
                            ))}
                        </div>

                        <button
                            className="btn btn-secondary btn-add-connection"
                            onClick={onAddNewConnection}
                        >
                            <Plus size={16} />
                            {t('connection.addNew')}
                        </button>

                        {error && (
                            <div className="error-message">
                                {error}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="welcome-empty">
                        <h3>{t('welcome.noConnections')}</h3>
                        <p>{t('welcome.addFirstConnection')}</p>
                        <button
                            className="btn btn-primary btn-lg"
                            onClick={onAddNewConnection}
                        >
                            <Plus size={18} />
                            {t('welcome.addFirstButton')}
                        </button>
                    </div>
                )}
            </div>
        </main>
    );
};
