"use client";

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Search, Eye } from 'lucide-react';
import api from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

interface Assignment {
  id: string;
  student: { name: string };
  lesson: { title: string };
  score: number | null;
  submittedAt: string | null;
}

export default function GradebookPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchGradebook = async () => {
      try {
        const res = await api.get('/teacher/gradebook');
        setAssignments(res.data);
      } catch (error) {
        console.error("Failed to load gradebook", error);
      } finally {
        setLoading(false);
      }
    };
    fetchGradebook();
  }, []);

  const filtered = assignments.filter(a => 
    a.student.name.toLowerCase().includes(search.toLowerCase()) || 
    a.lesson.title.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin w-8 h-8 text-primary" /></div>;
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{t('navigation.gradebook')}</h1>
          <p className="text-muted-foreground mt-2">Просмотр результатов и выставление оценок.</p>
        </div>
        <div className="relative max-w-sm w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Поиск по имени или уроку..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-card" />
        </div>
      </div>

      <div className="bg-card border border-secondary rounded-xl shadow-sm overflow-hidden overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-secondary/40 text-muted-foreground">
            <tr>
              <th className="px-6 py-4 font-medium">Ученик</th>
              <th className="px-6 py-4 font-medium">Урок</th>
              <th className="px-6 py-4 font-medium">Дата сдачи</th>
              <th className="px-6 py-4 font-medium">Оценка</th>
              <th className="px-6 py-4 font-medium text-right">Действие</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-secondary">
            {filtered.map((a) => (
              <tr key={a.id} className="hover:bg-secondary/10 transition-colors">
                <td className="px-6 py-4 font-medium text-foreground">{a.student.name}</td>
                <td className="px-6 py-4 text-muted-foreground">{a.lesson.title}</td>
                <td className="px-6 py-4 text-muted-foreground">{a.submittedAt ? new Date(a.submittedAt).toLocaleDateString('ru-RU') : 'Не сдано'}</td>
                <td className="px-6 py-4">
                  {a.score !== null ? (
                    <span className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${a.score >= 80 ? 'bg-green-100 text-green-700' : a.score >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                      {a.score}%
                    </span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </td>
                <td className="px-6 py-4 text-right">
                  <Button variant="ghost" size="sm" onClick={() => router.push(`/teacher/gradebook/${a.id}`)} disabled={!a.submittedAt}>
                    <Eye className="w-4 h-4 mr-2" /> Проверить
                  </Button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">Задания не найдены</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}