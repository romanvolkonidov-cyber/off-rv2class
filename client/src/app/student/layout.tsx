"use client";

import React from 'react';
import { useTranslation } from 'react-i18next';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/auth';
import { useRouter } from 'next/navigation';

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="h-16 bg-card border-b border-border flex items-center justify-between px-4 md:px-8 shadow-sm shrink-0">
        <h1 className="text-xl font-bold text-primary">rv2class</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium hidden md:inline-block text-muted-foreground">{user?.name}</span>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="text-destructive hover:bg-destructive/10">
            <LogOut className="w-4 h-4 md:mr-2" />
            <span className="hidden md:inline-block">{t('auth.logout')}</span>
          </Button>
        </div>
      </header>
      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        {children}
      </main>
    </div>
  );
}