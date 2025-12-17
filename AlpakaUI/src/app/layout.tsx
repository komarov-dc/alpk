import type { Metadata } from "next";
import "./globals.css";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AutoLogoutProvider } from "@/providers/AutoLogoutProvider";
import { SessionTimeoutWarning } from "@/components/SessionTimeoutWarning";
import { Analytics } from "@/components/Analytics";
import { QueryProvider } from "@/providers/QueryProvider";

export const metadata: Metadata = {
  title: "Psy&Pro UI - Психологическая диагностика и профориентация",
  description: "Интеллектуальный чат-бот для прохождения психологических диагностических сессий и профессиональной ориентации",
  keywords: "психологическая диагностика, профориентация, чат-бот, тестирование, психология",
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
  },
  openGraph: {
    title: "Psy&Pro UI - Диагностика и профориентация",
    description: "Современная платформа для психологического тестирования и карьерного консультирования",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`antialiased bg-gray-50 dark:bg-black text-gray-900 dark:text-white`}
        suppressHydrationWarning
      >
        <QueryProvider>
          <AutoLogoutProvider>
            <ErrorBoundary>
              <SessionTimeoutWarning />
              {children}
              <Analytics />
            </ErrorBoundary>
          </AutoLogoutProvider>
        </QueryProvider>
      </body>
    </html>
  );
}