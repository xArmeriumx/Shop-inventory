import Groq from 'groq-sdk';

/**
 * AI Client Configuration
 * Fallback to dummy key during build to prevent CI failures.
 */
export const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY || 'none_provided_at_build_time',
});

/**
 * Model selection defaults
 */
export const DEFAULT_MODEL = 'llama-3.1-8b-instant';
export const PREMIUM_MODEL = 'llama-3.1-70b-versatile';
export const VISION_MODEL = 'llama-3.2-11b-vision-preview';

/**
 * AI Configuration SSOT
 */
export const AI_CONFIG = {
    // Model Selection
    models: {
        default: DEFAULT_MODEL,
        premium: PREMIUM_MODEL,
        vision: VISION_MODEL,
    },

    // Generation Parameters
    generation: {
        temperature: 0.3,
        maxTokens: 2048,
    },

    // UI Thresholds
    ui: {
        tokenThresholds: {
            warning: 8000,
            danger: 12000,
        }
    }
} as const;
