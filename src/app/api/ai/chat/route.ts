import { NextRequest } from 'next/server';
import { groq, DEFAULT_MODEL, SHOP_AI_SYSTEM_PROMPT, detectToolFromMessage } from '@/lib/groq';
import { getShopContextForAI } from '@/actions/ai';
import { getToolDefinitions, executeTool } from '@/lib/ai/tools';
import { withAuth } from '@/lib/auth/api-guard';

export const POST = withAuth(async (request: NextRequest, session: any) => {
  try {
    const shopId = session.user.shopId;
    const userId = session.user.id;
    
    const { messages, confirmTool, confirmParams } = await request.json();

    const context = {
      userId,
      shopId,
    };

    // Handle tool confirmation
    if (confirmTool) {
      const result = await executeTool(confirmTool, confirmParams, context, true);
      return Response.json({ 
        message: result.message,
        toolResult: result,
      });
    }

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'Messages are required' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get the latest user message for fallback detection
    const latestUserMessage = messages.filter((m: any) => m.role === 'user').pop()?.content || '';

    // Get shop context
    const shopContext = await getShopContextForAI();

    // Build messages with system prompt and context
    const systemMessage = {
      role: 'system' as const,
      content: `${SHOP_AI_SYSTEM_PROMPT}\n\n--- ข้อมูลร้านปัจจุบัน ---\n${shopContext}`,
    };

    // Call Groq API with tools (lower temperature for stability)
    const response = await groq.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [systemMessage, ...messages],
      tools: getToolDefinitions(),
      tool_choice: 'auto',
      temperature: 0.3, // Lower for more stable tool detection
      max_tokens: 1024,
      stream: true,
    });

    // Handle streaming response with potential tool calls
    const encoder = new TextEncoder();
    let toolCalls: any[] = [];
    let textContent = '';

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of response) {
            const delta = chunk.choices[0]?.delta;
            
            // Handle text content
            if (delta?.content) {
              textContent += delta.content;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: delta.content })}\n\n`));
            }
            
            // Handle tool calls
            if (delta?.tool_calls) {
              for (const toolCall of delta.tool_calls) {
                if (toolCall.index !== undefined) {
                  if (!toolCalls[toolCall.index]) {
                    toolCalls[toolCall.index] = {
                      id: toolCall.id,
                      function: { name: '', arguments: '' },
                    };
                  }
                  if (toolCall.function?.name) {
                    toolCalls[toolCall.index].function.name = toolCall.function.name;
                  }
                  if (toolCall.function?.arguments) {
                    toolCalls[toolCall.index].function.arguments += toolCall.function.arguments;
                  }
                }
              }
            }
          }

          // Process tool calls if any
          if (toolCalls.length > 0) {
            for (const toolCall of toolCalls) {
              if (toolCall?.function?.name) {
                try {
                  const params = JSON.parse(toolCall.function.arguments || '{}');
                  const result = await executeTool(toolCall.function.name, params, context, false);
                  
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
                    toolResult: result,
                    toolName: toolCall.function.name,
                  })}\n\n`));
                } catch (e) {
                  console.error('Tool execution error:', e);
                }
              }
            }
          } else if (textContent && !textContent.includes('ไม่สามารถ') && !textContent.includes('ทำไม่ได้')) {
            // No tool calls - check for fallback keyword detection
            const fallback = detectToolFromMessage(latestUserMessage);
            
            if (fallback && fallback.params) {
              console.log('Fallback detected:', fallback);
              
              // Validate that we have necessary params
              const hasValidParams = 
                (fallback.tool === 'create_expense' && fallback.params.amount > 0) ||
                (fallback.tool === 'create_income' && fallback.params.amount > 0) ||
                (fallback.tool === 'create_product' && fallback.params.name && fallback.params.price > 0) ||
                (fallback.tool === 'check_stock' && fallback.params.productName) ||
                (fallback.tool === 'generate_report');

              if (hasValidParams) {
                const result = await executeTool(fallback.tool, fallback.params, context, false);
                
                // Clear text content and send tool result instead
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
                  toolResult: result,
                  toolName: fallback.tool,
                  fallback: true,
                })}\n\n`));
              }
            }
          }

          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
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
    return new Response(
      JSON.stringify({ error: 'เกิดข้อผิดพลาดในการประมวลผล กรุณาลองใหม่อีกครั้ง' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}, { rateLimitPolicy: 'ai' });
