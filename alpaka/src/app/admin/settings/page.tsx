"use client";

import { useState, useEffect } from "react";

interface Settings {
  yandex: {
    oauthToken: string;
    folderId: string;
  };
  secrets: {
    sharedSecret: string;
    internalSecret: string;
  };
  workers: {
    prof: {
      instances: number;
      pollInterval: number;
      maxConcurrentJobs: number;
    };
    bigfive: {
      instances: number;
      pollInterval: number;
      maxConcurrentJobs: number;
    };
  };
  urls: {
    externalApiUrl: string;
    internalApiUrl: string;
  };
}

interface SaveResponse {
  success: boolean;
  message: string;
  restartStatus?: "immediate" | "pending";
  stats?: {
    activeJobs?: number;
    settingsUpdated?: boolean;
  };
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [restartPending, setRestartPending] = useState(false);
  const [activeJobs, setActiveJobs] = useState(0);
  const [message, setMessage] = useState<{
    type: "success" | "error" | "warning";
    text: string;
  } | null>(null);
  const [showOAuthToken, setShowOAuthToken] = useState(false);
  const [showSharedSecret, setShowSharedSecret] = useState(false);
  const [showInternalSecret, setShowInternalSecret] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const secret = process.env.NEXT_PUBLIC_ALPAKA_INTERNAL_SECRET || "";
      const res = await fetch("/api/admin/settings", {
        headers: { "X-Alpaka-Internal-Secret": secret },
      });

      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      } else {
        setMessage({ type: "error", text: "Failed to load settings" });
      }
    } catch (error) {
      console.error("Failed to fetch settings:", error);
      setMessage({ type: "error", text: "Failed to load settings" });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;

    setSaving(true);
    setMessage(null);

    try {
      const secret = process.env.NEXT_PUBLIC_ALPAKA_INTERNAL_SECRET || "";
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Alpaka-Internal-Secret": secret,
        },
        body: JSON.stringify(settings),
      });

      const data: SaveResponse = await res.json();

      if (data.success) {
        // Update restart pending status
        if (data.restartStatus === "pending") {
          setRestartPending(true);
          setActiveJobs(data.stats?.activeJobs || 0);
          setMessage({
            type: "warning",
            text: data.message,
          });
        } else {
          setRestartPending(false);
          setActiveJobs(0);
          setMessage({
            type: "success",
            text: data.message,
          });
        }

        // Reload settings to get fresh masked values
        fetchSettings();
      } else {
        setMessage({
          type: "error",
          text: data.message || "Failed to save settings",
        });
      }
    } catch (error) {
      console.error("Failed to save settings:", error);
      setMessage({ type: "error", text: "Failed to save settings" });
    } finally {
      setSaving(false);
    }
  };

  const updateSettings = (path: string[], value: string | number) => {
    if (!settings) return;

    const newSettings = { ...settings };
    let current = newSettings as Record<string, unknown>;

    for (let i = 0; i < path.length - 1; i++) {
      const key = path[i];
      if (key) {
        current = current[key] as Record<string, unknown>;
      }
    }

    const lastKey = path[path.length - 1];
    if (lastKey) {
      current[lastKey] = value;
    }
    setSettings(newSettings);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Загрузка...</div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-500">Не удалось загрузить настройки</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      {/* Pending Restart Indicator */}
      {restartPending && (
        <div className="p-4 rounded-lg border bg-yellow-500/10 border-yellow-500 text-yellow-500">
          <div className="flex items-center gap-3">
            <div className="animate-pulse">⏳</div>
            <div>
              <div className="font-medium">Ожидание перезапуска воркеров</div>
              <div className="text-sm opacity-80 mt-1">
                Обработка {activeJobs} активных задач. Воркеры автоматически
                перезапустятся после завершения.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Message */}
      {message && (
        <div
          className={`
            p-4 rounded-lg border
            ${
              message.type === "success"
                ? "bg-green-500/10 border-green-500 text-green-500"
                : message.type === "warning"
                  ? "bg-yellow-500/10 border-yellow-500 text-yellow-500"
                  : "bg-red-500/10 border-red-500 text-red-500"
            }
          `}
        >
          {message.text}
        </div>
      )}

      {/* Yandex Cloud Settings */}
      <section className="surface-base border-default rounded-lg p-6 space-y-4">
        <h2 className="text-lg font-bold">Yandex Cloud</h2>
        <p className="text-sm text-gray-400">
          Учетные данные для Yandex Cloud API. Модель и провайдер настраиваются
          в Model Provider Node каждого проекта.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              OAuth Token
            </label>
            <div className="relative">
              <input
                type={showOAuthToken ? "text" : "password"}
                value={settings.yandex.oauthToken}
                onChange={(e) =>
                  updateSettings(["yandex", "oauthToken"], e.target.value)
                }
                placeholder="Введите новый OAuth token для обновления"
                className="input-base w-full font-mono text-sm pr-10"
              />
              <button
                type="button"
                onClick={() => setShowOAuthToken(!showOAuthToken)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300 transition-colors"
              >
                {showOAuthToken ? (
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
                      d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                    />
                  </svg>
                ) : (
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
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  </svg>
                )}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Оставьте *** чтобы сохранить существующий токен. Используется для
              Yandex Cloud API.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Folder ID</label>
            <input
              type="text"
              value={settings.yandex.folderId}
              onChange={(e) =>
                updateSettings(["yandex", "folderId"], e.target.value)
              }
              placeholder="Введите Folder ID"
              className="input-base w-full font-mono text-sm"
            />
            <p className="text-xs text-gray-400 mt-1">
              ID папки в Yandex Cloud
            </p>
          </div>
        </div>
      </section>

      {/* Secrets */}
      <section className="surface-base border-default rounded-lg p-6 space-y-4">
        <h2 className="text-lg font-bold">Секретные ключи</h2>
        <p className="text-sm text-gray-400">
          Секреты для аутентификации внутренних API. Требуется перезапуск после
          изменений.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Общий секрет (ALPAKA_SHARED_SECRET)
            </label>
            <div className="relative">
              <input
                type={showSharedSecret ? "text" : "password"}
                value={settings.secrets.sharedSecret}
                onChange={(e) =>
                  updateSettings(["secrets", "sharedSecret"], e.target.value)
                }
                placeholder="Введите новый секрет для обновления"
                className="input-base w-full pr-10"
              />
              <button
                type="button"
                onClick={() => setShowSharedSecret(!showSharedSecret)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300 transition-colors"
              >
                {showSharedSecret ? (
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
                      d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                    />
                  </svg>
                ) : (
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
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  </svg>
                )}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Используется для аутентификации внешнего API
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Внутренний секрет (ALPAKA_INTERNAL_SECRET)
            </label>
            <div className="relative">
              <input
                type={showInternalSecret ? "text" : "password"}
                value={settings.secrets.internalSecret}
                onChange={(e) =>
                  updateSettings(["secrets", "internalSecret"], e.target.value)
                }
                placeholder="Введите новый секрет для обновления"
                className="input-base w-full pr-10"
              />
              <button
                type="button"
                onClick={() => setShowInternalSecret(!showInternalSecret)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300 transition-colors"
              >
                {showInternalSecret ? (
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
                      d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                    />
                  </svg>
                ) : (
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
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  </svg>
                )}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Используется для аутентификации внутреннего admin API
            </p>
          </div>
        </div>
      </section>

      {/* Workers Configuration */}
      <section className="surface-base border-default rounded-lg p-6 space-y-4">
        <h2 className="text-lg font-bold">Настройка воркеров</h2>
        <p className="text-sm text-gray-400">
          Настройки PM2 воркеров. Требуется перезапуск воркеров для применения
          изменений.
        </p>

        <div className="space-y-6">
          {/* Prof Worker */}
          <div>
            <h3 className="font-medium mb-3">Профориентация</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Инстансов
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={settings.workers.prof.instances}
                  onChange={(e) =>
                    updateSettings(
                      ["workers", "prof", "instances"],
                      parseInt(e.target.value),
                    )
                  }
                  className="input-base w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  Интервал опроса (мс)
                </label>
                <input
                  type="number"
                  min="1000"
                  step="1000"
                  value={settings.workers.prof.pollInterval}
                  onChange={(e) =>
                    updateSettings(
                      ["workers", "prof", "pollInterval"],
                      parseInt(e.target.value),
                    )
                  }
                  className="input-base w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  Макс. потоков
                </label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={settings.workers.prof.maxConcurrentJobs}
                  onChange={(e) =>
                    updateSettings(
                      ["workers", "prof", "maxConcurrentJobs"],
                      parseInt(e.target.value),
                    )
                  }
                  className="input-base w-full"
                />
              </div>
            </div>
          </div>

          {/* BigFive Worker */}
          <div>
            <h3 className="font-medium mb-3">Психодиагностика</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Инстансов
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={settings.workers.bigfive.instances}
                  onChange={(e) =>
                    updateSettings(
                      ["workers", "bigfive", "instances"],
                      parseInt(e.target.value),
                    )
                  }
                  className="input-base w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  Интервал опроса (мс)
                </label>
                <input
                  type="number"
                  min="1000"
                  step="1000"
                  value={settings.workers.bigfive.pollInterval}
                  onChange={(e) =>
                    updateSettings(
                      ["workers", "bigfive", "pollInterval"],
                      parseInt(e.target.value),
                    )
                  }
                  className="input-base w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  Макс. потоков
                </label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={settings.workers.bigfive.maxConcurrentJobs}
                  onChange={(e) =>
                    updateSettings(
                      ["workers", "bigfive", "maxConcurrentJobs"],
                      parseInt(e.target.value),
                    )
                  }
                  className="input-base w-full"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* URLs Configuration */}
      <section className="surface-base border-default rounded-lg p-6 space-y-4">
        <h2 className="text-lg font-bold">API URL-адреса</h2>
        <p className="text-sm text-gray-400">
          Настройка внутренних и внешних API endpoint-ов.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Внешний API URL
            </label>
            <input
              type="url"
              value={settings.urls.externalApiUrl}
              onChange={(e) =>
                updateSettings(["urls", "externalApiUrl"], e.target.value)
              }
              placeholder="Введите URL внешнего API"
              className="input-base w-full"
            />
            <p className="text-xs text-gray-400 mt-1">
              Базовый URL внешнего API для воркеров
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Внутренний API URL
            </label>
            <input
              type="url"
              value={settings.urls.internalApiUrl}
              onChange={(e) =>
                updateSettings(["urls", "internalApiUrl"], e.target.value)
              }
              placeholder="Введите URL внутреннего API"
              className="input-base w-full"
            />
            <p className="text-xs text-gray-400 mt-1">
              Базовый URL внутреннего API для воркеров
            </p>
          </div>
        </div>
      </section>

      {/* Save Button */}
      <div className="flex justify-end gap-3 pt-4">
        <button
          onClick={() => fetchSettings()}
          disabled={saving}
          className="btn-base btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Сбросить
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-base btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? "Сохранение..." : "Сохранить настройки"}
        </button>
      </div>
    </div>
  );
}
