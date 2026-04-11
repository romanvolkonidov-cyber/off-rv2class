"use client";

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import '@/lib/i18n';
import { useAuthStore } from '@/stores/auth';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User, LogOut } from 'lucide-react';

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
  ],
  STUDENT: [
    { label: 'nav.dashboard', href: '/student', icon: '🏠' },
    { label: 'nav.pastLessons', href: '/student/lessons', icon: '📜' },
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

  const navItems = user.role === 'ADMIN' 
    ? (pathname.startsWith('/admin') ? navConfig.ADMIN : navConfig.TEACHER)
    : (navConfig[user.role] || []);

  const initials = user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top Navbar */}
      <header className="h-16 border-b border-border bg-card flex items-center justify-between px-4 sm:px-6 shrink-0 shadow-sm z-10">
        
        {/* Left: Logo */}
        <div className="flex items-center gap-3 w-1/4">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl gradient-brand flex items-center justify-center shadow-md shadow-primary/20">
            <span className="text-xs sm:text-sm font-bold text-white">rv</span>
          </div>
          <div className="hidden sm:block">
            <h1 className="font-bold text-lg leading-none text-gradient cursor-pointer" onClick={() => router.push(navItems[0]?.href || '/')}>rv2class</h1>
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">{t(`role.${user.role.toLowerCase()}`)}</p>
          </div>
        </div>

        {/* Center: Navigation Links */}
        <nav className="flex items-center justify-center flex-1 gap-1 sm:gap-4 overflow-x-auto px-2 hide-scrollbar">
          {user.role === 'ADMIN' && (
            <button
              onClick={() => router.push(pathname.startsWith('/admin') ? '/teacher' : '/admin')}
              className="flex items-center gap-2 px-3 py-2 rounded-full text-xs font-bold transition-all cursor-pointer bg-accent/10 text-accent border border-accent/20 hover:bg-accent hover:text-accent-foreground whitespace-nowrap"
            >
              <span>{pathname.startsWith('/admin') ? '👨‍🏫' : '🛡️'}</span>
              <span className="hidden md:inline">{pathname.startsWith('/admin') ? t('admin.switchToTeacher', 'В режим Учителя') : t('admin.adminPanel', 'Панель Админа')}</span>
            </button>
          )}

          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== `/${user.role.toLowerCase()}` && pathname.startsWith(item.href));
            return (
              <button
                key={item.href}
                onClick={() => router.push(item.href)}
                className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-full text-sm font-medium transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                }`}
              >
                <span>{item.icon}</span>
                <span className="hidden sm:inline">{t(item.label)}</span>
              </button>
            );
          })}
        </nav>

        {/* Right: User Profile & Actions */}
        <div className="flex items-center justify-end gap-3 w-1/4">
          <div className="hidden lg:flex flex-col items-end mr-2">
            <p className="text-sm font-medium truncate max-w-[150px]">{user.name}</p>
            <p className="text-xs text-muted-foreground truncate max-w-[150px]">{user.email}</p>
          </div>
          <Avatar className="h-8 w-8 sm:h-10 sm:w-10 border border-border">
            {/* Note: In a complete implementation, user.avatarUrl would come from AuthStore if we passed it in local storage */}
            <AvatarImage src={(user as any).avatarUrl ? `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}${(user as any).avatarUrl}` : undefined} />
            <AvatarFallback className="bg-primary/10 text-primary text-xs sm:text-sm font-medium">
              {initials}
            </AvatarFallback>
          </Avatar>
          
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0 cursor-pointer"
            onClick={handleLogout}
            title={t('auth.logout', 'Выйти')}
          >
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-muted/10">
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
          {children}
        </div>
      </main>
    </div>
  );
}
