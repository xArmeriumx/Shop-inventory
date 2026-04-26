'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
}

export interface ConfirmationData {
    title: string;
    items: { label: string; value: string; icon?: string }[];
    toolName: string;
    params: Record<string, any>;
}

export interface TokenUsage {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
}

export function useAIChat() {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [streamingContent, setStreamingContent] = useState('');
    const [confirmation, setConfirmation] = useState<ConfirmationData | null>(null);
    const [isConfirming, setIsConfirming] = useState(false);
    const [tokenUsage, setTokenUsage] = useState<TokenUsage | null>(null);

    const scrollAreaRef = useRef<HTMLDivElement>(null);
    // ... scrollToBottom logic existing
    const scrollToBottom = useCallback(() => {
        if (scrollAreaRef.current) {
            scrollAreaRef.current.scrollTo({
                top: scrollAreaRef.current.scrollHeight,
                behavior: 'smooth'
            });
        }
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [messages, streamingContent, confirmation, scrollToBottom]);

    const handleConfirm = async () => {
        if (!confirmation) return;

        setIsConfirming(true);
        try {
            const response = await fetch('/api/ai/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    confirmTool: confirmation.toolName,
                    confirmParams: confirmation.params,
                }),
            });

            const data = await response.json();
            setMessages(prev => [...prev, { role: 'assistant', content: data.message }]);
            setConfirmation(null);
        } catch (error) {
            setMessages(prev => [...prev, { role: 'assistant', content: '❌ เกิดข้อผิดพลาด กรุณาลองใหม่' }]);
        } finally {
            setIsConfirming(false);
        }
    };

    const handleCancel = () => {
        setConfirmation(null);
        setMessages(prev => [...prev, { role: 'assistant', content: '❌ ยกเลิกการดำเนินการ' }]);
    };

    const sendMessage = async (content: string) => {
        if (!content.trim() || isLoading) return;

        const cleanContent = content.replace(/^[📊🏆⚠️📈💰📦➕💡]\s*/, '');

        const userMessage: ChatMessage = { role: 'user', content: cleanContent };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);
        setStreamingContent('');
        setConfirmation(null);
        setTokenUsage(null);

        try {
            const response = await fetch('/api/ai/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: [...messages, userMessage].map(m => ({
                        role: m.role,
                        content: m.content,
                    })),
                }),
            });

            if (!response.ok) {
                const data = await response.json();
                setMessages(prev => [...prev, { role: 'assistant', content: `❌ ${data.error || 'เกิดข้อผิดพลาด'}` }]);
                return;
            }

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();
            let fullContent = '';
            let hasToolResult = false;

            if (reader) {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunk = decoder.decode(value);
                    const lines = chunk.split('\n');

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const dataStr = line.slice(6);
                            if (dataStr === '[DONE]') continue;

                            try {
                                const parsed = JSON.parse(dataStr);

                                if (parsed.content) {
                                    fullContent += parsed.content;
                                    setStreamingContent(fullContent);
                                }

                                if (parsed.usage) {
                                    setTokenUsage(parsed.usage);
                                }

                                if (parsed.toolResult) {
                                    hasToolResult = true;
                                    if (parsed.toolResult.requireConfirmation) {
                                        setConfirmation(parsed.toolResult.confirmationData);
                                        setStreamingContent('');
                                    } else {
                                        setStreamingContent('');
                                        setMessages(prev => [...prev, { role: 'assistant', content: parsed.toolResult.message }]);
                                    }
                                }
                            } catch (e) {
                                // Ignore parse errors from chunks
                            }
                        }
                    }
                }
            }

            if (fullContent && !hasToolResult) {
                setMessages(prev => [...prev, { role: 'assistant', content: fullContent }]);
            }
            setStreamingContent('');
        } catch (error) {
            setMessages(prev => [...prev, { role: 'assistant', content: '❌ ไม่สามารถเชื่อมต่อได้ กรุณาลองใหม่' }]);
        } finally {
            setIsLoading(false);
        }
    };

    return {
        messages,
        input,
        setInput,
        isLoading,
        streamingContent,
        confirmation,
        isConfirming,
        tokenUsage,
        scrollAreaRef,
        sendMessage,
        handleConfirm,
        handleCancel,
    };
}
