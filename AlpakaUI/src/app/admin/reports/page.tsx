"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { logger } from "@/utils/logger";
import { normalizeError } from "@/utils/normalizeError";
import { getAccessTokenFromCookies, parseJWTPayload } from "@/utils/tokenUtils";
import {
  DocumentTextIcon,
  ArrowLeftIcon,
  MagnifyingGlassIcon,
  DocumentDuplicateIcon,
  TableCellsIcon,
  DocumentChartBarIcon,
} from "@heroicons/react/24/outline";
import AdminNavigation from "@/components/AdminNavigation";

interface Report {
  id: string;
  type: "FULL" | "ADAPTED" | "SCORE_TABLE";
  sessionId: string;
  data: Record<string, unknown>;
  createdAt: string;
  session: {
    id: string;
    mode: "PSYCHODIAGNOSTICS" | "CAREER_GUIDANCE";
    respondentName?: string;
    status: string;
    startedAt: string;
    user: {
      id: string;
      email: string;
      lastName: string;
      firstName: string;
      middleName?: string | null;
    };
  };
}

export default function AdminReportsPage() {
  const router = useRouter();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    "ALL" | "FULL" | "ADAPTED" | "SCORE_TABLE"
  >("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [dateFilter, setDateFilter] = useState<
    "ALL" | "TODAY" | "WEEK" | "MONTH"
  >("ALL");

  useEffect(() => {
    // Check admin access
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
    } catch {
      router.push("/auth/login");
      return;
    }

    fetchReports();
  }, [router]);

  const fetchReports = async () => {
    try {
      const response = await fetch("/api/reports");
      if (response.ok) {
        const data = await response.json();
        setReports(data);
      }
    } catch (error) {
      logger.error("Failed to fetch reports:", normalizeError(error));
    } finally {
      setLoading(false);
    }
  };

  const getReportTypeIcon = (type: string) => {
    switch (type) {
      case "FULL":
        return <DocumentChartBarIcon className="h-5 w-5" />;
      case "ADAPTED":
        return <DocumentDuplicateIcon className="h-5 w-5" />;
      case "SCORE_TABLE":
        return <TableCellsIcon className="h-5 w-5" />;
      default:
        return <DocumentTextIcon className="h-5 w-5" />;
    }
  };

  const getReportTypeLabel = (type: string) => {
    switch (type) {
      case "FULL":
        return "Полный отчет";
      case "ADAPTED":
        return "Адаптированный отчет";
      case "SCORE_TABLE":
        return "Бальная таблица";
      default:
        return "Отчет";
    }
  };

  const getReportTypeColor = (type: string) => {
    switch (type) {
      case "FULL":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "ADAPTED":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "SCORE_TABLE":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200";
    }
  };

  const getModeLabel = (mode: string) => {
    return mode === "PSYCHODIAGNOSTICS" ? "Психодиагностика" : "Профориентация";
  };

  const filterReportsByDate = (report: Report) => {
    const reportDate = new Date(report.createdAt);
    const now = new Date();

    switch (dateFilter) {
      case "TODAY":
        return reportDate.toDateString() === now.toDateString();
      case "WEEK":
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return reportDate >= weekAgo;
      case "MONTH":
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        return reportDate >= monthAgo;
      default:
        return true;
    }
  };

  const filteredReports = reports.filter((report) => {
    const matchesTab = activeTab === "ALL" || report.type === activeTab;
    const fullName = [
      report.session.user.lastName,
      report.session.user.firstName,
      report.session.user.middleName,
    ]
      .filter(Boolean)
      .join(" ");
    const matchesSearch =
      report.session.user.email
        .toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (report.session.respondentName
        ?.toLowerCase()
        .includes(searchQuery.toLowerCase()) ??
        false);
    const matchesDate = filterReportsByDate(report);
    return matchesTab && matchesSearch && matchesDate;
  });

  const tabStats = {
    ALL: reports.length,
    FULL: reports.filter((r) => r.type === "FULL").length,
    ADAPTED: reports.filter((r) => r.type === "ADAPTED").length,
    SCORE_TABLE: reports.filter((r) => r.type === "SCORE_TABLE").length,
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-gray-500">Загрузка отчетов...</div>
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
                Отчеты по сессиям
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Всего отчетов: {reports.length}
              </p>
            </div>
            <Link
              href="/admin"
              className="flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            >
              <ArrowLeftIcon className="h-4 w-4 mr-1" />
              Назад к административной панели
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Navigation Menu */}
        <AdminNavigation />

        {/* Tabs */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-6">
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="flex -mb-px">
              <button
                onClick={() => setActiveTab("ALL")}
                className={`py-4 px-6 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "ALL"
                    ? "border-blue-500 text-blue-600 dark:text-blue-400"
                    : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                }`}
              >
                <div className="flex items-center gap-2">
                  <DocumentTextIcon className="h-5 w-5" />
                  <span>Все</span>
                  <span className="ml-2 px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 rounded-full">
                    {tabStats.ALL}
                  </span>
                </div>
              </button>
              <button
                onClick={() => setActiveTab("FULL")}
                className={`py-4 px-6 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "FULL"
                    ? "border-blue-500 text-blue-600 dark:text-blue-400"
                    : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                }`}
              >
                <div className="flex items-center gap-2">
                  <DocumentChartBarIcon className="h-5 w-5" />
                  <span>Полный отчет</span>
                  <span className="ml-2 px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 rounded-full">
                    {tabStats.FULL}
                  </span>
                </div>
              </button>
              <button
                onClick={() => setActiveTab("ADAPTED")}
                className={`py-4 px-6 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "ADAPTED"
                    ? "border-blue-500 text-blue-600 dark:text-blue-400"
                    : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                }`}
              >
                <div className="flex items-center gap-2">
                  <DocumentDuplicateIcon className="h-5 w-5" />
                  <span>Адаптированный отчет</span>
                  <span className="ml-2 px-2 py-1 text-xs bg-green-100 dark:bg-green-900 rounded-full">
                    {tabStats.ADAPTED}
                  </span>
                </div>
              </button>
              <button
                onClick={() => setActiveTab("SCORE_TABLE")}
                className={`py-4 px-6 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "SCORE_TABLE"
                    ? "border-blue-500 text-blue-600 dark:text-blue-400"
                    : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                }`}
              >
                <div className="flex items-center gap-2">
                  <TableCellsIcon className="h-5 w-5" />
                  <span>Бальная таблица</span>
                  <span className="ml-2 px-2 py-1 text-xs bg-purple-100 dark:bg-purple-900 rounded-full">
                    {tabStats.SCORE_TABLE}
                  </span>
                </div>
              </button>
            </nav>
          </div>

          {/* Filters */}
          <div className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Поиск по имени или email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                             bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                             focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <select
                value={dateFilter}
                onChange={(e) =>
                  setDateFilter(
                    e.target.value as "ALL" | "TODAY" | "WEEK" | "MONTH",
                  )
                }
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                         focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">Все время</option>
                <option value="TODAY">Сегодня</option>
                <option value="WEEK">За неделю</option>
                <option value="MONTH">За месяц</option>
              </select>
            </div>
          </div>
        </div>

        {/* Reports Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Reports List */}
          <div className="lg:col-span-2">
            <div className="space-y-4">
              {filteredReports.map((report) => (
                <div
                  key={report.id}
                  onClick={() => setSelectedReport(report)}
                  className={`bg-white dark:bg-gray-800 rounded-lg shadow p-6 cursor-pointer transition-all hover:shadow-lg ${
                    selectedReport?.id === report.id
                      ? "ring-2 ring-blue-500"
                      : ""
                  }`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-2 rounded-lg ${getReportTypeColor(report.type).replace("text-", "bg-").replace("800", "100").replace("dark:bg-", "dark:bg-")}`}
                      >
                        {getReportTypeIcon(report.type)}
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                          {getReportTypeLabel(report.type)}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {getModeLabel(report.session.mode)}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`px-3 py-1 text-xs font-semibold rounded-full ${getReportTypeColor(report.type)}`}
                    >
                      {report.type}
                    </span>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500 dark:text-gray-400">
                        Пользователь:
                      </span>
                      <span className="text-gray-900 dark:text-white font-medium">
                        {report.session.respondentName ||
                          [
                            report.session.user.lastName,
                            report.session.user.firstName,
                            report.session.user.middleName,
                          ]
                            .filter(Boolean)
                            .join(" ")}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500 dark:text-gray-400">
                        Email:
                      </span>
                      <span className="text-gray-900 dark:text-white">
                        {report.session.user.email}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500 dark:text-gray-400">
                        Дата:
                      </span>
                      <span className="text-gray-900 dark:text-white">
                        {new Date(report.createdAt).toLocaleString("ru-RU")}
                      </span>
                    </div>
                  </div>
                </div>
              ))}

              {filteredReports.length === 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8">
                  <div className="text-center text-gray-500 dark:text-gray-400">
                    <DocumentTextIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Отчеты не найдены</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Report Details */}
          <div className="lg:col-span-1">
            {selectedReport ? (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 sticky top-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Детали отчета
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      ID отчета
                    </label>
                    <p className="mt-1 text-sm font-mono text-gray-900 dark:text-white">
                      {selectedReport.id.slice(0, 16)}...
                    </p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Тип отчета
                    </label>
                    <p className="mt-1">
                      <span
                        className={`px-3 py-1 text-sm font-semibold rounded-full ${getReportTypeColor(selectedReport.type)}`}
                      >
                        {getReportTypeLabel(selectedReport.type)}
                      </span>
                    </p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Режим диагностики
                    </label>
                    <p className="mt-1 text-sm text-gray-900 dark:text-white">
                      {getModeLabel(selectedReport.session.mode)}
                    </p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Статус сессии
                    </label>
                    <p className="mt-1 text-sm text-gray-900 dark:text-white">
                      {selectedReport.session.status === "COMPLETED" ? (
                        <span className="text-green-600 dark:text-green-400">
                          Завершена
                        </span>
                      ) : (
                        <span className="text-yellow-600 dark:text-yellow-400">
                          В процессе
                        </span>
                      )}
                    </p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Дата создания
                    </label>
                    <p className="mt-1 text-sm text-gray-900 dark:text-white">
                      {new Date(selectedReport.createdAt).toLocaleString(
                        "ru-RU",
                        {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        },
                      )}
                    </p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Начало сессии
                    </label>
                    <p className="mt-1 text-sm text-gray-900 dark:text-white">
                      {new Date(
                        selectedReport.session.startedAt,
                      ).toLocaleString("ru-RU")}
                    </p>
                  </div>

                  <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                    <button className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
                      Просмотреть полный отчет
                    </button>
                    <button
                      className="w-full mt-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300
                               rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      Скачать PDF
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <div className="text-center text-gray-500 dark:text-gray-400">
                  <DocumentTextIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Выберите отчет для просмотра деталей</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
