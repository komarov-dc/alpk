import { useState, useCallback, useRef } from 'react';
import { logger } from '@/utils/logger';

interface StreamingOptions {
  onToken?: (token: string) => void;
  onComplete?: (fullResponse: string, thinking?: string) => void;
  onError?: (error: string) => void;
  onStats?: (stats: StreamStats) => void;
}

interface StreamStats {
  tokensGenerated: number;
  tokensPerSecond: number;
  duration: number;
}

interface StreamingState {
  isStreaming: boolean;
  response: string;
  thinking: string;
  error: string | null;
  stats: StreamStats | null;
}

export function useStreamingLLM(options: StreamingOptions = {}) {
  const [state, setState] = useState<StreamingState>({
    isStreaming: false,
    response: '',
    thinking: '',
    error: null,
    stats: null
  });
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const startTimeRef = useRef<number>(0);
  
  const startStreaming = useCallback(async (
    messages: Array<{ role: string; content: string }>,
    model: string,
    modelConfig?: Record<string, unknown>,
    systemMessage?: string
  ) => {
    // Reset state
    setState({
      isStreaming: true,
      response: '',
      thinking: '',
      error: null,
      stats: null
    });
    
    // Create abort controller for cancellation
    abortControllerRef.current = new AbortController();
    startTimeRef.current = Date.now();
    
    try {
      const response = await fetch('/api/llm/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages,
          model,
          modelConfig,
          systemMessage
        }),
        signal: abortControllerRef.current.signal
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }
      
      const decoder = new TextDecoder();
      let buffer = '';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        // Decode chunk and add to buffer
        buffer += decoder.decode(value, { stream: true });
        
        // Process complete SSE events from buffer
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            
            try {
              const event = JSON.parse(data);
              
              if (event.error) {
                throw new Error(event.error);
              }
              
              // Update state with new data
              setState(prev => ({
                ...prev,
                response: event.accumulated || prev.response,
                thinking: event.thinking || prev.thinking
              }));
              
              // Call token callback if provided
              if (event.response && options.onToken) {
                options.onToken(event.response);
              }
              
              // Handle completion
              if (event.done) {
                const duration = Date.now() - startTimeRef.current;
                const stats: StreamStats = {
                  tokensGenerated: event.eval_count || 0,
                  tokensPerSecond: parseFloat(event.tokens_per_second || '0'),
                  duration
                };
                
                setState(prev => ({
                  ...prev,
                  isStreaming: false,
                  stats
                }));
                
                if (options.onComplete) {
                  options.onComplete(event.accumulated, event.thinking);
                }
                
                if (options.onStats) {
                  options.onStats(stats);
                }
              }
            } catch (e) {
              logger.error('Error parsing SSE event:', e as Error);
            }
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        // Streaming aborted - expected behavior, no logging needed
      } else {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        setState(prev => ({
          ...prev,
          isStreaming: false,
          error: errorMessage
        }));
        
        if (options.onError) {
          options.onError(errorMessage);
        }
      }
    } finally {
      setState(prev => ({ ...prev, isStreaming: false }));
      abortControllerRef.current = null;
    }
  }, [options]);
  
  const stopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setState(prev => ({ ...prev, isStreaming: false }));
    }
  }, []);
  
  const resetState = useCallback(() => {
    setState({
      isStreaming: false,
      response: '',
      thinking: '',
      error: null,
      stats: null
    });
  }, []);
  
  return {
    ...state,
    startStreaming,
    stopStreaming,
    resetState
  };
}
