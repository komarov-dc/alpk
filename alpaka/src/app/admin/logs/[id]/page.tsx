'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';

interface ExecutionLog {
  id: string;
  nodeId: string;
  input: Record<string, unknown> | null;
  output: Record<string, unknown> | null;
  status: string;
  error: string | null;
  duration: number | null;
  createdAt: string;
}

interface ExecutionDetail {
  id: string;
  projectId: string;
  projectName: string;
  jobId: string | null;
  sessionId: string | null;
  status: string;
  totalNodes: number;
  executedNodes: number;
  failedNodes: number;
  skippedNodes: number;
  currentNodeId: string | null;
  startedAt: string;
  completedAt: string | null;
  duration: number | null;
  error: string | null;
  globalVariablesSnapshot: Record<string, unknown>;
  executionResults: Record<string, unknown> | null;
  logs: ExecutionLog[];
}

export default function AdminLogDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [execution, setExecution] = useState<ExecutionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchExecution = async () => {
      try {
        const secret = process.env.NEXT_PUBLIC_ALPAKA_INTERNAL_SECRET || '';
        const res = await fetch(`/api/admin/logs/${id}`, {
          headers: { 'X-Alpaka-Internal-Secret': secret },
        });

        if (res.ok) {
          const data = await res.json();
          setExecution(data);
        }
      } catch (error) {
        console.error('Failed to fetch execution:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchExecution();
  }, [id]);

  const toggleLog = (logId: string) => {
    const newExpanded = new Set(expandedLogs);
    if (newExpanded.has(logId)) {
      newExpanded.delete(logId);
    } else {
      newExpanded.add(logId);
    }
    setExpandedLogs(newExpanded);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatDuration = (ms: number | null) => {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}ms`;
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
    return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
      case 'success':
        return 'bg-green-500/20 text-green-500';
      case 'failed':
      case 'error':
        return 'bg-red-500/20 text-red-500';
      case 'running':
        return 'bg-blue-500/20 text-blue-500';
      case 'cancelled':
        return 'bg-gray-500/20 text-gray-400';
      default:
        return 'bg-gray-500/20 text-gray-300';
    }
  };

  const formatProjectName = (projectName: string) => {
    switch (projectName) {
      case 'MGIMO - Prof':
        return 'Профориентация';
      case 'MGIMO - BigFive':
        return 'Психодиагностика';
      default:
        return projectName;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Загрузка...</div>
      </div>
    );
  }

  if (!execution) {
    return (
      <div className="space-y-4">
        <Link
          href="/admin/logs"
          className="text-sm text-blue-400 hover:text-blue-300"
        >
          ← Назад к логам
        </Link>
        <div className="flex items-center justify-center h-64">
          <div className="text-red-500">Выполнение не найдено</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back Link */}
      <Link
        href="/admin/logs"
        className="text-sm text-blue-400 hover:text-blue-300 inline-block"
      >
        ← Назад к логам
      </Link>

      {/* Metadata */}
      <div className="surface-base border-default rounded-lg p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">{formatProjectName(execution.projectName)}</h1>
            <div className="text-sm text-gray-400 mt-1 space-y-1">
              <div>
                ID выполнения:{' '}
                <span className="font-mono text-gray-300">{execution.id}</span>
              </div>
              {execution.sessionId && (
                <div>
                  ID сессии:{' '}
                  <span className="font-mono text-gray-300">
                    {execution.sessionId}
                  </span>
                </div>
              )}
            </div>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(
              execution.status
            )}`}
          >
            {execution.status.toUpperCase()}
          </span>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-gray-600">
          <div>
            <div className="text-gray-400 text-sm">Всего узлов</div>
            <div className="text-xl font-bold mt-1">{execution.totalNodes}</div>
          </div>
          <div>
            <div className="text-gray-400 text-sm">Выполнено</div>
            <div className="text-xl font-bold mt-1 text-green-500">
              {execution.executedNodes}
            </div>
          </div>
          <div>
            <div className="text-gray-400 text-sm">Ошибок</div>
            <div className="text-xl font-bold mt-1 text-red-500">
              {execution.failedNodes}
            </div>
          </div>
          <div>
            <div className="text-gray-400 text-sm">Пропущено</div>
            <div className="text-xl font-bold mt-1 text-gray-400">
              {execution.skippedNodes}
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-gray-600">
          <div>
            <div className="text-gray-400 text-sm">Начало</div>
            <div className="text-sm mt-1">{formatDate(execution.startedAt)}</div>
          </div>
          <div>
            <div className="text-gray-400 text-sm">Завершено</div>
            <div className="text-sm mt-1">
              {execution.completedAt ? formatDate(execution.completedAt) : '-'}
            </div>
          </div>
          <div>
            <div className="text-gray-400 text-sm">Длительность</div>
            <div className="text-sm mt-1">
              {formatDuration(execution.duration)}
            </div>
          </div>
        </div>

        {/* Error */}
        {execution.error && (
          <div className="pt-4 border-t border-gray-600">
            <div className="text-red-500 text-sm font-medium mb-2">Ошибка:</div>
            <pre className="bg-red-500/10 border border-red-500 rounded p-3 text-sm text-red-400 overflow-x-auto">
              {execution.error}
            </pre>
          </div>
        )}
      </div>

      {/* Node Logs */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold">Логи выполнения узлов</h2>

        {execution.logs.length === 0 ? (
          <div className="surface-base border-default rounded-lg p-8 text-center text-gray-400">
            Логи недоступны
          </div>
        ) : (
          <div className="space-y-2">
            {execution.logs.map((log, index) => (
              <div
                key={log.id}
                className="surface-base border-default rounded-lg overflow-hidden"
              >
                {/* Log Header */}
                <button
                  onClick={() => toggleLog(log.id)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-600 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="text-sm text-gray-400 font-mono">
                      #{index + 1}
                    </div>
                    <div className="text-sm font-medium">{log.nodeId}</div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                        log.status
                      )}`}
                    >
                      {log.status.toUpperCase()}
                    </span>
                    <div className="text-sm text-gray-400">
                      {formatDuration(log.duration)}
                    </div>
                  </div>
                  <div className="text-gray-400">
                    {expandedLogs.has(log.id) ? '▼' : '▶'}
                  </div>
                </button>

                {/* Log Details */}
                {expandedLogs.has(log.id) && (
                  <div className="px-4 py-3 border-t border-gray-600 space-y-3">
                    <div>
                      <div className="text-xs text-gray-400 mb-1">
                        Создано:
                      </div>
                      <div className="text-sm">{formatDate(log.createdAt)}</div>
                    </div>

                    {log.input && (
                      <div>
                        <div className="text-xs text-gray-400 mb-1">Вход:</div>
                        <pre className="bg-gray-900 rounded p-3 text-xs overflow-x-auto">
                          {JSON.stringify(log.input, null, 2)}
                        </pre>
                      </div>
                    )}

                    {log.output && (
                      <div>
                        <div className="text-xs text-gray-400 mb-1">Выход:</div>
                        <pre className="bg-gray-900 rounded p-3 text-xs overflow-x-auto">
                          {JSON.stringify(log.output, null, 2)}
                        </pre>
                      </div>
                    )}

                    {log.error && (
                      <div>
                        <div className="text-xs text-red-500 mb-1">Ошибка:</div>
                        <pre className="bg-red-500/10 border border-red-500 rounded p-3 text-xs text-red-400 overflow-x-auto">
                          {log.error}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
