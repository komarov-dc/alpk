"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import DOMPurify from "dompurify";
import {
  AcademicCapIcon,
  BriefcaseIcon,
  ClockIcon,
  CheckCircleIcon,
  PlayIcon,
  DocumentTextIcon,
  ChartBarIcon,
  ArrowPathIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { formatRelativeTime } from "@/utils/formatters";
import { logger } from "@/utils/logger";
import { normalizeError } from "@/utils/normalizeError";
import { getAccessTokenFromCookies, parseJWTPayload } from "@/utils/tokenUtils";
import { htmlToText } from "html-to-text";
import { generateReportPDF, downloadPDF } from "@/lib/pdf/generator";

interface Response {
  id: string;
  questionId: number;
  question?: {
    id: number;
    text: string;
  };
  questionText: string;
  answer: string;
  timeSpent: number;
  answeredAt: string;
}

interface Report {
  id: string;
  type: "FULL" | "ADAPTED" | "SCORE_TABLE";
  content: string;
  createdAt: string;
}

interface SessionData {
  id: string;
  mode: "PSYCHODIAGNOSTICS" | "CAREER_GUIDANCE";
  status: "IN_PROGRESS" | "COMPLETED" | "ABANDONED";
  totalQuestions: number;
  currentIndex: number;
  startedAt: string;
  completedAt?: string;
  respondentName?: string | null;
  alpakaJobId?: string | null;
  alpakaJobStatus?: string | null;
  user?: {
    id: string;
    email: string;
    lastName: string;
    firstName: string;
    middleName?: string | null;
    role: string;
  };
  responses: Response[];
  reports?: Report[];
}

interface SessionDetailsProps {
  sessionId: string;
  onContinue?: () => void;
  onClose?: () => void;
  onOpenChat?: () => void;
}

export function SessionDetails({
  sessionId,
  onContinue,
  onClose,
  onOpenChat,
}: SessionDetailsProps) {
  const [session, setSession] = useState<SessionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    "overview" | "responses" | "report"
  >("overview");
  const [userRole, setUserRole] = useState<
    "USER" | "CONSULTANT" | "ADMIN" | null
  >(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [reportsStatus, setReportsStatus] = useState<
    "loading" | "queued" | "processing" | "completed" | "failed" | "none"
  >("none");
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [email, setEmail] = useState("");
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailSuccess, setEmailSuccess] = useState(false);
  const [viewingReport, setViewingReport] = useState<Report | null>(null);
  const [isGeneratingReports, setIsGeneratingReports] = useState(false);

  // Get user role from token
  useEffect(() => {
    const token = getAccessTokenFromCookies();

    if (token) {
      try {
        const payload = parseJWTPayload(token);
        if (payload) {
          setUserRole(
            (payload.role as "ADMIN" | "CONSULTANT" | "USER") || "USER",
          );
        }
      } catch (error) {
        logger.error("Failed to parse token:", normalizeError(error));
        setUserRole("USER");
      }
    }
  }, []);

  useEffect(() => {
    const loadSessionDetails = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/sessions?id=${sessionId}`);
        if (response.ok) {
          const data = await response.json();
          if (data && data.length > 0) {
            const sessionData = data[0];
            setSession(sessionData);

            // If session has reports, load them
            if (sessionData.reports && sessionData.reports.length > 0) {
              setReports(sessionData.reports);
              setReportsStatus("completed");
            } else if (
              sessionData.alpakaJobId &&
              sessionData.status === "COMPLETED"
            ) {
              // Session completed but reports not yet loaded
              setReportsStatus(sessionData.alpakaJobStatus || "queued");
            }
          }
        }
      } catch (error) {
        logger.error("Failed to load session details:", normalizeError(error));
      } finally {
        setIsLoading(false);
      }
    };

    loadSessionDetails();
  }, [sessionId]);

  // Poll for reports when on report tab and reports are being generated
  useEffect(() => {
    if (
      activeTab !== "report" ||
      !session ||
      reportsStatus === "completed" ||
      reportsStatus === "failed" ||
      reportsStatus === "none"
    ) {
      return;
    }

    const pollReports = async () => {
      try {
        const response = await fetch(
          `/api/sessions/${sessionId}/backend-reports`,
        );
        if (response.ok) {
          const data = await response.json();

          setReportsStatus(data.status);

          if (data.status === "completed" && data.reports) {
            setReports(data.reports);
          }
        }
      } catch (error) {
        logger.error("Failed to poll reports:", normalizeError(error));
      }
    };

    // Poll every 5 seconds
    const interval = setInterval(pollReports, 5000);
    // Also poll immediately
    pollReports();

    return () => clearInterval(interval);
  }, [activeTab, session, sessionId, reportsStatus]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <ArrowPathIcon className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-2" />
          <p className="text-gray-500">Загрузка сессии...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-gray-500">Сессия не найдена</p>
        </div>
      </div>
    );
  }

  const progress = Math.round(
    (session.responses.length / session.totalQuestions) * 100,
  );
  const isCompleted = session.status === "COMPLETED";
  const canContinue =
    session.status === "IN_PROGRESS" &&
    session.responses.length < session.totalQuestions;

  const modeInfo = {
    PSYCHODIAGNOSTICS: {
      title: "Психологическая диагностика",
      icon: AcademicCapIcon,
      color: "purple",
      gradient: "from-purple-500 to-pink-500",
    },
    CAREER_GUIDANCE: {
      title: "Профессиональная ориентация",
      icon: BriefcaseIcon,
      color: "green",
      gradient: "from-green-500 to-emerald-500",
    },
  };

  const mode = modeInfo[session.mode];
  const ModeIcon = mode.icon;

  // Calculate statistics
  const totalTimeSpent = session.responses.reduce(
    (acc, r) => acc + r.timeSpent,
    0,
  );
  const avgTimePerQuestion =
    session.responses.length > 0
      ? Math.round(totalTimeSpent / session.responses.length)
      : 0;
  const avgAnswerLength =
    session.responses.length > 0
      ? Math.round(
          session.responses.reduce((acc, r) => acc + r.answer.length, 0) /
            session.responses.length,
        )
      : 0;

  // Download TXT function
  const downloadTXT = (type: "FULL" | "ADAPTED" | "SCORE_TABLE") => {
    try {
      const report = reports.find((r) => r.type === type);
      if (!report) {
        alert("Отчет не найден");
        return;
      }

      const typeNames = {
        FULL: "Full_Report",
        ADAPTED: "Adapted_Report",
        SCORE_TABLE: "Score_Table",
      };

      const typeTitles = {
        FULL: "Полный отчет",
        ADAPTED: "Адаптированный отчет",
        SCORE_TABLE: "Бальная таблица",
      };

      // Function to clean and format text
      const formatText = (text: string): string => {
        // Replace escaped newlines with actual newlines
        let formatted = text.replace(/\\n/g, "\n");

        // Remove markdown headers but keep the text
        formatted = formatted.replace(/^#+\s*/gm, "");

        // Remove bold/italic markdown
        formatted = formatted.replace(/\*\*([^*]+)\*\*/g, "$1");
        formatted = formatted.replace(/\*([^*]+)\*/g, "$1");

        // Remove bullet points markdown, replace with actual bullets
        formatted = formatted.replace(/^[-*]\s+/gm, "• ");

        // Clean up multiple consecutive newlines (max 2)
        formatted = formatted.replace(/\n{3,}/g, "\n\n");

        // Trim whitespace
        formatted = formatted.trim();

        return formatted;
      };

      // Try to parse as JSON first
      let plainText = "";
      try {
        const jsonContent = JSON.parse(report.content);

        // Extract text based on report type
        if (type === "ADAPTED" && jsonContent.adapted_report?.full_text) {
          plainText = formatText(jsonContent.adapted_report.full_text);
        } else if (
          type === "FULL" &&
          jsonContent.final_professional_report?.full_text
        ) {
          plainText = formatText(
            jsonContent.final_professional_report.full_text,
          );
        } else if (
          type === "SCORE_TABLE" &&
          jsonContent.aggregate_score_profile
        ) {
          // For score table, format the JSON structure
          plainText = JSON.stringify(
            jsonContent.aggregate_score_profile,
            null,
            2,
          );
        } else {
          // Fallback: stringify entire JSON
          plainText = JSON.stringify(jsonContent, null, 2);
        }
      } catch {
        // If not JSON, treat as HTML and convert
        plainText = htmlToText(report.content, {
          wordwrap: 100,
          preserveNewlines: true,
        });
        plainText = formatText(plainText);
      }

      // Create header
      const header = `
═══════════════════════════════════════════════════════
${typeTitles[type]}
═══════════════════════════════════════════════════════

Респондент: ${session.respondentName || "Не указано"}
Дата: ${new Date().toLocaleDateString("ru-RU")}
Сессия: ${session.id}

═══════════════════════════════════════════════════════

`;

      const fullText = header + plainText;

      // Create and download blob
      const blob = new Blob([fullText], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${typeNames[type]}_${session.respondentName || "report"}_${new Date().toISOString().split("T")[0]}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      logger.error("Failed to download TXT:", normalizeError(error));
      alert("Ошибка при скачивании текстового файла");
    }
  };

  // Clean markdown formatting from text
  const cleanMarkdown = (text: string): string => {
    // Replace escaped newlines with actual newlines
    let cleaned = text.replace(/\\n/g, "\n");

    // Remove markdown headers but keep the text
    cleaned = cleaned.replace(/^#+\s*/gm, "");

    // Remove bold/italic markdown
    cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, "$1");
    cleaned = cleaned.replace(/\*([^*]+)\*/g, "$1");

    // Remove bullet points markdown, replace with actual bullets
    cleaned = cleaned.replace(/^[-*]\s+/gm, "• ");

    // Clean up multiple consecutive newlines (max 2)
    cleaned = cleaned.replace(/\n{3,}/g, "\n\n");

    // Trim whitespace
    cleaned = cleaned.trim();

    return cleaned;
  };

  // Download PDF function
  const downloadPDFReport = (type: "FULL" | "ADAPTED" | "SCORE_TABLE") => {
    try {
      const report = reports.find((r) => r.type === type);
      if (!report) {
        alert("Отчет не найден");
        return;
      }

      const typeNames = {
        FULL: "Full_Report",
        ADAPTED: "Adapted_Report",
        SCORE_TABLE: "Score_Table",
      };

      const typeTitles = {
        FULL: "Полный отчет",
        ADAPTED: "Адаптированный отчет",
        SCORE_TABLE: "Бальная таблица",
      };

      // Extract plain text from report content (same logic as downloadTXT)
      let plainText = "";
      try {
        const jsonContent = JSON.parse(report.content);
        if (type === "ADAPTED" && jsonContent.adapted_report?.full_text) {
          plainText = jsonContent.adapted_report.full_text;
        } else if (
          type === "FULL" &&
          jsonContent.final_professional_report?.full_text
        ) {
          plainText = jsonContent.final_professional_report.full_text;
        } else if (
          type === "SCORE_TABLE" &&
          jsonContent.aggregate_score_profile
        ) {
          plainText = JSON.stringify(
            jsonContent.aggregate_score_profile,
            null,
            2,
          );
        } else {
          plainText = JSON.stringify(jsonContent, null, 2);
        }
      } catch {
        plainText = htmlToText(report.content, {
          wordwrap: 100,
          preserveNewlines: true,
        });
      }

      // Clean markdown formatting
      plainText = cleanMarkdown(plainText);

      // Generate PDF using the library
      const pdfBlob = generateReportPDF({
        title: typeTitles[type],
        content: plainText,
        reportType: type,
        respondentName: session.respondentName || undefined,
        date: new Date().toLocaleDateString("ru-RU"),
      });

      // Download the PDF
      const filename = `${typeNames[type]}_${session.respondentName || "report"}_${new Date().toISOString().split("T")[0]}.pdf`;
      downloadPDF(pdfBlob, filename);
    } catch (error) {
      logger.error("Failed to download PDF:", normalizeError(error));
      alert("Ошибка при скачивании PDF файла");
    }
  };

  // View report function
  const viewReport = (type: "FULL" | "ADAPTED" | "SCORE_TABLE") => {
    const report = reports.find((r) => r.type === type);
    if (report) {
      setViewingReport(report);
    }
  };

  // Format score table as HTML
  const formatScoreTableAsHTML = (
    scoreProfile: Record<string, unknown>,
  ): string => {
    if (!scoreProfile || !Array.isArray(scoreProfile.assessments)) {
      return '<p class="text-gray-500">Нет данных для отображения</p>';
    }

    let html = '<div class="space-y-8">';

    // Iterate through each assessment
    scoreProfile.assessments.forEach(
      (assessment: Record<string, unknown>, index: number) => {
        html += `
        <div class="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl p-6 border border-purple-200 dark:border-purple-800">
          <div class="mb-6">
            <h2 class="text-2xl font-bold text-purple-900 dark:text-purple-100 mb-2">
              ${assessment.construct_name || `Оценка ${index + 1}`}
            </h2>
            ${
              assessment.aspect_name
                ? `
              <div class="flex items-center gap-2 mt-2">
                <span class="px-3 py-1 bg-purple-100 dark:bg-purple-800 text-purple-700 dark:text-purple-200 rounded-full text-sm font-medium">
                  ${assessment.aspect_name}
                </span>
                <span class="px-3 py-1 bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-200 rounded-full text-sm font-medium">
                  Общий балл: ${assessment.total_score || 0}
                </span>
              </div>
            `
                : ""
            }
          </div>

          <div class="overflow-x-auto">
            <table class="w-full border-collapse">
              <thead>
                <tr class="bg-purple-200 dark:bg-purple-800">
                  <th class="px-4 py-3 text-left text-sm font-semibold text-purple-900 dark:text-purple-100 border-b-2 border-purple-300 dark:border-purple-700">
                    Признак
                  </th>
                  <th class="px-4 py-3 text-center text-sm font-semibold text-purple-900 dark:text-purple-100 border-b-2 border-purple-300 dark:border-purple-700">
                    Балл
                  </th>
                  <th class="px-4 py-3 text-left text-sm font-semibold text-purple-900 dark:text-purple-100 border-b-2 border-purple-300 dark:border-purple-700">
                    Обоснование
                  </th>
                </tr>
              </thead>
              <tbody>
      `;

        // Add criterion scores
        if (Array.isArray(assessment.criterion_scores)) {
          assessment.criterion_scores.forEach(
            (criterion: Record<string, unknown>, criterionIndex: number) => {
              const rowBg =
                criterionIndex % 2 === 0
                  ? "bg-white dark:bg-gray-800/50"
                  : "bg-purple-50 dark:bg-purple-900/10";

              html += `
            <tr class="${rowBg} hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors">
              <td class="px-4 py-3 text-sm text-gray-800 dark:text-gray-200 border-b border-purple-100 dark:border-purple-800">
                ${criterion.item || "Не указано"}
              </td>
              <td class="px-4 py-3 text-center border-b border-purple-100 dark:border-purple-800">
                <span class="inline-flex items-center justify-center w-10 h-10 rounded-full ${
                  (criterion.assigned_score as number) >= 5
                    ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200"
                    : (criterion.assigned_score as number) >= 3
                      ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-200"
                      : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200"
                } font-bold text-sm">
                  ${criterion.assigned_score ?? "-"}
                </span>
              </td>
              <td class="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 border-b border-purple-100 dark:border-purple-800">
                ${criterion.justification || "Обоснование отсутствует"}
              </td>
            </tr>
          `;
            },
          );
        }

        html += `
              </tbody>
            </table>
          </div>
        </div>
      `;
      },
    );

    html += "</div>";
    // Sanitize the generated HTML
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: [
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "p",
        "br",
        "strong",
        "em",
        "ul",
        "ol",
        "li",
        "table",
        "thead",
        "tbody",
        "tr",
        "th",
        "td",
        "div",
        "span",
      ],
      ALLOWED_ATTR: ["class", "style"],
    });
  };

  // Format report content for display
  const getFormattedContent = (report: Report): string => {
    try {
      // Try to parse as JSON
      const jsonContent = JSON.parse(report.content);

      let text = "";

      // Extract text based on report type
      if (report.type === "ADAPTED" && jsonContent.adapted_report?.full_text) {
        text = jsonContent.adapted_report.full_text;
      } else if (
        report.type === "FULL" &&
        jsonContent.final_professional_report?.full_text
      ) {
        text = jsonContent.final_professional_report.full_text;
      } else if (
        report.type === "SCORE_TABLE" &&
        jsonContent.aggregate_score_profile
      ) {
        // For score table, format as structured HTML tables
        return formatScoreTableAsHTML(jsonContent.aggregate_score_profile);
      } else {
        // Fallback: stringify entire JSON
        text = JSON.stringify(jsonContent, null, 2);
      }

      // Convert markdown-style formatting to HTML
      // Replace escaped newlines with <br>
      text = text.replace(/\\n/g, "<br>");

      // Convert markdown headers to HTML
      text = text.replace(
        /###\s+([^\n<]+)/g,
        '<h3 class="text-lg font-bold mt-4 mb-2">$1</h3>',
      );
      text = text.replace(
        /##\s+([^\n<]+)/g,
        '<h2 class="text-xl font-bold mt-6 mb-3">$1</h2>',
      );
      text = text.replace(
        /#\s+([^\n<]+)/g,
        '<h1 class="text-2xl font-bold mt-6 mb-4">$1</h1>',
      );

      // Convert markdown bold
      text = text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

      // Convert markdown italic
      text = text.replace(/\*([^*]+)\*/g, "<em>$1</em>");

      // Convert markdown bullets - wrap consecutive <li> tags in <ul>
      const lines = text.split("<br>");
      let inList = false;
      let result = "";

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line) continue;

        if (line.includes("<li>")) {
          if (!inList) {
            result += '<ul class="list-disc ml-6 my-2">';
            inList = true;
          }
          result += line;
        } else {
          if (inList) {
            result += "</ul>";
            inList = false;
          }
          result += line + (i < lines.length - 1 ? "<br>" : "");
        }
      }
      if (inList) {
        result += "</ul>";
      }

      text = result;

      // Sanitize HTML to prevent XSS attacks
      return DOMPurify.sanitize(text, {
        ALLOWED_TAGS: [
          "h1",
          "h2",
          "h3",
          "h4",
          "h5",
          "h6",
          "p",
          "br",
          "strong",
          "em",
          "ul",
          "ol",
          "li",
          "table",
          "thead",
          "tbody",
          "tr",
          "th",
          "td",
          "div",
          "span",
        ],
        ALLOWED_ATTR: ["class", "style"],
      });
    } catch {
      // If not JSON, return as-is but sanitized
      return DOMPurify.sanitize(report.content, {
        ALLOWED_TAGS: [
          "h1",
          "h2",
          "h3",
          "h4",
          "h5",
          "h6",
          "p",
          "br",
          "strong",
          "em",
          "ul",
          "ol",
          "li",
          "table",
          "thead",
          "tbody",
          "tr",
          "th",
          "td",
          "div",
          "span",
        ],
        ALLOWED_ATTR: ["class", "style"],
      });
    }
  };

  // Generate reports function
  const handleGenerateReports = async () => {
    if (!session) return;

    setIsGeneratingReports(true);
    setReportsStatus("queued");

    try {
      const response = await fetch(`/api/sessions/${session.id}/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();

        if (data.alpakaJobId) {
          // Start polling for reports
          setReportsStatus("processing");
        } else {
          setReportsStatus("failed");
        }
      } else {
        setReportsStatus("failed");
      }
    } catch (error) {
      logger.error("Failed to generate reports:", normalizeError(error));
      setReportsStatus("failed");
    } finally {
      setIsGeneratingReports(false);
    }
  };

  // Send email function
  const handleSendEmail = async () => {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError("Пожалуйста, введите корректный email");
      return;
    }

    setIsSendingEmail(true);
    setEmailError(null);

    try {
      const response = await fetch(`/api/sessions/${sessionId}/send-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      if (response.ok) {
        setEmailSuccess(true);
        setTimeout(() => {
          setShowEmailModal(false);
          setEmailSuccess(false);
          setEmail("");
        }, 2000);
      } else {
        const data = await response.json();
        setEmailError(data.error || "Не удалось отправить email");
      }
    } catch {
      setEmailError("Ошибка при отправке email");
    } finally {
      setIsSendingEmail(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div
                className={`p-3 bg-gradient-to-br ${mode.gradient} rounded-xl`}
              >
                <ModeIcon className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {mode.title}
                </h1>
                <div className="flex items-center gap-4 mt-2 text-sm text-gray-600 dark:text-gray-400">
                  <span className="flex items-center gap-1">
                    <ClockIcon className="w-4 h-4" />
                    {formatRelativeTime(session.startedAt)}
                  </span>
                  {isCompleted ? (
                    <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                      <CheckCircleIcon className="w-4 h-4" />
                      Завершено
                    </span>
                  ) : (
                    <span className="text-blue-600 dark:text-blue-400">
                      В процессе • {progress}%
                    </span>
                  )}
                </div>
              </div>
            </div>
            {onClose && (
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Progress Bar */}
          <div className="mt-4">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>
                Прогресс: {session.responses.length} из {session.totalQuestions}{" "}
                вопросов
              </span>
              <span>{progress}%</span>
            </div>
            <div className="h-2 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
              <motion.div
                className={`h-full bg-gradient-to-r ${mode.gradient}`}
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-4 flex gap-3">
            {canContinue && onContinue && (
              <button
                onClick={onContinue}
                className={`flex items-center gap-2 px-6 py-3 bg-gradient-to-r ${mode.gradient} text-white rounded-lg hover:scale-105 transition-transform`}
              >
                <PlayIcon className="w-5 h-5" />
                <span>Продолжить с вопроса {session.responses.length + 1}</span>
              </button>
            )}
            {isCompleted && onOpenChat && (
              <button
                onClick={onOpenChat}
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg hover:scale-105 transition-all"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
                <span>Открыть чат</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="max-w-4xl mx-auto px-6">
          <div className="flex gap-6">
            <button
              onClick={() => setActiveTab("overview")}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === "overview"
                  ? "border-blue-500 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              <div className="flex items-center gap-2">
                <ChartBarIcon className="w-4 h-4" />
                <span>Обзор</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab("responses")}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === "responses"
                  ? "border-blue-500 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              <div className="flex items-center gap-2">
                <DocumentTextIcon className="w-4 h-4" />
                <span>Ответы ({session.responses.length})</span>
              </div>
            </button>
            {isCompleted && (
              <button
                onClick={() => setActiveTab("report")}
                className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === "report"
                    ? "border-blue-500 text-blue-600 dark:text-blue-400"
                    : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                }`}
              >
                <div className="flex items-center gap-2">
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <span>Отчет</span>
                </div>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-6">
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* Statistics Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                  <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                    Ответов дано
                  </div>
                  <div className="text-3xl font-bold text-gray-900 dark:text-white">
                    {session.responses.length} / {session.totalQuestions}
                  </div>
                  <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                    {progress}% выполнено
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                  <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                    Общее время
                  </div>
                  <div className="text-3xl font-bold text-gray-900 dark:text-white">
                    {Math.floor(totalTimeSpent / 60)} мин
                  </div>
                  <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                    ~{avgTimePerQuestion} сек на вопрос
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                  <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                    Средняя длина ответа
                  </div>
                  <div className="text-3xl font-bold text-gray-900 dark:text-white">
                    {avgAnswerLength}
                  </div>
                  <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                    символов
                  </div>
                </div>
              </div>

              {/* Session Info */}
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Информация о сессии
                </h3>
                <dl className="space-y-3">
                  <div className="flex justify-between">
                    <dt className="text-sm text-gray-500 dark:text-gray-400">
                      ID сессии
                    </dt>
                    <dd className="text-sm font-mono text-gray-900 dark:text-white">
                      {session.id.slice(0, 8)}...
                    </dd>
                  </div>
                  {session.user && (
                    <div className="flex justify-between">
                      <dt className="text-sm text-gray-500 dark:text-gray-400">
                        Пользователь
                      </dt>
                      <dd className="text-sm text-gray-900 dark:text-white">
                        <div className="text-right">
                          <div className="font-medium">
                            {[
                              session.user.lastName,
                              session.user.firstName,
                              session.user.middleName,
                            ]
                              .filter(Boolean)
                              .join(" ")}
                          </div>
                          <div className="text-xs text-gray-500">
                            {session.user.email}
                          </div>
                        </div>
                      </dd>
                    </div>
                  )}
                  {session.respondentName && (
                    <div className="flex justify-between">
                      <dt className="text-sm text-gray-500 dark:text-gray-400">
                        Имя респондента
                      </dt>
                      <dd className="text-sm text-gray-900 dark:text-white">
                        {session.respondentName}
                      </dd>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <dt className="text-sm text-gray-500 dark:text-gray-400">
                      Начата
                    </dt>
                    <dd className="text-sm text-gray-900 dark:text-white">
                      {new Date(session.startedAt).toLocaleString("ru-RU")}
                    </dd>
                  </div>
                  {session.completedAt && (
                    <div className="flex justify-between">
                      <dt className="text-sm text-gray-500 dark:text-gray-400">
                        Завершена
                      </dt>
                      <dd className="text-sm text-gray-900 dark:text-white">
                        {new Date(session.completedAt).toLocaleString("ru-RU")}
                      </dd>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <dt className="text-sm text-gray-500 dark:text-gray-400">
                      Статус
                    </dt>
                    <dd className="text-sm">
                      {isCompleted ? (
                        <span className="text-green-600 dark:text-green-400">
                          Завершено
                        </span>
                      ) : (
                        <span className="text-blue-600 dark:text-blue-400">
                          В процессе
                        </span>
                      )}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          )}

          {activeTab === "responses" && (
            <div className="space-y-4">
              {session.responses.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <DocumentTextIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Пока нет ответов</p>
                </div>
              ) : (
                session.responses.map((response, index) => (
                  <motion.div
                    key={response.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <h4 className="text-lg font-medium text-gray-900 dark:text-white">
                        Вопрос {index + 1}
                      </h4>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {Math.floor(response.timeSpent / 60)}:
                        {(response.timeSpent % 60).toString().padStart(2, "0")}
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                      {response.question?.text ||
                        response.questionText ||
                        "Вопрос не найден"}
                    </p>
                    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                      <p className="text-gray-900 dark:text-white whitespace-pre-wrap">
                        {response.answer}
                      </p>
                    </div>
                    <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      {response.answer.length} символов •{" "}
                      {formatRelativeTime(response.answeredAt)}
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          )}

          {activeTab === "report" && (
            <div className="space-y-6">
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    Отчеты по сессии
                  </h2>
                  {reportsStatus === "completed" && reports.length > 0 && (
                    <button
                      onClick={() => setShowEmailModal(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                        />
                      </svg>
                      Отправить на email
                    </button>
                  )}
                </div>
                {reportsStatus === "queued" ||
                reportsStatus === "processing" ? (
                  <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                    <ArrowPathIcon className="w-4 h-4 animate-spin" />
                    <span className="text-sm">
                      {reportsStatus === "queued"
                        ? "Ожидание генерации отчётов..."
                        : "Генерируем отчёты..."}
                    </span>
                  </div>
                ) : reportsStatus === "failed" ? (
                  <p className="text-sm text-red-600 dark:text-red-400">
                    Ошибка при генерации отчётов. Попробуйте позже.
                  </p>
                ) : reportsStatus === "completed" ? (
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Выберите тип отчета для скачивания
                  </p>
                ) : (
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Отчёты ещё не сгенерированы
                    </p>
                    <button
                      onClick={handleGenerateReports}
                      disabled={isGeneratingReports}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      {isGeneratingReports ? (
                        <>
                          <ArrowPathIcon className="w-4 h-4 animate-spin" />
                          <span>Генерация...</span>
                        </>
                      ) : (
                        <>
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                            />
                          </svg>
                          <span>Сгенерировать отчёты</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>

              {/* Report Cards Grid */}
              {reportsStatus === "completed" && reports.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Adapted Report - доступен всем */}
                  {reports.find((r) => r.type === "ADAPTED") && (
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 hover:border-green-400 dark:hover:border-green-600 transition-all group hover:shadow-lg">
                      <div className="flex flex-col h-full">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg group-hover:scale-110 transition-transform">
                            <svg
                              className="w-6 h-6 text-green-600 dark:text-green-400"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                              />
                            </svg>
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                              Адаптированный отчет
                            </h3>
                            <span className="inline-block px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded mt-1">
                              ADAPTED
                            </span>
                          </div>
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400 mb-4 flex-grow overflow-hidden line-clamp-3">
                          {(() => {
                            const report = reports.find(
                              (r) => r.type === "ADAPTED",
                            );
                            if (!report) return "";
                            try {
                              const jsonContent = JSON.parse(report.content);
                              const text =
                                jsonContent.adapted_report?.full_text || "";
                              // Remove markdown and get first 200 chars
                              const cleanText = text
                                .replace(/\\n/g, " ")
                                .replace(/^#+\s*/gm, "")
                                .replace(/\*\*([^*]+)\*\*/g, "$1")
                                .replace(/\*([^*]+)\*/g, "$1")
                                .substring(0, 200);
                              return cleanText + "...";
                            } catch {
                              return report.content.substring(0, 200) + "...";
                            }
                          })()}
                        </div>
                        <div className="space-y-2">
                          <button
                            onClick={() => viewReport("ADAPTED")}
                            className="w-full py-2.5 px-4 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                              />
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                              />
                            </svg>
                            <span>Просмотр</span>
                          </button>
                          <button
                            onClick={() => downloadTXT("ADAPTED")}
                            className="w-full py-2 px-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                              />
                            </svg>
                            <span>Скачать TXT</span>
                          </button>
                          <button
                            onClick={() => downloadPDFReport("ADAPTED")}
                            className="w-full py-2 px-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                              />
                            </svg>
                            <span>Скачать PDF</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Full Report - только для CONSULTANT и ADMIN */}
                  {(userRole === "CONSULTANT" || userRole === "ADMIN") &&
                    reports.find((r) => r.type === "FULL") && (
                      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-600 transition-all group hover:shadow-lg">
                        <div className="flex flex-col h-full">
                          <div className="flex items-center gap-3 mb-4">
                            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg group-hover:scale-110 transition-transform">
                              <svg
                                className="w-6 h-6 text-blue-600 dark:text-blue-400"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                />
                              </svg>
                            </div>
                            <div>
                              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                Полный отчет
                              </h3>
                              <span className="inline-block px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded mt-1">
                                FULL
                              </span>
                            </div>
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400 mb-4 flex-grow overflow-hidden line-clamp-3">
                            {(() => {
                              const report = reports.find(
                                (r) => r.type === "FULL",
                              );
                              if (!report) return "";
                              try {
                                const jsonContent = JSON.parse(report.content);
                                const text =
                                  jsonContent.final_professional_report
                                    ?.full_text || "";
                                // Remove markdown and get first 200 chars
                                const cleanText = text
                                  .replace(/\\n/g, " ")
                                  .replace(/^#+\s*/gm, "")
                                  .replace(/\*\*([^*]+)\*\*/g, "$1")
                                  .replace(/\*([^*]+)\*/g, "$1")
                                  .substring(0, 200);
                                return cleanText + "...";
                              } catch {
                                return report.content.substring(0, 200) + "...";
                              }
                            })()}
                          </div>
                          <div className="space-y-2">
                            <button
                              onClick={() => viewReport("FULL")}
                              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                            >
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                />
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                                />
                              </svg>
                              <span>Просмотр</span>
                            </button>
                            <button
                              onClick={() => downloadTXT("FULL")}
                              className="w-full py-2 px-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                            >
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                                />
                              </svg>
                              <span>Скачать TXT</span>
                            </button>
                            <button
                              onClick={() => downloadPDFReport("FULL")}
                              className="w-full py-2 px-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                            >
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                                />
                              </svg>
                              <span>Скачать PDF</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                  {/* Score Table - только для ADMIN */}
                  {userRole === "ADMIN" &&
                    reports.find((r) => r.type === "SCORE_TABLE") && (
                      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 hover:border-purple-400 dark:hover:border-purple-600 transition-all group hover:shadow-lg">
                        <div className="flex flex-col h-full">
                          <div className="flex items-center gap-3 mb-4">
                            <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg group-hover:scale-110 transition-transform">
                              <svg
                                className="w-6 h-6 text-purple-600 dark:text-purple-400"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                                />
                              </svg>
                            </div>
                            <div>
                              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                Бальная таблица
                              </h3>
                              <span className="inline-block px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 rounded mt-1">
                                SCORE_TABLE
                              </span>
                            </div>
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400 mb-4 flex-grow overflow-hidden line-clamp-3">
                            {(() => {
                              const report = reports.find(
                                (r) => r.type === "SCORE_TABLE",
                              );
                              if (!report) return "";
                              try {
                                const jsonContent = JSON.parse(report.content);
                                if (jsonContent.aggregate_score_profile) {
                                  return "Таблица с оценками по аспектам личности и рекомендациями...";
                                }
                                return "Структурированные данные оценки...";
                              } catch {
                                return report.content.substring(0, 200) + "...";
                              }
                            })()}
                          </div>
                          <div className="space-y-2">
                            <button
                              onClick={() => viewReport("SCORE_TABLE")}
                              className="w-full py-2.5 px-4 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                            >
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                />
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                                />
                              </svg>
                              <span>Просмотр</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                </div>
              ) : reportsStatus === "none" ? (
                <div className="text-center py-12 text-gray-500">
                  <DocumentTextIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Отчёты ещё не сгенерированы</p>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {/* Email Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Отправить отчёты на email
              </h3>
              <button
                onClick={() => {
                  setShowEmailModal(false);
                  setEmailError(null);
                  setEmailSuccess(false);
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            {emailSuccess ? (
              <div className="text-center py-4">
                <CheckCircleIcon className="w-16 h-16 text-green-500 mx-auto mb-3" />
                <p className="text-green-600 dark:text-green-400 font-medium">
                  Отчёты успешно отправлены!
                </p>
              </div>
            ) : (
              <>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Все доступные отчёты будут отправлены в текстовом формате
                </p>

                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setEmailError(null);
                  }}
                  placeholder="Введите email"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white mb-4"
                  disabled={isSendingEmail}
                />

                {emailError && (
                  <p className="text-sm text-red-600 dark:text-red-400 mb-4">
                    {emailError}
                  </p>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowEmailModal(false);
                      setEmailError(null);
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    disabled={isSendingEmail}
                  >
                    Отмена
                  </button>
                  <button
                    onClick={handleSendEmail}
                    disabled={isSendingEmail}
                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isSendingEmail ? (
                      <>
                        <ArrowPathIcon className="w-4 h-4 animate-spin" />
                        Отправка...
                      </>
                    ) : (
                      "Отправить"
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Report Viewer Modal */}
      {viewingReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {viewingReport.type === "FULL" && "Полный отчет"}
                  {viewingReport.type === "ADAPTED" && "Адаптированный отчет"}
                  {viewingReport.type === "SCORE_TABLE" && "Бальная таблица"}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {session.respondentName &&
                    `Респондент: ${session.respondentName} • `}
                  {new Date(viewingReport.createdAt).toLocaleDateString(
                    "ru-RU",
                  )}
                </p>
              </div>
              <button
                onClick={() => setViewingReport(null)}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <div
                className="prose prose-sm dark:prose-invert max-w-none
                  prose-headings:text-gray-900 dark:prose-headings:text-white
                  prose-p:text-gray-700 dark:prose-p:text-gray-300
                  prose-strong:text-gray-900 dark:prose-strong:text-white
                  prose-ul:text-gray-700 dark:prose-ul:text-gray-300
                  prose-ol:text-gray-700 dark:prose-ol:text-gray-300
                  prose-li:text-gray-700 dark:prose-li:text-gray-300
                "
                dangerouslySetInnerHTML={{
                  __html: getFormattedContent(viewingReport),
                }}
              />
            </div>

            {/* Footer with download button */}
            {viewingReport.type !== "SCORE_TABLE" && (
              <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Вы можете скачать отчет в текстовом формате
                </div>
                <button
                  onClick={() => {
                    downloadTXT(viewingReport.type);
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                    />
                  </svg>
                  Скачать TXT
                </button>
                <button
                  onClick={() => downloadPDFReport(viewingReport.type)}
                  className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                    />
                  </svg>
                  Скачать PDF
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
