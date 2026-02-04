import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Server,
    Database,
    HardDrive,
    Cpu,
    MemoryStick,
    Activity,
    Clock,
    FileText,
    Layers,
    RefreshCw,
    AlertCircle
} from 'lucide-react';
import {
    getClusterHealth,
    getClusterStats,
    getClusterInfo,
    getNodes,
    getNodesInfo,
    ClusterInfo
} from '../api/elasticsearchClient';
import type { ClusterHealth, ClusterStats, NodeInfo } from '../types';
import { formatBytes, formatUptime, formatDocCount } from '../utils/formatters';

interface DashboardProps {
    connectionName: string;
    connectionColor?: string;
    connectionId?: number | null;
}

export const Dashboard: React.FC<DashboardProps> = ({ connectionName, connectionColor, connectionId }) => {
    const { t } = useTranslation();
    const [health, setHealth] = useState<ClusterHealth | null>(null);
    const [stats, setStats] = useState<ClusterStats | null>(null);
    const [clusterInfo, setClusterInfo] = useState<ClusterInfo | null>(null);
    const [nodes, setNodes] = useState<NodeInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadData = async () => {
        setLoading(true);
        setError(null);

        try {
            const [healthData, statsData, infoData, nodesData, nodesInfoData] = await Promise.all([
                getClusterHealth(),
                getClusterStats(),
                getClusterInfo(),
                getNodes(),
                getNodesInfo()
            ]);

            setHealth(healthData as ClusterHealth);
            setStats(statsData as unknown as ClusterStats);
            setClusterInfo(infoData);

            const nodesList: NodeInfo[] = [];
            const nodesStats = (nodesData as any).nodes || {};
            const nodesInfo = (nodesInfoData as any).nodes || {};

            for (const nodeId of Object.keys(nodesStats)) {
                const nodeStat = nodesStats[nodeId];
                const nodeInfo = nodesInfo[nodeId] || {};

                const diskTotal = nodeStat.fs?.total?.total_in_bytes || 0;
                const diskFree = nodeStat.fs?.total?.free_in_bytes || 0;
                const diskUsedPercent = diskTotal > 0 ? Math.round(((diskTotal - diskFree) / diskTotal) * 100) : 0;

                nodesList.push({
                    id: nodeId,
                    name: nodeStat.name || nodeInfo.name || 'Unknown',
                    version: nodeInfo.version || '-',
                    ip: nodeStat.ip || nodeInfo.ip || '-',
                    roles: nodeStat.roles || nodeInfo.roles || [],
                    cpuPercent: nodeStat.os?.cpu?.percent || 0,
                    memPercent: nodeStat.os?.mem?.used_percent || 0,
                    heapPercent: nodeStat.jvm?.mem?.heap_used_percent || 0,
                    diskPercent: diskUsedPercent,
                    uptime: formatUptime(nodeStat.jvm?.uptime_in_millis || 0)
                });
            }

            setNodes(nodesList);
        } catch (err: any) {
            setError(err.message || t('common.error'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [connectionId]);

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'green': return 'var(--success)';
            case 'yellow': return 'var(--warning)';
            case 'red': return 'var(--danger)';
            default: return 'var(--text-secondary)';
        }
    };

    const getProgressColor = (percent: number) => {
        if (percent >= 90) return 'var(--danger)';
        if (percent >= 70) return 'var(--warning)';
        return 'var(--success)';
    };

    if (loading) {
        return (
            <div className="dashboard-loading">
                <RefreshCw size={32} className="spin" />
                <p>{t('dashboard.clusterInfo')}</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="dashboard-error">
                <AlertCircle size={32} />
                <p>{error}</p>
                <button className="btn btn-primary" onClick={loadData}>
                    {t('common.retry')}
                </button>
            </div>
        );
    }

    return (
        <div className="dashboard">
            <div className="dashboard-header">
                <div className="dashboard-title">
                    {connectionColor && (
                        <div
                            className="dashboard-connection-color"
                            style={{ backgroundColor: connectionColor }}
                        />
                    )}
                    <h2>{connectionName || health?.cluster_name}</h2>
                    <span
                        className="cluster-status-badge"
                        style={{ backgroundColor: getStatusColor(health?.status || '') }}
                    >
                        {health?.status?.toUpperCase()}
                    </span>
                    {clusterInfo?.version?.number && (
                        <span className="cluster-version-badge">
                            v{clusterInfo.version.number}
                        </span>
                    )}
                </div>
                <button className="btn btn-secondary btn-sm" onClick={loadData}>
                    <RefreshCw size={14} />
                    {t('common.refresh')}
                </button>
            </div>

            {/* Version Info */}
            {clusterInfo && (
                <div className="dashboard-version-info">
                    <div className="version-info-item">
                        <span className="version-info-label">{t('dashboard.version')}</span>
                        <span className="version-info-value">{clusterInfo.version?.number || '-'}</span>
                    </div>
                    <div className="version-info-item">
                        <span className="version-info-label">{t('dashboard.luceneVersion')}</span>
                        <span className="version-info-value">{clusterInfo.version?.lucene_version || '-'}</span>
                    </div>
                    <div className="version-info-item">
                        <span className="version-info-label">{t('dashboard.buildType')}</span>
                        <span className="version-info-value">{clusterInfo.version?.build_flavor || clusterInfo.version?.build_type || '-'}</span>
                    </div>
                    <div className="version-info-item">
                        <span className="version-info-label">{t('dashboard.clusterUuid')}</span>
                        <span className="version-info-value version-uuid">{clusterInfo.cluster_uuid || '-'}</span>
                    </div>
                </div>
            )}

            {/* Overview Cards */}
            <div className="dashboard-cards">
                <div className="dashboard-card">
                    <div className="dashboard-card-icon">
                        <Server size={20} />
                    </div>
                    <div className="dashboard-card-content">
                        <span className="dashboard-card-value">{health?.number_of_nodes || 0}</span>
                        <span className="dashboard-card-label">{t('dashboard.node')}</span>
                    </div>
                </div>

                <div className="dashboard-card">
                    <div className="dashboard-card-icon">
                        <Database size={20} />
                    </div>
                    <div className="dashboard-card-content">
                        <span className="dashboard-card-value">{stats?.indices?.count || 0}</span>
                        <span className="dashboard-card-label">{t('dashboard.index')}</span>
                    </div>
                </div>

                <div className="dashboard-card">
                    <div className="dashboard-card-icon">
                        <FileText size={20} />
                    </div>
                    <div className="dashboard-card-content">
                        <span className="dashboard-card-value">
                            {formatDocCount(stats?.indices?.docs?.count || 0)}
                        </span>
                        <span className="dashboard-card-label">{t('dashboard.document')}</span>
                    </div>
                </div>

                <div className="dashboard-card">
                    <div className="dashboard-card-icon">
                        <HardDrive size={20} />
                    </div>
                    <div className="dashboard-card-content">
                        <span className="dashboard-card-value">
                            {formatBytes(stats?.indices?.store?.size_in_bytes || 0)}
                        </span>
                        <span className="dashboard-card-label">{t('dashboard.dataSize')}</span>
                    </div>
                </div>

                <div className="dashboard-card">
                    <div className="dashboard-card-icon">
                        <Layers size={20} />
                    </div>
                    <div className="dashboard-card-content">
                        <span className="dashboard-card-value">
                            {health?.active_shards || 0}
                        </span>
                        <span className="dashboard-card-label">{t('dashboard.activeShards')}</span>
                    </div>
                </div>

                <div className="dashboard-card">
                    <div className="dashboard-card-icon">
                        <Activity size={20} />
                    </div>
                    <div className="dashboard-card-content">
                        <span className="dashboard-card-value">
                            {health?.unassigned_shards || 0}
                        </span>
                        <span className="dashboard-card-label">{t('dashboard.unassignedShards')}</span>
                    </div>
                </div>
            </div>

            {/* Resource Usage */}
            <div className="dashboard-section">
                <h3 className="dashboard-section-title">{t('dashboard.resourceUsage')}</h3>
                <div className="dashboard-resources">
                    <div className="resource-item">
                        <div className="resource-header">
                            <MemoryStick size={16} />
                            <span>{t('dashboard.memory')}</span>
                            <span className="resource-value">
                                {formatBytes(stats?.nodes?.os?.mem?.used_in_bytes || 0)} / {formatBytes(stats?.nodes?.os?.mem?.total_in_bytes || 0)}
                            </span>
                        </div>
                        <div className="resource-bar">
                            <div
                                className="resource-bar-fill"
                                style={{
                                    width: `${stats?.nodes?.os?.mem?.used_percent || 0}%`,
                                    backgroundColor: getProgressColor(stats?.nodes?.os?.mem?.used_percent || 0)
                                }}
                            />
                        </div>
                    </div>

                    <div className="resource-item">
                        <div className="resource-header">
                            <Cpu size={16} />
                            <span>{t('dashboard.jvmHeap')}</span>
                            <span className="resource-value">
                                {formatBytes(stats?.nodes?.jvm?.mem?.heap_used_in_bytes || 0)} / {formatBytes(stats?.nodes?.jvm?.mem?.heap_max_in_bytes || 0)}
                            </span>
                        </div>
                        <div className="resource-bar">
                            <div
                                className="resource-bar-fill"
                                style={{
                                    width: `${stats?.nodes?.jvm?.mem?.heap_max_in_bytes
                                        ? Math.round((stats.nodes.jvm.mem.heap_used_in_bytes / stats.nodes.jvm.mem.heap_max_in_bytes) * 100)
                                        : 0}%`,
                                    backgroundColor: getProgressColor(
                                        stats?.nodes?.jvm?.mem?.heap_max_in_bytes
                                            ? Math.round((stats.nodes.jvm.mem.heap_used_in_bytes / stats.nodes.jvm.mem.heap_max_in_bytes) * 100)
                                            : 0
                                    )
                                }}
                            />
                        </div>
                    </div>

                    <div className="resource-item">
                        <div className="resource-header">
                            <HardDrive size={16} />
                            <span>{t('dashboard.disk')}</span>
                            <span className="resource-value">
                                {formatBytes((stats?.nodes?.fs?.total_in_bytes || 0) - (stats?.nodes?.fs?.free_in_bytes || 0))} / {formatBytes(stats?.nodes?.fs?.total_in_bytes || 0)}
                            </span>
                        </div>
                        <div className="resource-bar">
                            <div
                                className="resource-bar-fill"
                                style={{
                                    width: `${stats?.nodes?.fs?.total_in_bytes
                                        ? Math.round(((stats.nodes.fs.total_in_bytes - stats.nodes.fs.free_in_bytes) / stats.nodes.fs.total_in_bytes) * 100)
                                        : 0}%`,
                                    backgroundColor: getProgressColor(
                                        stats?.nodes?.fs?.total_in_bytes
                                            ? Math.round(((stats.nodes.fs.total_in_bytes - stats.nodes.fs.free_in_bytes) / stats.nodes.fs.total_in_bytes) * 100)
                                            : 0
                                    )
                                }}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Nodes List */}
            <div className="dashboard-section">
                <h3 className="dashboard-section-title">{t('dashboard.nodesList')} ({nodes.length})</h3>
                <div className="nodes-table-container">
                    <table className="nodes-table">
                        <thead>
                            <tr>
                                <th>{t('dashboard.table.node')}</th>
                                <th>{t('dashboard.table.ip')}</th>
                                <th>{t('dashboard.table.version')}</th>
                                <th>{t('dashboard.table.cpu')}</th>
                                <th>{t('dashboard.table.memory')}</th>
                                <th>{t('dashboard.table.heap')}</th>
                                <th>{t('dashboard.table.disk')}</th>
                                <th>{t('dashboard.table.uptime')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {nodes.map((node) => (
                                <tr key={node.id}>
                                    <td className="node-name">
                                        <Server size={14} />
                                        {node.name}
                                    </td>
                                    <td>{node.ip}</td>
                                    <td>{node.version}</td>
                                    <td>
                                        <div className="mini-progress">
                                            <div
                                                className="mini-progress-fill"
                                                style={{
                                                    width: `${node.cpuPercent}%`,
                                                    backgroundColor: getProgressColor(node.cpuPercent)
                                                }}
                                            />
                                            <span>{node.cpuPercent}%</span>
                                        </div>
                                    </td>
                                    <td>
                                        <div className="mini-progress">
                                            <div
                                                className="mini-progress-fill"
                                                style={{
                                                    width: `${node.memPercent}%`,
                                                    backgroundColor: getProgressColor(node.memPercent)
                                                }}
                                            />
                                            <span>{node.memPercent}%</span>
                                        </div>
                                    </td>
                                    <td>
                                        <div className="mini-progress">
                                            <div
                                                className="mini-progress-fill"
                                                style={{
                                                    width: `${node.heapPercent}%`,
                                                    backgroundColor: getProgressColor(node.heapPercent)
                                                }}
                                            />
                                            <span>{node.heapPercent}%</span>
                                        </div>
                                    </td>
                                    <td>
                                        <div className="mini-progress">
                                            <div
                                                className="mini-progress-fill"
                                                style={{
                                                    width: `${node.diskPercent}%`,
                                                    backgroundColor: getProgressColor(node.diskPercent)
                                                }}
                                            />
                                            <span>{node.diskPercent}%</span>
                                        </div>
                                    </td>
                                    <td>
                                        <Clock size={12} />
                                        {node.uptime}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
