/**
 * Generic localStorage utilities with type safety
 */

/**
 * Creates a typed localStorage accessor for a specific key
 */
export function createStorageItem<T>(key: string, defaultValue: T) {
    return {
        get: (): T => {
            try {
                const item = localStorage.getItem(key);
                return item ? JSON.parse(item) : defaultValue;
            } catch {
                return defaultValue;
            }
        },
        set: (value: T): void => {
            try {
                localStorage.setItem(key, JSON.stringify(value));
            } catch (error) {
                console.error(`Failed to save ${key} to localStorage:`, error);
            }
        },
        remove: (): void => {
            localStorage.removeItem(key);
        },
    };
}

/**
 * Creates a numeric localStorage accessor with min/max bounds
 */
export function createNumericStorageItem(
    key: string,
    defaultValue: number,
    min?: number,
    max?: number
) {
    return {
        get: (): number => {
            try {
                const item = localStorage.getItem(key);
                if (item) {
                    const value = parseInt(item, 10);
                    if (!isNaN(value)) {
                        if (min !== undefined && value < min) return defaultValue;
                        if (max !== undefined && value > max) return defaultValue;
                        return value;
                    }
                }
                return defaultValue;
            } catch {
                return defaultValue;
            }
        },
        set: (value: number): void => {
            try {
                localStorage.setItem(key, value.toString());
            } catch (error) {
                console.error(`Failed to save ${key} to localStorage:`, error);
            }
        },
        remove: (): void => {
            localStorage.removeItem(key);
        },
    };
}

/**
 * Creates a string array localStorage accessor
 */
export function createStringArrayStorageItem(key: string, defaultValue: string[] = []) {
    return {
        get: (): string[] => {
            try {
                const item = localStorage.getItem(key);
                return item ? JSON.parse(item) : defaultValue;
            } catch {
                return defaultValue;
            }
        },
        set: (value: string[]): void => {
            try {
                localStorage.setItem(key, JSON.stringify(value));
            } catch (error) {
                console.error(`Failed to save ${key} to localStorage:`, error);
            }
        },
        remove: (): void => {
            localStorage.removeItem(key);
        },
    };
}

// ==================== PRE-DEFINED STORAGE ITEMS ====================

// Sidebar width
export const sidebarWidthStorage = createNumericStorageItem(
    'sidebarWidth',
    280,
    200,
    600
);

// Page size for document list
export const pageSizeStorage = createNumericStorageItem(
    'pageSize',
    50
);

// REST Modal size
export const restModalWidthStorage = createNumericStorageItem(
    'restModalWidth',
    1200,
    600
);

export const restModalHeightStorage = createNumericStorageItem(
    'restModalHeight',
    700,
    400
);

// REST Panel width percentage
export const restPanelWidthStorage = createNumericStorageItem(
    'restPanelWidth',
    50,
    20,
    80
);

// Pinned fields for JSON viewer
export const pinnedFieldsStorage = createStringArrayStorageItem(
    'es_viewer_pinned_fields',
    []
);

// Column configs (indexed by prefix)
export const columnConfigStorage = createStorageItem<Record<string, string[]>>(
    'es_viewer_columns',
    {}
);

// Search field configs (indexed by prefix)
export const searchFieldConfigStorage = createStorageItem<Record<string, string[]>>(
    'es_viewer_search_field',
    {}
);
