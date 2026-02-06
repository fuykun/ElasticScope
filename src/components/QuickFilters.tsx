import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Calendar,
    X,
    ChevronDown,
    Filter,
    Plus,
    Check,
    Search,
} from 'lucide-react';
import type { QuickFilter } from '../types';

// Searchable Select Component
interface SearchableSelectProps {
    value: string;
    onChange: (value: string) => void;
    options: string[];
    placeholder?: string;
    className?: string;
    icon?: React.ReactNode;
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({
    value,
    onChange,
    options,
    placeholder = 'Select...',
    className = '',
    icon,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const filteredOptions = options.filter(opt =>
        opt.toLowerCase().includes(search.toLowerCase())
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

    const handleSelect = (opt: string) => {
        onChange(opt);
        setIsOpen(false);
        setSearch('');
    };

    return (
        <div className={`searchable-select ${className}`} ref={containerRef}>
            <button
                type="button"
                className="searchable-select-trigger"
                onClick={() => setIsOpen(!isOpen)}
            >
                {icon}
                <span className={value ? '' : 'placeholder'}>
                    {value || placeholder}
                </span>
                <ChevronDown size={12} style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
            </button>
            {isOpen && (
                <div className="searchable-select-dropdown">
                    <div className="searchable-select-search">
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
                    <div className="searchable-select-options">
                        {filteredOptions.length === 0 ? (
                            <div className="searchable-select-no-results">No results</div>
                        ) : (
                            filteredOptions.map(opt => (
                                <button
                                    key={opt}
                                    type="button"
                                    className={`searchable-select-option ${opt === value ? 'selected' : ''}`}
                                    onClick={() => handleSelect(opt)}
                                >
                                    {opt}
                                    {opt === value && <Check size={12} />}
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

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

    dateFields,
    keywordFields,
    activeFilters,
    onFiltersChange,
    onQueryChange,
}) => {
    const { t } = useTranslation();
    const [selectedDateField, setSelectedDateField] = useState<string>(dateFields[0] || '');
    const [showAddFilter, setShowAddFilter] = useState(false);
    const [addFilterField, setAddFilterField] = useState('');
    const [addFilterValue, setAddFilterValue] = useState('');
    const addFilterRef = useRef<HTMLDivElement>(null);

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
                        <SearchableSelect
                            value={selectedDateField}
                            onChange={setSelectedDateField}
                            options={dateFields}
                            placeholder={t('indexPage.filters.selectDateField')}
                            className="date-field-searchable"
                            icon={<Calendar size={14} />}
                        />

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
                            <SearchableSelect
                                value={addFilterField}
                                onChange={setAddFilterField}
                                options={keywordFields}
                                placeholder={t('indexPage.filters.selectField')}
                                className="add-filter-searchable"
                            />
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
