'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const tabs = [
    { id: 'workers', label: 'Воркеры', path: '/admin' },
    { id: 'batch', label: 'Batch', path: '/admin/batch' },
    { id: 'settings', label: 'Настройки', path: '/admin/settings' },
    { id: 'logs', label: 'Логи', path: '/admin/logs' },
  ];

  const isActiveTab = (path: string) => {
    if (path === '/admin') {
      return pathname === '/admin';
    }
    return pathname?.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-black text-white font-mono">
      {/* Header */}
      <header className="border-b border-gray-500 bg-gray-800">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <h1 className="text-xl font-bold">Админ-панель</h1>
          <p className="text-sm text-gray-300 mt-1">
            Управление системой и мониторинг
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="max-w-7xl mx-auto px-6">
          <nav className="flex gap-1 -mb-px">
            {tabs.map((tab) => (
              <Link
                key={tab.id}
                href={tab.path}
                className={`
                  px-4 py-3 text-sm font-medium border-b-2 transition-all
                  ${
                    isActiveTab(tab.path)
                      ? 'border-white text-white'
                      : 'border-transparent text-gray-300 hover:text-white hover:border-gray-400'
                  }
                `}
              >
                {tab.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
