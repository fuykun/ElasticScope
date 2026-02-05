import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Calendar,
    X,
    ChevronDown,
    Check,
    Search,
} from 'lucide-react';

// Date Filter Types
export interface DateFilterValue {
    id: string;
    field: string;
    label: string;
    from: string;
    to: string;
}

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

interface DateFilterProps {
    dateFields: string[];
    activeFilter: DateFilterValue | null;
    onFilterChange: (filter: DateFilterValue | null) => void;
    onQueryChange: (query: object | null) => void;
}

const DATE_QUICK_FILTERS = [
    { id: 'today', key: 'today', from: 'now/d', to: 'now' },
    { id: 'yesterday', key: 'yesterday', from: 'now-1d/d', to: 'now/d' },
    { id: 'last_7_days', key: 'last7Days', from: 'now-7d/d', to: 'now' },
    { id: 'last_30_days', key: 'last30Days', from: 'now-30d/d', to: 'now' },
    { id: 'this_month', key: 'thisMonth', from: 'now/M', to: 'now' },
];

export const DateFilter: React.FC<DateFilterProps> = ({
    dateFields,
    activeFilter,
    onFilterChange,
    onQueryChange,
}) => {
    const { t } = useTranslation();
    const [selectedDateField, setSelectedDateField] = useState<string>(dateFields[0] || '');
    const [showCustomRange, setShowCustomRange] = useState(false);
    const [customFromDate, setCustomFromDate] = useState('');
    const [customFromTime, setCustomFromTime] = useState('00:00');
    const [customToDate, setCustomToDate] = useState('');
    const [customToTime, setCustomToTime] = useState('23:59');
    const customRangeRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (dateFields.length > 0 && !selectedDateField) {
            setSelectedDateField(dateFields[0]);
        }
    }, [dateFields]);

    // Close custom range dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (customRangeRef.current && !customRangeRef.current.contains(event.target as Node)) {
                setShowCustomRange(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const buildQueryFromFilter = (filter: DateFilterValue | null): object | null => {
        if (!filter) return null;

        return {
            range: {
                [filter.field]: {
                    gte: filter.from,
                    lte: filter.to,
                },
            },
        };
    };

    const handleQuickFilterClick = (dateFilter: typeof DATE_QUICK_FILTERS[0]) => {
        if (!selectedDateField) return;

        // If same filter is clicked, remove it
        if (activeFilter?.id === dateFilter.id) {
            onFilterChange(null);
            onQueryChange(null);
            return;
        }

        const newFilter: DateFilterValue = {
            id: dateFilter.id,
            field: selectedDateField,
            label: t(`indexPage.filters.${dateFilter.key}`),
            from: dateFilter.from,
            to: dateFilter.to,
        };

        onFilterChange(newFilter);
        onQueryChange(buildQueryFromFilter(newFilter));
    };

    const handleCustomRangeApply = () => {
        if (!selectedDateField || !customFromDate || !customToDate) return;

        const fromDateTime = `${customFromDate}T${customFromTime}`;
        const toDateTime = `${customToDate}T${customToTime}`;

        const newFilter: DateFilterValue = {
            id: 'custom_range',
            field: selectedDateField,
            label: formatDateTimeDisplay(fromDateTime, toDateTime),
            from: fromDateTime,
            to: toDateTime,
        };

        onFilterChange(newFilter);
        onQueryChange(buildQueryFromFilter(newFilter));
        setShowCustomRange(false);
    };

    const handleClearFilter = () => {
        onFilterChange(null);
        onQueryChange(null);
        setCustomFromDate('');
        setCustomFromTime('00:00');
        setCustomToDate('');
        setCustomToTime('23:59');
    };

    const formatDateTimeDisplay = (from: string, to: string): string => {
        const fromDate = new Date(from);
        const toDate = new Date(to);

        const formatDate = (d: Date) => {
            const day = d.getDate().toString().padStart(2, '0');
            const month = (d.getMonth() + 1).toString().padStart(2, '0');
            const year = d.getFullYear();
            const hours = d.getHours().toString().padStart(2, '0');
            const minutes = d.getMinutes().toString().padStart(2, '0');
            return `${day}.${month}.${year} ${hours}:${minutes}`;
        };

        return `${formatDate(fromDate)} - ${formatDate(toDate)}`;
    };

    const isQuickFilterActive = (filterId: string) => {
        return activeFilter?.id === filterId;
    };

    if (dateFields.length === 0) {
        return (
            <div className="date-filter">
                <div className="date-filter-empty">
                    <Calendar size={14} />
                    <span>{t('indexPage.filters.noDateFields')}</span>
                </div>
            </div>
        );
    }

    return (
        <div className="date-filter">
            <div className="date-filter-row">
                {/* Date Field Selector */}
                <SearchableSelect
                    value={selectedDateField}
                    onChange={setSelectedDateField}
                    options={dateFields}
                    placeholder={t('indexPage.filters.selectDateField')}
                    className="date-field-searchable"
                    icon={<Calendar size={14} />}
                />

                {/* Quick Filter Chips */}
                <div className="date-filter-chips">
                    {DATE_QUICK_FILTERS.map(df => (
                        <button
                            key={df.id}
                            className={`date-filter-chip ${isQuickFilterActive(df.id) ? 'active' : ''}`}
                            onClick={() => handleQuickFilterClick(df)}
                        >
                            {t(`indexPage.filters.${df.key}`)}
                            {isQuickFilterActive(df.id) && <Check size={12} />}
                        </button>
                    ))}
                </div>

                {/* Custom Range Button */}
                <div className="custom-range-container" ref={customRangeRef}>
                    <button
                        className={`date-filter-chip custom-range-btn ${activeFilter?.id === 'custom_range' ? 'active' : ''}`}
                        onClick={() => setShowCustomRange(!showCustomRange)}
                    >
                        <Calendar size={12} />
                        {activeFilter?.id === 'custom_range' ? activeFilter.label : t('indexPage.filters.customRange')}
                        <ChevronDown size={12} style={{ transform: showCustomRange ? 'rotate(180deg)' : 'none' }} />
                    </button>

                    {showCustomRange && (
                        <div className="custom-range-dropdown">
                            <div className="custom-range-header">
                                {t('indexPage.filters.selectDateRange')}
                            </div>
                            <div className="custom-range-inputs">
                                <div className="custom-range-field">
                                    <label>{t('indexPage.filters.from')}</label>
                                    <div className="custom-range-datetime">
                                        <input
                                            type="date"
                                            value={customFromDate}
                                            onChange={(e) => setCustomFromDate(e.target.value)}
                                            className="custom-range-date-input"
                                        />
                                        <input
                                            type="time"
                                            value={customFromTime}
                                            onChange={(e) => setCustomFromTime(e.target.value)}
                                            className="custom-range-time-input"
                                        />
                                    </div>
                                </div>
                                <div className="custom-range-field">
                                    <label>{t('indexPage.filters.to')}</label>
                                    <div className="custom-range-datetime">
                                        <input
                                            type="date"
                                            value={customToDate}
                                            onChange={(e) => setCustomToDate(e.target.value)}
                                            className="custom-range-date-input"
                                        />
                                        <input
                                            type="time"
                                            value={customToTime}
                                            onChange={(e) => setCustomToTime(e.target.value)}
                                            className="custom-range-time-input"
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="custom-range-actions">
                                <button
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => setShowCustomRange(false)}
                                >
                                    {t('common.cancel')}
                                </button>
                                <button
                                    className="btn btn-primary btn-sm"
                                    onClick={handleCustomRangeApply}
                                    disabled={!customFromDate || !customToDate}
                                >
                                    {t('common.apply')}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Clear Button */}
                {activeFilter && (
                    <button
                        className="date-filter-clear"
                        onClick={handleClearFilter}
                        title={t('indexPage.filters.clearAll')}
                    >
                        <X size={14} />
                    </button>
                )}
            </div>
        </div>
    );
};
