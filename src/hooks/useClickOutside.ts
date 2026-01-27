import { useEffect, RefObject } from 'react';

/**
 * Hook that detects clicks outside of the specified element
 * @param ref - React ref to the element
 * @param callback - Function to call when click outside is detected
 * @param enabled - Optional flag to enable/disable the hook (default: true)
 */
export const useClickOutside = (
    ref: RefObject<HTMLElement>,
    callback: () => void,
    enabled: boolean = true
) => {
    useEffect(() => {
        if (!enabled) return;

        const handleClickOutside = (event: MouseEvent) => {
            if (ref.current && !ref.current.contains(event.target as Node)) {
                callback();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [ref, callback, enabled]);
};

/**
 * Hook that detects clicks outside of multiple elements
 * @param refs - Array of React refs to the elements
 * @param callback - Function to call when click outside is detected
 * @param enabled - Optional flag to enable/disable the hook (default: true)
 */
export const useClickOutsideMultiple = (
    refs: RefObject<HTMLElement>[],
    callback: () => void,
    enabled: boolean = true
) => {
    useEffect(() => {
        if (!enabled) return;

        const handleClickOutside = (event: MouseEvent) => {
            const isOutside = refs.every(
                ref => ref.current && !ref.current.contains(event.target as Node)
            );
            if (isOutside) {
                callback();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [refs, callback, enabled]);
};
