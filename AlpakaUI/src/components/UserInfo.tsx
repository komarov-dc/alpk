"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { UserRole } from "@prisma/client";
import {
  ChevronDownIcon,
  UserIcon,
  ArrowRightOnRectangleIcon,
} from "@heroicons/react/24/outline";
import { logger } from "@/utils/logger";
import { normalizeError } from "@/utils/normalizeError";
import { getAccessTokenFromCookies, parseJWTPayload } from "@/utils/tokenUtils";

interface UserData {
  id: string;
  email: string;
  lastName: string;
  firstName: string;
  middleName?: string | null;
  role: UserRole;
}

export default function UserInfo() {
  const router = useRouter();
  const [user, setUser] = useState<UserData | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      const token = getAccessTokenFromCookies();

      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const payload = parseJWTPayload(token);

        if (payload) {
          // If we have user data in localStorage, use it
          const storedUser = localStorage.getItem("user");
          let lastName = "";
          let firstName = payload.email.split("@")[0];
          let middleName: string | null = null;

          if (storedUser) {
            try {
              const userData = JSON.parse(storedUser);
              lastName = userData.lastName || "";
              firstName = userData.firstName || firstName;
              middleName = userData.middleName;
            } catch {
              // Invalid JSON in localStorage - use defaults from JWT
            }
          }

          setUser({
            id: payload.userId,
            email: payload.email,
            lastName: lastName || "",
            firstName: firstName || "",
            middleName,
            role: payload.role as UserRole,
          });
        }
      } catch (error) {
        logger.error("Failed to parse user token:", normalizeError(error));
      } finally {
        setLoading(false);
      }
    };

    fetchUser();

    // Re-fetch when focus returns to window (in case cookies changed)
    const handleFocus = () => fetchUser();
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, []);

  const handleLogout = () => {
    // Clear all auth data
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("user");
    localStorage.removeItem("rememberMe");

    // Clear cookies
    document.cookie =
      "accessToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    document.cookie =
      "refreshToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";

    router.push("/auth/login");
  };

  const getRoleLabel = (role: UserRole) => {
    const labels: Record<UserRole, string> = {
      ADMIN: "Администратор",
      CONSULTANT: "Консультант",
      SUPPORT: "Поддержка",
      USER: "Пользователь",
    };
    return labels[role] || role;
  };

  const getRoleBadgeColor = (role: UserRole) => {
    const colors: Record<UserRole, string> = {
      ADMIN: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
      CONSULTANT:
        "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      SUPPORT:
        "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      USER: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200",
    };
    return colors[role] || "bg-gray-100 text-gray-800";
  };

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-10 w-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        onBlur={() => setTimeout(() => setIsOpen(false), 200)}
        className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
      >
        <UserIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
          {`${user.lastName} ${user.firstName}${user.middleName ? " " + user.middleName : ""}`}
        </span>
        <ChevronDownIcon
          className={`h-4 w-4 text-gray-500 dark:text-gray-400 transition-transform ${
            isOpen ? "transform rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 rounded-lg bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-700 z-50">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="text-sm font-medium text-gray-900 dark:text-white">
              {`${user.lastName} ${user.firstName}${user.middleName ? " " + user.middleName : ""}`}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {user.email}
            </div>
            <div className="mt-2">
              <span
                className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getRoleBadgeColor(user.role)}`}
              >
                {getRoleLabel(user.role)}
              </span>
            </div>
          </div>

          <div className="p-2">
            <button
              onClick={handleLogout}
              className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
            >
              <ArrowRightOnRectangleIcon className="h-4 w-4" />
              <span>Выйти</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
