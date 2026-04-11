"use client";

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2, Save, Wand2, ArrowLeft, BookOpen, MessageSquare, Image as ImageIcon, Send, Trash2, Plus, RefreshCw, Video, Clapperboard, X } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
export default function AdminLessonEditor() {
  const { t } = useTranslation();
  const { id } = useParams();
  const router = useRouter();
  const [lesson, setLesson] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [savingDocs, setSavingDocs] = useState<Record<string, boolean>>({});
  
  const [isRefining, setIsRefining] = useState(false);
  const [refinementPrompt, setRefinementPrompt] = useState('');
  const [refineDialogOpen, setRefineDialogOpen] = useState(false);

  const fetchLesson = async () => {
    try {
      const res = await api.get(`/admin/lessons/${id}`);
      setLesson(res.data);
    } catch (error) {
      toast.error(t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLesson();
  }, [id]);

  const handleUpdateHomework = async (hwId: string, updates: any) => {
    setSavingDocs(prev => ({ ...prev, [hwId]: true }));
    try {
      if (updates.options && typeof updates.options === 'string') {
        try {
          updates.options = JSON.stringify(updates.options.split('\n').filter(Boolean).map((o: string) => o.trim()));
        } catch { /* ignore */ }
      }
      await api.put(`/admin/homework/${hwId}`, updates);
      toast.success(t('common.saved'));
    } catch (error) {
      toast.error(t('common.error'));
    } finally {
      setSavingDocs(prev => ({ ...prev, [hwId]: false }));
    }
  };

  const handleUpdateNote = async (noteId: string, updates: any) => {
    setSavingDocs(prev => ({ ...prev, [noteId]: true }));
    try {
      // Convert string arrays back to JSON strings for backend
      const formatted = { ...updates };
      if (formatted.suggestedQuestions) formatted.suggestedQuestions = JSON.stringify(formatted.suggestedQuestions.split('\n').filter(Boolean));
      if (formatted.correctAnswers) formatted.correctAnswers = JSON.stringify(formatted.correctAnswers.split('\n').filter(Boolean));

      await api.put(`/admin/teacher-notes/${noteId}`, formatted);
      toast.success(t('common.saved'));
    } catch (error) {
      toast.error(t('common.error'));
    } finally {
      setSavingDocs(prev => ({ ...prev, [noteId]: false }));
    }
  };

  const handleRefine = async () => {
    if (!refinementPrompt.trim()) return;
    setIsRefining(true);
    setRefineDialogOpen(false);
    try {
      await api.post(`/admin/lessons/${id}/refine`, { prompt: refinementPrompt });
      toast.success(t('admin.statusProcessing', 'Обработка запроса... Обновите страницу через минуту.'));
    } catch (error) {
      toast.error(t('common.error'));
    } finally {
      setIsRefining(false);
      setRefinementPrompt('');
    }
  };

  const handleDeleteHomework = async (hwId: string) => {
    if (!confirm(t('admin.deleteLessonWarning'))) return;
    try {
      await api.delete(`/admin/homework/${hwId}`);
      setLesson((prev: any) => ({
        ...prev,
        homework: prev.homework.filter((h: any) => h.id !== hwId)
      }));
      toast.success(t('common.saved'));
    } catch {
      toast.error(t('common.error'));
    }
  };

  const handleDeleteSlide = async (slideId: string) => {
    if (!confirm(t('admin.deleteLessonWarning'))) return;
    try {
      await api.delete(`/admin/slides/${slideId}`);
      toast.success(t('common.saved'));
      fetchLesson(); // Refresh to get new indices
    } catch {
      toast.error(t('common.error'));
    }
  };

  const handleReplaceSlide = async (slideId: string, file: File) => {
    const fd = new FormData();
    fd.append('slide', file);
    try {
      await api.put(`/admin/slides/${slideId}/replace`, fd);
      toast.success(t('common.saved'));
      fetchLesson();
    } catch {
      toast.error(t('common.error'));
    }
  };

  const handleRegenerateNote = async (slideId: string) => {
    setSavingDocs(prev => ({ ...prev, [slideId]: true }));
    try {
      await api.post(`/admin/slides/${slideId}/regenerate-note`);
      toast.success(t('common.saved'));
      fetchLesson();
    } catch {
      toast.error(t('common.error'));
    } finally {
      setSavingDocs(prev => ({ ...prev, [slideId]: false }));
    }
  };

  const handleClearNote = async (slideId: string, noteId: string) => {
    if (!confirm(t('admin.deleteLessonWarning'))) return;
    setSavingDocs(prev => ({ ...prev, [slideId]: true }));
    try {
      await api.put(`/admin/teacher-notes/${noteId}`, {
        suggestedQuestions: JSON.stringify([]),
        correctAnswers: JSON.stringify([]),
        tips: ""
      });
      toast.success(t('common.saved'));
      fetchLesson();
    } catch {
      toast.error(t('common.error'));
    } finally {
      setSavingDocs(prev => ({ ...prev, [slideId]: false }));
    }
  };

  const handleUploadTeaser = async (type: 'teaser' | 'homework', file: File) => {
    const fd = new FormData();
    fd.append('video', file);
    fd.append('type', type);
    try {
      await api.post(`/admin/lessons/${id}/teasers/video`, fd);
      toast.success(t('common.saved'));
      fetchLesson();
    } catch {
      toast.error(t('common.error'));
    }
  };

  const handleUpdateLessonSettings = async (updates: any) => {
    try {
      await api.put(`/admin/lessons/${id}/settings`, updates);
      toast.success(t('common.saved'));
    } catch {
      toast.error(t('common.error'));
    }
  };

  if (loading) return <div className="flex h-screen items-center justify-center bg-background"><Loader2 className="animate-spin w-10 h-10 text-primary" /></div>;
  if (!lesson) return <div className="p-8 text-center">{t('common.error')}</div>;

  return (
    <div className="min-h-screen bg-muted/20">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-card border-b border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.push('/admin')} className="cursor-pointer">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="font-bold text-lg leading-tight">{lesson.title}</h1>
              <div className="text-xs text-muted-foreground uppercase font-bold tracking-widest">{lesson.level} • {t('admin.mediaAndHw')}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Dialog open={refineDialogOpen} onOpenChange={setRefineDialogOpen}>
              <DialogTrigger>
                <Button className="gradient-brand text-white shadow-md hover:shadow-lg transition-all cursor-pointer">
                  {isRefining ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wand2 className="w-4 h-4 mr-2" />}
                  {t('admin.refine', 'Улучшить через ИИ')}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t('admin.refineTitle', 'Уточнить контент ИИ')}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <p className="text-sm text-muted-foreground">{t('admin.refineDesc', 'Опишите, что вы хотите изменить (например: "Сделай упражнение на Grammar сложнее" или "Добавь больше слов про еду")')}</p>
                  <Textarea 
                    value={refinementPrompt}
                    onChange={(e) => setRefinementPrompt(e.target.value)}
                    placeholder={t('admin.refinePlaceholder', 'Ваши инструкции для ИИ...')}
                    className="min-h-[120px]"
                  />
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setRefineDialogOpen(false)}>{t('common.cancel')}</Button>
                  <Button onClick={handleRefine} disabled={isRefining || !refinementPrompt.trim()}>
                    {t('admin.startRefinement', 'Запустить генерацию')}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <Tabs defaultValue="homework" className="space-y-8">
          <div className="flex justify-between items-center border-b border-border pb-1 mb-6">
            <TabsList className="bg-transparent border-none p-0 gap-8">
              <TabsTrigger 
                value="homework" 
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent shadow-none px-0"
              >
                <BookOpen className="w-4 h-4 mr-2" /> {t('nav.homework')}
              </TabsTrigger>
              <TabsTrigger 
                value="notes" 
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent shadow-none px-0"
              >
                <MessageSquare className="w-4 h-4 mr-2" /> {t('admin.teacherNotes', 'Заметки учителя')}
              </TabsTrigger>
              <TabsTrigger 
                value="slides" 
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent shadow-none px-0"
              >
                <ImageIcon className="w-4 h-4 mr-2" /> {t('admin.slides', 'Слайды')}
              </TabsTrigger>
              <TabsTrigger 
                value="teasers" 
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent shadow-none px-0"
              >
                <Clapperboard className="w-4 h-4 mr-2" /> Intro Videos
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="homework" className="mt-0">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                {lesson.homework.map((hw: any) => (
                  <Card key={hw.id} className="relative group overflow-hidden border-border hover:border-primary/50 transition-colors">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 bg-muted/30">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="bg-card font-bold">{hw.exerciseType}</Badge>
                        {savingDocs[hw.id] && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteHomework(hw.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:bg-destructive/10 cursor-pointer">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                      <div className="space-y-2">
                        <Label className="text-xs uppercase font-bold tracking-wider text-muted-foreground">{t('admin.taskText', 'Текст задания')}</Label>
                        <Textarea 
                          defaultValue={hw.questionText} 
                          onBlur={(e) => handleUpdateHomework(hw.id, { questionText: e.target.value })}
                          className="min-h-[80px]"
                        />
                      </div>

                      {hw.options && (
                         <div className="space-y-2">
                            <Label className="text-xs uppercase font-bold tracking-wider text-muted-foreground">{t('admin.options', 'Варианты (каждый с новой строки)')}</Label>
                            <Textarea 
                               defaultValue={JSON.parse(hw.options || '[]').join('\n')}
                               onBlur={(e) => handleUpdateHomework(hw.id, { options: e.target.value })}
                               className="min-h-[100px] font-mono text-sm"
                            />
                         </div>
                      )}

                      {!hw.needsHumanGrading && (
                        <div className="space-y-2">
                          <Label className="text-xs uppercase font-bold tracking-wider text-muted-foreground">{t('admin.correctAnswer', 'Правильный ответ')}</Label>
                          <Input 
                            defaultValue={hw.correctAnswer} 
                            onBlur={(e) => handleUpdateHomework(hw.id, { correctAnswer: e.target.value })}
                          />
                        </div>
                      )}

                      {hw.exerciseType === 'LISTENING' && (
                         <div className="bg-secondary/20 p-4 rounded-xl border border-secondary/50 space-y-4">
                           <div className="flex items-center justify-between">
                             <Label className="font-bold flex items-center gap-2">
                               🔊 {t('admin.listeningAudio', 'Аудио для аудирования')}
                             </Label>
                             {hw.audioUrl && <Badge variant="secondary" className="bg-green-100 text-green-700">{t('admin.uploaded', 'Загружено')}</Badge>}
                           </div>
                           <Input type="file" accept="audio/*" onChange={async (e) => {
                             if (!e.target.files?.[0]) return;
                             const fd = new FormData();
                             fd.append('audio', e.target.files[0]);
                             await api.post(`/admin/homework/${hw.id}/audio`, fd);
                             toast.success(t('admin.audioUploaded', 'Аудио загружено!'));
                             fetchLesson();
                           }} className="bg-card cursor-pointer" />
                         </div>
                      )}
                    </CardContent>
                  </Card>
                ))}

                <Button 
                  variant="outline" 
                  className="w-full h-16 border-dashed border-2 hover:border-primary hover:bg-primary/5 transition-all text-muted-foreground hover:text-primary font-bold cursor-pointer"
                  onClick={async () => {
                    try {
                      await api.post(`/admin/lessons/${id}/homework`, { exerciseType: 'GRAMMAR' });
                      fetchLesson();
                      toast.success(t('common.saved'));
                    } catch {
                      toast.error(t('common.error'));
                    }
                  }}
                >
                  <Plus className="w-5 h-5 mr-2" /> {t('admin.addExercise', 'Добавить задание вручную')}
                </Button>
              </div>
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm uppercase tracking-wider">{t('admin.listeningScript', 'Сценарий для аудио')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Textarea 
                      defaultValue={lesson.listeningScript}
                      onBlur={(e) => api.put(`/admin/lessons/${id}/settings`, { listeningScript: e.target.value })}
                      placeholder={t('admin.scriptPlaceholder', 'Вставьте сценарий или используйте сгенерированный ИИ...')}
                      className="min-h-[250px] text-sm leading-relaxed"
                    />
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="notes" className="mt-0 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {lesson.slides.map((slide: any) => {
                const note = slide.teacherNote;
                if (!note) return null;
                return (
                  <Card key={slide.id} className="group flex flex-col md:flex-row overflow-hidden border-border hover:border-primary/50 transition-all hover:shadow-md">
                    <div className="w-full md:w-48 h-48 md:h-auto relative bg-black shrink-0">
                      <img 
                        src={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}${slide.imageUrl}`} 
                        className="absolute inset-0 w-full h-full object-contain"
                        alt={`Slide ${slide.orderIndex + 1}`}
                      />
                      <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded">
                        {t('admin.slideLabel').toUpperCase()} {slide.orderIndex + 1}
                      </div>
                    </div>
                    <CardContent className="p-6 flex-1 space-y-6 relative">
                       <Button 
                         variant="ghost" 
                         size="icon" 
                         className="absolute top-2 right-2 text-destructive opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10 cursor-pointer"
                         onClick={() => handleClearNote(slide.id, note.id)}
                         title={t('admin.clearNotes')}
                       >
                         <X className="w-4 h-4" />
                       </Button>

                      <div className="space-y-2">
                        <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">{t('admin.suggestedQuestions')}</Label>
                        <Textarea 
                          defaultValue={JSON.parse(note.suggestedQuestions || '[]').join('\n')}
                          onBlur={(e) => handleUpdateNote(note.id, { suggestedQuestions: e.target.value })}
                          className="min-h-[80px] text-sm bg-muted/20 border-border/50 focus:bg-background transition-colors"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">{t('admin.correctAnswers')}</Label>
                        <Textarea 
                          defaultValue={JSON.parse(note.correctAnswers || '[]').join('\n')}
                          onBlur={(e) => handleUpdateNote(note.id, { correctAnswers: e.target.value })}
                          className="min-h-[60px] text-sm bg-muted/20 border-border/50 focus:bg-background transition-colors"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">{t('admin.tips')}</Label>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-7 text-[10px] font-bold gap-1 text-primary hover:text-primary hover:bg-primary/10 transition-colors"
                          onClick={() => handleRegenerateNote(slide.id)}
                          disabled={savingDocs[slide.id]}
                        >
                          {savingDocs[slide.id] ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                          AI REGENERATE
                        </Button>
                      </div>
                       <Textarea 
                        defaultValue={note.tips}
                        onBlur={(e) => handleUpdateNote(note.id, { tips: e.target.value })}
                        className="min-h-[60px] text-sm text-blue-700 italic bg-blue-50/30 border-blue-100/50"
                      />
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="slides" className="mt-0">
             <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                {lesson.slides.map((slide: any) => (
                   <div key={slide.id} className="group relative aspect-video bg-black rounded-2xl overflow-hidden border border-border shadow-md hover:ring-2 ring-primary transition-all duration-300">
                      <img 
                        src={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}${slide.imageUrl}`} 
                        className="w-full h-full object-contain"
                        alt={`Slide ${slide.orderIndex}`}
                      />
                      
                      {/* Premium Overlay for Grid View */}
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-3 transition-opacity duration-300">
                         <div className="flex gap-2">
                            <label className="w-10 h-10 flex items-center justify-center bg-white text-black rounded-full cursor-pointer hover:scale-110 transition-transform shadow-xl" title={t('admin.replaceSlide')}>
                               <RefreshCw className="w-5 h-5" />
                               <input type="file" className="hidden" accept="image/*" onChange={(e) => {
                                 if (e.target.files?.[0]) {
                                   handleReplaceSlide(slide.id, e.target.files[0]);
                                   if (confirm("Regenerate AI notes for this slide?")) {
                                     handleRegenerateNote(slide.id);
                                   }
                                 }
                               }} />
                            </label>
                            <button onClick={() => handleDeleteSlide(slide.id)} className="w-10 h-10 flex items-center justify-center bg-destructive text-white rounded-full hover:scale-110 transition-transform shadow-xl" title={t('common.delete')}>
                               <Trash2 className="w-5 h-5" />
                            </button>
                         </div>
                         <span className="text-white text-[10px] font-bold uppercase tracking-widest">{t('admin.slideLabel')} {slide.orderIndex + 1}</span>
                      </div>

                      <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent text-white text-[11px] items-center justify-between flex">
                        <span className="font-bold opacity-80">#{slide.orderIndex + 1}</span>
                        <div className="flex gap-2">
                           {slide.audioUrl && <Badge variant="secondary" className="h-4 px-1 text-[8px] bg-blue-500 text-white border-0">{t('admin.audioLabel').toUpperCase()}</Badge>}
                           {slide.videoUrl && <Badge variant="secondary" className="h-4 px-1 text-[8px] bg-purple-500 text-white border-0">{t('admin.videoLabel').toUpperCase()}</Badge>}
                        </div>
                      </div>
                   </div>
                ))}

                {/* Optional: Simple add button for extra slides can go here in future */}
             </div>
          </TabsContent>

          <TabsContent value="teasers" className="mt-0 space-y-8">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Lesson Teaser */}
                <Card className="border-border rounded-[2rem] overflow-hidden hover:shadow-lg transition-all">
                   <CardHeader className="bg-muted/30 border-b border-border">
                      <CardTitle className="text-base flex items-center gap-2">
                         <Video className="w-5 h-5 text-primary" /> Lesson Intro Video
                      </CardTitle>
                   </CardHeader>
                   <CardContent className="p-8 space-y-8">
                      <div className="space-y-3">
                         <div className="flex items-center justify-between">
                           <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">{t('admin.videoPrompt')}</Label>
                           <Badge variant="outline" className="text-[9px] font-bold">8 SEC SCENARIO</Badge>
                         </div>
                         <div className="p-5 bg-primary/5 rounded-2xl text-sm italic border border-primary/10 group relative leading-relaxed">
                            {lesson.teaserVideoPrompt || "Generating..."}
                            <button 
                              className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity p-2 bg-white rounded-xl shadow-sm hover:scale-110 active:scale-95" 
                              onClick={() => {
                                navigator.clipboard.writeText(lesson.teaserVideoPrompt);
                                toast.success("Copied to clipboard!");
                              }}
                              title="Copy Scenario"
                            >
                               <ImageIcon className="w-4 h-4 text-primary" />
                            </button>
                         </div>
                      </div>
                      
                      <div className="space-y-4">
                         <Label className="font-bold text-sm">Upload Generated MP4</Label>
                         <Input type="file" accept="video/mp4" onChange={(e) => e.target.files?.[0] && handleUploadTeaser('teaser', e.target.files[0])} className="rounded-xl bg-muted/30 border-dashed border-2 p-2 hover:bg-muted/50 transition-colors" />
                         {lesson.teaserVideoUrl && (
                            <div className="rounded-3xl overflow-hidden shadow-2xl ring-1 ring-border">
                               <video 
                                 src={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}${lesson.teaserVideoUrl}`} 
                                 controls 
                                 className="w-full h-full object-cover max-h-[220px]"
                               />
                            </div>
                         )}
                      </div>

                      <div className="space-y-3 pt-6 border-t border-border">
                         <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">{t('admin.teacherNotes')}</Label>
                         <Textarea 
                            defaultValue={lesson.lessonVideoNotes}
                            onBlur={(e) => handleUpdateLessonSettings({ lessonVideoNotes: e.target.value })}
                            placeholder="e.g. Ask students what they see in the video..."
                            className="min-h-[100px] rounded-2xl bg-muted/20 border-border/50"
                         />
                      </div>
                   </CardContent>
                </Card>

                {/* Homework Teaser */}
                <Card className="border-border rounded-[2rem] overflow-hidden hover:shadow-lg transition-all">
                   <CardHeader className="bg-muted/30 border-b border-border">
                      <CardTitle className="text-base flex items-center gap-2">
                         <BookOpen className="w-5 h-5 text-primary" /> Homework Intro Video
                      </CardTitle>
                   </CardHeader>
                   <CardContent className="p-8 space-y-8">
                      <div className="space-y-3">
                         <div className="flex items-center justify-between">
                           <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">{t('admin.videoPrompt')}</Label>
                           <Badge variant="outline" className="text-[9px] font-bold">8 SEC SCENARIO</Badge>
                         </div>
                         <div className="p-5 bg-primary/5 rounded-2xl text-sm italic border border-primary/10 group relative leading-relaxed">
                            {lesson.homeworkVideoPrompt || "Generating..."}
                            <button 
                              className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity p-2 bg-white rounded-xl shadow-sm hover:scale-110 active:scale-95" 
                              onClick={() => {
                                navigator.clipboard.writeText(lesson.homeworkVideoPrompt);
                                toast.success("Copied to clipboard!");
                              }}
                              title="Copy Scenario"
                            >
                               <ImageIcon className="w-4 h-4 text-primary" />
                            </button>
                         </div>
                      </div>
                      
                      <div className="space-y-4">
                         <Label className="font-bold text-sm">Upload Generated MP4</Label>
                         <Input type="file" accept="video/mp4" onChange={(e) => e.target.files?.[0] && handleUploadTeaser('homework', e.target.files[0])} className="rounded-xl bg-muted/30 border-dashed border-2 p-2 hover:bg-muted/50 transition-colors" />
                         {lesson.homeworkVideoUrl && (
                             <div className="rounded-3xl overflow-hidden shadow-2xl ring-1 ring-border">
                               <video 
                                 src={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}${lesson.homeworkVideoUrl}`} 
                                 controls 
                                 className="w-full h-full object-cover max-h-[220px]"
                               />
                            </div>
                         )}
                      </div>

                      <div className="space-y-6 pt-6 border-t border-border">
                         <div className="space-y-3">
                            <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">{t('admin.videoQuestion')}</Label>
                            <Input 
                               defaultValue={lesson.homeworkVideoQuestion}
                               onBlur={(e) => handleUpdateLessonSettings({ homeworkVideoQuestion: e.target.value })}
                               placeholder="e.g. What color was the car?"
                               className="rounded-xl bg-muted/20"
                            />
                         </div>
                         <div className="space-y-3">
                            <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">{t('admin.options')}</Label>
                            <Textarea 
                               defaultValue={lesson.homeworkVideoOptions ? JSON.parse(lesson.homeworkVideoOptions).join('\n') : ''}
                               onBlur={(e) => {
                                  const options = JSON.stringify(e.target.value.split('\n').filter(Boolean));
                                  handleUpdateLessonSettings({ homeworkVideoOptions: options });
                               }}
                               placeholder="Red\nBlue\nGreen"
                               className="min-h-[100px] font-mono text-sm rounded-2xl bg-muted/20"
                            />
                         </div>
                         <div className="space-y-3">
                            <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">{t('admin.correctAnswer')}</Label>
                            <Input 
                               defaultValue={lesson.homeworkVideoAnswer}
                               onBlur={(e) => handleUpdateLessonSettings({ homeworkVideoAnswer: e.target.value })}
                               placeholder="Blue"
                               className="rounded-xl bg-muted/20"
                            />
                         </div>
                      </div>
                   </CardContent>
                </Card>
             </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}