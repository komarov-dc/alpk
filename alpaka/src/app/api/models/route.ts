import { NextResponse } from 'next/server';
import { API_ENDPOINTS } from '@/config/api';
import { logger } from '@/utils/logger';
import type { ModelsListResponse, ModelItem } from '@/types/api';

export async function GET() {
  try {// Прямой запрос к Ollama API без использования клиента
    const response = await fetch(API_ENDPOINTS.OLLAMA_TAGS, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    // Форматируем список моделей для UI
    const models: ModelItem[] = data.models?.map((model: Record<string, unknown>) => ({
      name: String(model.name || ''), // Полное имя для API вызовов
      size: Number(model.size || 0),
      digest: String(model.digest || ''),
      // Используем полное имя для отображения, но делаем его более читаемым
      displayName: String(model.name || '').replace(/:/g, ' ').replace(/-/g, ' ')
    })) || [];

    const apiResponse: ModelsListResponse = {
      success: true,
      models,
      total: models.length
    };
    return NextResponse.json(apiResponse);

  } catch (error) {
    logger.error('Failed to fetch Ollama models:', error as Error);
    
    // Возвращаем fallback модели при ошибке
    const fallbackModels: ModelItem[] = [
      { name: 'llama3.2', displayName: 'Llama 3.2', size: 0, digest: '' },
      { name: 'llama3.1', displayName: 'Llama 3.1', size: 0, digest: '' },
      { name: 'mistral', displayName: 'Mistral', size: 0, digest: '' },
      { name: 'codellama', displayName: 'Code Llama', size: 0, digest: '' },
      { name: 'phi3', displayName: 'Phi-3', size: 0, digest: '' },
      { name: 'gemma2', displayName: 'Gemma 2', size: 0, digest: '' },
    ];
    
    const fallbackResponse: ModelsListResponse = {
      success: true,
      models: fallbackModels,
      total: fallbackModels.length,
      fallback: true
    };
    return NextResponse.json(fallbackResponse, { status: 200 });
  }
}
