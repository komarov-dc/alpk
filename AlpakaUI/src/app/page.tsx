"use client";

import { useEffect, useState } from "react";

// Force dynamic rendering to prevent SSR issues with sessionManager
export const dynamic = "force-dynamic";
import { Sidebar } from "@/components/Sidebar";
import { ChatView } from "@/components/ChatView";
import { QuestionnaireViewWithTabs } from "@/components/QuestionnaireViewWithTabs";
import { WelcomeScreen } from "@/components/WelcomeScreen";
import { CompletionScreen } from "@/components/CompletionScreen";
import { SessionDetails } from "@/components/SessionDetails";
import { UnfinishedSessionBanner } from "@/components/UnfinishedSessionBanner";
import UserInfo from "@/components/UserInfo";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useChatStore } from "@/store/useChatStore";
import { UserRole } from "@prisma/client";
import {
  useSession,
  useCreateSession,
  useSubmitSession,
} from "@/hooks/queries/useSession";
import { useCreateChat } from "@/hooks/queries/useChat";
import Link from "next/link";
import { CogIcon } from "@heroicons/react/24/outline";
import { logger } from "@/utils/logger";
import { normalizeError } from "@/utils/normalizeError";
import { getAccessTokenFromCookies, parseJWTPayload } from "@/utils/tokenUtils";
// sessionManager will be imported dynamically to avoid SSR issues

export default function Home() {
  const [selectedMode, setSelectedMode] = useState<
    "psychodiagnostics" | "careerGuidance" | null
  >(null);
  const [showWelcome, setShowWelcome] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    null,
  );
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [unfinishedSession, setUnfinishedSession] = useState<{
    id: string;
    mode: "PSYCHODIAGNOSTICS" | "CAREER_GUIDANCE";
    progress: number;
    respondentName?: string;
  } | null>(null);
  const [showBanner, setShowBanner] = useState(false);

  // Локальное состояние для текущей активной сессии
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  // Импортируем TanStack Query hooks
  const { data: currentSession } = useSession(currentSessionId);
  const createSession = useCreateSession();
  const submitSession = useSubmitSession();
  const createChat = useCreateChat();

  useKeyboardShortcuts();

  // Load user role on mount
  useEffect(() => {
    // Проверяем валидность сессии при загрузке
    import("@/lib/sessionManager").then(({ sessionManager }) => {
      sessionManager.initializeSessionCheck();
    });

    // Get user role from cookie token
    const token = getAccessTokenFromCookies();

    if (token) {
      try {
        const payload = parseJWTPayload(token);
        if (payload) {
          setUserRole(payload.role as UserRole);

          // Дополнительная проверка для сессионных токенов
          if (payload.isSessionToken) {
            import("@/lib/sessionManager").then(({ sessionManager }) => {
              if (!sessionManager.getRememberMeStatus()) {
                if (!sessionManager.checkSessionValidity()) {
                  return; // SessionManager will handle the logout
                }
              }
            });
          }
        }
      } catch (error) {
        logger.error("Failed to parse token:", normalizeError(error));
      }
    }
  }, []);

  // Check for unfinished sessions
  useEffect(() => {
    const checkUnfinishedSessions = async () => {
      // Don't check if already in session
      if (currentSessionId) return;

      try {
        const response = await fetch("/api/sessions?status=IN_PROGRESS");
        if (response.ok) {
          const sessions = await response.json();
          if (sessions && sessions.length > 0) {
            const session = sessions[0];

            // Check if user dismissed this session banner
            const dismissed = localStorage.getItem(
              `dismissed-session-${session.id}`,
            );
            if (dismissed === "true") {
              return; // Don't show banner if dismissed
            }

            const progress =
              session.totalQuestions > 0
                ? Math.round(
                    ((session.responses?.length || 0) /
                      session.totalQuestions) *
                      100,
                  )
                : 0;

            setUnfinishedSession({
              id: session.id,
              mode: session.mode,
              progress,
              respondentName: session.respondentName,
            });
            setShowBanner(true);
          }
        }
      } catch (error) {
        logger.error(
          "Failed to check unfinished sessions:",
          normalizeError(error),
        );
      }
    };

    // Delay check to avoid race conditions
    const timer = setTimeout(() => checkUnfinishedSessions(), 500);
    return () => clearTimeout(timer);
  }, [currentSessionId]);

  // Handle browser back button
  useEffect(() => {
    const handlePopState = () => {
      if (showWelcome) {
        setShowWelcome(false);
        setSelectedMode(null);
      } else if (currentSessionId) {
        if (
          confirm(
            "Вы уверены, что хотите выйти из сессии? Ваш прогресс будет сохранен.",
          )
        ) {
          setCurrentSessionId(null);
        }
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [showWelcome, currentSessionId]);

  const handleModeSelect = (mode: "psychodiagnostics" | "careerGuidance") => {
    setSelectedMode(mode);
    setShowWelcome(true);
  };

  const handleStartSession = async (name: string) => {
    try {
      const mode =
        selectedMode === "psychodiagnostics"
          ? "PSYCHODIAGNOSTICS"
          : "CAREER_GUIDANCE";

      const result = await createSession.mutateAsync({
        mode,
        respondentName: name,
        totalQuestions: 5,
      });

      // Устанавливаем текущую сессию
      setCurrentSessionId(result.session.id);
      setShowWelcome(false);
    } catch (error) {
      logger.error("Failed to start session:", normalizeError(error));
    }
  };

  const handleSessionComplete = async () => {
    if (!currentSessionId) return;

    try {
      await submitSession.mutateAsync(currentSessionId);
      // Сессия завершена, но не сбрасываем currentSessionId
      // чтобы показать CompletionScreen
    } catch (error) {
      logger.error("Failed to complete session:", normalizeError(error));
    }
  };

  const handleSessionExit = () => {
    if (
      confirm(
        "Вы уверены, что хотите выйти из сессии? Ваш прогресс будет сохранен.",
      )
    ) {
      // Просто сбрасываем текущую сессию (сессия остается в БД как IN_PROGRESS)
      setCurrentSessionId(null);
    }
  };

  const handleWelcomeClose = () => {
    setShowWelcome(false);
    setSelectedMode(null);
  };

  const handleNewSession = () => {
    setCurrentSessionId(null);
    setSelectedMode(null);
  };

  const handleGoHome = () => {
    setCurrentSessionId(null);
    setSelectedMode(null);
    setSelectedSessionId(null);
  };

  const handleSessionSelect = (sessionId: string) => {
    setSelectedSessionId(sessionId);
    setShowWelcome(false);
    setSelectedMode(null);
  };

  const handleContinueSession = async () => {
    if (!selectedSessionId) return;

    try {
      // Просто устанавливаем выбранную сессию как текущую
      setCurrentSessionId(selectedSessionId);
      setSelectedSessionId(null);
    } catch (error) {
      logger.error("Failed to continue session:", normalizeError(error));
    }
  };

  const handleCloseSessionDetails = () => {
    setSelectedSessionId(null);
  };

  const handleOpenChat = async () => {
    setSelectedSessionId(null);
    // Создать новый чат
    try {
      const result = await createChat.mutateAsync({
        title: "Новый чат",
      });
      // После создания можно установить активный чат
      const { setActiveChatId } = useChatStore.getState();
      setActiveChatId(result.id);
    } catch (error) {
      logger.error("Failed to create chat:", normalizeError(error));
    }
  };

  const handleContinueUnfinishedSession = async () => {
    if (!unfinishedSession) return;

    setShowBanner(false);
    try {
      // Clear dismissed flag from localStorage
      localStorage.removeItem(`dismissed-session-${unfinishedSession.id}`);
      // Устанавливаем незавершенную сессию как текущую
      setCurrentSessionId(unfinishedSession.id);
    } catch (error) {
      logger.error("Failed to continue session:", normalizeError(error));
    }
  };

  const handleDismissBanner = () => {
    setShowBanner(false);
    // Optionally store dismissal in localStorage to not show again
    if (unfinishedSession) {
      localStorage.setItem(`dismissed-session-${unfinishedSession.id}`, "true");
    }
  };

  // Show welcome screen
  if (showWelcome && selectedMode) {
    return (
      <WelcomeScreen
        mode={selectedMode}
        onStart={handleStartSession}
        onClose={handleWelcomeClose}
      />
    );
  }

  // Show completion screen
  if (currentSession?.status === "COMPLETED") {
    return (
      <CompletionScreen
        name={currentSession.respondentName}
        mode={currentSession.mode}
        sessionId={currentSession.id}
        onNewSession={handleNewSession}
        onGoHome={handleGoHome}
      />
    );
  }

  // Render diagnostic view if in session
  if (currentSession && currentSession.status === "IN_PROGRESS") {
    return (
      <div className="h-screen flex flex-col">
        <QuestionnaireViewWithTabs
          sessionId={currentSession.id}
          questions={currentSession.questions || []}
          currentIndex={currentSession.currentIndex}
          totalQuestions={currentSession.totalQuestions}
          mode={currentSession.mode}
          onComplete={handleSessionComplete}
          onExit={handleSessionExit}
          savedResponses={currentSession.responses}
        />
      </div>
    );
  }

  // Show session details if selected
  if (selectedSessionId) {
    return (
      <div className="flex h-screen bg-gray-50 dark:bg-black">
        <Sidebar
          onSessionSelect={handleSessionSelect}
          onNewSession={() => setSelectedSessionId(null)}
        />
        <div className="flex-1">
          <SessionDetails
            sessionId={selectedSessionId}
            onContinue={handleContinueSession}
            onClose={handleCloseSessionDetails}
            onOpenChat={handleOpenChat}
          />
        </div>
      </div>
    );
  }

  // Show mode selection with header
  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-black overflow-hidden">
      {/* Unfinished session banner */}
      {showBanner && unfinishedSession && (
        <UnfinishedSessionBanner
          sessionId={unfinishedSession.id}
          sessionMode={unfinishedSession.mode}
          progress={unfinishedSession.progress}
          respondentName={unfinishedSession.respondentName}
          onContinue={handleContinueUnfinishedSession}
          onDismiss={handleDismissBanner}
        />
      )}

      {/* Header with user info and role-specific buttons */}
      <div className="flex-shrink-0 flex justify-between items-center px-3 sm:px-4 md:px-6 py-2 sm:py-3 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center space-x-2 sm:space-x-3 md:space-x-4">
          {/* Mobile menu button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-1.5 sm:p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <svg
              className="w-5 h-5 text-gray-600 dark:text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d={
                  isMobileMenuOpen
                    ? "M6 18L18 6M6 6l12 12"
                    : "M4 6h16M4 12h16M4 18h16"
                }
              />
            </svg>
          </button>

          <h1 className="text-sm sm:text-base md:text-lg font-semibold text-gray-900 dark:text-white">
            Psy&Pro UI
          </h1>

          {/* Role-specific action buttons */}
          <div className="hidden sm:flex items-center space-x-2">
            {userRole === "ADMIN" && (
              <Link
                href="/admin"
                className="flex items-center space-x-2 px-3 py-1.5 text-xs font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
              >
                <CogIcon className="h-3 w-3" />
                <span>Админ панель</span>
              </Link>
            )}

            {userRole === "CONSULTANT" && (
              <Link
                href="/admin/clients"
                className="flex items-center space-x-2 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                <svg
                  className="h-3 w-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
                <span>Мои клиенты</span>
              </Link>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-2 md:space-x-3">
          {/* Settings button for mobile */}
          <button className="md:hidden p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
            <svg
              className="w-5 h-5 text-gray-600 dark:text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </button>

          <UserInfo />
        </div>
      </div>

      {/* Mobile menu overlay */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black bg-opacity-50"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="relative flex flex-col w-64 bg-white dark:bg-gray-900 shadow-xl">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Меню
              </h2>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
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
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <Sidebar
                onSessionSelect={(id) => {
                  handleSessionSelect(id);
                  setIsMobileMenuOpen(false);
                }}
                onNewSession={() => {
                  setIsMobileMenuOpen(false);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Main content - explicitly set to fill remaining space */}
      <div className="flex flex-1 min-h-0">
        <div className="hidden md:block">
          <Sidebar
            onSessionSelect={handleSessionSelect}
            onNewSession={() => {}}
          />
        </div>
        <div className="flex-1 flex flex-col overflow-hidden">
          <ChatView onStartSession={handleModeSelect} />
        </div>
      </div>
    </div>
  );
}
