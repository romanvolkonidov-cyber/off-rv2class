'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import api, { PROD_URL } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

export default function AdminLessonDetailsPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useParams();
  const [lesson, setLesson] = useState<any>(null);
  const [uploadingSlideId, setUploadingSlideId] = useState<string | null>(null);
  const [uploadingHomeworkId, setUploadingHomeworkId] = useState<string | null>(null);

  // Edit states
  const [editingNote, setEditingNote] = useState<any>(null);
  const [noteQuestions, setNoteQuestions] = useState('');
  const [noteAnswers, setNoteAnswers] = useState('');
  const [noteTips, setNoteTips] = useState('');

  const [editingHomework, setEditingHomework] = useState<any>(null);
  const [hwQuestionText, setHwQuestionText] = useState('');
  const [hwOptions, setHwOptions] = useState('');
  const [hwCorrectAnswer, setHwCorrectAnswer] = useState('');

  const [isEditingScript, setIsEditingScript] = useState(false);
  const [tempScript, setTempScript] = useState('');
  
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

  const handleUpdateNote = async () => {
    if (!editingNote) return;
    try {
      await api.put(`/admin/teacher-notes/${editingNote.id}`, {
        suggestedQuestions: noteQuestions,
        correctAnswers: noteAnswers,
        tips: noteTips,
      });
      toast.success('Заметки обновлены');
      setEditingNote(null);
      fetchLesson();
    } catch {
      toast.error('Ошибка обновления');
    }
  };

  const handleUpdateHomework = async () => {
    if (!editingHomework) return;
    try {
      await api.put(`/admin/homework/${editingHomework.id}`, {
        questionText: hwQuestionText,
        options: hwOptions || null,
        correctAnswer: hwCorrectAnswer || null,
      });
      toast.success('Задание обновлено');
      setEditingHomework(null);
      fetchLesson();
    } catch {
      toast.error('Ошибка обновления');
    }
  };

  const handleUpdateScript = async () => {
    try {
      await api.put(`/admin/lessons/${params.id}/script`, {
        listeningScript: tempScript,
      });
      toast.success('Сценарий обновлен');
      setIsEditingScript(false);
      fetchLesson();
    } catch {
      toast.error('Ошибка обновления сценария');
    }
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

      {/* Listening Script Section */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            🎙️ Сценарий для Аудио (ИИ)
          </CardTitle>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => {
              setTempScript(lesson.listeningScript || '');
              setIsEditingScript(true);
            }}
          >
            Редактировать
          </Button>
        </CardHeader>
        <CardContent>
          {lesson.listeningScript ? (
            <div className="text-sm font-mono whitespace-pre-wrap bg-background/50 p-4 rounded-lg border">
              {lesson.listeningScript}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground py-4 text-center border-dashed border-2 rounded-lg">
              Сценарий пока не сгенерирован. Загрузите слайды, чтобы ИИ подготовил текст для озвучки.
            </div>
          )}
          <p className="text-[10px] text-muted-foreground mt-2 uppercase tracking-tight">
            Используйте данный текст для записи аудио к заданию типа LISTENING.
          </p>
        </CardContent>
      </Card>

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
                  src={`${(process.env.NODE_ENV === 'production' ? PROD_URL : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'))}${slide.imageUrl}`}
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
                        <Button variant="outline" size="sm" disabled={uploadingSlideId === slide.id}>
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
                        <Button variant="outline" size="sm" disabled={uploadingSlideId === slide.id}>
                          <span>{uploadingSlideId === slide.id ? 'Загрузка...' : 'Загрузить Видео'}</span>
                        </Button>
                      </label>
                      {slide.videoUrl && <Badge variant="secondary" className="text-purple-600 bg-purple-50">Видео прикреплено</Badge>}
                    </div>
                  </div>

                  {/* Teacher Notes (AI Generated) */}
                  {slide.teacherNote && (
                    <div className="p-3 bg-muted/30 rounded-lg border border-border space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase">
                          🤖 ИИ Заметки для учителя
                        </div>
                        <Button 
                          variant="ghost" 
                          size="xs" 
                          className="h-6 px-2 text-xs"
                          onClick={() => {
                            setEditingNote(slide.teacherNote);
                            setNoteQuestions(slide.teacherNote.suggestedQuestions);
                            setNoteAnswers(slide.teacherNote.correctAnswers);
                            setNoteTips(slide.teacherNote.tips || '');
                          }}
                        >
                          Редактировать
                        </Button>
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
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  <Badge>{hw.exerciseType}</Badge>
                  {hw.needsHumanGrading && <Badge variant="secondary">Ручная проверка</Badge>}
                </div>
                <Button 
                  variant="ghost" 
                  size="xs" 
                  onClick={() => {
                    setEditingHomework(hw);
                    setHwQuestionText(hw.questionText);
                    setHwOptions(hw.options || '');
                    setHwCorrectAnswer(hw.correctAnswer || '');
                  }}
                >
                  Редактировать
                </Button>
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
                  <Button variant="outline" size="sm" disabled={uploadingHomeworkId === hw.id}>
                    <span>{uploadingHomeworkId === hw.id ? 'Загрузка...' : 'Загрузить Аудио для ДЗ'}</span>
                  </Button>
                </label>
                {hw.audioUrl && <Badge variant="secondary" className="text-green-600 bg-green-50">Аудио прикреплено</Badge>}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Edit Scenario Dialog */}
      <Dialog open={isEditingScript} onOpenChange={setIsEditingScript}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Редактировать сценарий аудио</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Текст сценария</Label>
              <Textarea 
                value={tempScript} 
                onChange={(e) => setTempScript(e.target.value)}
                className="min-h-[300px] font-mono text-sm"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsEditingScript(false)}>Отмена</Button>
              <Button onClick={handleUpdateScript}>Сохранить сценарий</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Teacher Note Dialog */}
      <Dialog open={!!editingNote} onOpenChange={(open) => !open && setEditingNote(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Редактировать заметки учителя (ИИ)</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Вопросы (JSON или текст)</Label>
              <Textarea 
                value={noteQuestions} 
                onChange={(e) => setNoteQuestions(e.target.value)}
                className="min-h-[100px]"
              />
            </div>
            <div className="space-y-2">
              <Label>Ответы (JSON или текст)</Label>
              <Textarea 
                value={noteAnswers} 
                onChange={(e) => setNoteAnswers(e.target.value)}
                className="min-h-[100px]"
              />
            </div>
            <div className="space-y-2">
              <Label>Советы</Label>
              <Input 
                value={noteTips} 
                onChange={(e) => setNoteTips(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditingNote(null)}>Отмена</Button>
              <Button onClick={handleUpdateNote}>Сохранить</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Homework Dialog */}
      <Dialog open={!!editingHomework} onOpenChange={(open) => !open && setEditingHomework(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Редактировать задание ДЗ</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Текст задания</Label>
              <Textarea 
                value={hwQuestionText} 
                onChange={(e) => setHwQuestionText(e.target.value)}
              />
            </div>
            {editingHomework?.options && (
              <div className="space-y-2">
                <Label>Варианты (JSON массив)</Label>
                <Input 
                  value={hwOptions} 
                  onChange={(e) => setHwOptions(e.target.value)}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label>Правильный ответ</Label>
              <Input 
                value={hwCorrectAnswer} 
                onChange={(e) => setHwCorrectAnswer(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditingHomework(null)}>Отмена</Button>
              <Button onClick={handleUpdateHomework}>Сохранить</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
