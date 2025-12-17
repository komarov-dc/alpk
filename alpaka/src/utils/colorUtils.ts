/**
 * Утилиты для генерации и управления цветами связей
 */

// Autumn/Ochre palette - теплые осенние цвета для связей
const COLOR_PALETTE = [
  '#D2691E', // chocolate
  '#CD853F', // peru  
  '#DEB887', // burlywood
  '#F4A460', // sandy brown
  '#DAA520', // goldenrod
  '#B8860B', // dark goldenrod
  '#BC8F8F', // rosy brown
  '#A0522D', // sienna
  '#8B4513', // saddle brown
  '#D2B48C', // tan
  '#F5DEB3', // wheat
  '#FFEFD5', // papaya whip
  '#FFE4B5', // moccasin
  '#FFDAB9', // peach puff
  '#E6B87D', // light brown
  '#C19A6B', // camel
];

// Дополнительные осенние оттенки для больших workflow
const EXTENDED_COLORS = [
  '#CD853F', // peru
  '#D2691E', // chocolate  
  '#A0522D', // sienna
  '#8B4513', // saddle brown
  '#DAA520', // goldenrod
  '#B8860B', // dark goldenrod
  '#F4A460', // sandy brown
  '#DEB887', // burlywood
  '#BC8F8F', // rosy brown
  '#D2B48C', // tan
];

const ALL_COLORS = [...COLOR_PALETTE, ...EXTENDED_COLORS];

/**
 * Генерирует детерминированный цвет на основе строки
 * Одинаковые строки всегда дают одинаковый цвет
 */
export function generateColorFromString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  const index = Math.abs(hash) % ALL_COLORS.length;
  return ALL_COLORS[index] || '#D2691E'; // Default to chocolate if undefined
}

/**
 * Генерирует цвет для связи между двумя нодами
 */
export function generateEdgeColor(sourceId: string, targetId: string): string {
  // Создаем уникальную строку для каждой связи
  const edgeKey = `${sourceId}->${targetId}`;
  return generateColorFromString(edgeKey);
}

/**
 * Получает цвет для переменной на основе её источника
 */
export function getVariableColor(sourceNodeId: string, targetNodeId: string): string {
  return generateEdgeColor(sourceNodeId, targetNodeId);
}

/**
 * Конвертирует цвет в более светлый вариант для фона
 */
export function lightenColor(color: string, opacity = 0.1): string {
  // Конвертируем hex в RGB и добавляем прозрачность
  const hex = color.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

/**
 * Получает контрастный цвет текста для фона
 */
export function getContrastTextColor(backgroundColor: string): string {
  // Для простоты возвращаем белый или черный в зависимости от яркости
  const hex = backgroundColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  
  // Формула для определения яркости
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 128 ? '#000000' : '#FFFFFF';
}

/**
 * Создает карту цветов для всех связей в workflow
 */
export function createEdgeColorMap(edges: Array<{ id: string; source: string; target: string }>): Record<string, string> {
  const colorMap: Record<string, string> = {};
  
  edges.forEach(edge => {
    const color = generateEdgeColor(edge.source, edge.target);
    colorMap[edge.id] = color;
  });
  
  return colorMap;
}
