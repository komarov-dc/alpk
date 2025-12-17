"use client";

import { useState, useEffect } from "react";
import { ProgressLogViewer } from "@/components/admin/ProgressLogViewer";

interface WorkerStatus {
  name: string;
  status: "online" | "stopped" | "errored" | "unknown";
  uptime: number;
  restarts: number;
  cpu: number;
  memory: number;
  instances: number;
  projectName: string;
  lastExecutionAt: string | null;
}

interface StatsData {
  today: {
    totalJobs: number;
    completedJobs: number;
    failedJobs: number;
    averageDuration: {
      prof: number;
      bigfive: number;
    };
  };
  queued: number;
}

interface JobProgress {
  totalNodes: number;
  executedNodes: number;
  failedNodes: number;
  currentNodeId: string | null;
  startedAt: string;
  percentage: number;
}

interface ActiveJob {
  id: string;
  sessionId: string;
  mode: string;
  status: string;
  workerId: string | null;
  createdAt: string;
  updatedAt: string;
  progress: JobProgress | null;
}

export default function AdminWorkersPage() {
  const [workers, setWorkers] = useState<WorkerStatus[]>([]);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [activeJobs, setActiveJobs] = useState<ActiveJob[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const secret = process.env.NEXT_PUBLIC_ALPAKA_INTERNAL_SECRET || "";

      const [workersRes, statsRes, jobsRes] = await Promise.all([
        fetch("/api/admin/workers/status", {
          headers: { "X-Alpaka-Internal-Secret": secret },
        }),
        fetch("/api/admin/stats", {
          headers: { "X-Alpaka-Internal-Secret": secret },
        }),
        fetch("/api/admin/jobs?status=processing", {
          headers: { "X-Alpaka-Internal-Secret": secret },
        }),
      ]);

      if (workersRes.ok) {
        const workersData = await workersRes.json();
        setWorkers(workersData);
      }

      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data);
      }

      if (jobsRes.ok) {
        const data = await jobsRes.json();
        setActiveJobs(data.jobs || []);
      }
    } catch (error) {
      console.error("Failed to fetch admin data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Auto-refresh every 5 seconds
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleWorkerAction = async (
    workerName: string,
    action: "start" | "stop" | "restart",
  ) => {
    setActionLoading(`${workerName}-${action}`);
    try {
      const secret = process.env.NEXT_PUBLIC_ALPAKA_INTERNAL_SECRET || "";
      const res = await fetch(`/api/admin/workers/${workerName}/${action}`, {
        method: "POST",
        headers: { "X-Alpaka-Internal-Secret": secret },
      });

      const data = await res.json();

      if (data.success) {
        // Refresh data after action
        setTimeout(fetchData, 1000);
      } else {
        alert(`Failed to ${action} worker: ${data.error || data.message}`);
      }
    } catch (error) {
      console.error(`Failed to ${action} worker:`, error);
      alert(`Failed to ${action} worker`);
    } finally {
      setActionLoading(null);
    }
  };

  const formatUptime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
    return `${Math.floor(seconds / 86400)}d`;
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  };

  const formatLastExecution = (date: string | null) => {
    if (!date) return "Никогда";
    const diff = Date.now() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "Только что";
    if (minutes < 60) return `${minutes} мин назад`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} ч назад`;
    return `${Math.floor(hours / 24)} дн назад`;
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
      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="surface-base border-default rounded-lg p-4">
            <div className="text-gray-400 text-sm">Задач сегодня</div>
            <div className="text-2xl font-bold mt-1">
              {stats.today.totalJobs}
            </div>
          </div>
          <div className="surface-base border-default rounded-lg p-4">
            <div className="text-gray-400 text-sm">Завершено</div>
            <div className="text-2xl font-bold mt-1 text-green-500">
              {stats.today.completedJobs}
            </div>
          </div>
          <div className="surface-base border-default rounded-lg p-4">
            <div className="text-gray-400 text-sm">Ошибок</div>
            <div className="text-2xl font-bold mt-1 text-red-500">
              {stats.today.failedJobs}
            </div>
          </div>
          <div className="surface-base border-default rounded-lg p-4">
            <div className="text-gray-400 text-sm">В очереди</div>
            <div className="text-2xl font-bold mt-1 text-yellow-500">
              {stats.queued}
            </div>
          </div>
        </div>
      )}

      {/* Active Jobs */}
      {activeJobs.length > 0 && (
        <div>
          <h2 className="text-lg font-bold mb-4">Активные задачи</h2>
          <div className="surface-base border-default rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-800/50">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">
                    Сессия
                  </th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">
                    Режим
                  </th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">
                    Прогресс
                  </th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">
                    Время
                  </th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">
                    Воркер
                  </th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-400">
                    Действия
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {activeJobs.map((job) => {
                  const elapsedMs = job.progress?.startedAt
                    ? Date.now() - new Date(job.progress.startedAt).getTime()
                    : Date.now() - new Date(job.createdAt).getTime();

                  return (
                    <tr key={job.id} className="hover:bg-gray-800/30">
                      <td className="px-4 py-3 text-sm font-mono text-gray-300">
                        {job.sessionId.substring(0, 8)}...
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className="px-2 py-1 rounded bg-blue-500/20 text-blue-400 text-xs">
                          {job.mode}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {job.progress ? (
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <div className="w-24 h-2 bg-gray-700 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-green-500 transition-all duration-300"
                                  style={{
                                    width: `${job.progress.percentage}%`,
                                  }}
                                />
                              </div>
                              <span className="text-gray-300 text-xs font-mono">
                                {job.progress.executedNodes}/
                                {job.progress.totalNodes}
                              </span>
                              <span className="text-gray-500 text-xs">
                                ({job.progress.percentage}%)
                              </span>
                            </div>
                            {job.progress.failedNodes > 0 && (
                              <span className="text-red-400 text-xs">
                                {job.progress.failedNodes} ошибок
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-500 text-xs">
                            Запуск...
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-400 font-mono">
                        {formatDuration(elapsedMs)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-300 text-xs">
                        {job.workerId || "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        <button
                          onClick={() => setSelectedJobId(job.id)}
                          className="btn-base btn-primary text-xs px-3 py-1"
                        >
                          Логи
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Live Logs Modal */}
      {selectedJobId && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-5xl h-[80vh]">
            <ProgressLogViewer
              jobId={selectedJobId}
              onClose={() => setSelectedJobId(null)}
            />
          </div>
        </div>
      )}

      {/* Workers */}
      <div>
        <h2 className="text-lg font-bold mb-4">Воркеры</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {workers.map((worker) => (
            <div
              key={worker.name}
              className="surface-base border-default rounded-lg p-6 space-y-4"
            >
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-lg">{worker.projectName}</h3>
                  <div className="text-sm text-gray-400 mt-1">
                    {worker.name}
                  </div>
                </div>
                <div
                  className={`
                    px-3 py-1 rounded-full text-xs font-medium
                    ${
                      worker.status === "online"
                        ? "bg-green-500/20 text-green-500"
                        : worker.status === "stopped"
                          ? "bg-gray-500/20 text-gray-400"
                          : "bg-red-500/20 text-red-500"
                    }
                  `}
                >
                  {worker.status.toUpperCase()}
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-gray-400">Инстансов</div>
                  <div className="font-medium mt-1">{worker.instances}</div>
                </div>
                <div>
                  <div className="text-gray-400">Время работы</div>
                  <div className="font-medium mt-1">
                    {worker.status === "stopped"
                      ? "-"
                      : formatUptime(worker.uptime)}
                  </div>
                </div>
                <div>
                  <div className="text-gray-400">Рестартов</div>
                  <div className="font-medium mt-1">{worker.restarts}</div>
                </div>
                <div>
                  <div className="text-gray-400">CPU</div>
                  <div className="font-medium mt-1">
                    {worker.cpu.toFixed(1)}%
                  </div>
                </div>
                <div>
                  <div className="text-gray-400">Память</div>
                  <div className="font-medium mt-1">{worker.memory}МБ</div>
                </div>
                <div>
                  <div className="text-gray-400">Последний запуск</div>
                  <div className="font-medium mt-1">
                    {formatLastExecution(worker.lastExecutionAt)}
                  </div>
                </div>
              </div>

              {/* Avg Duration */}
              {stats && (
                <div className="text-sm">
                  <div className="text-gray-400">
                    Средняя длительность сегодня
                  </div>
                  <div className="font-medium mt-1">
                    {formatDuration(
                      worker.projectName === "MGIMO - Prof"
                        ? stats.today.averageDuration.prof
                        : stats.today.averageDuration.bigfive,
                    )}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-2 border-t border-gray-600">
                <button
                  onClick={() => handleWorkerAction(worker.name, "start")}
                  disabled={
                    worker.status === "online" ||
                    actionLoading === `${worker.name}-start`
                  }
                  className="btn-base btn-secondary flex-1 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {actionLoading === `${worker.name}-start`
                    ? "Запуск..."
                    : "Запустить"}
                </button>
                <button
                  onClick={() => handleWorkerAction(worker.name, "stop")}
                  disabled={
                    worker.status === "stopped" ||
                    actionLoading === `${worker.name}-stop`
                  }
                  className="btn-base btn-secondary flex-1 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {actionLoading === `${worker.name}-stop`
                    ? "Остановка..."
                    : "Остановить"}
                </button>
                <button
                  onClick={() => handleWorkerAction(worker.name, "restart")}
                  disabled={
                    worker.status === "stopped" ||
                    actionLoading === `${worker.name}-restart`
                  }
                  className="btn-base btn-primary flex-1 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {actionLoading === `${worker.name}-restart`
                    ? "Перезапуск..."
                    : "Перезапустить"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
