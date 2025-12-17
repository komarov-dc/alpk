"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeftIcon,
  EyeIcon,
  TrashIcon,
  UserCircleIcon,
  ClockIcon,
} from "@heroicons/react/24/outline";
import { AcademicCapIcon, BriefcaseIcon } from "@heroicons/react/24/outline";
import { logger } from "@/utils/logger";
import { normalizeError } from "@/utils/normalizeError";
import { getAccessTokenFromCookies, parseJWTPayload } from "@/utils/tokenUtils";
import AdminNavigation from "@/components/AdminNavigation";

interface Session {
  id: string;
  userId: string | null;
  user?: {
    id: string;
    email: string;
    lastName: string;
    firstName: string;
    middleName?: string | null;
    role: string;
  };
  respondentName: string | null;
  mode: "PSYCHODIAGNOSTICS" | "CAREER_GUIDANCE";
  status: "IN_PROGRESS" | "COMPLETED" | "ABANDONED";
  totalQuestions: number;
  currentIndex: number;
  startedAt: string;
  completedAt: string | null;
  responses: Array<{
    id: string;
    questionId: number;
    answer: string;
  }>;
}

export default function AdminSessionsPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | "completed" | "in_progress">(
    "all",
  );

  const fetchSessions = useCallback(async () => {
    try {
      const response = await fetch("/api/sessions");

      if (!response.ok) {
        throw new Error("Failed to fetch sessions");
      }

      const data = await response.json();

      // Apply filter
      let filtered = data;
      if (filter === "completed") {
        filtered = data.filter((s: Session) => s.status === "COMPLETED");
      } else if (filter === "in_progress") {
        filtered = data.filter((s: Session) => s.status === "IN_PROGRESS");
      }

      setSessions(filtered);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sessions");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    // Check if user is admin
    const token = getAccessTokenFromCookies();

    if (!token) {
      router.push("/auth/login");
      return;
    }

    try {
      const payload = parseJWTPayload(token);
      if (
        !payload ||
        (payload.role !== "ADMIN" && payload.role !== "CONSULTANT")
      ) {
        router.push("/");
        return;
      }
    } catch (error) {
      logger.error("Failed to parse token:", normalizeError(error));
      router.push("/auth/login");
      return;
    }

    fetchSessions();
  }, [router, fetchSessions]);

  const deleteSession = async (id: string) => {
    if (!confirm("Удалить эту сессию? Это действие нельзя отменить.")) {
      return;
    }

    try {
      const response = await fetch(`/api/sessions/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete session");
      }

      setSessions(sessions.filter((s) => s.id !== id));
    } catch {
      alert("Не удалось удалить сессию");
    }
  };

  const getModeIcon = (mode: string) => {
    return mode === "PSYCHODIAGNOSTICS" ? (
      <AcademicCapIcon className="w-5 h-5 text-purple-500" />
    ) : (
      <BriefcaseIcon className="w-5 h-5 text-green-500" />
    );
  };

  const getModeTitle = (mode: string) => {
    return mode === "PSYCHODIAGNOSTICS" ? "Психодиагностика" : "Профориентация";
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return (
          <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
            Завершена
          </span>
        );
      case "IN_PROGRESS":
        return (
          <span className="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300">
            В процессе
          </span>
        );
      case "ABANDONED":
        return (
          <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">
            Прервана
          </span>
        );
      default:
        return null;
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-gray-500">Загрузка...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-red-500">{error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Все сессии
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Всего: {sessions.length} сессий
              </p>
            </div>
            <Link
              href="/admin"
              className="flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            >
              <ArrowLeftIcon className="h-4 w-4 mr-1" />
              Назад к панели
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Navigation Menu */}
        <AdminNavigation />

        {/* Filters */}
        <div className="mb-6">
          <div className="flex gap-2">
            <button
              onClick={() => setFilter("all")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === "all"
                  ? "bg-blue-500 text-white"
                  : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              }`}
            >
              Все ({sessions.length})
            </button>
            <button
              onClick={() => setFilter("completed")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === "completed"
                  ? "bg-green-500 text-white"
                  : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              }`}
            >
              Завершенные
            </button>
            <button
              onClick={() => setFilter("in_progress")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === "in_progress"
                  ? "bg-yellow-500 text-white"
                  : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              }`}
            >
              В процессе
            </button>
          </div>
        </div>

        {/* Sessions Table */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Тип
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Пользователь
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Имя респондента
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Статус
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Прогресс
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Дата
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Действия
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {sessions.map((session) => (
                <tr
                  key={session.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {getModeIcon(session.mode)}
                      <span className="text-sm text-gray-900 dark:text-white">
                        {getModeTitle(session.mode)}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {session.user ? (
                      <div className="flex items-center gap-2">
                        <UserCircleIcon className="w-5 h-5 text-gray-400" />
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {[
                              session.user.lastName,
                              session.user.firstName,
                              session.user.middleName,
                            ]
                              .filter(Boolean)
                              .join(" ")}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {session.user.email}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        Анонимный
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-900 dark:text-white">
                      {session.respondentName || "-"}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(session.status)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div className="w-20 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div
                          className="bg-blue-500 h-2 rounded-full"
                          style={{
                            width: `${(session.responses.length / session.totalQuestions) * 100}%`,
                          }}
                        />
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {session.responses.length}/{session.totalQuestions}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
                      <ClockIcon className="w-4 h-4" />
                      {formatDate(session.startedAt)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/admin/sessions/${session.id}`}
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                      >
                        <EyeIcon className="w-5 h-5" />
                      </Link>
                      <button
                        onClick={() => deleteSession(session.id)}
                        className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                      >
                        <TrashIcon className="w-5 h-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {sessions.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500 dark:text-gray-400">
                Нет сессий для отображения
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
