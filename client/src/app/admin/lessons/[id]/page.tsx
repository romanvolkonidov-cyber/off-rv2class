'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export default function AdminLessonDetailsPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useParams();
  const [lesson, setLesson] = useState<any>(null);
  const [uploadingSlideId, setUploadingSlideId] = useState<string | null>(null);
  const [uploadingHomeworkId, setUploadingHomeworkId] = useState<string | null>(null);
  
  // Widget dragging state
  const slideRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  const fetchLesson = async () => {
    try {
      const res = await api.get(`/admin/lessons/${params.id}`);
      setLesson(res.data);
    } catch {
      toast.error('Ошибка загрузки урока');
    }
  };

  useEffect(() => {
    fetchLesson();
  }, [params.id]);

  const handleSlideAudioUpload = async (slideId: string, file: File) => {
    setUploadingSlideId(slideId);
    const formData = new FormData();
    formData.append('audio', file);
    try {
      await api.post(`/admin/slides/${slideId}/audio`, formData);
      toast.success('Аудио загружено на слайд');
      fetchLesson();
    } catch {
      toast.error('Ошибка загрузки аудио');
    } finally {
      setUploadingSlideId(null);
    }
  };

  const handleHomeworkAudioUpload = async (homeworkId: string, file: File) => {
    setUploadingHomeworkId(homeworkId);
    const formData = new FormData();
    formData.append('audio', file);
    try {
      await api.post(`/admin/homework/${homeworkId}/audio`, formData);
      toast.success('Аудио прикреплено к заданию');
      fetchLesson();
    } catch {
      toast.error('Ошибка загрузки аудио');
    } finally {
      setUploadingHomeworkId(null);
    }
  };

  const handleSaveWidgetCoords = async (slideId: string, x: number, y: number) => {
    // Keeping for backwards compatibility if needed, but not used actively for audio anymore
  };

  const handleSlideVideoUpload = async (slideId: string, file: File) => {
    setUploadingSlideId(slideId);
    const formData = new FormData();
    formData.append('video', file);
    try {
      await api.post(`/admin/slides/${slideId}/video`, formData);
      toast.success('Видео загружено на слайд');
      fetchLesson();
    } catch {
      toast.error('Ошибка загрузки видео');
    } finally {
      setUploadingSlideId(null);
    }
  };

  const onWidgetDragEnd = (e: React.DragEvent, slideId: string) => {
    const slideContainer = slideRefs.current[slideId];
    if (!slideContainer) return;
    
    const rect = slideContainer.getBoundingClientRect();
    const dropX = e.clientX - rect.left;
    const dropY = e.clientY - rect.top;

    // Convert to percentage
    const percentX = (dropX / rect.width) * 100;
    const percentY = (dropY / rect.height) * 100;
    
    handleSaveWidgetCoords(slideId, Math.max(0, Math.min(100, percentX)), Math.max(0, Math.min(100, percentY)));
  };

  if (!lesson) return <div className="p-8">Загрузка...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={() => router.push('/admin')}>
          ← Назад
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{lesson.title}</h1>
          <p className="text-muted-foreground text-sm">Редактор медиафайлов и ДЗ</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Слайды и Аудио</CardTitle>
        </CardHeader>
        <CardContent className="space-y-8">
          {lesson.slides?.map((slide: any) => (
            <div key={slide.id} className="flex gap-6 border-b pb-8">
              <div 
                className="relative w-80 aspect-video bg-muted rounded-lg overflow-hidden shrink-0 border"
                ref={(el) => { slideRefs.current[slide.id] = el }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => onWidgetDragEnd(e, slide.id)}
              >
                <img 
                  src={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}${slide.imageUrl}`}
                  className="w-full h-full object-contain pointer-events-none"
                  alt={`Slide ${slide.orderIndex + 1}`}
                />
              </div>

              <div className="flex-1 space-y-4">
                <h3 className="font-semibold">Слайд {slide.orderIndex + 1}</h3>
                
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium mb-2">Аудио слайда:</p>
                    <div className="flex items-center gap-3">
                      <label className="cursor-pointer">
                        <input 
                          type="file" 
                          accept="audio/mpeg,audio/wav,audio/mp3" 
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files?.[0]) handleSlideAudioUpload(slide.id, e.target.files[0]);
                          }}
                        />
                        <Button variant="outline" size="sm" asChild disabled={uploadingSlideId === slide.id}>
                          <span>{uploadingSlideId === slide.id ? 'Загрузка...' : 'Загрузить .MP3'}</span>
                        </Button>
                      </label>
                      {slide.audioUrl && <Badge variant="secondary" className="text-green-600 bg-green-50">Аудио прикреплено</Badge>}
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-medium mb-2">Видео слайда (занимает правую половину):</p>
                    <div className="flex items-center gap-3">
                      <label className="cursor-pointer">
                        <input 
                          type="file" 
                          accept="video/mp4,video/webm" 
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files?.[0]) handleSlideVideoUpload(slide.id, e.target.files[0]);
                          }}
                        />
                        <Button variant="outline" size="sm" asChild disabled={uploadingSlideId === slide.id}>
                          <span>{uploadingSlideId === slide.id ? 'Загрузка...' : 'Загрузить Видео'}</span>
                        </Button>
                      </label>
                      {slide.videoUrl && <Badge variant="secondary" className="text-purple-600 bg-purple-50">Видео прикреплено</Badge>}
                    </div>
                  </div>

                  {/* Teacher Notes (AI Generated) */}
                  {slide.teacherNote && (
                    <div className="p-3 bg-muted/30 rounded-lg border border-border space-y-3">
                      <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase">
                        🤖 ИИ Заметки для учителя
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs font-medium text-primary mb-1">Вопросы для обсуждения:</p>
                          <ul className="list-disc list-inside text-sm space-y-1">
                            {(() => {
                              try {
                                const qs = JSON.parse(slide.teacherNote.suggestedQuestions);
                                return qs.map((q: string, i: number) => <li key={i}>{q}</li>);
                              } catch {
                                return <li>{slide.teacherNote.suggestedQuestions}</li>;
                              }
                            })()}
                          </ul>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-green-600 mb-1">Ожидаемые ответы:</p>
                          <ul className="list-disc list-inside text-sm space-y-1">
                            {(() => {
                              try {
                                const ans = JSON.parse(slide.teacherNote.correctAnswers);
                                return ans.map((a: string, i: number) => <li key={i}>{a}</li>);
                              } catch {
                                return <li>{slide.teacherNote.correctAnswers}</li>;
                              }
                            })()}
                          </ul>
                        </div>
                      </div>
                      {slide.teacherNote.tips && (
                        <div className="pt-2 border-t text-xs text-muted-foreground italic">
                          💡 Совет: {slide.teacherNote.tips}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Домашние Задания с Аудио</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {lesson.homework?.map((hw: any) => (
            <div key={hw.id} className="p-4 border rounded-lg bg-card space-y-3">
              <div className="flex gap-2">
                <Badge>{hw.exerciseType}</Badge>
                {hw.needsHumanGrading && <Badge variant="secondary">Ручная проверка</Badge>}
              </div>
              <p className="text-sm font-medium">{hw.questionText}</p>
              
              {hw.options && (
                <div className="pl-4 border-l-2 border-primary/20 space-y-1">
                  {(() => {
                    try {
                      const options = JSON.parse(hw.options);
                      return options.map((opt: string, i: number) => (
                        <div key={i} className={`text-xs p-1.5 rounded ${opt === hw.correctAnswer ? 'bg-green-100/50 text-green-700 font-medium' : 'bg-muted/50'}`}>
                          {opt} {opt === hw.correctAnswer && '✅'}
                        </div>
                      ));
                    } catch {
                      return <p className="text-xs">{hw.options}</p>;
                    }
                  })()}
                </div>
              )}
              
              <div className="flex items-center gap-3 pt-2">
                <label className="cursor-pointer">
                  <input 
                    type="file" 
                    accept="audio/mpeg,audio/wav,audio/mp3" 
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.[0]) handleHomeworkAudioUpload(hw.id, e.target.files[0]);
                    }}
                  />
                  <Button variant="outline" size="sm" asChild disabled={uploadingHomeworkId === hw.id}>
                    <span>{uploadingHomeworkId === hw.id ? 'Загрузка...' : 'Загрузить Аудио для ДЗ'}</span>
                  </Button>
                </label>
                {hw.audioUrl && <Badge variant="secondary" className="text-green-600 bg-green-50">Аудио прикреплено</Badge>}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
