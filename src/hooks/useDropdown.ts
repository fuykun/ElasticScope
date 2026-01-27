import { useState, useRef, useEffect, useCallback } from 'react';

interface DropdownOptions {
    onClose?: () => void;
}

interface DropdownReturn<T extends HTMLElement = HTMLDivElement> {
    isOpen: boolean;
    open: () => void;
    close: () => void;
    toggle: () => void;
    ref: React.RefObject<T>;
}

/**
 * Hook for managing dropdown state with click-outside detection
 */
export function useDropdown<T extends HTMLElement = HTMLDivElement>(
    options?: DropdownOptions
): DropdownReturn<T> {
    const [isOpen, setIsOpen] = useState(false);
    const ref = useRef<T>(null);

    const open = useCallback(() => setIsOpen(true), []);
    const close = useCallback(() => {
        setIsOpen(false);
        options?.onClose?.();
    }, [options]);
    const toggle = useCallback(() => setIsOpen(prev => !prev), []);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (ref.current && !ref.current.contains(event.target as Node)) {
                close();
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen, close]);

    return {
        isOpen,
        open,
        close,
        toggle,
        ref,
    };
}

interface MultiDropdownReturn {
    openDropdown: string | null;
    isOpen: (id: string) => boolean;
    open: (id: string) => void;
    close: () => void;
    toggle: (id: string) => void;
    refs: Map<string, React.RefObject<HTMLDivElement>>;
    getRef: (id: string) => React.RefObject<HTMLDivElement>;
}

/**
 * Hook for managing multiple dropdowns (only one open at a time)
 */
export function useMultiDropdown(dropdownIds: string[]): MultiDropdownReturn {
    const [openDropdown, setOpenDropdown] = useState<string | null>(null);
    const refs = useRef(new Map<string, React.RefObject<HTMLDivElement>>());

    // Initialize refs
    dropdownIds.forEach(id => {
        if (!refs.current.has(id)) {
            refs.current.set(id, { current: null });
        }
    });

    const isOpen = useCallback((id: string) => openDropdown === id, [openDropdown]);
    const open = useCallback((id: string) => setOpenDropdown(id), []);
    const close = useCallback(() => setOpenDropdown(null), []);
    const toggle = useCallback((id: string) => {
        setOpenDropdown(prev => prev === id ? null : id);
    }, []);

    const getRef = useCallback((id: string): React.RefObject<HTMLDivElement> => {
        if (!refs.current.has(id)) {
            refs.current.set(id, { current: null });
        }
        return refs.current.get(id)!;
    }, []);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (!openDropdown) return;

            const currentRef = refs.current.get(openDropdown);
            if (currentRef?.current && !currentRef.current.contains(event.target as Node)) {
                close();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [openDropdown, close]);

    return {
        openDropdown,
        isOpen,
        open,
        close,
        toggle,
        refs: refs.current,
        getRef,
    };
}
