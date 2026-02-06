import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Save, Loader2 } from 'lucide-react';
import {
    createSavedConnection,
    updateSavedConnection,
    connectWithSavedConnection,
    deleteSavedConnection,
    CreateConnectionInput,
    SavedConnection
} from '../api/elasticsearchClient';

interface ConnectionFormModalProps {
    onSuccess: (connectionId: number) => void;
    onCancel: () => void;
    editConnection?: SavedConnection | null;
}

interface ValidationErrors {
    name?: string;
    url?: string;
}

const COLORS = [
    '#3b82f6', // blue
    '#22c55e', // green
    '#eab308', // yellow
    '#ef4444', // red
    '#a855f7', // purple
    '#ec4899', // pink
    '#f97316', // orange
    '#06b6d4', // cyan
];

// URL validasyonu
const isValidUrl = (url: string): boolean => {
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
};

export const ConnectionFormModal: React.FC<ConnectionFormModalProps> = ({
    onSuccess,
    onCancel,
    editConnection,
}) => {
    const { t } = useTranslation();
    const isEditMode = !!editConnection;

    const [name, setName] = useState('');
    const [url, setUrl] = useState('http://localhost:9200');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [color, setColor] = useState(COLORS[0]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
    const [touched, setTouched] = useState<{ name: boolean; url: boolean }>({ name: false, url: false });

    useEffect(() => {
        if (editConnection) {
            setName(editConnection.name);
            setUrl(editConnection.url);
            setUsername(editConnection.username || '');
            setPassword('');
            setColor(editConnection.color);
        }
    }, [editConnection]);

    const validateForm = (): boolean => {
        const errors: ValidationErrors = {};

        if (!name.trim()) {
            errors.name = t('connection.validation.nameRequired');
        } else if (name.trim().length < 2) {
            errors.name = t('connection.validation.nameMinLength');
        } else if (name.trim().length > 50) {
            errors.name = t('connection.validation.nameMaxLength');
        }

        // URL validasyonu
        if (!url.trim()) {
            errors.url = t('connection.validation.urlRequired');
        } else if (!isValidUrl(url)) {
            errors.url = t('connection.validation.urlInvalid');
        }

        setValidationErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleBlur = (field: 'name' | 'url') => {
        setTouched((prev) => ({ ...prev, [field]: true }));
        validateForm();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setTouched({ name: true, url: true });

        if (!validateForm()) {
            return;
        }

        setLoading(true);
        setError(null);

        let createdConnectionId: number | null = null;

        try {
            const input: CreateConnectionInput = {
                name: name.trim(),
                url: url.trim(),
                color,
            };

            if (username.trim()) input.username = username.trim();
            if (password) input.password = password;

            let connectionId: number;

            if (isEditMode && editConnection) {
                const updatedConnection = await updateSavedConnection(editConnection.id, input);
                connectionId = updatedConnection.id;
            } else {
                const savedConnection = await createSavedConnection(input);
                connectionId = savedConnection.id;
                createdConnectionId = connectionId;
            }

            await connectWithSavedConnection(connectionId);

            onSuccess(connectionId);
        } catch (err: any) {
            if (createdConnectionId !== null && !isEditMode) {
                try {
                    await deleteSavedConnection(createdConnectionId);
                } catch (deleteErr) {
                }
            }
            setError(err.message || t('connection.connectionFailed'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="connection-modal-form">
            <div className={`form-group ${touched.name && validationErrors.name ? 'has-error' : ''}`}>
                <label htmlFor="conn-name">{t('connection.name')}</label>
                <input
                    id="conn-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onBlur={() => handleBlur('name')}
                    placeholder={t('connection.namePlaceholder')}
                    disabled={loading}
                />
                {touched.name && validationErrors.name && (
                    <span className="field-error">{validationErrors.name}</span>
                )}
            </div>

            <div className={`form-group ${touched.url && validationErrors.url ? 'has-error' : ''}`}>
                <label htmlFor="conn-url">{t('connection.url')}</label>
                <input
                    id="conn-url"
                    type="text"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    onBlur={() => handleBlur('url')}
                    placeholder={t('connection.urlPlaceholder')}
                    disabled={loading}
                />
                {touched.url && validationErrors.url && (
                    <span className="field-error">{validationErrors.url}</span>
                )}
            </div>

            <div className="form-row">
                <div className="form-group">
                    <label htmlFor="conn-username">{t('connection.username')}</label>
                    <input
                        id="conn-username"
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder={t('connection.usernamePlaceholder')}
                        disabled={loading}
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="conn-password">{t('connection.password')}</label>
                    <input
                        id="conn-password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={t('connection.passwordPlaceholder')}
                        disabled={loading}
                    />
                </div>
            </div>

            <div className="form-group">
                <label>{t('connection.color')}</label>
                <div className="color-picker">
                    {COLORS.map((c) => (
                        <button
                            key={c}
                            type="button"
                            className={`color-option ${color === c ? 'selected' : ''}`}
                            style={{ backgroundColor: c }}
                            onClick={() => setColor(c)}
                            disabled={loading}
                        />
                    ))}
                </div>
            </div>

            {error && <div className="error-message">{error}</div>}

            <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={loading}>
                    {t('common.cancel')}
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                    {loading ? <Loader2 size={16} className="spin" /> : <Save size={16} />}
                    {loading ? (isEditMode ? t('connection.saving') : t('connection.connecting')) : (isEditMode ? t('common.save') : t('connection.saveAndConnect'))}
                </button>
            </div>
        </form>
    );
};
