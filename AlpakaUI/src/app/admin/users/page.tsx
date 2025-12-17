"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  UserGroupIcon,
  TrashIcon,
  ArrowLeftIcon,
  MagnifyingGlassIcon,
  CheckCircleIcon,
  XCircleIcon,
  PlusIcon,
  PencilIcon,
} from "@heroicons/react/24/outline";
import { UserRole, UserStatus } from "@prisma/client";
import { logger } from "@/utils/logger";
import { normalizeError } from "@/utils/normalizeError";
import { getAccessTokenFromCookies, parseJWTPayload } from "@/utils/tokenUtils";
import AdminNavigation from "@/components/AdminNavigation";

interface User {
  id: string;
  email: string;
  lastName: string;
  firstName: string;
  middleName?: string | null;
  phone?: string | null;
  birthDate?: string | null;
  status: UserStatus;
  role: UserRole;
  emailVerified: boolean;
  createdAt: string;
  _count?: {
    sessions: number;
  };
}

// User form modal component
function UserFormModal({
  title,
  user,
  onSubmit,
  onClose,
  error,
  validationErrors,
}: {
  title: string;
  user?: User;
  onSubmit: (data: Partial<User> & { password?: string }) => void;
  onClose: () => void;
  error?: string;
  validationErrors?: Array<{ path: string; message: string }>;
}) {
  const [formData, setFormData] = useState({
    email: user?.email || "",
    lastName: user?.lastName || "",
    firstName: user?.firstName || "",
    middleName: user?.middleName || "",
    phone: user?.phone || "",
    birthDate: user?.birthDate
      ? new Date(user.birthDate).toISOString().split("T")[0]
      : "",
    status: (user?.status || "OTHER") as UserStatus,
    role: (user?.role || "USER") as UserRole,
    password: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const dataToSubmit: Partial<User> & { password?: string } = {};

    // Copy non-empty fields
    if (formData.email) dataToSubmit.email = formData.email;
    if (formData.lastName) dataToSubmit.lastName = formData.lastName;
    if (formData.firstName) dataToSubmit.firstName = formData.firstName;
    if (formData.middleName) dataToSubmit.middleName = formData.middleName;
    if (formData.phone) dataToSubmit.phone = formData.phone;
    if (formData.birthDate) dataToSubmit.birthDate = formData.birthDate;
    if (formData.status) dataToSubmit.status = formData.status as UserStatus;
    if (formData.role) dataToSubmit.role = formData.role as UserRole;
    // Only include password if it's not empty (for new users or when changing password)
    if (formData.password) dataToSubmit.password = formData.password;

    onSubmit(dataToSubmit);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          {title}
        </h3>

        {error && (
          <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-4 mb-4">
            <p className="text-sm font-medium text-red-800 dark:text-red-400 mb-2">
              {error}
            </p>
            {validationErrors && validationErrors.length > 0 && (
              <ul className="list-disc list-inside text-sm text-red-700 dark:text-red-300 space-y-1 mt-2">
                {validationErrors.map((err, idx) => (
                  <li key={idx}>{err.message}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Email *
            </label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                       bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                       focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Фамилия *
            </label>
            <input
              type="text"
              required
              value={formData.lastName}
              onChange={(e) =>
                setFormData({ ...formData, lastName: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                       bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                       focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Имя *
            </label>
            <input
              type="text"
              required
              value={formData.firstName}
              onChange={(e) =>
                setFormData({ ...formData, firstName: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                       bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                       focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Отчество
            </label>
            <input
              type="text"
              value={formData.middleName}
              onChange={(e) =>
                setFormData({ ...formData, middleName: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                       bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                       focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Пароль {user ? "(оставьте пустым, чтобы не менять)" : "*"}
            </label>
            <input
              type="password"
              required={!user}
              value={formData.password}
              onChange={(e) =>
                setFormData({ ...formData, password: e.target.value })
              }
              placeholder={
                user ? "Оставьте пустым, чтобы не менять" : "Минимум 6 символов"
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                       bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                       focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Телефон
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => {
                const input = e.target.value;
                const digitsOnly = input.replace(/\D/g, "");

                let formatted = "";
                if (digitsOnly.length > 0) {
                  formatted = "+7";
                  if (digitsOnly.length > 1) {
                    formatted += "(" + digitsOnly.substring(1, 4);
                  }
                  if (digitsOnly.length >= 4) {
                    formatted += ")";
                  }
                  if (digitsOnly.length >= 5) {
                    formatted += "-" + digitsOnly.substring(4, 7);
                  }
                  if (digitsOnly.length >= 8) {
                    formatted += "-" + digitsOnly.substring(7, 9);
                  }
                  if (digitsOnly.length >= 10) {
                    formatted += "-" + digitsOnly.substring(9, 11);
                  }
                }

                setFormData({ ...formData, phone: formatted });
              }}
              placeholder="+7(123)-456-78-90"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                       bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                       focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Дата рождения
            </label>
            <input
              type="date"
              value={formData.birthDate}
              onChange={(e) =>
                setFormData({ ...formData, birthDate: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                       bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                       focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Статус *
            </label>
            <select
              required
              value={formData.status}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  status: e.target.value as UserStatus,
                })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                       bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                       focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="STUDENT">Студент</option>
              <option value="EMPLOYEE">Сотрудник</option>
              <option value="OTHER">Другое</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Роль *
            </label>
            <select
              required
              value={formData.role}
              onChange={(e) =>
                setFormData({ ...formData, role: e.target.value as UserRole })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                       bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                       focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="USER">Пользователь</option>
              <option value="CONSULTANT">Консультант</option>
              <option value="SUPPORT">Поддержка</option>
              <option value="ADMIN">Администратор</option>
            </select>
          </div>

          <div className="flex gap-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300
                       rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              {user ? "Сохранить" : "Создать"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRole, setSelectedRole] = useState<UserRole | "ALL">("ALL");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formError, setFormError] = useState("");
  const [formValidationErrors, setFormValidationErrors] = useState<
    Array<{ path: string; message: string }>
  >([]);

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

    fetchUsers();
  }, [router]);

  const fetchUsers = async () => {
    try {
      const response = await fetch("/api/users");
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      }
    } catch (error) {
      logger.error("Failed to fetch users:", normalizeError(error));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (user: User) => {
    setUserToDelete(user);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!userToDelete) return;

    try {
      const response = await fetch(`/api/users/${userToDelete.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setUsers(users.filter((u) => u.id !== userToDelete.id));
        setShowDeleteModal(false);
        setUserToDelete(null);
        if (selectedUser?.id === userToDelete.id) {
          setSelectedUser(null);
        }
      }
    } catch (error) {
      logger.error("Failed to delete user:", normalizeError(error));
    }
  };

  const handleCreateUser = async (
    userData: Partial<User> & { password?: string },
  ) => {
    setFormError("");
    setFormValidationErrors([]);

    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userData),
      });

      const data = await response.json();

      if (!response.ok) {
        // Check if we have detailed validation errors
        if (data.details && Array.isArray(data.details)) {
          const errors = data.details.map(
            (issue: { path: string[]; message: string }) => ({
              path: issue.path.join("."),
              message: issue.message,
            }),
          );
          setFormValidationErrors(errors);
          setFormError("Пожалуйста, исправьте ошибки в форме");
        } else {
          setFormError(data.error || "Не удалось создать пользователя");
        }
        return;
      }

      // Success
      setUsers([data, ...users]);
      setShowCreateModal(false);
      setFormError("");
      setFormValidationErrors([]);
    } catch (error) {
      logger.error("Failed to create user:", normalizeError(error));
      setFormError("Произошла ошибка при создании пользователя");
    }
  };

  const handleEditUser = async (
    userData: Partial<User> & { password?: string },
  ) => {
    if (!editingUser) return;

    setFormError("");
    setFormValidationErrors([]);

    try {
      const response = await fetch(`/api/users/${editingUser.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userData),
      });

      const data = await response.json();

      if (!response.ok) {
        // Check if we have detailed validation errors
        if (data.details && Array.isArray(data.details)) {
          const errors = data.details.map(
            (issue: { path: string[]; message: string }) => ({
              path: issue.path.join("."),
              message: issue.message,
            }),
          );
          setFormValidationErrors(errors);
          setFormError("Пожалуйста, исправьте ошибки в форме");
        } else {
          setFormError(data.error || "Не удалось обновить пользователя");
        }
        return;
      }

      // Success
      setUsers(users.map((u) => (u.id === editingUser.id ? data : u)));
      if (selectedUser?.id === editingUser.id) {
        setSelectedUser(data);
      }
      setShowEditModal(false);
      setEditingUser(null);
      setFormError("");
      setFormValidationErrors([]);
    } catch (error) {
      logger.error("Failed to update user:", normalizeError(error));
      setFormError("Произошла ошибка при обновлении пользователя");
    }
  };

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    try {
      const response = await fetch(`/api/users/${userId}/role`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });

      if (response.ok) {
        setUsers(
          users.map((u) => (u.id === userId ? { ...u, role: newRole } : u)),
        );
        if (selectedUser?.id === userId) {
          setSelectedUser({ ...selectedUser, role: newRole });
        }
      }
    } catch (error) {
      logger.error("Failed to update user role:", normalizeError(error));
    }
  };

  const getRoleColor = (role: UserRole) => {
    const colors = {
      ADMIN: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
      CONSULTANT:
        "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      SUPPORT:
        "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      USER: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200",
    };
    return colors[role];
  };

  const getRoleLabel = (role: UserRole) => {
    const labels = {
      ADMIN: "Администратор",
      CONSULTANT: "Консультант",
      SUPPORT: "Поддержка",
      USER: "Пользователь",
    };
    return labels[role];
  };

  const getStatusLabel = (status: UserStatus) => {
    const labels = {
      STUDENT: "Студент",
      EMPLOYEE: "Сотрудник",
      OTHER: "Другое",
    };
    return labels[status];
  };

  const filteredUsers = users.filter((user) => {
    const fullName = [user.lastName, user.firstName, user.middleName]
      .filter(Boolean)
      .join(" ");
    const matchesSearch =
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      fullName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = selectedRole === "ALL" || user.role === selectedRole;
    return matchesSearch && matchesRole;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-gray-500">Загрузка пользователей...</div>
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
                Управление пользователями
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Всего пользователей: {users.length}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => {
                  setFormError("");
                  setFormValidationErrors([]);
                  setShowCreateModal(true);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                <PlusIcon className="h-5 w-5" />
                Новый пользователь
              </button>
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
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Navigation Menu */}
        <AdminNavigation />

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Поиск по email или имени..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                           bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                           focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <select
              value={selectedRole}
              onChange={(e) =>
                setSelectedRole(e.target.value as UserRole | "ALL")
              }
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                       bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                       focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">Все роли</option>
              <option value="ADMIN">Администраторы</option>
              <option value="CONSULTANT">Консультанты</option>
              <option value="SUPPORT">Поддержка</option>
              <option value="USER">Пользователи</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Users List */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Пользователь
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Роль
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Сессии
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Действия
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {filteredUsers.map((user) => (
                      <tr
                        key={user.id}
                        className={`hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer ${
                          selectedUser?.id === user.id
                            ? "bg-blue-50 dark:bg-blue-900/20"
                            : ""
                        }`}
                        onClick={() => setSelectedUser(user)}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {[user.lastName, user.firstName, user.middleName]
                                .filter(Boolean)
                                .join(" ")}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {user.email}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getRoleColor(user.role)}`}
                          >
                            {getRoleLabel(user.role)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {user._count?.sessions || 0}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteUser(user);
                            }}
                            className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                          >
                            <TrashIcon className="h-5 w-5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredUsers.length === 0 && (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    Пользователи не найдены
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* User Details */}
          <div className="lg:col-span-1">
            {selectedUser ? (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Детали пользователя
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      ID
                    </label>
                    <p className="mt-1 text-sm font-mono text-gray-900 dark:text-white">
                      {selectedUser.id}
                    </p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      ФИО
                    </label>
                    <p className="mt-1 text-sm text-gray-900 dark:text-white">
                      {[
                        selectedUser.lastName,
                        selectedUser.firstName,
                        selectedUser.middleName,
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    </p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Email
                    </label>
                    <p className="mt-1 text-sm text-gray-900 dark:text-white flex items-center gap-2">
                      {selectedUser.email}
                      {selectedUser.emailVerified ? (
                        <CheckCircleIcon
                          className="h-4 w-4 text-green-500"
                          title="Подтвержден"
                        />
                      ) : (
                        <XCircleIcon
                          className="h-4 w-4 text-red-500"
                          title="Не подтвержден"
                        />
                      )}
                    </p>
                  </div>

                  {selectedUser.phone && (
                    <div>
                      <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        Телефон
                      </label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-white">
                        {selectedUser.phone}
                      </p>
                    </div>
                  )}

                  {selectedUser.birthDate && (
                    <div>
                      <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        Дата рождения
                      </label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-white">
                        {new Date(selectedUser.birthDate).toLocaleDateString(
                          "ru-RU",
                        )}
                      </p>
                    </div>
                  )}

                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Статус
                    </label>
                    <p className="mt-1 text-sm text-gray-900 dark:text-white">
                      {getStatusLabel(selectedUser.status)}
                    </p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Роль
                    </label>
                    <select
                      value={selectedUser.role}
                      onChange={(e) =>
                        handleRoleChange(
                          selectedUser.id,
                          e.target.value as UserRole,
                        )
                      }
                      className="mt-1 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                               bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                               focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="USER">Пользователь</option>
                      <option value="CONSULTANT">Консультант</option>
                      <option value="SUPPORT">Поддержка</option>
                      <option value="ADMIN">Администратор</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Дата регистрации
                    </label>
                    <p className="mt-1 text-sm text-gray-900 dark:text-white">
                      {new Date(selectedUser.createdAt).toLocaleString("ru-RU")}
                    </p>
                  </div>

                  <div className="pt-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
                    <button
                      onClick={() => {
                        setFormError("");
                        setFormValidationErrors([]);
                        setEditingUser(selectedUser);
                        setShowEditModal(true);
                      }}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                    >
                      <PencilIcon className="h-4 w-4" />
                      Редактировать
                    </button>
                    <button
                      onClick={() => handleDeleteUser(selectedUser)}
                      className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                    >
                      Удалить пользователя
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <div className="text-center text-gray-500 dark:text-gray-400">
                  <UserGroupIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Выберите пользователя для просмотра деталей</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && userToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Подтверждение удаления
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Вы уверены, что хотите удалить пользователя{" "}
              <strong>
                {[
                  userToDelete.lastName,
                  userToDelete.firstName,
                  userToDelete.middleName,
                ]
                  .filter(Boolean)
                  .join(" ")}
              </strong>{" "}
              ({userToDelete.email})? Это действие нельзя отменить.
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setUserToDelete(null);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300
                         rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create User Modal */}
      {showCreateModal && (
        <UserFormModal
          title="Создать пользователя"
          onSubmit={handleCreateUser}
          onClose={() => {
            setShowCreateModal(false);
            setFormError("");
            setFormValidationErrors([]);
          }}
          error={formError}
          validationErrors={formValidationErrors}
        />
      )}

      {/* Edit User Modal */}
      {showEditModal && editingUser && (
        <UserFormModal
          title="Редактировать пользователя"
          user={editingUser}
          onSubmit={handleEditUser}
          onClose={() => {
            setShowEditModal(false);
            setEditingUser(null);
            setFormError("");
            setFormValidationErrors([]);
          }}
          error={formError}
          validationErrors={formValidationErrors}
        />
      )}
    </div>
  );
}
