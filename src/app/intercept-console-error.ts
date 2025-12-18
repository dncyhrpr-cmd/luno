/**
 * Utility to intercept and suppress specific console warnings. This is useful for
 * hiding warnings from third-party libraries (like 'react-financial-charts') that
 * use deprecated lifecycle methods, which we cannot fix ourselves.
 */

// Define the specific string patterns we want to suppress.
const SUPPRESSED_PATTERNS = [
    'UNSAFE_componentWillMount',
    'UNSAFE_componentWillReceiveProps',
    'findDOMNode is deprecated' // Another common warning from older libraries
];

// Check if we are in a browser environment before patching the console.
if (typeof window !== 'undefined') {
    const originalConsoleError = console.error;
    const originalConsoleWarn = console.warn;

    /**
     * Checks if any of the arguments passed to a console method contain a message
     * that should be suppressed.
     * @param args - The arguments passed to the console method (e.g., console.warn).
     * @returns - True if a message in the arguments should be suppressed.
     */
    const shouldSuppress = (args: any[]): boolean => {
        // Iterate through each argument provided to the console function.
        for (const arg of args) {
            // We only care about string arguments.
            if (typeof arg === 'string') {
                // Check if the string includes any of our defined suppression patterns.
                for (const pattern of SUPPRESSED_PATTERNS) {
                    if (arg.includes(pattern)) {
                        return true; // Found a match, so we should suppress this message.
                    }
                }
            }
        }
        return false; // No matches found.
    };

    // Override console.warn
    console.warn = (...args: any[]) => {
        if (shouldSuppress(args)) {
            return; // Suppress the warning by returning early.
        }
        // If not suppressed, call the original console.warn.
        originalConsoleWarn.apply(console, args);
    };

    // Override console.error
    console.error = (...args: any[]) => {
        if (shouldSuppress(args)) {
            return; // Suppress the error by returning early.
        }
        // If not suppressed, call the original console.error.
        originalConsoleError.apply(console, args);
    };
}

// This export statement is kept for module compatibility, even if empty.
export {};
