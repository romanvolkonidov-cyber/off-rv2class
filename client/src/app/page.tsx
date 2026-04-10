'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import '@/lib/i18n';
import api from '@/lib/api';
import { auth } from '@/lib/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { useAuthStore } from '@/stores/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function LoginPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, login, isLoading, error, loadFromStorage } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isRegisterMode, setIsRegisterMode] = useState(false);

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  useEffect(() => {
    if (user) {
      const dashboardMap = {
        ADMIN: '/admin',
        TEACHER: '/teacher',
        STUDENT: '/student',
      };
      router.push(dashboardMap[user.role] || '/');
    }
  }, [user, router]);

  const performLogin = async (loginEmail: string, loginPassword: string, loginName?: string) => {
    const trimmedEmail = (loginEmail || '').trim();
    const trimmedPassword = (loginPassword || '').trim();

    console.log('🚀 [v1.4] Attempting Firebase Login...');
    console.log('📧 Email Sent:', `"${trimmedEmail}"`);

    if (!trimmedEmail) {
      console.error('❌ FATAL: performLogin was called with an EMPTY email!');
      toast.error('Ошибка: Email не может быть пустым. Попробуйте ввести его еще раз.');
      return;
    }

    try {
      if (isRegisterMode && loginName) {
        // Create user in Firebase
        const fbUser = await createUserWithEmailAndPassword(auth, trimmedEmail, trimmedPassword);
        const idToken = await fbUser.user.getIdToken();
        
        // Send to backend to create Teacher in Prisma
        const res = await api.post('/auth/firebase-login', { idToken, name: loginName.trim(), role: 'TEACHER' });
        
        localStorage.setItem('rv2class_token', res.data.token);
        localStorage.setItem('rv2class_user', JSON.stringify(res.data.user));
        window.location.reload(); 
      } else {
        // Login in Firebase
        const fbUser = await signInWithEmailAndPassword(auth, trimmedEmail, trimmedPassword);
        const idToken = await fbUser.user.getIdToken();
        
        // Send to backend to get JWT session
        const res = await api.post('/auth/firebase-login', { idToken });
        localStorage.setItem('rv2class_token', res.data.token);
        localStorage.setItem('rv2class_user', JSON.stringify(res.data.user));
        window.location.reload();
      }
    } catch (err: any) {
      console.error('❌ Firebase Login Error Details:', {
        code: err.code,
        message: err.message,
        emailSent: trimmedEmail
      });
      
      if (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        toast.error('Неверный email или пароль');
      } else if (err.code === 'auth/email-already-in-use') {
        toast.error('Такой email уже зарегистрирован');
      } else if (err.code === 'auth/invalid-email') {
        toast.error('Неверный формат email. Проверьте адрес.');
      } else if (err.response?.data?.error) {
        toast.error(err.response.data.error);
      } else {
        toast.error(`Ошибка: ${err.message || 'Firebase Login Error'}`);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // EXTREME FALLBACK: If React state is empty, scrape the DOM directly
    let finalEmail = email;
    let finalPassword = password;
    
    if (!finalEmail) {
      const emailEl = document.getElementById('email') as HTMLInputElement;
      if (emailEl?.value) finalEmail = emailEl.value;
    }
    
    if (!finalPassword) {
      const passEl = document.getElementById('password') as HTMLInputElement;
      if (passEl?.value) finalPassword = passEl.value;
    }

    await performLogin(finalEmail, finalPassword, isRegisterMode ? name : undefined);
  };

  if (user) return null;

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 gradient-brand opacity-[0.03]" />
      <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-primary/5 blur-3xl animate-pulse" />
      <div className="absolute bottom-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-primary/3 blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />

      <Card className="w-full max-w-md mx-4 shadow-2xl border-0 glass relative z-10" id="login-card">
        <CardHeader className="text-center space-y-3 pb-2">
          {/* Logo */}
          <div className="mx-auto w-16 h-16 rounded-2xl gradient-brand flex items-center justify-center shadow-lg shadow-primary/25 transition-transform hover:scale-105">
            <span className="text-2xl font-bold text-white">rv</span>
          </div>
          <CardTitle className="text-2xl font-bold">
            <span className="text-gradient">{t('app.name')}</span>
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            {isRegisterMode ? 'Создайте портал учителя для своих учеников' : t('auth.loginSubtitle')}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegisterMode && (
              <div className="space-y-2">
                <Label htmlFor="name">Ваше имя</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Иван Иванов"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="transition-all focus:shadow-md focus:shadow-primary/10"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">{t('auth.email')}</Label>
              <Input
                id="email"
                type="email"
                placeholder="teacher@rv2class.ru"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                className="transition-all focus:shadow-md focus:shadow-primary/10"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">{t('auth.password')}</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="transition-all focus:shadow-md focus:shadow-primary/10"
              />
            </div>

            {error && (
              <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full gradient-brand text-white font-medium shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all cursor-pointer"
              disabled={isLoading}
              id="login-button"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {t('common.loading')}
                </span>
              ) : (
                t('auth.loginButton')
              )}
            </Button>
            
            <div className="text-center text-sm mt-4">
              <button
                type="button"
                onClick={() => setIsRegisterMode(!isRegisterMode)}
                className="text-primary hover:underline"
              >
                {isRegisterMode ? 'Уже есть аккаунт? Войти' : 'Регистрация для учителей'}
              </button>
            </div>
          </form>

          {/* Demo credentials hint - NOW OUTSIDE FORM */}
          <div className="mt-6 pt-4 border-t border-border/50">
            <p className="text-xs text-muted-foreground text-center mb-2">Демо-аккаунты:</p>
            <div className="grid grid-cols-1 gap-1 text-xs text-muted-foreground">
              <button
                type="button"
                className="text-left px-2 py-1.5 rounded hover:bg-primary/10 transition-colors cursor-pointer border border-primary/20"
                onClick={() => performLogin('romanvolkonidov@gmail.com', 'admin123')}
              >
                🛡️ Roman Admin: romanvolkonidov@gmail.com / admin123
              </button>
              <button
                type="button"
                className="text-left px-2 py-1.5 rounded hover:bg-accent transition-colors cursor-pointer"
                onClick={() => performLogin('admin@rv2class.ru', 'admin123')}
              >
                👑 admin@rv2class.ru / admin123
              </button>
              <button
                type="button"
                className="text-left px-2 py-1.5 rounded hover:bg-accent transition-colors cursor-pointer"
                onClick={() => performLogin('teacher@rv2class.ru', 'teacher123')}
              >
                📚 teacher@rv2class.ru / teacher123
              </button>
              <button
                type="button"
                className="text-left px-2 py-1.5 rounded hover:bg-accent transition-colors cursor-pointer"
                onClick={() => performLogin('student@rv2class.ru', 'student123')}
              >
                🎒 student@rv2class.ru / student123
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
