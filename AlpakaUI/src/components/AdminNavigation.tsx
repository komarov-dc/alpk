'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ChartBarIcon,
  UsersIcon,
  ClipboardDocumentListIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';

export default function AdminNavigation() {
  const pathname = usePathname();

  const navItems = [
    {
      href: '/admin',
      label: 'Статистика',
      icon: ChartBarIcon,
    },
    {
      href: '/admin/users',
      label: 'Пользователи',
      icon: UsersIcon,
    },
    {
      href: '/admin/sessions',
      label: 'Сессии',
      icon: ClipboardDocumentListIcon,
    },
    {
      href: '/admin/reports',
      label: 'Отчеты',
      icon: DocumentTextIcon,
    },
  ];

  return (
    <div className="mb-6">
      <div className="flex gap-3 overflow-x-auto pb-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
