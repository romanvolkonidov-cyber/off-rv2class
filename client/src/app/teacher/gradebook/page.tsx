'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import '@/lib/i18n';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';

interface GradebookEntry {
  id: string;
  score: number | null;
  gradeOverride: number | null;
  teacherComment: string | null;
  submittedAt: string | null;
  student: { id: string; name: string; email: string };
  lesson: { id: string; title: string };
  responses: {
    id: string;
    studentAnswer: string;
    isCorrect: boolean;
    homework: { questionText: string; correctAnswer: string; exerciseType: string };
  }[];
}

export default function GradebookPage() {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<GradebookEntry[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editOverride, setEditOverride] = useState<string>('');
  const [editComment, setEditComment] = useState<string>('');

  const fetchGradebook = useCallback(async () => {
    try {
      const res = await api.get('/teacher/gradebook');
      setEntries(res.data);
    } catch {
      toast.error('Ошибка загрузки журнала');
    }
  }, []);

  useEffect(() => {
    fetchGradebook();
  }, [fetchGradebook]);

  const handleSaveOverride = async (entryId: string) => {
    try {
      await api.put(`/teacher/gradebook/${entryId}`, {
        gradeOverride: editOverride ? parseFloat(editOverride) : null,
        teacherComment: editComment || null,
      });
      toast.success('Оценка сохранена');
      fetchGradebook();
      setExpandedId(null);
    } catch {
      toast.error('Ошибка сохранения');
    }
  };

  const toggleExpand = (entry: GradebookEntry) => {
    if (expandedId === entry.id) {
      setExpandedId(null);
    } else {
      setExpandedId(entry.id);
      setEditOverride(entry.gradeOverride?.toString() || '');
      setEditComment(entry.teacherComment || '');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('gradebook.title')}</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Результаты домашних заданий ваших учеников
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('gradebook.student')}</TableHead>
                <TableHead>{t('gradebook.lesson')}</TableHead>
                <TableHead className="text-center">{t('gradebook.autoScore')}</TableHead>
                <TableHead className="text-center">{t('gradebook.override')}</TableHead>
                <TableHead className="text-center">Статус</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Пока нет назначенных заданий
                  </TableCell>
                </TableRow>
              ) : (
                entries.map((entry) => (
                  <>
                    <TableRow key={entry.id} className="cursor-pointer" onClick={() => toggleExpand(entry)}>
                      <TableCell className="font-medium">{entry.student.name}</TableCell>
                      <TableCell>{entry.lesson.title}</TableCell>
                      <TableCell className="text-center">
                        {entry.score !== null ? `${Math.round(entry.score)}%` : '—'}
                      </TableCell>
                      <TableCell className="text-center">
                        {entry.gradeOverride !== null ? `${Math.round(entry.gradeOverride)}%` : '—'}
                      </TableCell>
                      <TableCell className="text-center">
                        {entry.submittedAt ? (
                          <Badge className="bg-green-100 text-green-700">{t('gradebook.submitted')}</Badge>
                        ) : (
                          <Badge variant="outline">{t('gradebook.notSubmitted')}</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-muted-foreground text-sm">
                          {expandedId === entry.id ? '▲' : '▼'}
                        </span>
                      </TableCell>
                    </TableRow>

                    {/* Expanded detail view */}
                    {expandedId === entry.id && (
                      <TableRow key={`${entry.id}-detail`}>
                        <TableCell colSpan={6} className="bg-accent/20 p-4">
                          <div className="space-y-4">
                            {/* Responses */}
                            {entry.responses.length > 0 && (
                              <div className="space-y-2">
                                <h4 className="font-medium text-sm">Ответы ученика:</h4>
                                {entry.responses.map((resp, idx) => (
                                  <div key={resp.id} className="flex items-start gap-3 text-sm pl-2">
                                    <span className={resp.isCorrect ? 'text-green-600' : 'text-red-500'}>
                                      {resp.isCorrect ? '✅' : '❌'}
                                    </span>
                                    <div>
                                      <p className="text-muted-foreground">{idx + 1}. {resp.homework.questionText}</p>
                                      <p>Ответ: <strong>{resp.studentAnswer}</strong></p>
                                      {!resp.isCorrect && (
                                        <p className="text-green-600 text-xs">Правильный: {resp.homework.correctAnswer}</p>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            <Separator />

                            {/* Override & Comment */}
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <label className="text-sm font-medium">{t('gradebook.override')} (%)</label>
                                <Input
                                  type="number"
                                  min="0"
                                  max="100"
                                  value={editOverride}
                                  onChange={(e) => setEditOverride(e.target.value)}
                                  placeholder="Оставьте пустым для авто-оценки"
                                />
                              </div>
                              <div className="space-y-2">
                                <label className="text-sm font-medium">{t('gradebook.comment')}</label>
                                <Textarea
                                  value={editComment}
                                  onChange={(e) => setEditComment(e.target.value)}
                                  placeholder="Комментарий для ученика"
                                  rows={2}
                                />
                              </div>
                            </div>

                            <Button
                              onClick={() => handleSaveOverride(entry.id)}
                              size="sm"
                              className="cursor-pointer"
                            >
                              {t('common.save')}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
