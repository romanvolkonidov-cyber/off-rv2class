'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import '@/lib/i18n';
import { useAuthStore } from '@/stores/auth';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';

interface NavItem {
  label: string;
  href: string;
  icon: string;
}

const navConfig: Record<string, NavItem[]> = {
  ADMIN: [
    { label: 'nav.courses', href: '/admin', icon: '📚' },
    { label: 'nav.users', href: '/admin/users', icon: '👥' },
  ],
  TEACHER: [
    { label: 'nav.library', href: '/teacher', icon: '📖' },
    { label: 'nav.students', href: '/teacher/students', icon: '🎒' },
    { label: 'nav.gradebook', href: '/teacher/gradebook', icon: '📊' },
  ],
  STUDENT: [
    { label: 'nav.dashboard', href: '/student', icon: '🏠' },
    { label: 'Прошлые уроки', href: '/student/lessons', icon: '📜' },
    { label: 'nav.homework', href: '/student/homework', icon: '📝' },
  ],
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout, loadFromStorage } = useAuthStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    loadFromStorage();
    setMounted(true);
  }, [loadFromStorage]);

  useEffect(() => {
    if (mounted && !user) {
      router.push('/');
    }
  }, [mounted, user, router]);

  if (!mounted || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const navItems = navConfig[user.role] || [];
  const initials = user.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-card flex flex-col shrink-0">
        {/* Logo */}
        <div className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl gradient-brand flex items-center justify-center shadow-md shadow-primary/20">
            <span className="text-sm font-bold text-white">rv</span>
          </div>
          <div>
            <h1 className="font-bold text-lg leading-none text-gradient">rv2class</h1>
            <p className="text-xs text-muted-foreground mt-0.5">{t(`role.${user.role.toLowerCase()}`)}</p>
          </div>
        </div>

        <Separator />

        {/* Nav items */}
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || 
              (item.href !== `/${user.role.toLowerCase()}` && pathname.startsWith(item.href));
            return (
              <button
                key={item.href}
                onClick={() => router.push(item.href)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                {t(item.label)}
              </button>
            );
          })}
        </nav>

        <Separator />

        {/* User info & logout */}
        <div className="p-3">
          <div className="flex items-center gap-3 px-2 py-2">
            <Avatar className="h-9 w-9">
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user.name}</p>
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full mt-1 text-muted-foreground hover:text-destructive cursor-pointer"
            onClick={handleLogout}
            id="logout-button"
          >
            {t('auth.logout')}
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="p-6 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
