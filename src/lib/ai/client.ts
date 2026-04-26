import Groq from 'groq-sdk';
import { DEFAULT_MODEL } from './config';

export * from './config';

let _groq: Groq | null = null;

/**
 * AI Client Instance (Lazy initialization to prevent browser execution)
 */
export const getGroqClient = () => {
    if (!_groq) {
        _groq = new Groq({
            apiKey: process.env.GROQ_API_KEY || 'none_provided_at_build_time',
        });
    }
    return _groq;
};

// For backward compatibility in server code
export const groq = typeof window === 'undefined' ? new Groq({
    apiKey: process.env.GROQ_API_KEY || 'none_provided_at_build_time',
}) : null as unknown as Groq;
