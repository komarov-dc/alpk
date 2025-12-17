import { NextRequest } from 'next/server';
import { z } from 'zod';
import { checkRateLimit, sanitizeString } from '@/utils/validation';
import { API_ENDPOINTS } from '@/config/api';
import { logger } from '@/utils/logger';

// Validation schema for LLM stream request
const llmStreamRequestSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['system', 'user', 'assistant']),
    content: z.string()
  })).min(1),
  model: z.string().min(1),
  modelConfig: z.record(z.string(), z.unknown()).optional(),
  systemMessage: z.string().optional()
});

export async function POST(req: NextRequest) {
  try {
    // Rate limiting for LLM requests
    const clientIp = req.headers.get('x-forwarded-for') || 'unknown';
    if (!checkRateLimit(clientIp, 'llm')) {
      return Response.json(
        { error: 'Too many LLM requests. Please try again later.' },
        { status: 429 }
      );
    }

    const body = await req.json();
    
    // Validate request body
    const validation = llmStreamRequestSchema.safeParse(body);
    if (!validation.success) {
      return Response.json(
        { 
          error: 'Invalid request data',
          details: validation.error.issues.map(e => ({
            path: e.path.join('.'),
            message: e.message
          }))
        },
        { status: 400 }
      );
    }
    
    const { messages, model, modelConfig, systemMessage } = validation.data;
    
    // Sanitize message content
    const sanitizedMessages = messages.map(msg => ({
      ...msg,
      content: sanitizeString(msg.content)
    }));
    const sanitizedSystemMessage = systemMessage ? sanitizeString(systemMessage) : undefined;
    
    // Prepare Ollama request
    const ollamaRequest = {
      model,
      prompt: sanitizedMessages.map(m => `${m.role}: ${m.content}`).join('\n'),
      system: sanitizedSystemMessage,
      stream: true, // Enable streaming
      options: modelConfig || {}
    };
    
    // Make request to Ollama
    const response = await fetch(API_ENDPOINTS.OLLAMA_GENERATE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ollamaRequest)
    });
    
    if (!response.ok) {
      throw new Error(`Ollama error: ${response.status}`);
    }
    
    // Create a TransformStream to handle the streaming
    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();
    
    // Process the stream in the background
    (async () => {
      try {
        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response body');
        
        const decoder = new TextDecoder();
        let accumulatedResponse = '';
        let thinking = '';
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          // Parse NDJSON from Ollama
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n').filter(line => line.trim());
          
          for (const line of lines) {
            try {
              const data = JSON.parse(line);
              
              // Accumulate the response
              if (data.response) {
                accumulatedResponse += data.response;
                
                // Check for thinking tags (for models that support it)
                const thinkMatch = accumulatedResponse.match(/<think>([\s\S]*?)<\/think>/);
                if (thinkMatch && thinkMatch[1]) {
                  thinking = thinkMatch[1];
                }
                
                // Send SSE event to client
                const event = {
                  response: data.response,
                  accumulated: accumulatedResponse,
                  thinking: thinking,
                  done: data.done || false,
                  model: data.model,
                  eval_count: data.eval_count,
                  eval_duration: data.eval_duration
                };
                
                await writer.write(
                  encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
                );
              }
              
              // If done, send final event
              if (data.done) {
                const finalEvent = {
                  response: '',
                  accumulated: accumulatedResponse,
                  thinking: thinking,
                  done: true,
                  total_duration: data.total_duration,
                  eval_count: data.eval_count,
                  eval_duration: data.eval_duration,
                  tokens_per_second: data.eval_count && data.eval_duration 
                    ? (data.eval_count / (data.eval_duration / 1e9)).toFixed(2)
                    : 0
                };
                
                await writer.write(
                  encoder.encode(`data: ${JSON.stringify(finalEvent)}\n\n`)
                );
              }
            } catch (e) {
              const error = e instanceof Error ? e : new Error(String(e));
              logger.error('Error parsing Ollama response line:', error);
            }
          }
        }
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        logger.error('Stream processing error:', err);
        // Send error event
        await writer.write(
          encoder.encode(`data: ${JSON.stringify({ error: String(error) })}\n\n`)
        );
      } finally {
        await writer.close();
      }
    })();
    
    // Return SSE response
    return new Response(stream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no' // Disable Nginx buffering
      }
    });
    
  } catch (error) {
    return Response.json(
      { error: `Failed to stream LLM response: ${error}` },
      { status: 500 }
    );
  }
}

// OPTIONS for CORS if needed
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}
