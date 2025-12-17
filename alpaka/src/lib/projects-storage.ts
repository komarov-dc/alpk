interface ProjectData {
  id: string;
  name: string;
  description?: string;
  nodes: unknown[];
  edges: unknown[];
  createdAt: string;
  updatedAt: string;
}

// Временное хранилище проектов (в реальном приложении используйте базу данных)
export const projects: ProjectData[] = [
  {
    id: 'demo-project',
    name: 'Demo Project',
    description: 'Example AI workflow project',
    nodes: [],
    edges: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
];

export type { ProjectData };
