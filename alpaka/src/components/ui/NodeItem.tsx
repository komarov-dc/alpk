'use client';


interface NodeTemplate {
  id: string;
  type: string;
  label: string;
  description: string;
  icon: string;
  category: string;
  comingSoon?: boolean;
}

interface NodeItemProps {
  node: NodeTemplate;
}

export const NodeItem = ({ node }: NodeItemProps) => {
  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div
      className={`bg-gray-800 border border-gray-700 rounded-lg p-3 transition-all duration-200 group relative ${
        node.comingSoon 
          ? 'cursor-not-allowed opacity-70' 
          : 'cursor-grab hover:shadow-lg hover:border-gray-600 hover:bg-gray-750'
      }`}
      draggable={!node.comingSoon}
      {...(!node.comingSoon && {
        onDragStart: (event: React.DragEvent<HTMLDivElement>) => onDragStart(event, node.type)
      })}
    >
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0">
          <div className="w-8 h-8 bg-white rounded-md border border-gray-200 flex items-center justify-center text-lg">
            {node.icon}
          </div>
        </div>
        
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-gray-900 truncate">
            {node.label}
          </h4>
          <p className="text-xs text-gray-500 mt-1 line-clamp-2">
            {node.description}
          </p>
          
          {/* Category Badge */}
          <div className="mt-2 flex items-center space-x-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              {node.category}
            </span>
            {node.comingSoon && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-800">
                Coming Soon
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Drag Indicator */}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="w-4 h-4 text-gray-400">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M9 3h2v2H9V3zm4 0h2v2h-2V3zM9 7h2v2H9V7zm4 0h2v2h-2V7zm-4 4h2v2H9v-2zm4 0h2v2h-2v-2zm-4 4h2v2H9v-2zm4 0h2v2h-2v-2zm-4 4h2v2H9v-2zm4 0h2v2h-2v-2z"/>
          </svg>
        </div>
      </div>
    </div>
  );
};
