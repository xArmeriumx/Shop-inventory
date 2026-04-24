import { NextRequest } from 'next/server';
import { groq } from '@/lib/ai';
import { getShopContextForAI } from '@/actions/core/ai.actions';
import { getToolDefinitions, executeTool } from '@/lib/ai/tools';
import { withAuth } from '@/lib/auth/api-guard';
import { AiStreamUtils } from '@/lib/ai/ai-stream-utils';
import { DEFAULT_MODEL, SHOP_AI_SYSTEM_PROMPT, detectToolFromMessage } from '@/lib/ai';

export const POST = withAuth(async (request: NextRequest, session: any) => {
  try {
    const shopId = session.user.shopId;
    const userId = session.user.id;

    const { messages, confirmTool, confirmParams } = await request.json();

    const context = { userId, shopId };

    // Handle tool confirmation (Early return)
    if (confirmTool) {
      const result = await executeTool(confirmTool, confirmParams, context, true);
      return Response.json({
        message: result.message,
        toolResult: result,
      });
    }

    if (!messages || !Array.isArray(messages)) {
      return Response.json({ error: 'Messages are required' }, { status: 400 });
    }

    // Get the latest user message for fallback detection
    const latestUserMessage = messages.filter((m: any) => m.role === 'user').pop()?.content || '';

    // Get shop context (Modular Service + PromptBuilder inside the action)
    const shopContext = await getShopContextForAI();

    // Call Groq API
    const response = await groq.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [
        { role: 'system', content: `${SHOP_AI_SYSTEM_PROMPT}\n\n--- ข้อมูลร้านปัจจุบัน ---\n${shopContext}` },
        ...messages
      ],
      tools: getToolDefinitions(),
      tool_choice: 'auto',
      temperature: 0.3,
      max_tokens: 1024,
      stream: true,
    });

    const stream = new ReadableStream({
      async start(controller) {
        const { encodeChunk, encodeDone } = AiStreamUtils.createEncoder();
        let toolCalls: any[] = [];
        let textContent = '';

        try {
          for await (const chunk of response) {
            const delta = chunk.choices[0]?.delta;
            if (delta?.content) {
              textContent += delta.content;
              controller.enqueue(encodeChunk(AiStreamUtils.formatContentChunk(delta.content)));
            }

            if (delta?.tool_calls) {
              for (const tc of delta.tool_calls) {
                if (tc.index !== undefined) {
                  if (!toolCalls[tc.index]) {
                    toolCalls[tc.index] = { id: tc.id, function: { name: '', arguments: '' } };
                  }
                  if (tc.function?.name) toolCalls[tc.index].function.name = tc.function.name;
                  if (tc.function?.arguments) toolCalls[tc.index].function.arguments += tc.function.arguments;
                }
              }
            }
          }

          // Process tool calls
          if (toolCalls.length > 0) {
            for (const toolCall of toolCalls) {
              if (toolCall?.function?.name) {
                const params = JSON.parse(toolCall.function.arguments || '{}');
                const result = await executeTool(toolCall.function.name, params, context, false);
                controller.enqueue(encodeChunk(AiStreamUtils.formatToolChunk(toolCall.function.name, result)));
              }
            }
          } else if (textContent && !textContent.includes('ไม่สามารถ')) {
            // Fallback detection
            const fallback = detectToolFromMessage(latestUserMessage);
            if (fallback && fallback.params) {
              const result = await executeTool(fallback.tool, fallback.params, context, false);
              controller.enqueue(encodeChunk(AiStreamUtils.formatToolChunk(fallback.tool, result, true)));
            }
          }

          controller.enqueue(encodeDone());
          controller.close();
        } catch (error) {
          console.error('Streaming error:', error);
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('AI Chat error:', error);
    return Response.json({ error: 'เกิดข้อผิดพลาดในการประมวลผล' }, { status: 500 });
  }
}, { rateLimitPolicy: 'ai' });
