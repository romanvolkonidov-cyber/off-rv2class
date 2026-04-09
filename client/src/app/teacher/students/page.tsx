'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import '@/lib/i18n';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';

interface Student {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  _count: { homeworkAssignments: number };
}

export default function StudentsPage() {
  const { t } = useTranslation();
  const [students, setStudents] = useState<Student[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const fetchStudents = useCallback(async () => {
    try {
      const res = await api.get('/teacher/students');
      setStudents(res.data);
    } catch {
      toast.error('Ошибка загрузки учеников');
    }
  }, []);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  const handleAdd = async () => {
    if (!name || !email || !password) return;
    try {
      await api.post('/teacher/students', { name, email, password });
      setName('');
      setEmail('');
      setPassword('');
      setIsAdding(false);
      fetchStudents();
      toast.success('Ученик добавлен');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Ошибка');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить ученика?')) return;
    try {
      await api.delete(`/teacher/students/${id}`);
      fetchStudents();
      toast.success('Ученик удалён');
    } catch {
      toast.error('Ошибка удаления');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('teacher.myStudents')}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Управление учениками
          </p>
        </div>
        <Dialog open={isAdding} onOpenChange={setIsAdding}>
          <DialogTrigger render={
            <Button className="gradient-brand text-white cursor-pointer">
              + {t('teacher.addStudent')}
            </Button>
          } />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('teacher.addStudent')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>{t('auth.name')}</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Иван Иванов" />
              </div>
              <div className="space-y-2">
                <Label>{t('auth.email')}</Label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="student@email.com" />
              </div>
              <div className="space-y-2">
                <Label>{t('auth.password')}</Label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Пароль" />
              </div>
              <Button onClick={handleAdd} className="w-full cursor-pointer">{t('common.create')}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('auth.name')}</TableHead>
                <TableHead>{t('auth.email')}</TableHead>
                <TableHead className="text-center">Домашние задания</TableHead>
                <TableHead className="text-center">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    {t('teacher.noStudents')}
                  </TableCell>
                </TableRow>
              ) : (
                students.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell>{s.email}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">{s._count.homeworkAssignments}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive cursor-pointer"
                        onClick={() => handleDelete(s.id)}
                      >
                        {t('common.delete')}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
