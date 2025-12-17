import { useCallback } from 'react';

/**
 * Хук для предотвращения скролла канваса при скролле внутри нод
 */
export const usePreventCanvasScroll = () => {
  const handleWheel = useCallback((event: React.WheelEvent) => {
    // Предотвращаем всплытие события скролла к родительским элементам
    // Это останавливает масштабирование канваса при скролле внутри ноды
    event.stopPropagation();
  }, []);

  const handleMouseEnter = useCallback(() => {
    // Временно отключено для диагностики проблем с перетаскиванием
    // event.stopPropagation();
  }, []);

  const handleMouseLeave = useCallback(() => {
    // Временно отключено для диагностики проблем с перетаскиванием  
    // event.stopPropagation();
  }, []);

  return {
    onWheel: handleWheel,
    onMouseEnter: handleMouseEnter,
    onMouseLeave: handleMouseLeave,
  };
};
