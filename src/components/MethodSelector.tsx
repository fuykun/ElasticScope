import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import '../styles/components/method-selector.css';

interface MethodSelectorProps {
    value: 'GET' | 'POST' | 'PUT' | 'DELETE';
    onChange: (value: 'GET' | 'POST' | 'PUT' | 'DELETE') => void;
    className?: string;
}

export const MethodSelector: React.FC<MethodSelectorProps> = ({ value, onChange, className }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const methods: Array<'GET' | 'POST' | 'PUT' | 'DELETE'> = ['GET', 'POST', 'PUT', 'DELETE'];

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (method: 'GET' | 'POST' | 'PUT' | 'DELETE') => {
        onChange(method);
        setIsOpen(false);
    };

    return (
        <div className={`method-selector-container ${className || ''}`} ref={containerRef}>
            <div
                className={`method-selector-trigger ${isOpen ? 'active' : ''}`}
                onClick={() => setIsOpen(!isOpen)}
            >
                <span className={`method-value method-${value}`}>{value}</span>
                <ChevronDown
                    size={14}
                    style={{
                        transform: isOpen ? 'rotate(180deg)' : '0deg',
                        transition: 'transform 0.2s',
                        color: 'var(--text-secondary)'
                    }}
                />
            </div>

            {isOpen && (
                <div className="method-selector-menu">
                    {methods.map((method) => (
                        <div
                            key={method}
                            className="method-option"
                            onClick={() => handleSelect(method)}
                        >
                            <span className={`method-${method}`}>{method}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
