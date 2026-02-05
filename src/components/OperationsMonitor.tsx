import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Activity,
    Clock,
    Cpu,
    RefreshCw,
    Search,
    Trash2,
    AlertCircle,
    TrendingUp,
    ArrowDownToLine,
    ArrowUpFromLine,
    Merge,
    RotateCw,
    HardDrive,
    Zap,
    CheckCircle,
    X,
} from 'lucide-react';
import {
    getTasks,
    getPendingTasks,
    getThreadPool,
    getIndexingStats,
    cancelTask,
    TaskInfo,
    ThreadPoolInfo,
    IndexingStats,
} from '../api/elasticsearchClient';

interface OperationsMonitorProps {
    connectionId?: number | null;
}

export const OperationsMonitor: React.FC<OperationsMonitorProps> = ({ connectionId }) => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<'tasks' | 'threadpool' | 'indexing'>('tasks');
    const [tasks, setTasks] = useState<Array<TaskInfo & { nodeId: string; taskId: string; nodeName: string }>>([]);
    const [pendingTasks, setPendingTasks] = useState<Array<{ insert_order: number; priority: string; source: string; time_in_queue_millis: number }>>([]);
    const [threadPool, setThreadPool] = useState<ThreadPoolInfo[]>([]);
    const [indexingStats, setIndexingStats] = useState<IndexingStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [autoRefresh, setAutoRefresh] = useState(false);
    const [refreshInterval, setRefreshInterval] = useState(5000);

    const loadData = useCallback(async () => {
        try {
            setError(null);

            const [tasksData, pendingData, threadPoolData, indexingData] = await Promise.all([
                getTasks(),
                getPendingTasks(),
                getThreadPool(),
                getIndexingStats(),
            ]);

            // Flatten tasks
            const flatTasks: Array<TaskInfo & { nodeId: string; taskId: string; nodeName: string }> = [];
            if (tasksData.nodes) {
                for (const [nodeId, nodeData] of Object.entries(tasksData.nodes)) {
                    if (nodeData.tasks) {
                        for (const [taskId, task] of Object.entries(nodeData.tasks)) {
                            flatTasks.push({
                                ...task,
                                nodeId,
                                taskId,
                                nodeName: nodeData.name,
                            });
                        }
                    }
                }
            }

            // Sort by start time descending
            flatTasks.sort((a, b) => b.start_time_in_millis - a.start_time_in_millis);

            setTasks(flatTasks);
            setPendingTasks(pendingData.tasks || []);
            setThreadPool(threadPoolData || []);
            setIndexingStats(indexingData);
        } catch (err: any) {
            setError(err.message || t('common.error'));
        } finally {
            setLoading(false);
        }
    }, [t]);

    useEffect(() => {
        loadData();
    }, [connectionId, loadData]);

    // Auto refresh
    useEffect(() => {
        if (!autoRefresh) return;

        const interval = setInterval(loadData, refreshInterval);
        return () => clearInterval(interval);
    }, [autoRefresh, refreshInterval, loadData]);

    const handleCancelTask = async (taskId: string) => {
        if (!confirm(t('operations.confirmCancelTask'))) return;

        try {
            await cancelTask(taskId);
            loadData();
        } catch (err: any) {
            alert(err.message);
        }
    };

    const formatDuration = (nanos: number) => {
        const ms = nanos / 1000000;
        if (ms < 1000) return `${ms.toFixed(0)}ms`;
        if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
        if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
        return `${(ms / 3600000).toFixed(1)}h`;
    };

    const formatRate = (total: number, timeMs: number) => {
        if (timeMs === 0) return '0/s';
        const rate = (total / timeMs) * 1000;
        if (rate < 1) return `${rate.toFixed(2)}/s`;
        if (rate < 1000) return `${rate.toFixed(0)}/s`;
        return `${(rate / 1000).toFixed(1)}k/s`;
    };

    const getTaskTypeIcon = (action: string) => {
        if (action.includes('search')) return <Search size={14} />;
        if (action.includes('index') || action.includes('bulk')) return <ArrowDownToLine size={14} />;
        if (action.includes('delete')) return <Trash2 size={14} />;
        if (action.includes('reindex')) return <RotateCw size={14} />;
        if (action.includes('merge')) return <Merge size={14} />;
        if (action.includes('refresh')) return <RefreshCw size={14} />;
        if (action.includes('flush')) return <HardDrive size={14} />;
        return <Activity size={14} />;
    };

    if (loading) {
        return (
            <div className="operations-loading">
                <RefreshCw size={32} className="spin" />
                <p>{t('common.loading')}</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="operations-error">
                <AlertCircle size={32} />
                <p>{error}</p>
                <button className="btn btn-primary" onClick={loadData}>
                    {t('common.retry')}
                </button>
            </div>
        );
    }

    const stats = indexingStats?._all?.total;

    return (
        <div className="operations-monitor">
            <div className="operations-header">
                <div className="operations-title">
                    <Activity size={20} />
                    <h2>{t('operations.title')}</h2>
                </div>
                <div className="operations-controls">
                    <label className="auto-refresh-toggle">
                        <input
                            type="checkbox"
                            checked={autoRefresh}
                            onChange={(e) => setAutoRefresh(e.target.checked)}
                        />
                        <span>{t('operations.autoRefresh')}</span>
                        {autoRefresh && (
                            <select
                                value={refreshInterval}
                                onChange={(e) => setRefreshInterval(Number(e.target.value))}
                                className="refresh-interval-select"
                            >
                                <option value={2000}>2s</option>
                                <option value={5000}>5s</option>
                                <option value={10000}>10s</option>
                                <option value={30000}>30s</option>
                            </select>
                        )}
                    </label>
                    <button className="btn btn-secondary btn-sm" onClick={loadData}>
                        <RefreshCw size={14} className={loading ? 'spin' : ''} />
                        {t('common.refresh')}
                    </button>
                </div>
            </div>

            {/* Quick Stats */}
            <div className="operations-quick-stats">
                <div className="quick-stat">
                    <Zap size={16} />
                    <div className="quick-stat-content">
                        <span className="quick-stat-value">{tasks.length}</span>
                        <span className="quick-stat-label">{t('operations.activeTasks')}</span>
                    </div>
                </div>
                <div className="quick-stat">
                    <Clock size={16} />
                    <div className="quick-stat-content">
                        <span className="quick-stat-value">{pendingTasks.length}</span>
                        <span className="quick-stat-label">{t('operations.pendingTasks')}</span>
                    </div>
                </div>
                <div className="quick-stat">
                    <ArrowDownToLine size={16} />
                    <div className="quick-stat-content">
                        <span className="quick-stat-value">{stats?.indexing?.index_current || 0}</span>
                        <span className="quick-stat-label">{t('operations.indexingCurrent')}</span>
                    </div>
                </div>
                <div className="quick-stat">
                    <Search size={16} />
                    <div className="quick-stat-content">
                        <span className="quick-stat-value">{stats?.search?.query_current || 0}</span>
                        <span className="quick-stat-label">{t('operations.searchCurrent')}</span>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="operations-tabs">
                <button
                    className={`operations-tab ${activeTab === 'tasks' ? 'active' : ''}`}
                    onClick={() => setActiveTab('tasks')}
                >
                    <Activity size={14} />
                    {t('operations.tasks')}
                    {tasks.length > 0 && <span className="tab-badge">{tasks.length}</span>}
                </button>
                <button
                    className={`operations-tab ${activeTab === 'threadpool' ? 'active' : ''}`}
                    onClick={() => setActiveTab('threadpool')}
                >
                    <Cpu size={14} />
                    {t('operations.threadPool')}
                </button>
                <button
                    className={`operations-tab ${activeTab === 'indexing' ? 'active' : ''}`}
                    onClick={() => setActiveTab('indexing')}
                >
                    <TrendingUp size={14} />
                    {t('operations.indexingStats')}
                </button>
            </div>

            {/* Tab Content */}
            <div className="operations-content">
                {activeTab === 'tasks' && (
                    <div className="tasks-panel">
                        {tasks.length === 0 && pendingTasks.length === 0 ? (
                            <div className="empty-state">
                                <CheckCircle size={48} />
                                <p>{t('operations.noActiveTasks')}</p>
                            </div>
                        ) : (
                            <>
                                {/* Active Tasks */}
                                {tasks.length > 0 && (
                                    <div className="tasks-section">
                                        <h3>{t('operations.runningTasks')}</h3>
                                        <div className="tasks-list">
                                            {tasks.map((task) => (
                                                <div key={task.taskId} className="task-item">
                                                    <div className="task-icon">
                                                        {getTaskTypeIcon(task.action)}
                                                    </div>
                                                    <div className="task-info">
                                                        <div className="task-action">{task.action}</div>
                                                        {task.description && (
                                                            <div className="task-description">{task.description}</div>
                                                        )}
                                                        <div className="task-meta">
                                                            <span className="task-node">{task.nodeName}</span>
                                                            <span className="task-duration">
                                                                <Clock size={10} />
                                                                {formatDuration(task.running_time_in_nanos)}
                                                            </span>
                                                            {task.status?.total !== undefined && (
                                                                <span className="task-progress">
                                                                    {task.status.updated || 0}/{task.status.total}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    {task.cancellable && !task.cancelled && (
                                                        <button
                                                            className="btn btn-danger btn-sm task-cancel"
                                                            onClick={() => handleCancelTask(task.taskId)}
                                                            title={t('operations.cancelTask')}
                                                        >
                                                            <X size={12} />
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Pending Tasks */}
                                {pendingTasks.length > 0 && (
                                    <div className="tasks-section">
                                        <h3>{t('operations.pendingClusterTasks')}</h3>
                                        <div className="tasks-list">
                                            {pendingTasks.map((task, idx) => (
                                                <div key={idx} className="task-item pending">
                                                    <div className="task-icon">
                                                        <Clock size={14} />
                                                    </div>
                                                    <div className="task-info">
                                                        <div className="task-action">{task.source}</div>
                                                        <div className="task-meta">
                                                            <span className="task-priority">{task.priority}</span>
                                                            <span className="task-duration">
                                                                <Clock size={10} />
                                                                {task.time_in_queue_millis}ms {t('operations.inQueue')}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}

                {activeTab === 'threadpool' && (
                    <div className="threadpool-panel">
                        <table className="threadpool-table">
                            <thead>
                                <tr>
                                    <th>{t('operations.node')}</th>
                                    <th>{t('operations.pool')}</th>
                                    <th>{t('operations.type')}</th>
                                    <th>{t('operations.active')}</th>
                                    <th>{t('operations.queue')}</th>
                                    <th>{t('operations.rejected')}</th>
                                    <th>{t('operations.completed')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {threadPool
                                    .filter(tp => parseInt(tp.active) > 0 || parseInt(tp.queue) > 0 || parseInt(tp.rejected) > 0)
                                    .map((tp, idx) => {
                                        const active = parseInt(tp.active) || 0;
                                        const queue = parseInt(tp.queue) || 0;
                                        const rejected = parseInt(tp.rejected) || 0;

                                        return (
                                            <tr key={idx}>
                                                <td>{tp.node_name}</td>
                                                <td>
                                                    <span className="pool-name">{tp.name}</span>
                                                </td>
                                                <td>{tp.type}</td>
                                                <td>
                                                    <span
                                                        className="stat-badge"
                                                        style={{ color: active > 0 ? 'var(--success)' : 'var(--text-muted)' }}
                                                    >
                                                        {active}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span
                                                        className="stat-badge"
                                                        style={{ color: queue > 10 ? 'var(--warning)' : 'var(--text-muted)' }}
                                                    >
                                                        {queue}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span
                                                        className="stat-badge"
                                                        style={{ color: rejected > 0 ? 'var(--danger)' : 'var(--text-muted)' }}
                                                    >
                                                        {rejected}
                                                    </span>
                                                </td>
                                                <td>{tp.completed}</td>
                                            </tr>
                                        );
                                    })}
                                {threadPool.filter(tp => parseInt(tp.active) > 0 || parseInt(tp.queue) > 0 || parseInt(tp.rejected) > 0).length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="empty-row">
                                            {t('operations.allPoolsIdle')}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {activeTab === 'indexing' && indexingStats && (
                    <div className="indexing-panel">
                        <div className="indexing-stats-grid">
                            {/* Indexing Stats */}
                            <div className="stats-card">
                                <div className="stats-card-header">
                                    <ArrowDownToLine size={16} />
                                    <h4>{t('operations.indexing')}</h4>
                                </div>
                                <div className="stats-card-body">
                                    <div className="stat-row">
                                        <span className="stat-label">{t('operations.totalIndexed')}</span>
                                        <span className="stat-value">{stats?.indexing?.index_total?.toLocaleString() || 0}</span>
                                    </div>
                                    <div className="stat-row">
                                        <span className="stat-label">{t('operations.indexingRate')}</span>
                                        <span className="stat-value">
                                            {formatRate(stats?.indexing?.index_total || 0, stats?.indexing?.index_time_in_millis || 1)}
                                        </span>
                                    </div>
                                    <div className="stat-row">
                                        <span className="stat-label">{t('operations.currentIndexing')}</span>
                                        <span className="stat-value highlight">{stats?.indexing?.index_current || 0}</span>
                                    </div>
                                    <div className="stat-row">
                                        <span className="stat-label">{t('operations.failed')}</span>
                                        <span className="stat-value danger">{stats?.indexing?.index_failed || 0}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Search Stats */}
                            <div className="stats-card">
                                <div className="stats-card-header">
                                    <Search size={16} />
                                    <h4>{t('operations.search')}</h4>
                                </div>
                                <div className="stats-card-body">
                                    <div className="stat-row">
                                        <span className="stat-label">{t('operations.totalQueries')}</span>
                                        <span className="stat-value">{stats?.search?.query_total?.toLocaleString() || 0}</span>
                                    </div>
                                    <div className="stat-row">
                                        <span className="stat-label">{t('operations.queryRate')}</span>
                                        <span className="stat-value">
                                            {formatRate(stats?.search?.query_total || 0, stats?.search?.query_time_in_millis || 1)}
                                        </span>
                                    </div>
                                    <div className="stat-row">
                                        <span className="stat-label">{t('operations.currentQueries')}</span>
                                        <span className="stat-value highlight">{stats?.search?.query_current || 0}</span>
                                    </div>
                                    <div className="stat-row">
                                        <span className="stat-label">{t('operations.avgQueryTime')}</span>
                                        <span className="stat-value">
                                            {stats?.search?.query_total
                                                ? `${((stats.search.query_time_in_millis / stats.search.query_total) || 0).toFixed(1)}ms`
                                                : '0ms'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Delete Stats */}
                            <div className="stats-card">
                                <div className="stats-card-header">
                                    <Trash2 size={16} />
                                    <h4>{t('operations.deletes')}</h4>
                                </div>
                                <div className="stats-card-body">
                                    <div className="stat-row">
                                        <span className="stat-label">{t('operations.totalDeleted')}</span>
                                        <span className="stat-value">{stats?.indexing?.delete_total?.toLocaleString() || 0}</span>
                                    </div>
                                    <div className="stat-row">
                                        <span className="stat-label">{t('operations.deleteRate')}</span>
                                        <span className="stat-value">
                                            {formatRate(stats?.indexing?.delete_total || 0, stats?.indexing?.delete_time_in_millis || 1)}
                                        </span>
                                    </div>
                                    <div className="stat-row">
                                        <span className="stat-label">{t('operations.currentDeletes')}</span>
                                        <span className="stat-value highlight">{stats?.indexing?.delete_current || 0}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Fetch Stats */}
                            <div className="stats-card">
                                <div className="stats-card-header">
                                    <ArrowUpFromLine size={16} />
                                    <h4>{t('operations.fetch')}</h4>
                                </div>
                                <div className="stats-card-body">
                                    <div className="stat-row">
                                        <span className="stat-label">{t('operations.totalFetches')}</span>
                                        <span className="stat-value">{stats?.search?.fetch_total?.toLocaleString() || 0}</span>
                                    </div>
                                    <div className="stat-row">
                                        <span className="stat-label">{t('operations.fetchRate')}</span>
                                        <span className="stat-value">
                                            {formatRate(stats?.search?.fetch_total || 0, stats?.search?.fetch_time_in_millis || 1)}
                                        </span>
                                    </div>
                                    <div className="stat-row">
                                        <span className="stat-label">{t('operations.currentFetches')}</span>
                                        <span className="stat-value highlight">{stats?.search?.fetch_current || 0}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default OperationsMonitor;
