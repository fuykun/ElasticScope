const STORAGE_KEY = 'es_viewer_columns';
const SEARCH_FIELD_KEY = 'es_viewer_search_field';

export interface ColumnConfig {
    [prefix: string]: string[];
}

export interface SearchFieldConfig {
    [prefix: string]: string[];
}

export const getIndexPrefix = (indexName: string): string => {
    const underscoreIndex = indexName.indexOf('_');
    if (underscoreIndex === -1) {
        return indexName;
    }
    return indexName.substring(0, underscoreIndex);
};

export const getAllColumnConfigs = (): ColumnConfig => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored ? JSON.parse(stored) : {};
    } catch {
        return {};
    }
};

export const getColumnsForPrefix = (prefix: string): string[] | null => {
    const configs = getAllColumnConfigs();
    return configs[prefix] || null;
};

export const saveColumnsForPrefix = (prefix: string, columns: string[]): void => {
    const configs = getAllColumnConfigs();
    configs[prefix] = columns;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(configs));
};

export const removeColumnsForPrefix = (prefix: string): void => {
    const configs = getAllColumnConfigs();
    delete configs[prefix];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(configs));
};

export const extractFieldsFromMapping = (
    mapping: Record<string, any>,
    indexName: string
): string[] => {
    const fields: string[] = [];

    const indexMapping = mapping[indexName]?.mappings?.properties;
    if (indexMapping) {
        for (const fieldName of Object.keys(indexMapping)) {
            fields.push(fieldName);
        }
    }

    return fields.sort();
};

export const extractSearchableFieldsFromMapping = (
    mapping: Record<string, any>,
    indexName: string
): string[] => {
    const fields: string[] = [];

    const indexMapping = mapping[indexName]?.mappings?.properties;
    if (indexMapping) {
        for (const fieldName of Object.keys(indexMapping)) {
            const fieldDef = indexMapping[fieldName];

            if (fieldDef.type === 'object' || fieldDef.type === 'nested') {
                continue;
            }

            if (fieldDef.properties) {
                continue;
            }

            fields.push(fieldName);
        }
    }

    return fields.sort();
};

export const extractSortableFieldsFromMapping = (
    mapping: Record<string, any>,
    indexName: string
): string[] => {
    const fields: string[] = [];

    const sortableTypes = [
        'keyword', 'long', 'integer', 'short', 'byte', 'double', 'float',
        'half_float', 'scaled_float', 'date', 'date_nanos', 'boolean', 'ip'
    ];

    const indexMapping = mapping[indexName]?.mappings?.properties;
    if (indexMapping) {
        for (const fieldName of Object.keys(indexMapping)) {
            const fieldDef = indexMapping[fieldName];
            const fieldType = fieldDef.type;

            if (fieldType === 'object' || fieldType === 'nested') {
                continue;
            }

            if (fieldDef.properties) {
                continue;
            }

            if (fieldType === 'text') {
                if (fieldDef.fields?.keyword) {
                    fields.push(`${fieldName}.keyword`);
                }
                continue;
            }

            if (sortableTypes.includes(fieldType)) {
                fields.push(fieldName);
            }
        }
    }

    return fields.sort();
};

// ==================== SEARCH FIELD STORAGE ====================

export const getAllSearchFieldConfigs = (): SearchFieldConfig => {
    try {
        const stored = localStorage.getItem(SEARCH_FIELD_KEY);
        return stored ? JSON.parse(stored) : {};
    } catch {
        return {};
    }
};

export const getSearchFieldsForPrefix = (prefix: string): string[] => {
    const configs = getAllSearchFieldConfigs();
    return configs[prefix] || [];
};

export const saveSearchFieldsForPrefix = (prefix: string, fields: string[]): void => {
    const configs = getAllSearchFieldConfigs();
    configs[prefix] = fields;
    localStorage.setItem(SEARCH_FIELD_KEY, JSON.stringify(configs));
};

export const removeSearchFieldsForPrefix = (prefix: string): void => {
    const configs = getAllSearchFieldConfigs();
    delete configs[prefix];
    localStorage.setItem(SEARCH_FIELD_KEY, JSON.stringify(configs));
};