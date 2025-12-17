"use client";

import React, { useState, useEffect } from "react";
import { useFlowStore } from "@/store/useFlowStore";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { logger } from "@/utils/logger";
import { ClientDate } from "@/components/ui/ClientDate";

interface Project {
  id: string;
  name: string;
  description?: string;
  isSystem?: boolean;
  templateId?: string;
  nodeCount: number;
  edgeCount: number;
  createdAt: string;
  updatedAt: string;
}

interface ProjectManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProjectManager = ({ isOpen, onClose }: ProjectManagerProps) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDescription, setNewProjectDescription] = useState("");
  const router = useRouter();

  const { currentProject, nodes, edges, loadProject, saveProject } =
    useFlowStore();

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/projects");
      const data = await response.json();
      if (data.success) {
        setProjects(data.projects);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error : new Error(String(error));
      logger.error("Failed to fetch projects:", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchProjects();
    }
  }, [isOpen]);

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;

    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newProjectName,
          description: newProjectDescription,
        }),
      });

      const data = await response.json();
      if (data.success) {
        const projectName = encodeURIComponent(data.project.name);
        await loadProject(data.project.id);
        setNewProjectName("");
        setNewProjectDescription("");
        setShowNewProject(false);
        onClose();
        // Navigate to new project URL
        router.push(`/${projectName}`);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error : new Error(String(error));
      logger.error("Failed to create project:", errorMessage);
    }
  };

  const handleLoadProject = async (projectId: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}`);
      const data = await response.json();
      if (data.success) {
        const projectName = encodeURIComponent(data.project.name);
        await loadProject(data.project.id);
        onClose();
        // Navigate to project URL
        router.push(`/${projectName}`);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error : new Error(String(error));
      logger.error("Failed to load project:", errorMessage);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    if (!confirm("Are you sure you want to delete this project?")) return;

    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        fetchProjects();
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error : new Error(String(error));
      logger.error("Failed to delete project:", errorMessage);
    }
  };

  const handleDuplicateProject = async (projectId: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/duplicate`, {
        method: "POST",
      });

      const data = await response.json();
      if (data.success) {
        fetchProjects(); // Refresh the projects list
        logger.debug(`Project duplicated: ${data.project.name}`);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error : new Error(String(error));
      logger.error("Failed to duplicate project:", errorMessage);
    }
  };

  const handleSaveCurrentProject = async () => {
    if (currentProject) {
      await saveProject();
      fetchProjects();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-black border border-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-white">
                  Project Manager
                </h2>
                <div className="flex space-x-2">
                  {currentProject && (
                    <button
                      onClick={handleSaveCurrentProject}
                      className="px-4 py-2 bg-white text-black text-sm font-medium rounded-md hover:bg-gray-200 transition-colors"
                    >
                      Save Current
                    </button>
                  )}
                  <button
                    onClick={() => setShowNewProject(true)}
                    className="px-4 py-2 bg-white text-black text-sm font-medium rounded-md hover:bg-gray-200 transition-colors"
                  >
                    New Project
                  </button>
                  <button
                    onClick={onClose}
                    className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>

            {/* Current Project Info */}
            {currentProject && (
              <div className="p-6 bg-gray-900 border-b border-gray-700">
                <h3 className="text-sm font-medium text-white mb-1">
                  Current Project
                </h3>
                <p className="text-lg font-semibold text-white">
                  {currentProject.name}
                </p>
                {currentProject.description && (
                  <p className="text-sm text-gray-300 mt-1">
                    {currentProject.description}
                  </p>
                )}
                <div className="flex space-x-4 mt-2 text-xs text-gray-400">
                  <span>{nodes.length} nodes</span>
                  <span>{edges.length} connections</span>
                </div>
              </div>
            )}

            {/* New Project Form */}
            <AnimatePresence>
              {showNewProject && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="border-b border-gray-700 overflow-hidden"
                >
                  <div className="p-6 bg-gray-800">
                    <h3 className="text-lg font-medium text-white mb-4">
                      Create New Project
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Project Name *
                        </label>
                        <input
                          type="text"
                          value={newProjectName}
                          onChange={(e) => setNewProjectName(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="My AI Workflow"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Description
                        </label>
                        <textarea
                          value={newProjectDescription}
                          onChange={(e) =>
                            setNewProjectDescription(e.target.value)
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          rows={2}
                          placeholder="Describe your workflow..."
                        />
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={handleCreateProject}
                          disabled={!newProjectName.trim()}
                          className="px-4 py-2 bg-white text-black text-sm font-medium rounded-md hover:bg-gray-200 disabled:bg-gray-600 transition-colors"
                        >
                          Create Project
                        </button>
                        <button
                          onClick={() => setShowNewProject(false)}
                          className="px-4 py-2 bg-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-400 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Projects List */}
            <div className="p-6 max-h-96 overflow-y-auto">
              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto"></div>
                  <p className="text-gray-500 mt-2">Loading projects...</p>
                </div>
              ) : projects.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">No projects found</p>
                  <p className="text-sm text-gray-400 mt-1">
                    Create your first project to get started
                  </p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {projects.map((project) => (
                    <div
                      key={project.id}
                      className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-white">
                              {project.name}
                            </h4>
                            {project.isSystem && (
                              <span className="px-2 py-0.5 bg-gray-700 text-gray-300 text-xs rounded">
                                Системный
                              </span>
                            )}
                          </div>
                          {project.description && (
                            <p className="text-sm text-gray-600 mt-1">
                              {project.description}
                            </p>
                          )}
                          <div className="flex space-x-4 mt-2 text-xs text-gray-500">
                            <span>{project.nodeCount} nodes</span>
                            <span>{project.edgeCount} connections</span>
                            <span>
                              Updated{" "}
                              <ClientDate
                                date={project.updatedAt}
                                format="date"
                              />
                            </span>
                          </div>
                        </div>
                        <div className="flex space-x-2 ml-4">
                          <button
                            onClick={() => handleLoadProject(project.id)}
                            className="px-3 py-1 bg-white text-black text-xs font-medium rounded hover:bg-gray-200 transition-colors"
                          >
                            Load
                          </button>
                          <button
                            onClick={() => handleDuplicateProject(project.id)}
                            className="px-3 py-1 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 transition-colors"
                            title="Duplicate project"
                          >
                            Duplicate
                          </button>
                          {!project.isSystem && (
                            <button
                              onClick={() => handleDeleteProject(project.id)}
                              className="px-3 py-1 bg-red-600 text-white text-xs font-medium rounded hover:bg-red-700 transition-colors"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
