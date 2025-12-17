import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface MenuItem {
  id: string;
  label: string;
  icon?: string;
  onClick?: () => void;
  disabled?: boolean;
  submenu?: MenuItem[];
  separator?: boolean;
}

interface MenuProps {
  items: MenuItem[];
  position: { x: number; y: number };
  onClose: () => void;
  className?: string;
  level?: number;
}

interface SubmenuState {
  itemId: string;
  position: { x: number; y: number };
  items: MenuItem[];
}

const Menu: React.FC<MenuProps> = ({ 
  items, 
  position, 
  onClose, 
  className = '',
  level = 0 
}) => {
  const [activeSubmenu, setActiveSubmenu] = useState<SubmenuState | null>(null);
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const clearHoverTimeout = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
  };

  const handleItemHover = (item: MenuItem, event: React.MouseEvent) => {
    clearHoverTimeout();
    setHoveredItemId(item.id);
    
    if (item.submenu && item.submenu.length > 0) {
      const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      // Умное позиционирование - проверяем, поместится ли подменю справа
      let submenuX = rect.right + 5;
      let submenuY = rect.top;
      
      // Если подменю не помещается справа, показываем слева
      if (submenuX + 200 > viewportWidth) {
        submenuX = rect.left - 205;
      }
      
      // Если подменю не помещается снизу, сдвигаем вверх
      if (submenuY + 200 > viewportHeight) {
        submenuY = Math.max(10, viewportHeight - 210);
      }

      setActiveSubmenu({
        itemId: item.id,
        position: { x: submenuX, y: submenuY },
        items: item.submenu
      });
    } else {
      setActiveSubmenu(null);
    }
  };

  const handleItemLeave = () => {
    clearHoverTimeout();
    
    // Увеличиваем задержку для более стабильной работы
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredItemId(null);
      setActiveSubmenu(null);
    }, 150);
  };

  const handleSubmenuEnter = () => {
    clearHoverTimeout();
  };

  const handleSubmenuLeave = () => {
    // Добавляем небольшую задержку для более плавного перехода
    hoverTimeoutRef.current = setTimeout(() => {
      setActiveSubmenu(null);
      setHoveredItemId(null);
    }, 100);
  };

  const handleItemClick = (item: MenuItem) => {
    if (item.onClick && !item.disabled && !item.submenu) {
      item.onClick();
      onClose();
    }
  };

  const renderMenuItem = (item: MenuItem) => {
    const hasSubmenu = item.submenu && item.submenu.length > 0;
    const isHovered = hoveredItemId === item.id;

    if (item.separator) {
      return (
        <div className="h-px bg-gray-200 my-1" />
      );
    }

    return (
      <div
        className={`
          flex items-center justify-between px-3 py-2 text-sm cursor-pointer transition-colors
          ${item.disabled 
            ? 'text-gray-400 cursor-not-allowed' 
            : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
          }
          ${isHovered ? 'bg-gray-100' : ''}
        `}
        onMouseEnter={(e) => handleItemHover(item, e)}
        onMouseLeave={handleItemLeave}
        onClick={() => handleItemClick(item)}
      >
        <div className="flex items-center space-x-2">
          {item.icon && (
            <span className="text-base">{item.icon}</span>
          )}
          <span>{item.label}</span>
        </div>
        {hasSubmenu && (
          <span className="text-gray-400 ml-2">▶</span>
        )}
      </div>
    );
  };

  useEffect(() => {
    return () => {
      clearHoverTimeout();
    };
  }, []);

  return (
    <>
      <motion.div
        ref={menuRef}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.1 }}
        className={`
          fixed bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-48
          ${className}
        `}
        style={{
          left: position.x,
          top: position.y,
          zIndex: 50 + level,
        }}
      >
        {items.map((item) => (
          <React.Fragment key={item.id}>
            {renderMenuItem(item)}
          </React.Fragment>
        ))}
      </motion.div>

      {/* Рекурсивные подменю */}
      <AnimatePresence>
        {activeSubmenu && (
          <div
            onMouseEnter={handleSubmenuEnter}
            onMouseLeave={handleSubmenuLeave}
          >
            <Menu
              items={activeSubmenu.items}
              position={activeSubmenu.position}
              onClose={onClose}
              level={level + 1}
            />
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

interface HierarchicalContextMenuProps {
  items: MenuItem[];
  isOpen: boolean;
  position: { x: number; y: number };
  onClose: () => void;
  className?: string;
}

export const HierarchicalContextMenu: React.FC<HierarchicalContextMenuProps> = ({
  items,
  isOpen,
  position,
  onClose,
  className = ''
}) => {

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      let isInsideMenu = false;
      
      // Более надежная проверка - ищем любой элемент с высоким z-index (наши меню)
      let currentElement = target;
      while (currentElement && currentElement !== document.body) {
        const computedStyle = window.getComputedStyle(currentElement);
        const zIndex = parseInt(computedStyle.zIndex || '0');
        
        if (zIndex >= 50 && 
            (currentElement.classList?.contains('bg-white') || 
             currentElement.classList?.contains('rounded-lg') ||
             currentElement.closest('[style*="z-index"]'))) {
          isInsideMenu = true;
          break;
        }
        currentElement = currentElement.parentElement as Element;
      }
      
      if (!isInsideMenu) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      // Небольшая задержка чтобы избежать немедленного закрытия
      setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleEscape);
      }, 10);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <Menu
        items={items}
        position={position}
        onClose={onClose}
        className={className}
      />
    </AnimatePresence>
  );
};