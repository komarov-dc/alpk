"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { logger } from "@/utils/logger";
import { normalizeError } from "@/utils/normalizeError";
import { getAccessTokenFromCookies, parseJWTPayload } from "@/utils/tokenUtils";
import {
  UserGroupIcon,
  ChartBarIcon,
  DocumentTextIcon,
  ArrowLeftIcon,
} from "@heroicons/react/24/outline";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import AdminNavigation from "@/components/AdminNavigation";

interface Statistics {
  totalUsers: number;
  totalSessions: number;
  completedSessions: number;
  totalReports: number;
  activeUsers: number;
  sessionsByMode: {
    psychodiagnostics: number;
    careerGuidance: number;
  };
}

export default function AdminDashboard() {
  const router = useRouter();
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modeFilter, setModeFilter] = useState<
    "ALL" | "PSYCHODIAGNOSTICS" | "CAREER_GUIDANCE"
  >("ALL");

  useEffect(() => {
    // Check if user is admin from cookie token
    const token = getAccessTokenFromCookies();

    if (!token) {
      router.push("/auth/login");
      return;
    }

    try {
      const payload = parseJWTPayload(token);
      if (!payload || payload.role !== "ADMIN") {
        router.push("/");
        return;
      }
    } catch (error) {
      logger.error("Failed to parse token:", normalizeError(error));
      router.push("/auth/login");
      return;
    }

    // Fetch statistics
    fetchStatistics();
  }, [router]);

  const fetchStatistics = async (
    mode?: "ALL" | "PSYCHODIAGNOSTICS" | "CAREER_GUIDANCE",
  ) => {
    try {
      // Get token from cookies
      const cookies = document.cookie.split(";");
      let token = null;

      for (const cookie of cookies) {
        const [name, value] = cookie.trim().split("=");
        if (name === "accessToken") {
          token = value;
          break;
        }
      }

      const url =
        mode && mode !== "ALL"
          ? `/api/admin/statistics?mode=${mode}`
          : "/api/admin/statistics";

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch statistics");
      }

      const data = await response.json();
      setStatistics(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load statistics",
      );
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
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
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Панель администратора
            </h1>
            <Link
              href="/"
              className="flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            >
              <ArrowLeftIcon className="h-4 w-4 mr-1" />
              Вернуться на главную
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Navigation Menu */}
        <AdminNavigation />

        {/* Filter Tabs */}
        <div className="mb-6">
          <div className="flex gap-2 overflow-x-auto pb-2">
            <button
              onClick={() => {
                setModeFilter("ALL");
                fetchStatistics("ALL");
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                modeFilter === "ALL"
                  ? "bg-blue-600 text-white"
                  : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
              }`}
            >
              📊 Общая статистика
            </button>
            <button
              onClick={() => {
                setModeFilter("PSYCHODIAGNOSTICS");
                fetchStatistics("PSYCHODIAGNOSTICS");
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                modeFilter === "PSYCHODIAGNOSTICS"
                  ? "bg-purple-600 text-white"
                  : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
              }`}
            >
              🧠 Психодиагностика
            </button>
            <button
              onClick={() => {
                setModeFilter("CAREER_GUIDANCE");
                fetchStatistics("CAREER_GUIDANCE");
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                modeFilter === "CAREER_GUIDANCE"
                  ? "bg-green-600 text-white"
                  : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
              }`}
            >
              💼 Профориентация
            </button>
          </div>
        </div>

        {/* Statistics Cards - Now clickable */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Link href="/admin/users" className="block">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 hover:shadow-lg hover:border-blue-500 dark:hover:border-blue-400 transition-all cursor-pointer">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Пользователи
                  </p>
                  <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
                    {statistics?.totalUsers || 0}
                  </p>
                  <p className="mt-1 text-xs text-gray-600 dark:text-gray-500">
                    Всего зарегистрировано
                  </p>
                </div>
                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <UserGroupIcon className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </div>
          </Link>

          <Link href="/admin/sessions" className="block">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 hover:shadow-lg hover:border-green-500 dark:hover:border-green-400 transition-all cursor-pointer">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Сессии
                  </p>
                  <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
                    {statistics?.totalSessions || 0}
                  </p>
                  <p className="mt-1 text-xs text-green-600 dark:text-green-400">
                    {statistics?.completedSessions || 0} завершено
                  </p>
                </div>
                <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <ChartBarIcon className="h-8 w-8 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </div>
          </Link>

          <Link href="/admin/reports" className="block">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 hover:shadow-lg hover:border-purple-500 dark:hover:border-purple-400 transition-all cursor-pointer">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Отчеты
                  </p>
                  <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
                    {statistics?.totalReports || 0}
                  </p>
                  <p className="mt-1 text-xs text-gray-600 dark:text-gray-500">
                    Сгенерировано
                  </p>
                </div>
                <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                  <DocumentTextIcon className="h-8 w-8 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
            </div>
          </Link>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Активность
                </p>
                <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
                  {statistics?.activeUsers || 0}
                </p>
                <p className="mt-1 text-xs text-gray-600 dark:text-gray-500">
                  За последние 30 дней
                </p>
              </div>
              <div className="p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                <UserGroupIcon className="h-8 w-8 text-yellow-600 dark:text-yellow-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Session Distribution Charts */}
        {statistics && (
          <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Pie Chart - Session Distribution */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Распределение сессий по типам
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        {
                          name: "Психодиагностика",
                          value:
                            statistics.sessionsByMode?.psychodiagnostics || 0,
                          percentage: Math.round(
                            ((statistics.sessionsByMode?.psychodiagnostics ||
                              0) /
                              (statistics.totalSessions || 1)) *
                              100,
                          ),
                        },
                        {
                          name: "Профориентация",
                          value: statistics.sessionsByMode?.careerGuidance || 0,
                          percentage: Math.round(
                            ((statistics.sessionsByMode?.careerGuidance || 0) /
                              (statistics.totalSessions || 1)) *
                              100,
                          ),
                        },
                      ]}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      <Cell fill="#8b5cf6" />
                      <Cell fill="#10b981" />
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "rgba(17, 24, 39, 0.95)",
                        border: "1px solid rgba(75, 85, 99, 0.5)",
                        borderRadius: "8px",
                        color: "#fff",
                      }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Bar Chart - Completion Status */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Статус сессий
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[
                      {
                        name: "Всего",
                        count: statistics.totalSessions || 0,
                      },
                      {
                        name: "Завершено",
                        count: statistics.completedSessions || 0,
                      },
                      {
                        name: "В процессе",
                        count:
                          (statistics.totalSessions || 0) -
                          (statistics.completedSessions || 0),
                      },
                    ]}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis
                      dataKey="name"
                      stroke="#9ca3af"
                      tick={{ fill: "#9ca3af" }}
                    />
                    <YAxis stroke="#9ca3af" tick={{ fill: "#9ca3af" }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "rgba(17, 24, 39, 0.95)",
                        border: "1px solid rgba(75, 85, 99, 0.5)",
                        borderRadius: "8px",
                        color: "#fff",
                      }}
                    />
                    <Bar dataKey="count" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
