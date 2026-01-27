import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Calendar,
    X,
    ChevronDown,
    Filter,
    Plus,
    Check,
    Loader,
} from 'lucide-react';
import { getAggregations, AggregationBucket } from '../api/elasticsearchClient';
import type { QuickFilter, Facet } from '../types';

interface QuickFiltersProps {
    indexName: string;
    dateFields: string[];
    keywordFields: string[];
    activeFilters: QuickFilter[];
    onFiltersChange: (filters: QuickFilter[]) => void;
    onQueryChange: (query: object | null) => void;
}

const DATE_QUICK_FILTERS = [
    { id: 'today', key: 'today', from: 'now/d', to: 'now' },
    { id: 'yesterday', key: 'yesterday', from: 'now-1d/d', to: 'now/d' },
    { id: 'last_7_days', key: 'last7Days', from: 'now-7d/d', to: 'now' },
    { id: 'last_30_days', key: 'last30Days', from: 'now-30d/d', to: 'now' },
    { id: 'this_month', key: 'thisMonth', from: 'now/M', to: 'now' },
];

export const QuickFilters: React.FC<QuickFiltersProps> = ({
    indexName,
    dateFields,
    keywordFields,
    activeFilters,
    onFiltersChange,
    onQueryChange,
}) => {
    const { t } = useTranslation();
    const [facets, setFacets] = useState<Facet[]>([]);
    const [loadingFacets, setLoadingFacets] = useState(false);
    const [selectedDateField, setSelectedDateField] = useState<string>(dateFields[0] || '');
    const [showAddFilter, setShowAddFilter] = useState(false);
    const [addFilterField, setAddFilterField] = useState('');
    const [addFilterValue, setAddFilterValue] = useState('');
    const addFilterRef = useRef<HTMLDivElement>(null);

    // Load facets on mount and when filters change
    useEffect(() => {
        if (keywordFields.length > 0) {
            loadFacets();
        }
    }, [indexName, keywordFields]);

    useEffect(() => {
        if (dateFields.length > 0 && !selectedDateField) {
            setSelectedDateField(dateFields[0]);
        }
    }, [dateFields]);

    // Close add filter dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (addFilterRef.current && !addFilterRef.current.contains(event.target as Node)) {
                setShowAddFilter(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const loadFacets = async () => {
        if (keywordFields.length === 0) return;

        setLoadingFacets(true);
        try {
            const currentQuery = buildQueryFromFilters(activeFilters);
            const result = await getAggregations(
                indexName,
                keywordFields.slice(0, 5), // Max 5 facets
                selectedDateField || undefined,
                currentQuery || undefined
            );

            const newFacets: Facet[] = [];
            if (result.aggregations) {
                for (const field of keywordFields.slice(0, 5)) {
                    if (result.aggregations[field]?.buckets) {
                        newFacets.push({
                            field,
                            buckets: result.aggregations[field].buckets.map((b: AggregationBucket) => ({
                                ...b,
                                selected: activeFilters.some(
                                    f => f.type === 'term' && f.field === field && f.value === b.key
                                ),
                            })),
                        });
                    }
                }
            }
            setFacets(newFacets);
        } catch (error) {
            console.error('Facet yüklenemedi:', error);
        } finally {
            setLoadingFacets(false);
        }
    };

    const buildQueryFromFilters = (filters: QuickFilter[]): object | null => {
        if (filters.length === 0) return null;

        const must: object[] = [];

        for (const filter of filters) {
            if (filter.type === 'date') {
                must.push({
                    range: {
                        [filter.field]: {
                            gte: filter.value.from,
                            lte: filter.value.to,
                        },
                    },
                });
            } else if (filter.type === 'term') {
                must.push({
                    term: {
                        [filter.field]: filter.value,
                    },
                });
            } else if (filter.type === 'custom') {
                must.push(filter.query);
            }
        }

        return must.length === 1 ? must[0] : { bool: { must } };
    };

    const handleDateFilterClick = (dateFilter: typeof DATE_QUICK_FILTERS[0]) => {
        if (!selectedDateField) return;

        const existingIndex = activeFilters.findIndex(
            f => f.type === 'date' && f.id === dateFilter.id
        );

        let newFilters: QuickFilter[];
        if (existingIndex >= 0) {
            // Remove filter
            newFilters = activeFilters.filter((_, i) => i !== existingIndex);
        } else {
            // Remove other date filters and add this one
            newFilters = activeFilters.filter(f => f.type !== 'date');
            newFilters.push({
                id: dateFilter.id,
                type: 'date',
                field: selectedDateField,
                label: t(`indexPage.filters.${dateFilter.key}`),
                value: { from: dateFilter.from, to: dateFilter.to },
                query: {
                    range: {
                        [selectedDateField]: {
                            gte: dateFilter.from,
                            lte: dateFilter.to,
                        },
                    },
                },
            });
        }

        onFiltersChange(newFilters);
        onQueryChange(buildQueryFromFilters(newFilters));
    };

    const handleFacetClick = (field: string, value: string, label: string) => {
        const filterId = `${field}:${value}`;
        const existingIndex = activeFilters.findIndex(f => f.id === filterId);

        // Hide .keyword suffix in display label
        const displayField = field.endsWith('.keyword') ? field.replace('.keyword', '') : field;

        let newFilters: QuickFilter[];
        if (existingIndex >= 0) {
            newFilters = activeFilters.filter((_, i) => i !== existingIndex);
        } else {
            newFilters = [
                ...activeFilters,
                {
                    id: filterId,
                    type: 'term',
                    field,
                    label: `${displayField}: ${label}`,
                    value,
                    query: { term: { [field]: value } },
                },
            ];
        }

        onFiltersChange(newFilters);
        onQueryChange(buildQueryFromFilters(newFilters));
    };

    const handleRemoveFilter = (filterId: string) => {
        const newFilters = activeFilters.filter(f => f.id !== filterId);
        onFiltersChange(newFilters);
        onQueryChange(buildQueryFromFilters(newFilters));
    };

    const handleClearAllFilters = () => {
        onFiltersChange([]);
        onQueryChange(null);
    };

    const handleAddCustomFilter = () => {
        if (!addFilterField || !addFilterValue) return;

        const filterId = `custom:${addFilterField}:${addFilterValue}`;
        const newFilter: QuickFilter = {
            id: filterId,
            type: 'term',
            field: addFilterField,
            label: `${addFilterField}: ${addFilterValue}`,
            value: addFilterValue,
            query: { term: { [addFilterField]: addFilterValue } },
        };

        const newFilters = [...activeFilters, newFilter];
        onFiltersChange(newFilters);
        onQueryChange(buildQueryFromFilters(newFilters));

        setAddFilterField('');
        setAddFilterValue('');
        setShowAddFilter(false);
    };

    const isDateFilterActive = (dateFilterId: string) => {
        return activeFilters.some(f => f.type === 'date' && f.id === dateFilterId);
    };

    return (
        <div className="quick-filters">
            {/* Date Quick Filters */}
            {dateFields.length > 0 && (
                <div className="quick-filters-section">
                    <div className="quick-filters-row">
                        <div className="quick-filters-date-selector">
                            <Calendar size={14} />
                            <select
                                value={selectedDateField}
                                onChange={(e) => setSelectedDateField(e.target.value)}
                                className="date-field-select"
                            >
                                {dateFields.map(field => (
                                    <option key={field} value={field}>{field}</option>
                                ))}
                            </select>
                        </div>

                        <div className="quick-filters-chips">
                            {DATE_QUICK_FILTERS.map(df => (
                                <button
                                    key={df.id}
                                    className={`quick-filter-chip ${isDateFilterActive(df.id) ? 'active' : ''}`}
                                    onClick={() => handleDateFilterClick(df)}
                                >
                                    {t(`indexPage.filters.${df.key}`)}
                                    {isDateFilterActive(df.id) && <Check size={12} />}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Facets */}
            {facets.length > 0 && (
                <div className="quick-filters-section">
                    <div className="quick-filters-facets">
                        {loadingFacets ? (
                            <div className="facets-loading">
                                <Loader size={14} className="spin" />
                            </div>
                        ) : (
                            facets.map(facet => {
                                // Hide .keyword suffix in display
                                const displayField = facet.field.endsWith('.keyword')
                                    ? facet.field.replace('.keyword', '')
                                    : facet.field;
                                return (
                                    <div key={facet.field} className="facet-group">
                                        <span className="facet-label">{displayField}:</span>
                                        <div className="facet-values">
                                            {facet.buckets.slice(0, 5).map(bucket => {
                                                const isSelected = activeFilters.some(
                                                    f => f.type === 'term' && f.field === facet.field && f.value === bucket.key
                                                );
                                                return (
                                                    <button
                                                        key={bucket.key}
                                                        className={`facet-chip ${isSelected ? 'active' : ''}`}
                                                        onClick={() => handleFacetClick(facet.field, bucket.key, bucket.key)}
                                                    >
                                                        {bucket.key}
                                                        <span className="facet-count">{bucket.doc_count}</span>
                                                        {isSelected && <Check size={10} />}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}

            {/* Active Filters */}
            {activeFilters.length > 0 && (
                <div className="quick-filters-section active-filters-section">
                    <div className="active-filters-header">
                        <Filter size={14} />
                        <span>{t('indexPage.filters.activeFilters')}</span>
                        <button
                            className="clear-all-btn"
                            onClick={handleClearAllFilters}
                        >
                            {t('indexPage.filters.clearAll')}
                        </button>
                    </div>
                    <div className="active-filters-list">
                        {activeFilters.map(filter => (
                            <span key={filter.id} className="active-filter-chip">
                                {filter.label}
                                <button
                                    className="remove-filter-btn"
                                    onClick={() => handleRemoveFilter(filter.id)}
                                >
                                    <X size={12} />
                                </button>
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Add Custom Filter */}
            <div className="quick-filters-section" ref={addFilterRef}>
                <button
                    className="add-filter-btn"
                    onClick={() => setShowAddFilter(!showAddFilter)}
                >
                    <Plus size={14} />
                    {t('indexPage.filters.addFilter')}
                    <ChevronDown size={12} style={{ transform: showAddFilter ? 'rotate(180deg)' : 'none' }} />
                </button>

                {showAddFilter && (
                    <div className="add-filter-dropdown">
                        <div className="add-filter-row">
                            <select
                                value={addFilterField}
                                onChange={(e) => setAddFilterField(e.target.value)}
                                className="add-filter-select"
                            >
                                <option value="">{t('indexPage.filters.selectField')}</option>
                                {keywordFields.map(field => (
                                    <option key={field} value={field}>{field}</option>
                                ))}
                            </select>
                            <input
                                type="text"
                                value={addFilterValue}
                                onChange={(e) => setAddFilterValue(e.target.value)}
                                placeholder={t('indexPage.filters.enterValue')}
                                className="add-filter-input"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleAddCustomFilter();
                                }}
                            />
                            <button
                                className="btn btn-primary btn-sm"
                                onClick={handleAddCustomFilter}
                                disabled={!addFilterField || !addFilterValue}
                            >
                                <Plus size={14} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
