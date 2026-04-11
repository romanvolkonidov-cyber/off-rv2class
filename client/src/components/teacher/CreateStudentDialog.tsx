"use client";

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Plus, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

export function CreateStudentDialog({ onStudentCreated }: { onStudentCreated: () => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await api.post('/auth/register', {
        name,
        email,
        password,
        role: 'STUDENT'
      });
      
      toast.success(t('teacher.studentCreated', 'Ученик успешно добавлен'));
      setOpen(false);
      setName('');
      setEmail('');
      setPassword('');
      onStudentCreated();
    } catch (error: any) {
      console.error(error);
      const msg = error.response?.data?.error || t('teacher.createStudentError', 'Ошибка при создании ученика');
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm cursor-pointer">
          <UserPlus className="w-4 h-4 mr-2" />
          {t('teacher.addStudent', 'Добавить ученика')}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t('teacher.addStudentTitle', 'Регистрация нового ученика')}</DialogTitle>
          <DialogDescription>
            {t('teacher.addStudentDesc', 'Создайте аккаунт для ученика. Он будет автоматически привязан к вам.')}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="name">{t('auth.name', 'Имя')}</Label>
            <Input
              id="name"
              placeholder="Иван Иванов"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">{t('auth.email', 'Email')}</Label>
            <Input
              id="email"
              type="email"
              placeholder="student@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">{t('auth.password', 'Пароль')}</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
          <Button type="submit" className="w-full mt-4 cursor-pointer" disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
            {t('teacher.createBtn', 'Создать аккаунт')}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
