import { useCallback, useRef, useEffect, useState } from 'react';

interface ResizableOptions {
    initialValue: number;
    min: number;
    max: number;
    direction: 'horizontal' | 'vertical';
    onResize?: (value: number) => void;
    onResizeEnd?: (value: number) => void;
}

interface ResizableReturn {
    value: number;
    setValue: (value: number) => void;
    handleMouseDown: (e: React.MouseEvent) => void;
    isResizing: boolean;
}

/**
 * Hook for handling resize operations (sidebars, panels, modals)
 */
export function useResizable({
    initialValue,
    min,
    max,
    direction,
    onResize,
    onResizeEnd,
}: ResizableOptions): ResizableReturn {
    const [value, setValue] = useState(initialValue);
    const isResizing = useRef(false);
    const [isResizingState, setIsResizingState] = useState(false);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        isResizing.current = true;
        setIsResizingState(true);
        document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize';
        document.body.style.userSelect = 'none';
    }, [direction]);

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isResizing.current) return;

        const newValue = direction === 'horizontal' ? e.clientX : e.clientY;
        const clampedValue = Math.max(min, Math.min(max, newValue));

        setValue(clampedValue);
        onResize?.(clampedValue);
    }, [direction, min, max, onResize]);

    const handleMouseUp = useCallback(() => {
        if (isResizing.current) {
            isResizing.current = false;
            setIsResizingState(false);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            onResizeEnd?.(value);
        }
    }, [value, onResizeEnd]);

    useEffect(() => {
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [handleMouseMove, handleMouseUp]);

    return {
        value,
        setValue,
        handleMouseDown,
        isResizing: isResizingState,
    };
}

interface ModalResizableOptions {
    initialWidth: number;
    initialHeight: number;
    minWidth: number;
    minHeight: number;
    onResizeEnd?: (width: number, height: number) => void;
}

interface ModalResizableReturn {
    width: number;
    height: number;
    handleResizeStart: (e: React.MouseEvent) => void;
    isResizing: boolean;
}

/**
 * Hook for handling modal resize (both width and height)
 */
export function useModalResizable({
    initialWidth,
    initialHeight,
    minWidth,
    minHeight,
    onResizeEnd,
}: ModalResizableOptions): ModalResizableReturn {
    const [size, setSize] = useState({ width: initialWidth, height: initialHeight });
    const isResizing = useRef(false);
    const [isResizingState, setIsResizingState] = useState(false);
    const startPos = useRef({ x: 0, y: 0 });
    const startSize = useRef({ width: 0, height: 0 });

    const handleResizeStart = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        isResizing.current = true;
        setIsResizingState(true);
        startPos.current = { x: e.clientX, y: e.clientY };
        startSize.current = { width: size.width, height: size.height };
        document.body.style.cursor = 'nwse-resize';
        document.body.style.userSelect = 'none';
    }, [size]);

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isResizing.current) return;

        const deltaX = e.clientX - startPos.current.x;
        const deltaY = e.clientY - startPos.current.y;

        const newWidth = Math.max(minWidth, startSize.current.width + deltaX);
        const newHeight = Math.max(minHeight, startSize.current.height + deltaY);

        setSize({ width: newWidth, height: newHeight });
    }, [minWidth, minHeight]);

    const handleMouseUp = useCallback(() => {
        if (isResizing.current) {
            isResizing.current = false;
            setIsResizingState(false);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            onResizeEnd?.(size.width, size.height);
        }
    }, [size, onResizeEnd]);

    useEffect(() => {
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [handleMouseMove, handleMouseUp]);

    return {
        width: size.width,
        height: size.height,
        handleResizeStart,
        isResizing: isResizingState,
    };
}
