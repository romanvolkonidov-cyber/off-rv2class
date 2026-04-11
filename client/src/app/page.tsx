'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export default function LandingLoginPage() {
  const router = useRouter();
  const { user, login, loadFromStorage } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Load the user token from local storage on mount
  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  // Route users to their respective dashboards if already authenticated
  useEffect(() => {
    if (user) {
      const routes: Record<string, string> = {
        ADMIN: '/admin',
        TEACHER: '/teacher',
        STUDENT: '/student',
      };
      router.push(routes[user.role] || '/');
    }
  }, [user, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (login) {
        await login(email, password);
        toast.success('Успешный вход');
      } else {
        toast.error('Функция входа еще не реализована в store');
      }
    } catch (error) {
      toast.error('Ошибка авторизации. Проверьте данные.');
    } finally {
      setIsLoading(false);
    }
  };

  // Prevent flicker while redirecting an already logged-in user
  if (user) return null; 

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md p-8 bg-card rounded-xl shadow-lg border border-border">
        <div className="text-center mb-8">
          <div className="w-14 h-14 mx-auto bg-primary rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-primary/20">
            <span className="text-2xl font-bold text-primary-foreground">rv</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">rv2class</h1>
          <p className="text-sm text-muted-foreground mt-2">Войдите в свой аккаунт для продолжения</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Input
              type="password"
              placeholder="Пароль"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full cursor-pointer" disabled={isLoading}>
            {isLoading ? 'Загрузка...' : 'Войти'}
          </Button>
        </form>
      </div>
    </div>
  );
}