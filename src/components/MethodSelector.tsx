import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

interface MethodSelectorProps {
    value: 'GET' | 'POST' | 'PUT' | 'DELETE';
    onChange: (method: 'GET' | 'POST' | 'PUT' | 'DELETE') => void;
}

export const MethodSelector: React.FC<MethodSelectorProps> = ({ value, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const methods: Array<'GET' | 'POST' | 'PUT' | 'DELETE'> = ['GET', 'POST', 'PUT', 'DELETE'];

    const getMethodColor = (method: string) => {
        switch (method) {
            case 'GET':
                return 'var(--success)';
            case 'POST':
                return 'var(--accent)';
            case 'PUT':
                return '#fbbf24';
            case 'DELETE':
                return 'var(--danger)';
            default:
                return 'var(--text-secondary)';
        }
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const handleSelect = (method: 'GET' | 'POST' | 'PUT' | 'DELETE') => {
        onChange(method);
        setIsOpen(false);
    };

    return (
        <div className="method-selector" ref={dropdownRef}>
            <button
                className="method-selector-trigger"
                onClick={() => setIsOpen(!isOpen)}
                style={{ color: getMethodColor(value) }}
            >
                <span className="method-selector-value">{value}</span>
                <ChevronDown
                    size={14}
                    className={`method-selector-chevron ${isOpen ? 'open' : ''}`}
                />
            </button>

            {isOpen && (
                <div className="method-selector-dropdown">
                    {methods.map((method) => (
                        <div
                            key={method}
                            className={`method-selector-option ${value === method ? 'selected' : ''}`}
                            onClick={() => handleSelect(method)}
                            style={{ color: getMethodColor(method) }}
                        >
                            {value === method && <Check size={14} className="method-check" />}
                            <span>{method}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
