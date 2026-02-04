import React from 'react';

interface MethodSelectorProps {
    value: 'GET' | 'POST' | 'PUT' | 'DELETE';
    onChange: (method: 'GET' | 'POST' | 'PUT' | 'DELETE') => void;
}

export const MethodSelector: React.FC<MethodSelectorProps> = ({ value, onChange }) => {
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

    return (
        <select
            className="rest-method-select"
            value={value}
            onChange={(e) => onChange(e.target.value as 'GET' | 'POST' | 'PUT' | 'DELETE')}
            style={{
                color: getMethodColor(value),
                fontWeight: 700,
            }}
        >
            {methods.map((method) => (
                <option key={method} value={method}>
                    {method}
                </option>
            ))}
        </select>
    );
};
