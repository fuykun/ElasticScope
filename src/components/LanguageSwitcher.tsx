import React, { useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Check } from 'lucide-react';
import { useClickOutside } from '../hooks/useClickOutside';

const languages = [
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'tr', name: 'Türkçe', flag: '🇹🇷' },
];

export const LanguageSwitcher: React.FC = () => {
    const { i18n } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const closeDropdown = useCallback(() => setIsOpen(false), []);
    useClickOutside(dropdownRef, closeDropdown, isOpen);

    const currentLanguage = languages.find(l => l.code === i18n.language) || languages[0];

    const handleLanguageChange = (code: string) => {
        i18n.changeLanguage(code);
        setIsOpen(false);
    };

    return (
        <div className="language-switcher" ref={dropdownRef}>
            <button
                className="language-trigger"
                onClick={() => setIsOpen(!isOpen)}
                title="Change Language"
            >
                <span className="language-current">{currentLanguage.flag}</span>
                <ChevronDown size={14} className={`dropdown-arrow ${isOpen ? 'open' : ''}`} />
            </button>

            {isOpen && (
                <div className="language-dropdown">
                    {languages.map((lang) => (
                        <button
                            key={lang.code}
                            className={`language-option ${i18n.language === lang.code ? 'active' : ''}`}
                            onClick={() => handleLanguageChange(lang.code)}
                        >
                            <span className="language-flag">{lang.flag}</span>
                            <span className="language-name">{lang.name}</span>
                            {i18n.language === lang.code && <Check size={14} className="language-check" />}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};
