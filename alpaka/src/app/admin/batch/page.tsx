"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import mammoth from "mammoth";

interface Project {
  id: string;
  name: string;
  description: string | null;
}

interface JobProgress {
  totalNodes: number;
  executedNodes: number;
  failedNodes: number;
  percentage: number;
}

interface BatchJob {
  id: string;
  sessionId: string;
  fileName: string | null;
  status: string;
  workerId: string | null;
  error: string | null;
  progress: JobProgress | null;
}

interface BatchUpload {
  id: string;
  name: string;
  projectId: string;
  projectName: string;
  status: string;
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  outputDir: string;
  createdAt: string;
  completedAt: string | null;
  jobs: BatchJob[];
}

interface FilePreview {
  name: string;
  size: number;
  content: string;
}

export default function BatchUploadPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [files, setFiles] = useState<FilePreview[]>([]);
  const [batches, setBatches] = useState<BatchUpload[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedBatch, setExpandedBatch] = useState<string | null>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const secret = typeof window !== 'undefined'
    ? process.env.NEXT_PUBLIC_ALPAKA_INTERNAL_SECRET || ""
    : "";

  // Fetch projects
  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch("/api/projects");
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects || []);
        // Auto-select first project
        if (data.projects?.length > 0 && !selectedProject) {
          setSelectedProject(data.projects[0].id);
        }
      }
    } catch (err) {
      console.error("Failed to fetch projects:", err);
    }
  }, [selectedProject]);

  // Fetch batches
  const fetchBatches = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/batch", {
        headers: { "X-Alpaka-Internal-Secret": secret },
      });
      if (res.ok) {
        const data = await res.json();
        setBatches(data.batches || []);
      }
    } catch (err) {
      console.error("Failed to fetch batches:", err);
    }
  }, [secret]);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchProjects(), fetchBatches()]).finally(() => setLoading(false));

    // Poll for batch updates every 5 seconds
    const interval = setInterval(fetchBatches, 5000);
    return () => clearInterval(interval);
  }, [fetchProjects, fetchBatches]);

  // Extract text from a file (.md or .docx)
  const extractText = async (file: File): Promise<string | null> => {
    const name = file.name.toLowerCase();
    if (name.endsWith('.md') || name.endsWith('.txt')) {
      return file.text();
    }
    if (name.endsWith('.docx')) {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      return result.value;
    }
    return null; // unsupported format
  };

  // Handle file/folder selection
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles) return;

    setError(null);
    setParsing(true);
    const previews: FilePreview[] = [];
    let skipped = 0;

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles.item(i);
      if (!file) continue;

      const name = file.name.toLowerCase();
      if (!name.endsWith('.md') && !name.endsWith('.txt') && !name.endsWith('.docx')) {
        skipped++;
        continue;
      }

      try {
        const content = await extractText(file);
        if (content) {
          previews.push({
            name: file.name,
            size: file.size,
            content,
          });
        }
      } catch (err) {
        console.error(`Failed to read file ${file.name}:`, err);
        setError(`Ошибка чтения "${file.name}"`);
      }
    }

    if (skipped > 0 && previews.length > 0) {
      setError(`Пропущено ${skipped} файл(ов) с неподдерживаемым форматом`);
    } else if (previews.length === 0) {
      setError('Не найдено файлов .docx, .md или .txt');
    }

    setFiles(previews);
    setParsing(false);
  };

  // Handle batch creation
  const handleStartBatch = async () => {
    if (!selectedProject || files.length === 0) {
      setError("Выберите проект и загрузите файлы");
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const project = projects.find(p => p.id === selectedProject);

      const res = await fetch("/api/admin/batch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Alpaka-Internal-Secret": secret,
        },
        body: JSON.stringify({
          projectId: selectedProject,
          projectName: project?.name || "Unknown",
          files: files.map(f => ({
            name: f.name,
            content: f.content,
          })),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create batch");
      }

      // Clear files and refresh batches
      setFiles([]);
      await fetchBatches();

      // Reset file inputs
      if (folderInputRef.current) folderInputRef.current.value = '';
      if (fileInputRef.current) fileInputRef.current.value = '';

    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setUploading(false);
    }
  };

  // Format file size
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Format date
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Get status badge color
  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "bg-green-500/20 text-green-500";
      case "processing": return "bg-blue-500/20 text-blue-500";
      case "failed": return "bg-red-500/20 text-red-500";
      case "partial": return "bg-yellow-500/20 text-yellow-500";
      default: return "bg-gray-500/20 text-gray-400";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Upload Section */}
      <div className="surface-base border-default rounded-lg p-6">
        <h2 className="text-lg font-bold mb-4">Массовая загрузка текстов</h2>

        {error && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Project Selection */}
        <div className="mb-4">
          <label className="block text-sm text-gray-400 mb-2">
            Выберите пайплайн (проект)
          </label>
          <select
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            className="w-full bg-gray-800 border border-gray-600 rounded px-4 py-2 text-white focus:outline-none focus:border-blue-500"
          >
            <option value="">-- Выберите проект --</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </div>

        {/* File Upload */}
        <div className="mb-4">
          <label className="block text-sm text-gray-400 mb-2">
            Загрузите файлы (.docx, .md, .txt)
          </label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => folderInputRef.current?.click()}
              className="flex-1 bg-gray-800 border border-gray-600 rounded px-4 py-3 text-white hover:bg-gray-700 hover:border-blue-500 transition-colors cursor-pointer text-center"
            >
              Выбрать папку
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 bg-gray-800 border border-gray-600 rounded px-4 py-3 text-gray-400 hover:bg-gray-700 hover:border-gray-500 transition-colors cursor-pointer text-center"
            >
              Выбрать файлы
            </button>
          </div>
          {/* Hidden inputs */}
          <input
            ref={folderInputRef}
            type="file"
            accept=".docx,.md,.txt"
            // @ts-expect-error webkitdirectory is non-standard but supported in all major browsers
            webkitdirectory=""
            onChange={handleFileSelect}
            className="hidden"
          />
          <input
            ref={fileInputRef}
            type="file"
            accept=".docx,.md,.txt"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
          {parsing && (
            <div className="mt-2 text-sm text-blue-400">
              Чтение файлов...
            </div>
          )}
        </div>

        {/* File Preview */}
        {files.length > 0 && (
          <div className="mb-4">
            <div className="text-sm text-gray-400 mb-2">
              Загружено файлов: <span className="text-white font-bold">{files.length}</span>
            </div>

            <div className="bg-gray-800/50 rounded p-4 max-h-48 overflow-y-auto">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {files.map((file, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 text-sm text-gray-300 bg-gray-700/50 rounded px-2 py-1"
                  >
                    <span className="truncate">{file.name}</span>
                    <span className="text-gray-500 text-xs whitespace-nowrap">
                      {formatSize(file.size)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Output Preview */}
            <div className="mt-4 p-4 bg-gray-800/30 rounded border border-dashed border-gray-600">
              <div className="text-sm text-gray-400 mb-2">После обработки:</div>
              <div className="font-mono text-sm text-green-400">
                <div>output/batch_[timestamp]/</div>
                {files.slice(0, 3).map((file, idx) => {
                  const baseName = file.name.replace(/\.(docx|md|txt)$/i, '');
                  return (
                    <div key={idx} className="ml-4 text-gray-400">
                      {baseName}/
                      <span className="text-gray-500 ml-2">
                        (adapted.md, professional.md, scores.md)
                      </span>
                    </div>
                  );
                })}
                {files.length > 3 && (
                  <div className="ml-4 text-gray-500">
                    ... и ещё {files.length - 3} папок
                  </div>
                )}
              </div>
              <div className="mt-2 text-sm text-gray-500">
                Всего: {files.length} папок x 3 файла = {files.length * 3} файлов
              </div>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <button
          onClick={handleStartBatch}
          disabled={uploading || !selectedProject || files.length === 0}
          className="w-full btn-base btn-primary py-3 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {uploading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Создание задач...
            </span>
          ) : (
            `Запустить обработку (${files.length} файлов)`
          )}
        </button>
      </div>

      {/* Batch History */}
      <div>
        <h2 className="text-lg font-bold mb-4">История batch-загрузок</h2>

        {batches.length === 0 ? (
          <div className="surface-base border-default rounded-lg p-8 text-center text-gray-400">
            Нет batch-загрузок
          </div>
        ) : (
          <div className="space-y-3">
            {batches.map((batch) => {
              const progress = batch.totalJobs > 0
                ? Math.round(((batch.completedJobs + batch.failedJobs) / batch.totalJobs) * 100)
                : 0;
              const isExpanded = expandedBatch === batch.id;

              return (
                <div key={batch.id} className="surface-base border-default rounded-lg overflow-hidden">
                  {/* Batch header - clickable */}
                  <div
                    className="px-4 py-3 flex items-center gap-4 cursor-pointer hover:bg-gray-800/30"
                    onClick={() => setExpandedBatch(isExpanded ? null : batch.id)}
                  >
                    <span className="text-gray-500 text-xs">
                      {isExpanded ? '▼' : '▶'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-mono text-gray-300 truncate">
                          {batch.name}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-xs ${getStatusColor(batch.status)}`}>
                          {batch.status}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {batch.projectName} · {formatDate(batch.createdAt)}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${
                              batch.failedJobs > 0 ? 'bg-yellow-500' : 'bg-green-500'
                            }`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <span className="text-gray-400 text-xs whitespace-nowrap">
                          {batch.completedJobs}/{batch.totalJobs}
                          {batch.failedJobs > 0 && (
                            <span className="text-red-400 ml-1">
                              ({batch.failedJobs} err)
                            </span>
                          )}
                        </span>
                      </div>
                      <span className="text-xs font-mono text-gray-600 hidden md:inline">
                        {batch.outputDir.split('/').pop()}
                      </span>
                    </div>
                  </div>

                  {/* Expanded: per-job details */}
                  {isExpanded && batch.jobs && (
                    <div className="border-t border-gray-700">
                      <table className="w-full">
                        <thead className="bg-gray-800/50">
                          <tr>
                            <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Файл</th>
                            <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Статус</th>
                            <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Прогресс по нодам</th>
                            <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Воркер</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800">
                          {batch.jobs.map((job) => (
                            <tr key={job.id} className="hover:bg-gray-800/20">
                              <td className="px-4 py-2 text-sm text-gray-300">
                                {job.fileName || job.sessionId}
                              </td>
                              <td className="px-4 py-2 text-sm">
                                <span className={`px-2 py-0.5 rounded text-xs ${getStatusColor(job.status)}`}>
                                  {job.status}
                                </span>
                              </td>
                              <td className="px-4 py-2 text-sm">
                                {job.progress ? (
                                  <div className="flex items-center gap-2">
                                    <div className="w-24 h-2 bg-gray-700 rounded-full overflow-hidden">
                                      <div
                                        className="h-full bg-green-500 transition-all duration-300"
                                        style={{ width: `${job.progress.percentage}%` }}
                                      />
                                    </div>
                                    <span className="text-gray-400 text-xs font-mono">
                                      {job.progress.executedNodes}/{job.progress.totalNodes}
                                    </span>
                                    <span className="text-gray-500 text-xs">
                                      ({job.progress.percentage}%)
                                    </span>
                                    {job.progress.failedNodes > 0 && (
                                      <span className="text-red-400 text-xs">
                                        {job.progress.failedNodes} err
                                      </span>
                                    )}
                                  </div>
                                ) : job.status === 'queued' ? (
                                  <span className="text-gray-500 text-xs">В очереди</span>
                                ) : job.status === 'completed' ? (
                                  <span className="text-green-500 text-xs">Готово</span>
                                ) : job.status === 'failed' ? (
                                  <span className="text-red-400 text-xs" title={job.error || ''}>
                                    Ошибка{job.error ? `: ${job.error.slice(0, 50)}` : ''}
                                  </span>
                                ) : (
                                  <span className="text-gray-500 text-xs">Запуск...</span>
                                )}
                              </td>
                              <td className="px-4 py-2 text-xs text-gray-500 font-mono">
                                {job.workerId || '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
