'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Execution {
  id: string;
  projectName: string;
  jobId: string | null;
  sessionId: string | null;
  status: string;
  totalNodes: number;
  executedNodes: number;
  failedNodes: number;
  skippedNodes: number;
  startedAt: string;
  completedAt: string | null;
  duration: number | null;
  error: string | null;
}

interface LogsResponse {
  executions: Execution[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export default function AdminLogsPage() {
  const [data, setData] = useState<LogsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    status: '',
    projectName: '',
  });

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      try {
        const secret = process.env.NEXT_PUBLIC_ALPAKA_INTERNAL_SECRET || '';

        const params = new URLSearchParams({
          page: page.toString(),
          limit: '20',
        });

        if (filters.status) params.set('status', filters.status);
        if (filters.projectName) params.set('projectName', filters.projectName);

        const res = await fetch(`/api/admin/logs?${params}`, {
          headers: { 'X-Alpaka-Internal-Secret': secret },
        });

        if (res.ok) {
          const data = await res.json();
          setData(data);
        }
      } catch (error) {
        console.error('Failed to fetch logs:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, [page, filters]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (ms: number | null) => {
    if (!ms) return '-';
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500/20 text-green-500';
      case 'failed':
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

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="surface-base border-default rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Статус</label>
            <select
              value={filters.status}
              onChange={(e) => {
                setFilters({ ...filters, status: e.target.value });
                setPage(1);
              }}
              className="input-base w-full"
            >
              <option value="">Все</option>
              <option value="running">Выполняется</option>
              <option value="completed">Завершено</option>
              <option value="failed">Ошибка</option>
              <option value="cancelled">Отменено</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Проект</label>
            <select
              value={filters.projectName}
              onChange={(e) => {
                setFilters({ ...filters, projectName: e.target.value });
                setPage(1);
              }}
              className="input-base w-full"
            >
              <option value="">Все</option>
              <option value="MGIMO - Prof">Профориентация</option>
              <option value="MGIMO - BigFive">Психодиагностика</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={() => {
                setFilters({ status: '', projectName: '' });
                setPage(1);
              }}
              className="btn-base btn-secondary w-full"
            >
              Очистить фильтры
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="surface-base border-default rounded-lg overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-400">Загрузка...</div>
          </div>
        ) : !data || data.executions.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-400">Выполнения не найдены</div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-800 border-b border-gray-600">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium">
                      Проект
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium">
                      ID сессии
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium">
                      Статус
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium">
                      Прогресс
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium">
                      Начало
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium">
                      Длительность
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium">
                      Действия
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-600">
                  {data.executions.map((exec) => (
                    <tr
                      key={exec.id}
                      className="hover:bg-gray-700 transition-colors"
                    >
                      <td className="px-4 py-3 text-sm">{formatProjectName(exec.projectName)}</td>
                      <td className="px-4 py-3 text-sm font-mono text-gray-300">
                        {exec.sessionId?.slice(0, 8) || '-'}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                            exec.status
                          )}`}
                        >
                          {exec.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-600 rounded-full h-2 max-w-[100px]">
                            <div
                              className="bg-green-500 h-2 rounded-full"
                              style={{
                                width: `${
                                  (exec.executedNodes / exec.totalNodes) * 100
                                }%`,
                              }}
                            />
                          </div>
                          <span className="text-xs text-gray-400">
                            {exec.executedNodes}/{exec.totalNodes}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-300">
                        {formatDate(exec.startedAt)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-300">
                        {formatDuration(exec.duration)}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/logs/${exec.id}`}
                          className="text-sm text-blue-400 hover:text-blue-300"
                        >
                          Подробнее
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-4 py-3 bg-gray-800 border-t border-gray-600 flex items-center justify-between">
              <div className="text-sm text-gray-400">
                Показано с {(page - 1) * 20 + 1} по{' '}
                {Math.min(page * 20, data.pagination.total)} из{' '}
                {data.pagination.total} выполнений
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                  className="btn-base btn-secondary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Предыдущая
                </button>
                <div className="flex items-center gap-2">
                  {Array.from({ length: data.pagination.totalPages }, (_, i) => {
                    const pageNum = i + 1;
                    // Show first 2, last 2, and current +/- 1
                    if (
                      pageNum <= 2 ||
                      pageNum > data.pagination.totalPages - 2 ||
                      Math.abs(pageNum - page) <= 1
                    ) {
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setPage(pageNum)}
                          className={`
                            px-3 py-1 rounded text-sm
                            ${
                              page === pageNum
                                ? 'bg-white text-black'
                                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                            }
                          `}
                        >
                          {pageNum}
                        </button>
                      );
                    } else if (
                      pageNum === 3 ||
                      pageNum === data.pagination.totalPages - 2
                    ) {
                      return (
                        <span key={pageNum} className="text-gray-400">
                          ...
                        </span>
                      );
                    }
                    return null;
                  })}
                </div>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={page === data.pagination.totalPages}
                  className="btn-base btn-secondary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Следующая
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
