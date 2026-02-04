import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Plus,
    Trash2,
    ChevronDown,
    Search,
    Check,
    X,
    Play,
    Code,
    Copy,
    RotateCcw,
    Layers,
    Filter,
} from 'lucide-react';

// Field metadata extracted from mapping
export interface FieldInfo {
    name: string;
    type: string;
    isNested: boolean;
    nestedPath?: string;
    isArray?: boolean;
    fields?: Record<string, FieldInfo>; // sub-fields like .keyword
}

// Operators for different field types
type OperatorType =
    | 'equals'
    | 'not_equals'
    | 'contains'
    | 'not_contains'
    | 'starts_with'
    | 'ends_with'
    | 'in'
    | 'not_in'
    | 'exists'
    | 'not_exists'
    | 'gt'
    | 'gte'
    | 'lt'
    | 'lte'
    | 'between'
    | 'regex';

interface Operator {
    value: OperatorType;
    label: string;
    needsValue: boolean;
    needsSecondValue?: boolean; // for 'between'
    applicableTypes: string[];
}

// Single condition
export interface QueryCondition {
    id: string;
    field: string;
    operator: OperatorType;
    value: string;
    value2?: string; // for 'between' operator
}

// Condition group (AND/OR)
export interface QueryGroup {
    id: string;
    logic: 'AND' | 'OR';
    conditions: QueryCondition[];
    groups: QueryGroup[]; // nested groups
}

interface QueryBuilderProps {
    fields: FieldInfo[];
    onQueryChange: (query: object | null) => void;
    onSearch: (query: object | null) => void;
    rootGroup: QueryGroup;
    onRootGroupChange: (group: QueryGroup) => void;
}

// Generate unique ID
const generateId = () => Math.random().toString(36).substring(2, 9);

// All available operators
const ALL_OPERATORS: Operator[] = [
    { value: 'equals', label: 'queryBuilder.operators.equals', needsValue: true, applicableTypes: ['keyword', 'text', 'integer', 'long', 'float', 'double', 'boolean', 'date', 'short', 'byte'] },
    { value: 'not_equals', label: 'queryBuilder.operators.notEquals', needsValue: true, applicableTypes: ['keyword', 'text', 'integer', 'long', 'float', 'double', 'boolean', 'date', 'short', 'byte'] },
    { value: 'contains', label: 'queryBuilder.operators.contains', needsValue: true, applicableTypes: ['text', 'keyword'] },
    { value: 'not_contains', label: 'queryBuilder.operators.notContains', needsValue: true, applicableTypes: ['text', 'keyword'] },
    { value: 'starts_with', label: 'queryBuilder.operators.startsWith', needsValue: true, applicableTypes: ['keyword', 'text'] },
    { value: 'ends_with', label: 'queryBuilder.operators.endsWith', needsValue: true, applicableTypes: ['keyword', 'text'] },
    { value: 'in', label: 'queryBuilder.operators.in', needsValue: true, applicableTypes: ['keyword', 'text', 'integer', 'long', 'float', 'double', 'short', 'byte'] },
    { value: 'not_in', label: 'queryBuilder.operators.notIn', needsValue: true, applicableTypes: ['keyword', 'text', 'integer', 'long', 'float', 'double', 'short', 'byte'] },
    { value: 'exists', label: 'queryBuilder.operators.exists', needsValue: false, applicableTypes: ['keyword', 'text', 'integer', 'long', 'float', 'double', 'boolean', 'date', 'object', 'nested', 'short', 'byte'] },
    { value: 'not_exists', label: 'queryBuilder.operators.notExists', needsValue: false, applicableTypes: ['keyword', 'text', 'integer', 'long', 'float', 'double', 'boolean', 'date', 'object', 'nested', 'short', 'byte'] },
    { value: 'gt', label: 'queryBuilder.operators.greaterThan', needsValue: true, applicableTypes: ['integer', 'long', 'float', 'double', 'date', 'short', 'byte'] },
    { value: 'gte', label: 'queryBuilder.operators.greaterThanOrEqual', needsValue: true, applicableTypes: ['integer', 'long', 'float', 'double', 'date', 'short', 'byte'] },
    { value: 'lt', label: 'queryBuilder.operators.lessThan', needsValue: true, applicableTypes: ['integer', 'long', 'float', 'double', 'date', 'short', 'byte'] },
    { value: 'lte', label: 'queryBuilder.operators.lessThanOrEqual', needsValue: true, applicableTypes: ['integer', 'long', 'float', 'double', 'date', 'short', 'byte'] },
    { value: 'between', label: 'queryBuilder.operators.between', needsValue: true, needsSecondValue: true, applicableTypes: ['integer', 'long', 'float', 'double', 'date', 'short', 'byte'] },
    { value: 'regex', label: 'queryBuilder.operators.regex', needsValue: true, applicableTypes: ['keyword', 'text'] },
];

// Searchable Select Component
interface SearchableSelectProps {
    value: string;
    onChange: (value: string) => void;
    options: { value: string; label: string; type?: string }[];
    placeholder?: string;
    className?: string;
    disabled?: boolean;
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({
    value,
    onChange,
    options,
    placeholder = 'Select...',
    className = '',
    disabled = false,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const filteredOptions = options.filter(opt =>
        opt.label.toLowerCase().includes(search.toLowerCase()) ||
        opt.value.toLowerCase().includes(search.toLowerCase())
    );

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
                setSearch('');
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    const handleSelect = (val: string) => {
        onChange(val);
        setIsOpen(false);
        setSearch('');
    };

    const selectedOption = options.find(o => o.value === value);

    return (
        <div className={`qb-searchable-select ${className} ${disabled ? 'disabled' : ''}`} ref={containerRef}>
            <button
                type="button"
                className="qb-searchable-select-trigger"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
            >
                <span className={selectedOption ? '' : 'placeholder'}>
                    {selectedOption?.label || placeholder}
                </span>
                <ChevronDown size={12} style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
            </button>
            {isOpen && (
                <div className="qb-searchable-select-dropdown">
                    <div className="qb-searchable-select-search">
                        <Search size={14} />
                        <input
                            ref={inputRef}
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search..."
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>
                    <div className="qb-searchable-select-options">
                        {filteredOptions.length === 0 ? (
                            <div className="qb-searchable-select-no-results">No results</div>
                        ) : (
                            filteredOptions.map(opt => (
                                <button
                                    key={opt.value}
                                    type="button"
                                    className={`qb-searchable-select-option ${opt.value === value ? 'selected' : ''}`}
                                    onClick={() => handleSelect(opt.value)}
                                >
                                    <span className="option-label">{opt.label}</span>
                                    {opt.type && <span className="option-type">{opt.type}</span>}
                                    {opt.value === value && <Check size={12} />}
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

// Extract all fields from mapping recursively
export const extractFieldsFromMappingWithTypes = (
    mapping: Record<string, any>,
    indexName: string
): FieldInfo[] => {
    const fields: FieldInfo[] = [];
    const properties = mapping[indexName]?.mappings?.properties || {};

    const traverse = (obj: Record<string, any>, parentPath: string, nestedPath?: string) => {
        for (const [key, value] of Object.entries(obj)) {
            if (!value || typeof value !== 'object') continue;

            const fieldPath = parentPath ? `${parentPath}.${key}` : key;
            const isNested = value.type === 'nested';
            const currentNestedPath = isNested ? fieldPath : nestedPath;

            const fieldInfo: FieldInfo = {
                name: fieldPath,
                type: value.type || 'object',
                isNested: isNested,
                nestedPath: nestedPath,
            };

            // Check for .keyword sub-field
            if (value.fields?.keyword) {
                fieldInfo.fields = {
                    keyword: {
                        name: `${fieldPath}.keyword`,
                        type: 'keyword',
                        isNested: false,
                        nestedPath: nestedPath,
                    }
                };
            }

            fields.push(fieldInfo);

            // Traverse nested properties
            if (value.properties) {
                traverse(value.properties, fieldPath, currentNestedPath);
            }
        }
    };

    traverse(properties, '', undefined);
    return fields.sort((a, b) => a.name.localeCompare(b.name));
};

// Build Elasticsearch query from QueryGroup
const buildElasticsearchQuery = (group: QueryGroup, fields: FieldInfo[]): object | null => {
    const clauses: object[] = [];

    // Process conditions
    for (const condition of group.conditions) {
        if (!condition.field) continue;

        const fieldInfo = fields.find(f => f.name === condition.field || f.fields?.keyword?.name === condition.field);
        const clause = buildConditionClause(condition, fieldInfo);
        if (clause) {
            clauses.push(clause);
        }
    }

    // Process nested groups
    for (const nestedGroup of group.groups) {
        const nestedQuery = buildElasticsearchQuery(nestedGroup, fields);
        if (nestedQuery) {
            clauses.push(nestedQuery);
        }
    }

    if (clauses.length === 0) return null;
    if (clauses.length === 1) return clauses[0];

    return {
        bool: {
            [group.logic === 'AND' ? 'must' : 'should']: clauses,
            ...(group.logic === 'OR' ? { minimum_should_match: 1 } : {})
        }
    };
};

// Build single condition clause
const buildConditionClause = (condition: QueryCondition, fieldInfo?: FieldInfo): object | null => {
    const { field, operator, value, value2 } = condition;
    if (!field) return null;

    // Determine if we need nested query wrapper
    const needsNestedWrapper = fieldInfo?.nestedPath;

    let clause: object | null = null;

    // Parse value for numeric/boolean fields
    const parseValue = (val: string, type?: string): any => {
        if (!type) return val;
        if (type === 'boolean') return val.toLowerCase() === 'true';
        if (['integer', 'long', 'short', 'byte'].includes(type)) return parseInt(val, 10);
        if (['float', 'double'].includes(type)) return parseFloat(val);
        return val;
    };

    const parsedValue = parseValue(value, fieldInfo?.type);
    const parsedValue2 = value2 ? parseValue(value2, fieldInfo?.type) : undefined;

    switch (operator) {
        case 'equals':
            clause = { term: { [field]: parsedValue } };
            break;
        case 'not_equals':
            clause = { bool: { must_not: [{ term: { [field]: parsedValue } }] } };
            break;
        case 'contains':
            clause = { match_phrase: { [field]: value } };
            break;
        case 'not_contains':
            clause = { bool: { must_not: [{ match_phrase: { [field]: value } }] } };
            break;
        case 'starts_with':
            clause = { prefix: { [field]: value } };
            break;
        case 'ends_with':
            clause = { wildcard: { [field]: `*${value}` } };
            break;
        case 'in': {
            // Parse comma-separated values
            const values = value.split(',').map(v => parseValue(v.trim(), fieldInfo?.type));
            clause = { terms: { [field]: values } };
            break;
        }
        case 'not_in': {
            const values = value.split(',').map(v => parseValue(v.trim(), fieldInfo?.type));
            clause = { bool: { must_not: [{ terms: { [field]: values } }] } };
            break;
        }
        case 'exists':
            clause = { exists: { field } };
            break;
        case 'not_exists':
            clause = { bool: { must_not: [{ exists: { field } }] } };
            break;
        case 'gt':
            clause = { range: { [field]: { gt: parsedValue } } };
            break;
        case 'gte':
            clause = { range: { [field]: { gte: parsedValue } } };
            break;
        case 'lt':
            clause = { range: { [field]: { lt: parsedValue } } };
            break;
        case 'lte':
            clause = { range: { [field]: { lte: parsedValue } } };
            break;
        case 'between':
            clause = { range: { [field]: { gte: parsedValue, lte: parsedValue2 } } };
            break;
        case 'regex':
            clause = { regexp: { [field]: value } };
            break;
        default:
            return null;
    }

    // Wrap in nested query if needed
    if (needsNestedWrapper && clause) {
        return {
            nested: {
                path: fieldInfo?.nestedPath,
                query: clause
            }
        };
    }

    return clause;
};

// Create empty group
export const createEmptyGroup = (): QueryGroup => ({
    id: generateId(),
    logic: 'AND',
    conditions: [],
    groups: [],
});

// Create empty condition
const createEmptyCondition = (): QueryCondition => ({
    id: generateId(),
    field: '',
    operator: 'equals',
    value: '',
});

export const QueryBuilder: React.FC<QueryBuilderProps> = ({
    fields,
    onQueryChange,
    onSearch,
    rootGroup,
    onRootGroupChange,
}) => {
    const { t } = useTranslation();
    const [showJsonPreview, setShowJsonPreview] = useState(false);
    const [generatedQuery, setGeneratedQuery] = useState<object | null>(null);

    // Update generated query when rootGroup changes
    useEffect(() => {
        const query = buildElasticsearchQuery(rootGroup, fields);
        setGeneratedQuery(query);
        onQueryChange(query);
    }, [rootGroup, fields]);

    // Convert fields to select options
    const fieldOptions = fields.map(f => ({
        value: f.name,
        label: f.name,
        type: f.type,
    }));

    // Get operators for a field type
    const getOperatorsForField = (fieldName: string): Operator[] => {
        const field = fields.find(f => f.name === fieldName);
        if (!field) return ALL_OPERATORS;
        return ALL_OPERATORS.filter(op => op.applicableTypes.includes(field.type));
    };

    // Update root group and generate query
    const updateGroup = useCallback((newGroup: QueryGroup) => {
        onRootGroupChange(newGroup);
    }, [onRootGroupChange]);

    // Update condition in group
    const updateCondition = (groupId: string, conditionId: string, updates: Partial<QueryCondition>) => {
        const updateInGroup = (group: QueryGroup): QueryGroup => {
            if (group.id === groupId) {
                return {
                    ...group,
                    conditions: group.conditions.map(c =>
                        c.id === conditionId ? { ...c, ...updates } : c
                    ),
                };
            }
            return {
                ...group,
                groups: group.groups.map(updateInGroup),
            };
        };
        updateGroup(updateInGroup(rootGroup));
    };

    // Add condition to group
    const addCondition = (groupId: string) => {
        const addToGroup = (group: QueryGroup): QueryGroup => {
            if (group.id === groupId) {
                return {
                    ...group,
                    conditions: [...group.conditions, createEmptyCondition()],
                };
            }
            return {
                ...group,
                groups: group.groups.map(addToGroup),
            };
        };
        updateGroup(addToGroup(rootGroup));
    };

    // Remove condition from group
    const removeCondition = (groupId: string, conditionId: string) => {
        const removeFromGroup = (group: QueryGroup): QueryGroup => {
            if (group.id === groupId) {
                return {
                    ...group,
                    conditions: group.conditions.filter(c => c.id !== conditionId),
                };
            }
            return {
                ...group,
                groups: group.groups.map(removeFromGroup),
            };
        };
        updateGroup(removeFromGroup(rootGroup));
    };

    // Add nested group
    const addGroup = (parentGroupId: string) => {
        const addToGroup = (group: QueryGroup): QueryGroup => {
            if (group.id === parentGroupId) {
                return {
                    ...group,
                    groups: [...group.groups, createEmptyGroup()],
                };
            }
            return {
                ...group,
                groups: group.groups.map(addToGroup),
            };
        };
        updateGroup(addToGroup(rootGroup));
    };

    // Remove nested group
    const removeGroup = (parentGroupId: string, groupId: string) => {
        const removeFromGroup = (group: QueryGroup): QueryGroup => {
            if (group.id === parentGroupId) {
                return {
                    ...group,
                    groups: group.groups.filter(g => g.id !== groupId),
                };
            }
            return {
                ...group,
                groups: group.groups.map(removeFromGroup),
            };
        };
        updateGroup(removeFromGroup(rootGroup));
    };

    // Toggle group logic (AND/OR)
    const toggleGroupLogic = (groupId: string) => {
        const toggleInGroup = (group: QueryGroup): QueryGroup => {
            if (group.id === groupId) {
                return {
                    ...group,
                    logic: group.logic === 'AND' ? 'OR' : 'AND',
                };
            }
            return {
                ...group,
                groups: group.groups.map(toggleInGroup),
            };
        };
        updateGroup(toggleInGroup(rootGroup));
    };

    // Reset query builder
    const handleReset = () => {
        const emptyGroup = createEmptyGroup();
        onRootGroupChange(emptyGroup);
        setGeneratedQuery(null);
        onQueryChange(null);
    };

    // Execute search
    const handleSearch = () => {
        onSearch(generatedQuery);
    };

    // Copy query to clipboard
    const handleCopyQuery = () => {
        if (generatedQuery) {
            navigator.clipboard.writeText(JSON.stringify(generatedQuery, null, 2));
        }
    };

    // Render a single condition row
    const renderCondition = (groupId: string, condition: QueryCondition, isLast: boolean, logic: 'AND' | 'OR') => {
        const operators = getOperatorsForField(condition.field);
        const selectedOperator = ALL_OPERATORS.find(op => op.value === condition.operator);

        return (
            <div key={condition.id} className="qb-condition">
                <div className="qb-condition-row">
                    <SearchableSelect
                        value={condition.field}
                        onChange={(field) => {
                            // Reset operator if not applicable to new field type
                            const newOperators = getOperatorsForField(field);
                            const currentOpValid = newOperators.some(op => op.value === condition.operator);
                            updateCondition(groupId, condition.id, {
                                field,
                                operator: currentOpValid ? condition.operator : 'equals',
                                value: '',
                                value2: undefined,
                            });
                        }}
                        options={fieldOptions}
                        placeholder={t('queryBuilder.selectField')}
                        className="qb-field-select"
                    />

                    <SearchableSelect
                        value={condition.operator}
                        onChange={(operator) => updateCondition(groupId, condition.id, {
                            operator: operator as OperatorType,
                            value2: undefined,
                        })}
                        options={operators.map(op => ({ value: op.value, label: t(op.label) }))}
                        placeholder={t('queryBuilder.selectOperator')}
                        className="qb-operator-select"
                        disabled={!condition.field}
                    />

                    {selectedOperator?.needsValue && (
                        <input
                            type="text"
                            className="qb-value-input"
                            value={condition.value}
                            onChange={(e) => updateCondition(groupId, condition.id, { value: e.target.value })}
                            placeholder={
                                condition.operator === 'in' || condition.operator === 'not_in'
                                    ? t('queryBuilder.enterValuesCommaSeparated')
                                    : t('queryBuilder.enterValue')
                            }
                            disabled={!condition.field}
                        />
                    )}

                    {selectedOperator?.needsSecondValue && (
                        <>
                            <span className="qb-and-label">{t('queryBuilder.and')}</span>
                            <input
                                type="text"
                                className="qb-value-input"
                                value={condition.value2 || ''}
                                onChange={(e) => updateCondition(groupId, condition.id, { value2: e.target.value })}
                                placeholder={t('queryBuilder.enterValue')}
                                disabled={!condition.field}
                            />
                        </>
                    )}

                    <button
                        className="qb-remove-btn"
                        onClick={() => removeCondition(groupId, condition.id)}
                        title={t('queryBuilder.removeCondition')}
                    >
                        <X size={14} />
                    </button>
                </div>

                {!isLast && (
                    <div className="qb-logic-indicator">
                        <span className={`qb-logic-badge ${logic.toLowerCase()}`}>{logic}</span>
                    </div>
                )}
            </div>
        );
    };

    // Render a group (recursive)
    const renderGroup = (group: QueryGroup, isRoot: boolean = false, parentId?: string) => {
        const hasContent = group.conditions.length > 0 || group.groups.length > 0;

        return (
            <div key={group.id} className={`qb-group ${isRoot ? 'qb-root-group' : 'qb-nested-group'}`}>
                <div className="qb-group-header">
                    <button
                        className={`qb-logic-toggle ${group.logic.toLowerCase()}`}
                        onClick={() => toggleGroupLogic(group.id)}
                        title={t('queryBuilder.toggleLogic')}
                    >
                        <Layers size={14} />
                        {group.logic}
                    </button>

                    <div className="qb-group-actions">
                        <button
                            className="qb-add-btn"
                            onClick={() => addCondition(group.id)}
                            title={t('queryBuilder.addCondition')}
                        >
                            <Filter size={14} />
                            {t('queryBuilder.addCondition')}
                        </button>
                        <button
                            className="qb-add-btn"
                            onClick={() => addGroup(group.id)}
                            title={t('queryBuilder.addGroup')}
                        >
                            <Layers size={14} />
                            {t('queryBuilder.addGroup')}
                        </button>
                        {!isRoot && parentId && (
                            <button
                                className="qb-remove-btn"
                                onClick={() => removeGroup(parentId, group.id)}
                                title={t('queryBuilder.removeGroup')}
                            >
                                <Trash2 size={14} />
                            </button>
                        )}
                    </div>
                </div>

                <div className="qb-group-content">
                    {group.conditions.map((condition, index) =>
                        renderCondition(group.id, condition, index === group.conditions.length - 1 && group.groups.length === 0, group.logic)
                    )}

                    {group.groups.map((nestedGroup, index) => (
                        <React.Fragment key={nestedGroup.id}>
                            {(group.conditions.length > 0 || index > 0) && (
                                <div className="qb-logic-indicator">
                                    <span className={`qb-logic-badge ${group.logic.toLowerCase()}`}>{group.logic}</span>
                                </div>
                            )}
                            {renderGroup(nestedGroup, false, group.id)}
                        </React.Fragment>
                    ))}

                    {!hasContent && (
                        <div className="qb-empty-group">
                            <p>{t('queryBuilder.emptyGroup')}</p>
                            <button
                                className="qb-add-btn primary"
                                onClick={() => addCondition(group.id)}
                            >
                                <Plus size={14} />
                                {t('queryBuilder.addFirstCondition')}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="query-builder">
            <div className="qb-header">
                <h3 className="qb-title">
                    <Filter size={16} />
                    {t('queryBuilder.title')}
                </h3>
                <div className="qb-header-actions">
                    <button
                        className={`qb-preview-btn ${showJsonPreview ? 'active' : ''}`}
                        onClick={() => setShowJsonPreview(!showJsonPreview)}
                        title={t('queryBuilder.togglePreview')}
                    >
                        <Code size={14} />
                        {t('queryBuilder.preview')}
                    </button>
                    <button
                        className="qb-reset-btn"
                        onClick={handleReset}
                        title={t('queryBuilder.reset')}
                    >
                        <RotateCcw size={14} />
                        {t('queryBuilder.reset')}
                    </button>
                </div>
            </div>

            <div className="qb-body">
                {renderGroup(rootGroup, true)}

                {showJsonPreview && (
                    <div className="qb-json-preview">
                        <div className="qb-preview-header">
                            <span>{t('queryBuilder.generatedQuery')}</span>
                            <button
                                className="qb-copy-btn"
                                onClick={handleCopyQuery}
                                disabled={!generatedQuery}
                                title={t('queryBuilder.copyQuery')}
                            >
                                <Copy size={12} />
                            </button>
                        </div>
                        <pre className="qb-preview-code">
                            {generatedQuery
                                ? JSON.stringify(generatedQuery, null, 2)
                                : t('queryBuilder.noQuery')}
                        </pre>
                    </div>
                )}
            </div>

            <div className="qb-footer">
                <button
                    className="btn btn-primary qb-search-btn"
                    onClick={handleSearch}
                    disabled={!generatedQuery}
                >
                    <Play size={14} />
                    {t('queryBuilder.search')}
                </button>
            </div>
        </div>
    );
};

export default QueryBuilder;
