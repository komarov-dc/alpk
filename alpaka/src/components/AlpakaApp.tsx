'use client';

import { useEffect, useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FlowCanvas } from '@/components/FlowCanvas';
import { Sidebar } from '@/components/Sidebar';
import { CanvasToolbar } from '@/components/ui/CanvasToolbar';
import { useFlowStore } from '@/store/useFlowStore';
import { ReactFlowProvider } from '@xyflow/react';
import { logger } from '@/utils/logger';
import { historyManager } from '@/store/modules/historyManager';

interface AlpakaAppProps {
  projectName?: string;
}

// Компонент с зумом, который должен быть внутри ReactFlowProvider
const AlpakaAppInner = ({ projectName }: AlpakaAppProps) => {
  const { 
    createProject, 
    createNewProject,
    loadProject, 
    cursorMode, 
    setCursorMode
  } = useFlowStore();
  // React Flow instance removed - not needed for current functionality
  const router = useRouter();
  const [isExecutionManagerOpen, setIsExecutionManagerOpen] = useState(false);
  const [isVariableManagerOpen, setIsVariableManagerOpen] = useState(false);

  const loadProjectByName = useCallback(async (projectName: string, router: ReturnType<typeof useRouter>) => {
    try {
      const response = await fetch('/api/projects');
      if (!response.ok) {
        throw new Error('Failed to fetch projects');
      }
      
      const data = await response.json();
      const projects = data.success ? data.projects : [];
      
      const project = projects.find((p: { name: string; id: string }) => p.name === projectName);
      
      if (project) {
        // Загружаем полные данные проекта через API
        const fullProjectResponse = await fetch(`/api/projects/${project.id}`);
        if (fullProjectResponse.ok) {
          const fullProjectData = await fullProjectResponse.json();
          if (fullProjectData.success) {
            await loadProject(project.id);
          } else {
            throw new Error('Failed to load full project data');
          }
        } else {
          throw new Error('Project not found');
        }
      } else {
        // If project not found, redirect to home
        router.push('/');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to load project by name:', errorMessage);
      // On error, redirect to home
      router.push('/');
    }
  }, [loadProject]);

  useEffect(() => {
    // CRITICAL: Clear history on app start to free old memory-heavy snapshots
    historyManager.clearHistory();
    
    const initializeApp = async () => {
      if (projectName) {
        // Try to load project by name from URL
        loadProjectByName(projectName, router);
      } else {
        // On home page, try to load the last project
        try {
          const response = await fetch('/api/projects');
          const data = await response.json();
          
          if (data.success && data.projects && data.projects.length > 0) {
            // Load the most recent project (first in the list)
            const lastProject = data.projects[0];
            try {
              await loadProject(lastProject.id);
              // Update URL to reflect the loaded project
              const projectName = encodeURIComponent(lastProject.name);
              router.replace(`/${projectName}`);
            } catch (loadError) {
              const errorMessage = loadError instanceof Error ? loadError : new Error(String(loadError));
              logger.error('Failed to load project:', errorMessage);
              // If loading fails, create a new project
              await createNewProject();
            }
          } else {
            // No projects exist, create a default one
            await createNewProject();
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error : new Error(String(error));
          logger.error('Failed to fetch projects:', errorMessage);
          // Fallback to creating new project
          await createNewProject();
        }
      }
    };

    initializeApp();
  }, [projectName, createProject, createNewProject, router, loadProjectByName, loadProject]);


  return (
    <div className="h-screen w-full flex overflow-hidden font-mono bg-black">
      <Sidebar 
        onExecutionManagerToggle={setIsExecutionManagerOpen}
        onVariableManagerToggle={setIsVariableManagerOpen} 
      />
      <div className="flex-1 relative">
        <FlowCanvas />
        {!isExecutionManagerOpen && !isVariableManagerOpen && (
          <CanvasToolbar
            cursorMode={cursorMode}
            onCursorModeChange={setCursorMode}
          />
        )}
      </div>
    </div>
  );
}

// Основной экспортируемый компонент с ReactFlowProvider
export default function AlpakaApp({ projectName }: AlpakaAppProps) {
  return (
    <ReactFlowProvider>
      <AlpakaAppInner projectName={projectName} />
    </ReactFlowProvider>
  );
}
