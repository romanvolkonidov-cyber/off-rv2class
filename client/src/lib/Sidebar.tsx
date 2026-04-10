"use client";

import React from 'react';
import { useTranslation } from 'react-i18next';
import { BookOpen, Users, GraduationCap, Settings, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className }: SidebarProps) {
  const { t } = useTranslation();

  const navItems = [
    { icon: BookOpen, label: t('navigation.library'), href: '/teacher/library' },
    { icon: Users, label: t('navigation.students'), href: '/teacher/students' },
    { icon: GraduationCap, label: t('navigation.gradebook'), href: '/teacher/gradebook' },
    { icon: Settings, label: t('navigation.settings'), href: '/teacher/settings' },
  ];

  return (
    <aside className={cn("flex flex-col w-64 h-screen bg-card border-r border-secondary", className)}>
      <div className="p-6">
        <h1 className="text-2xl font-bold text-primary">rv2class</h1>
      </div>
      
      <nav className="flex-1 px-4 space-y-2">
        {navItems.map((item, index) => {
          const Icon = item.icon;
          return (
            <a 
              key={index} 
              href={item.href}
              className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg text-foreground hover:bg-secondary hover:text-primary transition-colors"
            >
              <Icon className="w-5 h-5" />
              {item.label}
            </a>
          );
        })}
      </nav>

      <div className="p-4 border-t border-secondary">
        <Button variant="ghost" className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10">
          <LogOut className="w-5 h-5 mr-3" />
          {t('auth.logout')}
        </Button>
      </div>
    </aside>
  );
}