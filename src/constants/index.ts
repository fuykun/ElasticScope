/**
 * Application constants
 */

// ==================== PAGINATION ====================

export const PAGE_SIZE_OPTIONS = [10, 50, 100, 1000] as const;
export const DEFAULT_PAGE_SIZE = 10;

// ==================== SIDEBAR ====================

export const DEFAULT_SIDEBAR_WIDTH = 280;
export const MIN_SIDEBAR_WIDTH = 200;
export const MAX_SIDEBAR_WIDTH = 600;

// ==================== REST MODAL ====================

export const DEFAULT_REST_MODAL_WIDTH = 1200;
export const DEFAULT_REST_MODAL_HEIGHT = 700;
export const MIN_REST_MODAL_WIDTH = 600;
export const MIN_REST_MODAL_HEIGHT = 400;

// ==================== CONNECTION COLORS ====================

export const CONNECTION_COLORS = [
    '#3b82f6', // blue
    '#22c55e', // green
    '#eab308', // yellow
    '#ef4444', // red
    '#a855f7', // purple
    '#ec4899', // pink
    '#f97316', // orange
    '#06b6d4', // cyan
] as const;

export const DEFAULT_CONNECTION_COLOR = CONNECTION_COLORS[0];

// ==================== HEALTH STATUS COLORS ====================

export const HEALTH_COLORS = {
    green: '#22c55e',
    yellow: '#eab308',
    red: '#ef4444',
    unknown: '#6b7280',
} as const;

// ==================== API ====================

export const API_URL = 'http://localhost:3001/api';

// ==================== DEFAULT QUERIES ====================

export const DEFAULT_SEARCH_BODY = {
    query: {
        match_all: {}
    },
    size: 10,
    from: 0
};

export const DEFAULT_COUNT_BODY = {
    query: {
        match_all: {}
    }
};

// ==================== JSON VIEWER ====================

export const JSON_VIEWER_DEFAULT_EXPANDED_DEPTH = 2;
export const JSON_PREVIEW_ITEMS_COUNT = 3;
