import i18n from '../i18n';

/**
 * Common formatting utilities
 */

/**
 * Format bytes to human readable string
 */
export const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Format uptime in milliseconds to human readable string
 */
export const formatUptime = (millis: number): string => {
    const seconds = Math.floor(millis / 1000);
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) return `${days}g ${hours}s`;
    if (hours > 0) return `${hours}s ${minutes}d`;
    return `${minutes}d`;
};

/**
 * Format timestamp to locale date string
 */
export const formatDate = (timestamp: number | null | undefined): string => {
    if (!timestamp) return '-';
    const locale = i18n.language === 'tr' ? 'tr-TR' : 'en-US';
    return new Date(timestamp).toLocaleDateString(locale, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};

/**
 * Format timestamp to relative time (e.g., "2d", "3w", "5mo")
 */
export const formatRelativeDate = (timestamp: number | null): string => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return i18n.t('common.today');
    if (diffDays === 1) return i18n.t('common.yesterday');
    if (diffDays < 7) return i18n.t('common.daysAgo', { count: diffDays });
    if (diffDays < 30) return i18n.t('common.weeksAgo', { count: Math.floor(diffDays / 7) });
    if (diffDays < 365) return i18n.t('common.monthsAgo', { count: Math.floor(diffDays / 30) });
    return i18n.t('common.yearsAgo', { count: Math.floor(diffDays / 365) });
};

/**
 * Format document count to localized string
 */
export const formatDocCount = (count: string | number | undefined): string => {
    if (!count) return '0';
    const num = typeof count === 'string' ? parseInt(count, 10) : count;
    const locale = i18n.language === 'tr' ? 'tr-TR' : 'en-US';
    return num.toLocaleString(locale);
};

/**
 * Format large numbers with K/M suffix
 */
export const formatCompactNumber = (count: string | number): string => {
    const num = typeof count === 'string' ? parseInt(count, 10) : count;
    if (!num) return '0';
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
};

/**
 * Format percentage with bounds coloring hint
 */
export const getPercentageColorClass = (percent: number): 'success' | 'warning' | 'danger' => {
    if (percent >= 90) return 'danger';
    if (percent >= 70) return 'warning';
    return 'success';
};
