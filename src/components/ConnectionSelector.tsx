import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Plus, Power, Trash2, Pencil, Download, Upload } from 'lucide-react';
import {
    SavedConnection,
    getSavedConnections,
    connectWithSavedConnection,
    disconnect,
    deleteSavedConnection,
    getClusterHealth,
    exportConnectionsData,
    importConnectionsData,
    ConnectionsExportData,
} from '../api/elasticsearchClient';
import { useClickOutside } from '../hooks/useClickOutside';

interface ConnectionSelectorProps {
    isConnected: boolean;
    currentConnectionId: number | null;
    currentConnectionName: string;
    onConnectionChange: () => void;
    onAddNew: () => void;
    onEdit: (connection: SavedConnection) => void;
}

export const ConnectionSelector: React.FC<ConnectionSelectorProps> = ({
    isConnected,
    currentConnectionId,
    currentConnectionName,
    onConnectionChange,
    onAddNew,
    onEdit,
}) => {
    const { t } = useTranslation();
    const [connections, setConnections] = useState<SavedConnection[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [clusterStatus, setClusterStatus] = useState<'green' | 'yellow' | 'red' | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Click outside hook
    const closeDropdown = useCallback(() => setIsOpen(false), []);
    useClickOutside(dropdownRef, closeDropdown, isOpen);

    useEffect(() => {
        loadConnections();
    }, []);

    useEffect(() => {
        loadConnections();
    }, [currentConnectionId]);

    useEffect(() => {
        if (isConnected) {
            loadClusterHealth();
        } else {
            setClusterStatus(null);
        }
    }, [isConnected]);

    const loadConnections = async () => {
        try {
            const data = await getSavedConnections();
            setConnections(data);
        } catch (error) {
            console.error('Bağlantılar yüklenemedi:', error);
        }
    };

    const loadClusterHealth = async () => {
        try {
            const health = await getClusterHealth();
            setClusterStatus(health.status);
        } catch {
            setClusterStatus(null);
        }
    };

    const handleConnect = async (connection: SavedConnection) => {
        setLoading(true);
        try {
            await connectWithSavedConnection(connection.id);
            setIsOpen(false);
            onConnectionChange();
        } catch (error) {
            console.error('Bağlantı hatası:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDisconnect = async () => {
        try {
            await disconnect();
            onConnectionChange();
        } catch (error) {
            console.error('Bağlantı kesme hatası:', error);
        }
    };

    const handleDelete = async (e: React.MouseEvent, id: number) => {
        e.stopPropagation();
        if (confirm(t('connection.deleteConfirm'))) {
            try {
                await deleteSavedConnection(id);
                await loadConnections();
                if (currentConnectionId === id) {
                    await disconnect();
                    onConnectionChange();
                }
            } catch (error) {
                console.error('Silme hatası:', error);
            }
        }
    };

    const handleEdit = (e: React.MouseEvent, connection: SavedConnection) => {
        e.stopPropagation();
        setIsOpen(false);
        onEdit(connection);
    };

    const handleExport = async () => {
        try {
            if (connections.length === 0) {
                alert(t('connection.noConnectionsToExport'));
                return;
            }

            const exportData = await exportConnectionsData();
            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `elasticscope-connections-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            setIsOpen(false);
        } catch (error) {
            console.error('Export error:', error);
        }
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const text = await file.text();
            const importData: ConnectionsExportData = JSON.parse(text);

            // Validate the data structure
            if (!importData.connections || !Array.isArray(importData.connections)) {
                alert(t('connection.importError'));
                return;
            }

            const result = await importConnectionsData(importData, connections);

            if (result.imported > 0) {
                await loadConnections();
            }

            let message = t('connection.importSuccess', { count: result.imported });
            if (result.skipped > 0) {
                message += '\n' + t('connection.importDuplicate', { count: result.skipped });
            }

            alert(message);
            setIsOpen(false);
        } catch (error) {
            console.error('Import error:', error);
            alert(t('connection.importError'));
        } finally {
            // Reset the file input
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const currentConnection = connections.find((c) => c.id === currentConnectionId);

    return (
        <div className="connection-selector" ref={dropdownRef}>
            <input
                type="file"
                ref={fileInputRef}
                accept=".json"
                onChange={handleImportFile}
                style={{ display: 'none' }}
            />
            <button
                className="connection-selector-trigger"
                onClick={() => setIsOpen(!isOpen)}
                disabled={loading}
            >
                {isConnected && currentConnection ? (
                    <>
                        <span
                            className="connection-color-dot"
                            style={{ backgroundColor: currentConnection.color }}
                        />
                        <span className="connection-name">{currentConnectionName}</span>
                        {clusterStatus && (
                            <span className={`cluster-status-dot ${clusterStatus}`} />
                        )}
                    </>
                ) : (
                    <span className="no-connection">{t('header.selectConnection')}</span>
                )}
                <ChevronDown size={16} className={`dropdown-arrow ${isOpen ? 'open' : ''}`} />
            </button>

            {isOpen && (
                <div className="connection-dropdown">
                    <div className="connection-list">
                        {connections.length === 0 ? (
                            <div className="no-connections">{t('connection.noSavedConnections')}</div>
                        ) : (
                            connections.map((conn) => (
                                <div
                                    key={conn.id}
                                    className={`connection-item ${currentConnectionId === conn.id ? 'active' : ''}`}
                                    onClick={() => handleConnect(conn)}
                                >
                                    <span
                                        className="connection-color-dot"
                                        style={{ backgroundColor: conn.color }}
                                    />
                                    <div className="connection-details">
                                        <span className="connection-item-name">{conn.name}</span>
                                        <span className="connection-item-url">{conn.url}</span>
                                    </div>
                                    <div className="connection-item-actions">
                                        <button
                                            className="btn btn-icon btn-edit"
                                            onClick={(e) => handleEdit(e, conn)}
                                            title={t('common.edit')}
                                        >
                                            <Pencil size={14} />
                                        </button>
                                        <button
                                            className="btn btn-icon btn-delete"
                                            onClick={(e) => handleDelete(e, conn.id)}
                                            title={t('common.delete')}
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    <div className="connection-dropdown-actions">
                        <div className="connection-actions-row">
                            <button className="btn btn-add-connection" onClick={() => { onAddNew(); setIsOpen(false); }}>
                                <Plus size={16} />
                                {t('connection.addNew')}
                            </button>
                            <div className="connection-import-export">
                                <button className="btn btn-import" onClick={handleImportClick} title={t('connection.import')}>
                                    <Upload size={16} />
                                </button>
                                <button className="btn btn-export" onClick={handleExport} title={t('connection.export')}>
                                    <Download size={16} />
                                </button>
                            </div>
                        </div>
                        {isConnected && (
                            <button className="btn btn-disconnect-small" onClick={handleDisconnect}>
                                <Power size={16} />
                                {t('connection.disconnect')}
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
