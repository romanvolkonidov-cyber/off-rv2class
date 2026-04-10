"use client";

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2, Save } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export default function AdminLessonEditor() {
  const { id } = useParams();
  const [lesson, setLesson] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLesson = async () => {
      try {
        const res = await api.get(`/admin/lessons/${id}`);
        setLesson(res.data);
      } catch (error) {
        toast.error('Ошибка загрузки урока');
      } finally {
        setLoading(false);
      }
    };
    fetchLesson();
  }, [id]);

  const handleUpdateHomework = async (hwId: string, updates: any) => {
    try {
      await api.put(`/admin/homework/${hwId}`, updates);
      toast.success('Задание обновлено');
    } catch (error) {
      toast.error('Ошибка обновления задания');
    }
  };

  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin w-8 h-8 text-primary" /></div>;
  if (!lesson) return <div>Урок не найден</div>;

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <h1 className="text-3xl font-bold">Редактор контента ИИ: {lesson.title}</h1>
      <p className="text-muted-foreground">Проверьте и исправьте сгенерированные заметки и задания перед публикацией.</p>

      <div className="space-y-6">
        <h2 className="text-2xl font-semibold border-b pb-2">Домашние задания</h2>
        {lesson.homework.map((hw: any) => (
          <div key={hw.id} className="bg-card p-6 rounded-xl border border-secondary shadow-sm space-y-4">
            <div className="flex justify-between items-center">
              <span className="font-bold text-primary">{hw.exerciseType}</span>
              {hw.exerciseType === 'LISTENING' && !hw.audioUrl && (
                <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full">Требуется загрузить аудио (скрыто от ученика)</span>
              )}
            </div>
            
            <div className="space-y-2">
              <Label>Текст задания</Label>
              <Textarea 
                defaultValue={hw.questionText} 
                onBlur={(e) => handleUpdateHomework(hw.id, { questionText: e.target.value })}
              />
            </div>

            {hw.correctAnswer !== null && (
              <div className="space-y-2">
                <Label>Правильный ответ (для авто-проверки)</Label>
                <Input 
                  defaultValue={hw.correctAnswer} 
                  onBlur={(e) => handleUpdateHomework(hw.id, { correctAnswer: e.target.value })}
                />
              </div>
            )}
            
            {/* Audio Upload for Listening exercises */}
            {hw.exerciseType === 'LISTENING' && (
               <div className="space-y-2 mt-4 bg-secondary/30 p-4 rounded-lg">
                 <Label>Загрузить Аудио файл (.mp3)</Label>
                 <Input type="file" accept="audio/*" onChange={async (e) => {
                   if (!e.target.files?.[0]) return;
                   const fd = new FormData();
                   fd.append('audio', e.target.files[0]);
                   await api.post(`/admin/homework/${hw.id}/audio`, fd);
                   toast.success('Аудио загружено!');
                 }} />
               </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}