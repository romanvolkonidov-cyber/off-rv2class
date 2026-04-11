import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin", "latin-ext"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "rv2class — Онлайн-обучение английскому",
  description: "Современная платформа для онлайн-обучения английскому языку с интерактивными уроками, автоматической проверкой домашних заданий и умной системой создания учебных материалов",
  description: "Современная платформа для онлайн-обучения английскому языку с интерактивными уроками и автоматической проверкой домашних заданий.",
  keywords: ["английский", "онлайн-обучение", "интерактивные уроки", "преподаватель", "rv2class", "английский язык"],
  openGraph: {
    title: "rv2class — Онлайн-обучение английскому",
    description: "Современная платформа для онлайн-обучения английскому языку с интерактивными уроками и автоматической проверкой домашних заданий.",
    url: "https://158.220.94.77.sslip.io",
    siteName: "rv2class",
    locale: "ru_RU",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "rv2class — Онлайн-обучение",
    description: "Современная платформа для онлайн-обучения английскому языку.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body className={`min-h-screen bg-background font-sans antialiased text-foreground ${geistSans.variable} ${geistMono.variable}`}>
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
