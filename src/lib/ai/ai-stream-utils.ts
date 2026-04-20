/**
 * Utilities for managing AI streaming responses.
 * Simplifies the process of encoding and sending JSON chunks over a ReadableStream.
 */
export const AiStreamUtils = {
    /**
     * Creates a standardized JSON encoder for SSE (Server-Sent Events)
     */
    createEncoder() {
        const encoder = new TextEncoder();
        return {
            encodeChunk(data: any) {
                return encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
            },
            encodeDone() {
                return encoder.encode('data: [DONE]\n\n');
            }
        };
    },

    /**
     * Helper to format tool result for the stream
     */
    formatToolChunk(toolName: string, result: any, fallback = false) {
        return {
            toolResult: result,
            toolName: toolName,
            fallback
        };
    },

    /**
     * Helper to format content chunk for the stream
     */
    formatContentChunk(content: string) {
        return { content };
    }
};
