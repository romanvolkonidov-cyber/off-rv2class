"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export default function LoginPage() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { user, login, isLoading, loadFromStorage } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isRegisterMode, setIsRegisterMode] = useState(false);

  useEffect(() => {
    loadFromStorage();
    if (useAuthStore.getState().user) {
      const role = useAuthStore.getState().user?.role;
      if (role === 'ADMIN') router.push('/admin');
      else if (role === 'TEACHER') router.push('/teacher');
      else router.push('/student');
    }
  }, [loadFromStorage, router]);

  const toggleLanguage = () => {
    const currentLang = i18n.language || 'ru';
    i18n.changeLanguage(currentLang.startsWith('ru') ? 'en' : 'ru');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isRegisterMode) {
      toast.error(i18n.language?.startsWith('ru') ? "Регистрация временно закрыта" : "Registration is temporarily closed");
      return;
    }
    const success = await login(email, password);
    if (success) {
      const role = useAuthStore.getState().user?.role;
      if (role === 'ADMIN') router.push('/admin');
      else if (role === 'TEACHER') router.push('/teacher');
      else router.push('/student');
    } else {
      toast.error(i18n.language?.startsWith('ru') ? "Ошибка входа. Проверьте email и пароль." : "Login failed. Check email and password.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* Language Switcher */}
      <div className="absolute top-6 right-6 z-50">
        <Button variant="outline" size="sm" className="glass bg-background/50 hover:bg-background/80" onClick={toggleLanguage}>
          {i18n.language?.startsWith('ru') ? '🇬🇧 English' : '🇷🇺 Русский'}
        </Button>
      </div>

      {/* Animated background */}
      <div className="absolute inset-0 gradient-brand opacity-[0.03]" />
      <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-primary/5 blur-3xl animate-pulse" />
      <div className="absolute bottom-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-blue-600/5 blur-3xl animate-pulse delay-1000" />

      <Card className="w-full max-w-md z-10 glass border-border/50">
        <CardHeader className="space-y-3 text-center pb-6">
          <div className="w-16 h-16 rounded-2xl gradient-brand mx-auto flex items-center justify-center shadow-lg shadow-primary/20 mb-2">
            <span className="text-2xl font-bold text-white">rv</span>
          </div>
          <CardTitle className="text-3xl font-bold tracking-tight">
            <span className="text-gradient">{t('app.name')}</span>
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            {isRegisterMode ? t('auth.registerSubtitle') : t('auth.loginSubtitle')}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegisterMode && (
              <div className="space-y-2">
                <Label htmlFor="name">{t('auth.name')}</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder={t('auth.namePlaceholder')}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="bg-background/50"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">{t('auth.email')}</Label>
              <Input
                id="email"
                type="email"
                placeholder={t('auth.emailPlaceholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-background/50"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">{t('auth.password')}</Label>
              </div>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-background/50"
              />
            </div>

            <Button type="submit" className="w-full font-semibold shadow-md mt-2" disabled={isLoading}>
              {isLoading ? t('common.loading') : (isRegisterMode ? t('auth.teacherRegistration') : t('auth.loginButton'))}
            </Button>

            <div className="text-center mt-4">
              <button
                type="button"
                onClick={() => setIsRegisterMode(!isRegisterMode)}
                className="text-sm text-primary hover:underline"
              >
                {isRegisterMode ? t('auth.alreadyHaveAccount') : t('auth.teacherRegistration')}
              </button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Legal Footer */}
      <div className="absolute bottom-6 w-full text-center flex flex-wrap justify-center items-center gap-x-6 gap-y-2 text-xs font-medium text-muted-foreground z-10 px-4">
        <a href="/legal/privacy" className="hover:text-primary transition-colors underline underline-offset-2">{t('auth.privacy')}</a>
        <a href="/legal/terms" className="hover:text-primary transition-colors underline underline-offset-2">{t('auth.terms')}</a>
        <span className="opacity-70">© {new Date().getFullYear()} rv2class. {t('auth.rights')}</span>
      </div>
    </div>
  );
}
