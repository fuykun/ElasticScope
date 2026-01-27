import i18n from 'i18next';

/**
 * Translate server error codes to localized messages
 */
export function translateError(error: any): string {
    // If error has errorCode property (from server)
    if (error?.errorCode) {
        const key = `serverErrors.${error.errorCode}`;
        const translated = i18n.t(key, { details: error.details });
        
        // If translation key exists, return it
        if (translated !== key) {
            return translated;
        }
        
        // Fallback to error code itself
        return error.errorCode;
    }
    
    // If error message looks like an error code (ALL_CAPS_WITH_UNDERSCORES)
    if (error?.message && /^[A-Z_]+$/.test(error.message)) {
        const key = `serverErrors.${error.message}`;
        const translated = i18n.t(key);
        
        if (translated !== key) {
            return translated;
        }
    }
    
    // Fallback to original error message
    return error?.message || i18n.t('serverErrors.UNKNOWN_ERROR');
}
