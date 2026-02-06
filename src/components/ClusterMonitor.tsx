import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Activity,
    Cpu,
    HardDrive,
    Database,
    RefreshCw,
    AlertCircle,
    CheckCircle,
    AlertTriangle,
    Server,
    Layers,
    TrendingUp,
    BarChart3,
    Clock,
    Zap,
    Network,
    MemoryStick,
    Disc,
    FileSearch,
    CircleDot,
    Search,
    ArrowDownToLine,
    Trash2,
    RotateCw,
    Merge,
    Play,
    Pause,
    X,
    ListTodo,
    Loader,
} from 'lucide-react';
import {
    getClusterHealth,
    getClusterStats,
    getNodesStatsAll,
    getCatNodes,
    NodesStatsResponse,
    NodeStats,
    getTasks,
    cancelTask,
    TaskInfo,
} from '../api/elasticsearchClient';
import { formatBytes } from '../utils/formatters';

interface ClusterMonitorProps {
    connectionId?: number | null;
}

interface TimeSeriesData {
    timestamp: number;
    values: Record<string, number>;
}

interface HistoryData {
    jvmHeapPercent: TimeSeriesData[];
    cpuPercent: TimeSeriesData[];
    gcCount: TimeSeriesData[];
    gcTime: TimeSeriesData[];
    indexingRate: TimeSeriesData[];
    searchRate: TimeSeriesData[];
    diskUsedPercent: TimeSeriesData[];
    networkRx: TimeSeriesData[];
    networkTx: TimeSeriesData[];
}

const MAX_HISTORY_POINTS = 60; // 5 dakika (5 saniye interval ile)

export const ClusterMonitor: React.FC<ClusterMonitorProps> = ({ connectionId }) => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<'overview' | 'nodes' | 'operations' | 'caches' | 'tasks'>('overview');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [refreshInterval, setRefreshInterval] = useState(5000);
    const [isPageVisible, setIsPageVisible] = useState(!document.hidden);
    const [idleMinutes, setIdleMinutes] = useState(0);
    const lastActivityRef = useRef(Date.now());

    const IDLE_TIMEOUT_MINUTES = 30; // 30 dakika sonra otomatik durdur
    const REFRESH_OPTIONS = [
        { value: 5000, label: '5s' },
        { value: 10000, label: '10s' },
        { value: 30000, label: '30s' },
        { value: 60000, label: '1m' },
        { value: 300000, label: '5m' },
    ];

    // Cluster data
    const [clusterHealth, setClusterHealth] = useState<any>(null);
    const [, setClusterStats] = useState<any>(null);
    const [nodesStats, setNodesStats] = useState<NodesStatsResponse | null>(null);
    const [catNodes, setCatNodes] = useState<any[]>([]);

    // Tasks data
    const [tasks, setTasks] = useState<Array<TaskInfo & { nodeId: string; nodeName: string; taskId: string }>>([]);
    const [tasksLoading, setTasksLoading] = useState(false);
    const [cancellingTasks, setCancellingTasks] = useState<Set<string>>(new Set());

    // History for charts
    const [history, setHistory] = useState<HistoryData>({
        jvmHeapPercent: [],
        cpuPercent: [],
        gcCount: [],
        gcTime: [],
        indexingRate: [],
        searchRate: [],
        diskUsedPercent: [],
        networkRx: [],
        networkTx: [],
    });

    // Previous values for rate calculation
    const prevValuesRef = useRef<Record<string, Record<string, number>>>({});

    const loadData = useCallback(async () => {
        try {
            setError(null);

            const [health, stats, nodes, catNodesData] = await Promise.all([
                getClusterHealth(),
                getClusterStats(),
                getNodesStatsAll(),
                getCatNodes(),
            ]);

            setClusterHealth(health);
            setClusterStats(stats);
            setNodesStats(nodes);
            setCatNodes(catNodesData);

            // Update history
            if (nodes?.nodes) {
                const now = Date.now();
                const nodeEntries = Object.entries(nodes.nodes) as [string, NodeStats][];

                // Calculate aggregated values
                let totalHeapUsed = 0;
                let totalHeapMax = 0;
                let totalCpu = 0;
                let totalGcCount = 0;
                let totalGcTime = 0;
                let totalIndexing = 0;
                let totalSearch = 0;
                let totalDiskUsed = 0;
                let totalDiskTotal = 0;
                let totalRx = 0;
                let totalTx = 0;

                nodeEntries.forEach(([, node]) => {
                    totalHeapUsed += node.jvm?.mem?.heap_used_in_bytes || 0;
                    totalHeapMax += node.jvm?.mem?.heap_max_in_bytes || 0;
                    totalCpu += node.os?.cpu?.percent || 0;

                    const gc = node.jvm?.gc?.collectors;
                    if (gc) {
                        totalGcCount += (gc.young?.collection_count || 0) + (gc.old?.collection_count || 0);
                        totalGcTime += (gc.young?.collection_time_in_millis || 0) + (gc.old?.collection_time_in_millis || 0);
                    }

                    totalIndexing += node.indices?.indexing?.index_total || 0;
                    totalSearch += node.indices?.search?.query_total || 0;
                    totalDiskUsed += (node.fs?.total?.total_in_bytes || 0) - (node.fs?.total?.available_in_bytes || 0);
                    totalDiskTotal += node.fs?.total?.total_in_bytes || 0;
                    totalRx += node.transport?.rx_size_in_bytes || 0;
                    totalTx += node.transport?.tx_size_in_bytes || 0;
                });

                const nodeCount = nodeEntries.length || 1;
                const heapPercent = totalHeapMax > 0 ? (totalHeapUsed / totalHeapMax) * 100 : 0;
                const avgCpu = totalCpu / nodeCount;
                const diskPercent = totalDiskTotal > 0 ? (totalDiskUsed / totalDiskTotal) * 100 : 0;

                // Calculate rates
                const prevIndexing = prevValuesRef.current.indexing?.total || totalIndexing;
                const prevSearch = prevValuesRef.current.search?.total || totalSearch;
                const prevGcCount = prevValuesRef.current.gc?.count || totalGcCount;
                const prevGcTime = prevValuesRef.current.gc?.time || totalGcTime;
                const prevRx = prevValuesRef.current.network?.rx || totalRx;
                const prevTx = prevValuesRef.current.network?.tx || totalTx;

                const indexingRate = Math.max(0, totalIndexing - prevIndexing);
                const searchRate = Math.max(0, totalSearch - prevSearch);
                const gcCountDelta = Math.max(0, totalGcCount - prevGcCount);
                const gcTimeDelta = Math.max(0, totalGcTime - prevGcTime);
                const rxRate = Math.max(0, totalRx - prevRx);
                const txRate = Math.max(0, totalTx - prevTx);

                // Store current values for next rate calculation
                prevValuesRef.current = {
                    indexing: { total: totalIndexing },
                    search: { total: totalSearch },
                    gc: { count: totalGcCount, time: totalGcTime },
                    network: { rx: totalRx, tx: totalTx },
                };

                setHistory(prev => ({
                    jvmHeapPercent: [...prev.jvmHeapPercent.slice(-MAX_HISTORY_POINTS + 1), { timestamp: now, values: { avg: heapPercent } }],
                    cpuPercent: [...prev.cpuPercent.slice(-MAX_HISTORY_POINTS + 1), { timestamp: now, values: { avg: avgCpu } }],
                    gcCount: [...prev.gcCount.slice(-MAX_HISTORY_POINTS + 1), { timestamp: now, values: { delta: gcCountDelta } }],
                    gcTime: [...prev.gcTime.slice(-MAX_HISTORY_POINTS + 1), { timestamp: now, values: { delta: gcTimeDelta } }],
                    indexingRate: [...prev.indexingRate.slice(-MAX_HISTORY_POINTS + 1), { timestamp: now, values: { rate: indexingRate } }],
                    searchRate: [...prev.searchRate.slice(-MAX_HISTORY_POINTS + 1), { timestamp: now, values: { rate: searchRate } }],
                    diskUsedPercent: [...prev.diskUsedPercent.slice(-MAX_HISTORY_POINTS + 1), { timestamp: now, values: { percent: diskPercent } }],
                    networkRx: [...prev.networkRx.slice(-MAX_HISTORY_POINTS + 1), { timestamp: now, values: { bytes: rxRate } }],
                    networkTx: [...prev.networkTx.slice(-MAX_HISTORY_POINTS + 1), { timestamp: now, values: { bytes: txRate } }],
                }));
            }
        } catch (err: any) {
            setError(err.message || t('common.error'));
        } finally {
            setLoading(false);
        }
    }, [t]);

    const loadTasks = useCallback(async () => {
        setTasksLoading(true);
        try {
            const data = await getTasks();
            const taskList: Array<TaskInfo & { nodeId: string; nodeName: string; taskId: string }> = [];

            if (data?.nodes) {
                Object.entries(data.nodes).forEach(([nodeId, nodeData]) => {
                    const nodeName = nodeData.name;
                    Object.entries(nodeData.tasks).forEach(([, task]) => {
                        // Only show cancellable long-running tasks
                        if (task.cancellable) {
                            taskList.push({
                                ...task,
                                nodeId,
                                nodeName,
                                taskId: `${nodeId}:${task.id}`,
                            });
                        }
                    });
                });
            }

            // Sort by running time (longest first)
            taskList.sort((a, b) => b.running_time_in_nanos - a.running_time_in_nanos);
            setTasks(taskList);
        } catch (err) {
            console.error('Failed to load tasks:', err);
        } finally {
            setTasksLoading(false);
        }
    }, []);

    const handleCancelTask = async (taskId: string) => {
        setCancellingTasks(prev => new Set(prev).add(taskId));
        try {
            await cancelTask(taskId);
            // Reload tasks after cancellation
            await loadTasks();
        } catch (err) {
            console.error('Failed to cancel task:', err);
        } finally {
            setCancellingTasks(prev => {
                const next = new Set(prev);
                next.delete(taskId);
                return next;
            });
        }
    };

    useEffect(() => {
        loadData();
    }, [connectionId, loadData]);

    // Load tasks when switching to tasks tab
    useEffect(() => {
        if (activeTab === 'tasks') {
            loadTasks();
        }
    }, [activeTab, loadTasks]);

    useEffect(() => {
        const handleVisibilityChange = () => {
            setIsPageVisible(!document.hidden);
            if (!document.hidden) {
                lastActivityRef.current = Date.now();
                setIdleMinutes(0);
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, []);

    // User activity tracker
    useEffect(() => {
        const handleActivity = () => {
            lastActivityRef.current = Date.now();
            setIdleMinutes(0);
        };

        // Mouse ve keyboard activity'sini dinle
        window.addEventListener('mousemove', handleActivity);
        window.addEventListener('keydown', handleActivity);
        window.addEventListener('click', handleActivity);
        window.addEventListener('scroll', handleActivity);

        return () => {
            window.removeEventListener('mousemove', handleActivity);
            window.removeEventListener('keydown', handleActivity);
            window.removeEventListener('click', handleActivity);
            window.removeEventListener('scroll', handleActivity);
        };
    }, []);

    // Idle checker - her dakika kontrol et
    useEffect(() => {
        const idleChecker = setInterval(() => {
            const minutesIdle = Math.floor((Date.now() - lastActivityRef.current) / 60000);
            setIdleMinutes(minutesIdle);

            if (minutesIdle >= IDLE_TIMEOUT_MINUTES && autoRefresh) {
                setAutoRefresh(false);
            }
        }, 60000);

        return () => clearInterval(idleChecker);
    }, [autoRefresh]);

    useEffect(() => {
        if (!autoRefresh || !isPageVisible) return;

        const interval = setInterval(() => {
            loadData();
            if (activeTab === 'tasks') {
                loadTasks();
            }
        }, refreshInterval);
        return () => clearInterval(interval);
    }, [autoRefresh, refreshInterval, loadData, loadTasks, activeTab, isPageVisible]);

    const getHealthColor = (status: string) => {
        switch (status) {
            case 'green': return 'var(--success)';
            case 'yellow': return 'var(--warning)';
            case 'red': return 'var(--danger)';
            default: return 'var(--text-muted)';
        }
    };

    const getHealthIcon = (status: string) => {
        switch (status) {
            case 'green': return <CheckCircle size={20} />;
            case 'yellow': return <AlertTriangle size={20} />;
            case 'red': return <AlertCircle size={20} />;
            default: return <CircleDot size={20} />;
        }
    };

    // Mini sparkline chart component
    const MiniChart: React.FC<{
        data: TimeSeriesData[];
        valueKey: string;
        color: string;
        height?: number;
        showArea?: boolean;
        formatValue?: (v: number) => string;
    }> = ({ data, valueKey, color, height = 60, showArea = true, formatValue }) => {
        if (data.length < 2) {
            return (
                <div className="mini-chart-placeholder" style={{ height }}>
                    <span>{t('clusterMonitor.collectingData')}</span>
                </div>
            );
        }

        const values = data.map(d => d.values[valueKey] || 0);
        const max = Math.max(...values, 1);
        const min = Math.min(...values, 0);
        const range = max - min || 1;

        const width = 200;
        const padding = 4;
        const chartWidth = width - padding * 2;
        const chartHeight = height - padding * 2;

        const points = values.map((v, i) => {
            const x = padding + (i / (values.length - 1)) * chartWidth;
            const y = padding + chartHeight - ((v - min) / range) * chartHeight;
            return `${x},${y}`;
        }).join(' ');

        const areaPath = `M ${padding},${padding + chartHeight} ${values.map((v, i) => {
            const x = padding + (i / (values.length - 1)) * chartWidth;
            const y = padding + chartHeight - ((v - min) / range) * chartHeight;
            return `L ${x},${y}`;
        }).join(' ')} L ${padding + chartWidth},${padding + chartHeight} Z`;

        const lastValue = values[values.length - 1];
        const displayValue = formatValue ? formatValue(lastValue) : lastValue.toFixed(1);

        return (
            <div className="mini-chart">
                <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
                    {showArea && (
                        <path d={areaPath} fill={color} fillOpacity="0.2" />
                    )}
                    <polyline
                        points={points}
                        fill="none"
                        stroke={color}
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                    <circle
                        cx={padding + chartWidth}
                        cy={padding + chartHeight - ((lastValue - min) / range) * chartHeight}
                        r="3"
                        fill={color}
                    />
                </svg>
                <div className="mini-chart-value" style={{ color }}>{displayValue}</div>
            </div>
        );
    };

    // Calculate aggregated stats
    const getAggregatedStats = () => {
        if (!nodesStats?.nodes) return null;

        const nodes = Object.values(nodesStats.nodes) as NodeStats[];
        const nodeCount = nodes.length;

        let totalHeapUsed = 0;
        let totalHeapMax = 0;
        let totalCpu = 0;
        let totalDiskUsed = 0;
        let totalDiskTotal = 0;
        let totalGcYoungCount = 0;
        let totalGcOldCount = 0;
        let totalGcYoungTime = 0;
        let totalGcOldTime = 0;
        let totalIndexingOps = 0;
        let totalSearchOps = 0;
        let totalGetOps = 0;
        let totalMergeOps = 0;
        let totalRefreshOps = 0;
        let totalFlushOps = 0;
        let totalDeleteOps = 0;
        let totalOpenFileDescriptors = 0;
        let totalFieldDataMemory = 0;
        let totalFieldDataEvictions = 0;
        let totalQueryCacheMemory = 0;
        let totalQueryCacheEvictions = 0;
        let totalRequestCacheMemory = 0;
        let totalRequestCacheEvictions = 0;
        let totalSegments = 0;
        let totalSegmentMemory = 0;
        let totalTranslogOps = 0;
        let totalTranslogSize = 0;

        nodes.forEach(node => {
            totalHeapUsed += node.jvm?.mem?.heap_used_in_bytes || 0;
            totalHeapMax += node.jvm?.mem?.heap_max_in_bytes || 0;
            totalCpu += node.os?.cpu?.percent || 0;
            totalDiskUsed += (node.fs?.total?.total_in_bytes || 0) - (node.fs?.total?.available_in_bytes || 0);
            totalDiskTotal += node.fs?.total?.total_in_bytes || 0;

            const gc = node.jvm?.gc?.collectors;
            if (gc) {
                totalGcYoungCount += gc.young?.collection_count || 0;
                totalGcOldCount += gc.old?.collection_count || 0;
                totalGcYoungTime += gc.young?.collection_time_in_millis || 0;
                totalGcOldTime += gc.old?.collection_time_in_millis || 0;
            }

            totalIndexingOps += node.indices?.indexing?.index_total || 0;
            totalSearchOps += node.indices?.search?.query_total || 0;
            totalGetOps += node.indices?.get?.total || 0;
            totalMergeOps += node.indices?.merges?.total || 0;
            totalRefreshOps += node.indices?.refresh?.total || 0;
            totalFlushOps += node.indices?.flush?.total || 0;
            totalDeleteOps += node.indices?.indexing?.delete_total || 0;
            totalOpenFileDescriptors += node.process?.open_file_descriptors || 0;

            totalFieldDataMemory += node.indices?.fielddata?.memory_size_in_bytes || 0;
            totalFieldDataEvictions += node.indices?.fielddata?.evictions || 0;
            totalQueryCacheMemory += node.indices?.query_cache?.memory_size_in_bytes || 0;
            totalQueryCacheEvictions += node.indices?.query_cache?.evictions || 0;
            totalRequestCacheMemory += node.indices?.request_cache?.memory_size_in_bytes || 0;
            totalRequestCacheEvictions += node.indices?.request_cache?.evictions || 0;

            totalSegments += node.indices?.segments?.count || 0;
            totalSegmentMemory += node.indices?.segments?.memory_in_bytes || 0;
            totalTranslogOps += node.indices?.translog?.operations || 0;
            totalTranslogSize += node.indices?.translog?.size_in_bytes || 0;
        });

        return {
            nodeCount,
            heapUsedPercent: totalHeapMax > 0 ? (totalHeapUsed / totalHeapMax) * 100 : 0,
            heapUsed: totalHeapUsed,
            heapMax: totalHeapMax,
            cpuPercent: totalCpu / nodeCount,
            diskUsedPercent: totalDiskTotal > 0 ? (totalDiskUsed / totalDiskTotal) * 100 : 0,
            diskUsed: totalDiskUsed,
            diskTotal: totalDiskTotal,
            gcYoungCount: totalGcYoungCount,
            gcOldCount: totalGcOldCount,
            gcYoungTime: totalGcYoungTime,
            gcOldTime: totalGcOldTime,
            indexingOps: totalIndexingOps,
            searchOps: totalSearchOps,
            getOps: totalGetOps,
            mergeOps: totalMergeOps,
            refreshOps: totalRefreshOps,
            flushOps: totalFlushOps,
            deleteOps: totalDeleteOps,
            openFileDescriptors: totalOpenFileDescriptors,
            fieldDataMemory: totalFieldDataMemory,
            fieldDataEvictions: totalFieldDataEvictions,
            queryCacheMemory: totalQueryCacheMemory,
            queryCacheEvictions: totalQueryCacheEvictions,
            requestCacheMemory: totalRequestCacheMemory,
            requestCacheEvictions: totalRequestCacheEvictions,
            segments: totalSegments,
            segmentMemory: totalSegmentMemory,
            translogOps: totalTranslogOps,
            translogSize: totalTranslogSize,
        };
    };

    if (loading) {
        return (
            <div className="cluster-monitor-loading">
                <RefreshCw size={32} className="spin" />
                <p>{t('common.loading')}</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="cluster-monitor-error">
                <AlertCircle size={32} />
                <p>{error}</p>
                <button className="btn btn-primary" onClick={loadData}>
                    {t('common.retry')}
                </button>
            </div>
        );
    }

    const aggStats = getAggregatedStats();

    return (
        <div className="cluster-monitor">
            {/* Header */}
            <div className="cluster-monitor-header">
                <div className="cluster-monitor-title">
                    <BarChart3 size={24} />
                    <h2>{t('clusterMonitor.title')}</h2>
                </div>
                <div className="cluster-monitor-controls">
                    <select
                        className="refresh-interval-select"
                        value={refreshInterval}
                        onChange={(e) => setRefreshInterval(Number(e.target.value))}
                        disabled={!autoRefresh}
                    >
                        {REFRESH_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>

                    <button
                        className={`btn btn-sm ${autoRefresh && isPageVisible ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => {
                            setAutoRefresh(!autoRefresh);
                            lastActivityRef.current = Date.now();
                            setIdleMinutes(0);
                        }}
                        title={t('clusterMonitor.autoRefresh')}
                    >
                        {autoRefresh ? <Pause size={16} /> : <Play size={16} />}
                        {autoRefresh ? t('clusterMonitor.pause') : t('clusterMonitor.resume')}
                    </button>
                    <button
                        className="btn btn-sm btn-secondary"
                        onClick={loadData}
                        title={t('common.refresh')}
                    >
                        <RefreshCw size={16} />
                    </button>

                    {/* Durum göstergesi */}
                    {autoRefresh && !isPageVisible && (
                        <span className="refresh-status paused" title={t('clusterMonitor.pausedBackground')}>
                            {t('clusterMonitor.pausedBackground')}
                        </span>
                    )}
                    {autoRefresh && isPageVisible && idleMinutes > 0 && (
                        <span className="refresh-status idle" title={t('clusterMonitor.idleWarning', { minutes: IDLE_TIMEOUT_MINUTES - idleMinutes })}>
                            {t('clusterMonitor.idleIn', { minutes: IDLE_TIMEOUT_MINUTES - idleMinutes })}
                        </span>
                    )}
                </div>
            </div>

            {/* KPI Cards */}
            <div className="cluster-kpi-grid">
                <div className="kpi-card kpi-health">
                    <div className="kpi-icon" style={{ color: getHealthColor(clusterHealth?.status) }}>
                        {getHealthIcon(clusterHealth?.status)}
                    </div>
                    <div className="kpi-content">
                        <div className="kpi-label">{t('clusterMonitor.clusterHealth')}</div>
                        <div className="kpi-value" style={{ color: getHealthColor(clusterHealth?.status) }}>
                            {clusterHealth?.status?.toUpperCase() || 'N/A'}
                        </div>
                    </div>
                </div>

                <div className="kpi-card">
                    <div className="kpi-icon"><Cpu size={20} /></div>
                    <div className="kpi-content">
                        <div className="kpi-label">{t('clusterMonitor.cpuUsage')}</div>
                        <div className="kpi-value">{aggStats?.cpuPercent?.toFixed(1) || 0}%</div>
                    </div>
                </div>

                <div className="kpi-card">
                    <div className="kpi-icon"><MemoryStick size={20} /></div>
                    <div className="kpi-content">
                        <div className="kpi-label">{t('clusterMonitor.jvmHeap')}</div>
                        <div className="kpi-value">{aggStats?.heapUsedPercent?.toFixed(1) || 0}%</div>
                    </div>
                </div>

                <div className="kpi-card">
                    <div className="kpi-icon"><Server size={20} /></div>
                    <div className="kpi-content">
                        <div className="kpi-label">{t('clusterMonitor.nodes')}</div>
                        <div className="kpi-value">{clusterHealth?.number_of_nodes || 0}</div>
                    </div>
                </div>

                <div className="kpi-card">
                    <div className="kpi-icon"><Database size={20} /></div>
                    <div className="kpi-content">
                        <div className="kpi-label">{t('clusterMonitor.dataNodes')}</div>
                        <div className="kpi-value">{clusterHealth?.number_of_data_nodes || 0}</div>
                    </div>
                </div>

                <div className="kpi-card">
                    <div className="kpi-icon"><Clock size={20} /></div>
                    <div className="kpi-content">
                        <div className="kpi-label">{t('clusterMonitor.pendingTasks')}</div>
                        <div className="kpi-value">{clusterHealth?.number_of_pending_tasks || 0}</div>
                    </div>
                </div>

                <div className="kpi-card">
                    <div className="kpi-icon"><Zap size={20} /></div>
                    <div className="kpi-content">
                        <div className="kpi-label">{t('clusterMonitor.openFileDesc')}</div>
                        <div className="kpi-value">{(aggStats?.openFileDescriptors || 0).toLocaleString()}</div>
                    </div>
                </div>
            </div>

            {/* Shards Row */}
            <div className="cluster-section">
                <h3><Layers size={18} /> {t('clusterMonitor.shards')}</h3>
                <div className="shards-grid">
                    <div className="shard-stat">
                        <span className="shard-label">{t('clusterMonitor.activePrimary')}</span>
                        <span className="shard-value">{clusterHealth?.active_primary_shards || 0}</span>
                    </div>
                    <div className="shard-stat">
                        <span className="shard-label">{t('clusterMonitor.activeShards')}</span>
                        <span className="shard-value">{clusterHealth?.active_shards || 0}</span>
                    </div>
                    <div className="shard-stat">
                        <span className="shard-label">{t('clusterMonitor.initializingShards')}</span>
                        <span className="shard-value">{clusterHealth?.initializing_shards || 0}</span>
                    </div>
                    <div className="shard-stat">
                        <span className="shard-label">{t('clusterMonitor.relocatingShards')}</span>
                        <span className="shard-value">{clusterHealth?.relocating_shards || 0}</span>
                    </div>
                    <div className="shard-stat">
                        <span className="shard-label">{t('clusterMonitor.unassignedShards')}</span>
                        <span className="shard-value" style={{ color: clusterHealth?.unassigned_shards > 0 ? 'var(--warning)' : 'inherit' }}>
                            {clusterHealth?.unassigned_shards || 0}
                        </span>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="cluster-tabs">
                <button
                    className={`cluster-tab ${activeTab === 'overview' ? 'active' : ''}`}
                    onClick={() => setActiveTab('overview')}
                >
                    <TrendingUp size={16} />
                    {t('clusterMonitor.overview')}
                </button>
                <button
                    className={`cluster-tab ${activeTab === 'nodes' ? 'active' : ''}`}
                    onClick={() => setActiveTab('nodes')}
                >
                    <Server size={16} />
                    {t('clusterMonitor.nodesTab')}
                </button>
                <button
                    className={`cluster-tab ${activeTab === 'operations' ? 'active' : ''}`}
                    onClick={() => setActiveTab('operations')}
                >
                    <Activity size={16} />
                    {t('clusterMonitor.operationsTab')}
                </button>
                <button
                    className={`cluster-tab ${activeTab === 'caches' ? 'active' : ''}`}
                    onClick={() => setActiveTab('caches')}
                >
                    <Database size={16} />
                    {t('clusterMonitor.cachesTab')}
                </button>
                <button
                    className={`cluster-tab ${activeTab === 'tasks' ? 'active' : ''}`}
                    onClick={() => setActiveTab('tasks')}
                >
                    <ListTodo size={16} />
                    {t('clusterMonitor.tasksTab')}
                    {tasks.length > 0 && (
                        <span className="tab-badge">{tasks.length}</span>
                    )}
                </button>
            </div>

            {/* Tab Content */}
            <div className="cluster-tab-content">
                {activeTab === 'overview' && (
                    <div className="overview-content">
                        {/* JVM & CPU Charts */}
                        <div className="charts-row">
                            <div className="chart-card">
                                <h4><MemoryStick size={16} /> {t('clusterMonitor.jvmHeapUsage')}</h4>
                                <MiniChart
                                    data={history.jvmHeapPercent}
                                    valueKey="avg"
                                    color="var(--accent)"
                                    height={80}
                                    formatValue={(v) => `${v.toFixed(1)}%`}
                                />
                                <div className="chart-info">
                                    <span>{formatBytes(aggStats?.heapUsed || 0)} / {formatBytes(aggStats?.heapMax || 0)}</span>
                                </div>
                            </div>

                            <div className="chart-card">
                                <h4><Cpu size={16} /> {t('clusterMonitor.cpuUsage')}</h4>
                                <MiniChart
                                    data={history.cpuPercent}
                                    valueKey="avg"
                                    color="var(--success)"
                                    height={80}
                                    formatValue={(v) => `${v.toFixed(1)}%`}
                                />
                            </div>
                        </div>

                        {/* GC Charts */}
                        <div className="charts-row">
                            <div className="chart-card">
                                <h4><RotateCw size={16} /> {t('clusterMonitor.gcCount')}</h4>
                                <MiniChart
                                    data={history.gcCount}
                                    valueKey="delta"
                                    color="var(--warning)"
                                    height={80}
                                    formatValue={(v) => v.toFixed(0)}
                                />
                                <div className="chart-info">
                                    <span>Young: {aggStats?.gcYoungCount?.toLocaleString()}</span>
                                    <span>Old: {aggStats?.gcOldCount?.toLocaleString()}</span>
                                </div>
                            </div>

                            <div className="chart-card">
                                <h4><Clock size={16} /> {t('clusterMonitor.gcTime')}</h4>
                                <MiniChart
                                    data={history.gcTime}
                                    valueKey="delta"
                                    color="var(--danger)"
                                    height={80}
                                    formatValue={(v) => `${v.toFixed(0)}ms`}
                                />
                                <div className="chart-info">
                                    <span>Young: {aggStats?.gcYoungTime?.toLocaleString()}ms</span>
                                    <span>Old: {aggStats?.gcOldTime?.toLocaleString()}ms</span>
                                </div>
                            </div>
                        </div>

                        {/* Disk & Network */}
                        <div className="charts-row">
                            <div className="chart-card">
                                <h4><HardDrive size={16} /> {t('clusterMonitor.diskUsage')}</h4>
                                <div className="disk-bar-container">
                                    <div
                                        className="disk-bar"
                                        style={{
                                            width: `${aggStats?.diskUsedPercent || 0}%`,
                                            backgroundColor: (aggStats?.diskUsedPercent || 0) > 80 ? 'var(--danger)' : 'var(--accent)'
                                        }}
                                    />
                                </div>
                                <div className="chart-info">
                                    <span>{formatBytes(aggStats?.diskUsed || 0)} / {formatBytes(aggStats?.diskTotal || 0)}</span>
                                    <span>{aggStats?.diskUsedPercent?.toFixed(1)}%</span>
                                </div>
                            </div>

                            <div className="chart-card">
                                <h4><Network size={16} /> {t('clusterMonitor.networkIO')}</h4>
                                <div className="network-stats">
                                    <div className="network-stat">
                                        <span className="network-label">↓ RX</span>
                                        <MiniChart
                                            data={history.networkRx}
                                            valueKey="bytes"
                                            color="var(--success)"
                                            height={40}
                                            formatValue={(v) => formatBytes(v)}
                                        />
                                    </div>
                                    <div className="network-stat">
                                        <span className="network-label">↑ TX</span>
                                        <MiniChart
                                            data={history.networkTx}
                                            valueKey="bytes"
                                            color="var(--accent)"
                                            height={40}
                                            formatValue={(v) => formatBytes(v)}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Translog & Segments */}
                        <div className="stats-row">
                            <div className="stat-card">
                                <h4><FileSearch size={16} /> {t('clusterMonitor.translog')}</h4>
                                <div className="stat-grid">
                                    <div className="stat-item">
                                        <span className="stat-label">{t('clusterMonitor.operations')}</span>
                                        <span className="stat-value">{(aggStats?.translogOps || 0).toLocaleString()}</span>
                                    </div>
                                    <div className="stat-item">
                                        <span className="stat-label">{t('clusterMonitor.size')}</span>
                                        <span className="stat-value">{formatBytes(aggStats?.translogSize || 0)}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="stat-card">
                                <h4><Disc size={16} /> {t('clusterMonitor.segments')}</h4>
                                <div className="stat-grid">
                                    <div className="stat-item">
                                        <span className="stat-label">{t('clusterMonitor.count')}</span>
                                        <span className="stat-value">{(aggStats?.segments || 0).toLocaleString()}</span>
                                    </div>
                                    <div className="stat-item">
                                        <span className="stat-label">{t('clusterMonitor.memory')}</span>
                                        <span className="stat-value">{formatBytes(aggStats?.segmentMemory || 0)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'nodes' && (
                    <div className="nodes-content">
                        <div className="nodes-table-container">
                            <table className="nodes-table">
                                <thead>
                                    <tr>
                                        <th>{t('clusterMonitor.nodeName')}</th>
                                        <th>{t('clusterMonitor.role')}</th>
                                        <th>{t('clusterMonitor.cpuPercent')}</th>
                                        <th>{t('clusterMonitor.heapPercent')}</th>
                                        <th>{t('clusterMonitor.ramPercent')}</th>
                                        <th>{t('clusterMonitor.diskPercent')}</th>
                                        <th>{t('clusterMonitor.load')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {catNodes.map((node, idx) => (
                                        <tr key={idx}>
                                            <td>
                                                <div className="node-name">
                                                    {node.master === '*' && <span className="master-badge">★</span>}
                                                    {node.name}
                                                </div>
                                                <div className="node-ip">{node.ip}</div>
                                            </td>
                                            <td><code>{node['node.role']}</code></td>
                                            <td>
                                                <div className="progress-cell">
                                                    <div className="mini-progress">
                                                        <div
                                                            className="mini-progress-bar"
                                                            style={{
                                                                width: `${node.cpu || 0}%`,
                                                                backgroundColor: parseInt(node.cpu) > 80 ? 'var(--danger)' : 'var(--success)'
                                                            }}
                                                        />
                                                    </div>
                                                    <span>{node.cpu || 0}%</span>
                                                </div>
                                            </td>
                                            <td>
                                                <div className="progress-cell">
                                                    <div className="mini-progress">
                                                        <div
                                                            className="mini-progress-bar"
                                                            style={{
                                                                width: `${node['heap.percent'] || 0}%`,
                                                                backgroundColor: parseInt(node['heap.percent']) > 80 ? 'var(--danger)' : 'var(--accent)'
                                                            }}
                                                        />
                                                    </div>
                                                    <span>{node['heap.percent'] || 0}%</span>
                                                </div>
                                            </td>
                                            <td>
                                                <div className="progress-cell">
                                                    <div className="mini-progress">
                                                        <div
                                                            className="mini-progress-bar"
                                                            style={{
                                                                width: `${node['ram.percent'] || 0}%`,
                                                                backgroundColor: parseInt(node['ram.percent']) > 90 ? 'var(--danger)' : 'var(--warning)'
                                                            }}
                                                        />
                                                    </div>
                                                    <span>{node['ram.percent'] || 0}%</span>
                                                </div>
                                            </td>
                                            <td>
                                                <div className="progress-cell">
                                                    <div className="mini-progress">
                                                        <div
                                                            className="mini-progress-bar"
                                                            style={{
                                                                width: `${node['disk.used_percent'] || 0}%`,
                                                                backgroundColor: parseFloat(node['disk.used_percent']) > 80 ? 'var(--danger)' : 'var(--accent)'
                                                            }}
                                                        />
                                                    </div>
                                                    <span>{parseFloat(node['disk.used_percent'] || 0).toFixed(1)}%</span>
                                                </div>
                                            </td>
                                            <td>
                                                <span className="load-values">
                                                    {node['load_1m'] || '-'} / {node['load_5m'] || '-'} / {node['load_15m'] || '-'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Per-node detailed stats */}
                        {nodesStats?.nodes && (
                            <div className="nodes-detail-grid">
                                {(Object.entries(nodesStats.nodes) as [string, NodeStats][]).map(([nodeId, node]) => (
                                    <div key={nodeId} className="node-detail-card">
                                        <h4><Server size={16} /> {node.name}</h4>
                                        <div className="node-breakers">
                                            <h5>{t('clusterMonitor.circuitBreakers')}</h5>
                                            <div className="breaker-list">
                                                {node.breaker && Object.entries(node.breaker).map(([name, breaker]) => (
                                                    <div key={name} className="breaker-item">
                                                        <span className="breaker-name">{name}</span>
                                                        <span className="breaker-size">{breaker.estimated_size}</span>
                                                        <span className={`breaker-tripped ${breaker.tripped > 0 ? 'warning' : ''}`}>
                                                            Tripped: {breaker.tripped}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'operations' && (
                    <div className="operations-content">
                        {/* Operations Rate Charts */}
                        <div className="charts-row">
                            <div className="chart-card wide">
                                <h4><ArrowDownToLine size={16} /> {t('clusterMonitor.indexingRate')}</h4>
                                <MiniChart
                                    data={history.indexingRate}
                                    valueKey="rate"
                                    color="var(--accent)"
                                    height={100}
                                    formatValue={(v) => `${v.toFixed(0)}/s`}
                                />
                            </div>

                            <div className="chart-card wide">
                                <h4><Search size={16} /> {t('clusterMonitor.searchRate')}</h4>
                                <MiniChart
                                    data={history.searchRate}
                                    valueKey="rate"
                                    color="var(--success)"
                                    height={100}
                                    formatValue={(v) => `${v.toFixed(0)}/s`}
                                />
                            </div>
                        </div>

                        {/* Operations Stats */}
                        <div className="operations-stats-grid">
                            <div className="op-stat-card">
                                <div className="op-icon"><ArrowDownToLine size={20} /></div>
                                <div className="op-content">
                                    <div className="op-label">{t('clusterMonitor.totalIndexing')}</div>
                                    <div className="op-value">{(aggStats?.indexingOps || 0).toLocaleString()}</div>
                                </div>
                            </div>

                            <div className="op-stat-card">
                                <div className="op-icon"><Search size={20} /></div>
                                <div className="op-content">
                                    <div className="op-label">{t('clusterMonitor.totalSearch')}</div>
                                    <div className="op-value">{(aggStats?.searchOps || 0).toLocaleString()}</div>
                                </div>
                            </div>

                            <div className="op-stat-card">
                                <div className="op-icon"><FileSearch size={20} /></div>
                                <div className="op-content">
                                    <div className="op-label">{t('clusterMonitor.totalGet')}</div>
                                    <div className="op-value">{(aggStats?.getOps || 0).toLocaleString()}</div>
                                </div>
                            </div>

                            <div className="op-stat-card">
                                <div className="op-icon"><Trash2 size={20} /></div>
                                <div className="op-content">
                                    <div className="op-label">{t('clusterMonitor.totalDelete')}</div>
                                    <div className="op-value">{(aggStats?.deleteOps || 0).toLocaleString()}</div>
                                </div>
                            </div>

                            <div className="op-stat-card">
                                <div className="op-icon"><Merge size={20} /></div>
                                <div className="op-content">
                                    <div className="op-label">{t('clusterMonitor.totalMerge')}</div>
                                    <div className="op-value">{(aggStats?.mergeOps || 0).toLocaleString()}</div>
                                </div>
                            </div>

                            <div className="op-stat-card">
                                <div className="op-icon"><RefreshCw size={20} /></div>
                                <div className="op-content">
                                    <div className="op-label">{t('clusterMonitor.totalRefresh')}</div>
                                    <div className="op-value">{(aggStats?.refreshOps || 0).toLocaleString()}</div>
                                </div>
                            </div>

                            <div className="op-stat-card">
                                <div className="op-icon"><HardDrive size={20} /></div>
                                <div className="op-content">
                                    <div className="op-label">{t('clusterMonitor.totalFlush')}</div>
                                    <div className="op-value">{(aggStats?.flushOps || 0).toLocaleString()}</div>
                                </div>
                            </div>
                        </div>

                        {/* Thread Pool Status */}
                        {nodesStats?.nodes && (
                            <div className="thread-pool-section">
                                <h4>{t('clusterMonitor.threadPools')}</h4>
                                {(Object.entries(nodesStats.nodes) as [string, NodeStats][]).map(([nodeId, node]) => (
                                    <div key={nodeId} className="node-thread-pool">
                                        <h5>{node.name}</h5>
                                        <div className="thread-pool-grid">
                                            {node.thread_pool && Object.entries(node.thread_pool)
                                                .filter(([name]) => ['write', 'search', 'get', 'analyze', 'refresh', 'flush', 'force_merge', 'generic'].includes(name))
                                                .map(([name, pool]) => (
                                                    <div key={name} className="thread-pool-item">
                                                        <span className="pool-name">{name}</span>
                                                        <div className="pool-stats">
                                                            <span className="pool-active" title="Active">{pool.active}</span>
                                                            <span className="pool-queue" title="Queue">{pool.queue}</span>
                                                            <span className={`pool-rejected ${pool.rejected > 0 ? 'warning' : ''}`} title="Rejected">
                                                                {pool.rejected}
                                                            </span>
                                                        </div>
                                                    </div>
                                                ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'caches' && (
                    <div className="caches-content">
                        <div className="cache-cards-grid">
                            <div className="cache-card">
                                <h4>{t('clusterMonitor.fieldDataCache')}</h4>
                                <div className="cache-stats">
                                    <div className="cache-stat">
                                        <span className="cache-label">{t('clusterMonitor.memorySize')}</span>
                                        <span className="cache-value">{formatBytes(aggStats?.fieldDataMemory || 0)}</span>
                                    </div>
                                    <div className="cache-stat">
                                        <span className="cache-label">{t('clusterMonitor.evictions')}</span>
                                        <span className={`cache-value ${(aggStats?.fieldDataEvictions || 0) > 0 ? 'warning' : ''}`}>
                                            {(aggStats?.fieldDataEvictions || 0).toLocaleString()}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="cache-card">
                                <h4>{t('clusterMonitor.queryCache')}</h4>
                                <div className="cache-stats">
                                    <div className="cache-stat">
                                        <span className="cache-label">{t('clusterMonitor.memorySize')}</span>
                                        <span className="cache-value">{formatBytes(aggStats?.queryCacheMemory || 0)}</span>
                                    </div>
                                    <div className="cache-stat">
                                        <span className="cache-label">{t('clusterMonitor.evictions')}</span>
                                        <span className={`cache-value ${(aggStats?.queryCacheEvictions || 0) > 0 ? 'warning' : ''}`}>
                                            {(aggStats?.queryCacheEvictions || 0).toLocaleString()}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="cache-card">
                                <h4>{t('clusterMonitor.requestCache')}</h4>
                                <div className="cache-stats">
                                    <div className="cache-stat">
                                        <span className="cache-label">{t('clusterMonitor.memorySize')}</span>
                                        <span className="cache-value">{formatBytes(aggStats?.requestCacheMemory || 0)}</span>
                                    </div>
                                    <div className="cache-stat">
                                        <span className="cache-label">{t('clusterMonitor.evictions')}</span>
                                        <span className={`cache-value ${(aggStats?.requestCacheEvictions || 0) > 0 ? 'warning' : ''}`}>
                                            {(aggStats?.requestCacheEvictions || 0).toLocaleString()}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Per-node cache details */}
                        {nodesStats?.nodes && (
                            <div className="cache-detail-section">
                                <h4>{t('clusterMonitor.cacheByNode')}</h4>
                                <table className="cache-table">
                                    <thead>
                                        <tr>
                                            <th>{t('clusterMonitor.nodeName')}</th>
                                            <th>{t('clusterMonitor.fieldData')}</th>
                                            <th>{t('clusterMonitor.queryCache')}</th>
                                            <th>{t('clusterMonitor.requestCache')}</th>
                                            <th>{t('clusterMonitor.segmentMem')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(Object.entries(nodesStats.nodes) as [string, NodeStats][]).map(([nodeId, node]) => (
                                            <tr key={nodeId}>
                                                <td>{node.name}</td>
                                                <td>{formatBytes(node.indices?.fielddata?.memory_size_in_bytes || 0)}</td>
                                                <td>{formatBytes(node.indices?.query_cache?.memory_size_in_bytes || 0)}</td>
                                                <td>{formatBytes(node.indices?.request_cache?.memory_size_in_bytes || 0)}</td>
                                                <td>{formatBytes(node.indices?.segments?.memory_in_bytes || 0)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'tasks' && (
                    <div className="tasks-content">
                        <div className="tasks-header">
                            <h4><ListTodo size={16} /> {t('clusterMonitor.activeTasks')}</h4>
                            <button
                                className="btn btn-sm btn-secondary"
                                onClick={loadTasks}
                                disabled={tasksLoading}
                            >
                                <RefreshCw size={14} className={tasksLoading ? 'spin' : ''} />
                            </button>
                        </div>

                        {tasksLoading && tasks.length === 0 ? (
                            <div className="tasks-loading">
                                <Loader size={24} className="spin" />
                                <span>{t('common.loading')}</span>
                            </div>
                        ) : tasks.length === 0 ? (
                            <div className="tasks-empty">
                                <CheckCircle size={32} />
                                <p>{t('clusterMonitor.noActiveTasks')}</p>
                            </div>
                        ) : (
                            <div className="tasks-table-container">
                                <table className="tasks-table">
                                    <thead>
                                        <tr>
                                            <th>{t('clusterMonitor.taskAction')}</th>
                                            <th>{t('clusterMonitor.taskNode')}</th>
                                            <th>{t('clusterMonitor.taskProgress')}</th>
                                            <th>{t('clusterMonitor.taskRunning')}</th>
                                            <th>{t('clusterMonitor.taskActions')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {tasks.map((task) => {
                                            const runningMs = Math.floor(task.running_time_in_nanos / 1_000_000);
                                            const runningSeconds = Math.floor(runningMs / 1000);
                                            const runningMinutes = Math.floor(runningSeconds / 60);
                                            const runningHours = Math.floor(runningMinutes / 60);

                                            let runningTimeStr = '';
                                            if (runningHours > 0) {
                                                runningTimeStr = `${runningHours}h ${runningMinutes % 60}m`;
                                            } else if (runningMinutes > 0) {
                                                runningTimeStr = `${runningMinutes}m ${runningSeconds % 60}s`;
                                            } else {
                                                runningTimeStr = `${runningSeconds}s`;
                                            }

                                            const progress = task.status?.total
                                                ? Math.round(((task.status.updated || 0) + (task.status.created || 0) + (task.status.deleted || 0)) / task.status.total * 100)
                                                : null;

                                            const isCancelling = cancellingTasks.has(task.taskId);

                                            return (
                                                <tr key={task.taskId} className={task.cancelled ? 'cancelled' : ''}>
                                                    <td>
                                                        <div className="task-action">
                                                            <code>{task.action}</code>
                                                            {task.description && (
                                                                <span className="task-description" title={task.description}>
                                                                    {task.description.length > 60
                                                                        ? task.description.substring(0, 60) + '...'
                                                                        : task.description}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <span className="task-node">{task.nodeName}</span>
                                                    </td>
                                                    <td>
                                                        {progress !== null ? (
                                                            <div className="task-progress">
                                                                <div className="mini-progress">
                                                                    <div
                                                                        className="mini-progress-bar"
                                                                        style={{
                                                                            width: `${progress}%`,
                                                                            backgroundColor: 'var(--accent)'
                                                                        }}
                                                                    />
                                                                </div>
                                                                <span>{progress}%</span>
                                                            </div>
                                                        ) : (
                                                            <span className="task-no-progress">-</span>
                                                        )}
                                                    </td>
                                                    <td>
                                                        <span className="task-time">{runningTimeStr}</span>
                                                    </td>
                                                    <td>
                                                        {task.cancellable && !task.cancelled ? (
                                                            <button
                                                                className="btn btn-sm btn-danger task-cancel-btn"
                                                                onClick={() => handleCancelTask(task.taskId)}
                                                                disabled={isCancelling}
                                                                title={t('clusterMonitor.cancelTask')}
                                                            >
                                                                {isCancelling ? (
                                                                    <Loader size={14} className="spin" />
                                                                ) : (
                                                                    <X size={14} />
                                                                )}
                                                            </button>
                                                        ) : task.cancelled ? (
                                                            <span className="task-cancelled-badge">
                                                                {t('clusterMonitor.taskCancelled')}
                                                            </span>
                                                        ) : null}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
