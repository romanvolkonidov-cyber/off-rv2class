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
import { toast } from 'sonner';

interface Course {
  id: string;
  title: string;
  description: string | null;
  color: string | null;
  lessons: {
    id: string;
    title: string;
    published: boolean;
    aiStatus: string;
    aiError: string | null;
    level: string;
    orderIndex: number;
  }[];
  orderIndex: number;
}

export default function AdminDashboard() {
  const { t } = useTranslation();
  const [courses, setCourses] = useState<Course[]>([]);
  const [newCourseTitle, setNewCourseTitle] = useState('');
  const [newCourseDesc, setNewCourseDesc] = useState('');
  const [newCourseColor, setNewCourseColor] = useState('#3b82f6');
  const [newLessonTitle, setNewLessonTitle] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [uploadingLessonId, setUploadingLessonId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isCreatingCourse, setIsCreatingCourse] = useState(false);
  const [newCourseOrder, setNewCourseOrder] = useState(0);
  const [newLessonOrder, setNewLessonOrder] = useState(0);
  const [newLessonLevel, setNewLessonLevel] = useState('B1');

  // Edit states
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [editingLesson, setEditingLesson] = useState<{ id: string; title: string, level: string, orderIndex: number } | null>(null);
  const [isEditingCourseDialog, setIsEditingCourseDialog] = useState(false);
  const [isEditingLessonDialog, setIsEditingLessonDialog] = useState(false);

  const fetchCourses = useCallback(async () => {
    try {
      const res = await api.get('/admin/courses');
      setCourses(res.data);
    } catch {
      toast.error(t('admin.errorLoadCourses', 'Ошибка загрузки курсов'));
    }
  }, [t]);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  // Polling for processing lessons
  useEffect(() => {
    const hasProcessing = courses.some(c => c.lessons.some(l => l.aiStatus === 'processing'));
    if (hasProcessing) {
      const interval = setInterval(fetchCourses, 5000);
      return () => clearInterval(interval);
    }
  }, [courses, fetchCourses]);

  const handleCreateCourse = async () => {
    if (!newCourseTitle.trim()) return;
    try {
      await api.post('/admin/courses', {
        title: newCourseTitle,
        description: newCourseDesc || null,
        orderIndex: Number(newCourseOrder),
        color: newCourseColor,
      });
      setNewCourseTitle('');
      setNewCourseDesc('');
      setNewCourseOrder(0);
      setNewCourseColor('#3b82f6');
      setIsCreatingCourse(false);
      fetchCourses();
      toast.success(t('admin.courseCreated', 'Курс создан'));
    } catch {
      toast.error(t('admin.courseCreateError', 'Ошибка создания курса'));
    }
  };

  const handleCreateLesson = async (courseId: string) => {
    if (!newLessonTitle.trim()) return;
    try {
      await api.post(`/admin/courses/${courseId}/lessons`, {
        title: newLessonTitle,
        level: newLessonLevel,
        orderIndex: Number(newLessonOrder),
      });
      setNewLessonTitle('');
      setNewLessonOrder(0);
      setNewLessonLevel('B1');
      setSelectedCourseId(null);
      fetchCourses();
      toast.success(t('admin.lessonCreated', 'Урок создан'));
    } catch {
      toast.error(t('admin.lessonCreateError', 'Ошибка создания урока'));
    }
  };

  const handleUpdateCourse = async () => {
    if (!editingCourse || !editingCourse.title.trim()) return;
    try {
      await api.put(`/admin/courses/${editingCourse.id}`, {
        title: editingCourse.title,
        description: editingCourse.description,
        color: editingCourse.color,
        orderIndex: Number(editingCourse.orderIndex),
      });
      setIsEditingCourseDialog(false);
      setEditingCourse(null);
      fetchCourses();
      toast.success(t('common.saved', 'Сохранено'));
    } catch {
      toast.error(t('common.error', 'Ошибка'));
    }
  };

  const handleUpdateLesson = async () => {
    if (!editingLesson || !editingLesson.title.trim()) return;
    try {
      await api.put(`/admin/lessons/${editingLesson.id}`, {
        title: editingLesson.title,
        level: editingLesson.level,
        orderIndex: Number(editingLesson.orderIndex),
      });
      setIsEditingLessonDialog(false);
      setEditingLesson(null);
      fetchCourses();
      toast.success(t('common.saved', 'Сохранено'));
    } catch {
      toast.error(t('common.error', 'Ошибка'));
    }
  };

  const handleDeleteLesson = async (lessonId: string) => {
    if (!confirm(t('admin.deleteLessonConfirm', 'Удалить этот урок?'))) return;
    try {
      await api.delete(`/admin/lessons/${lessonId}`);
      fetchCourses();
      toast.success(t('common.deleted', 'Удалено'));
    } catch {
      toast.error(t('admin.deleteError', 'Ошибка удаления'));
    }
  };

  const handleUploadSlides = async (lessonId: string, files: FileList, level: string) => {
    setUploadingLessonId(lessonId);
    setUploadProgress(0);
    const formData = new FormData();
    Array.from(files).forEach((file) => formData.append('slides', file));
    formData.append('level', level);

    try {
      await api.post(`/admin/lessons/${lessonId}/slides`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000,
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(percentCompleted);
          }
        }
      });
      toast.success(t('admin.slidesUploaded', 'Слайды загружены. ИИ генерирует материалы...'));
      fetchCourses();
    } catch {
      toast.error(t('admin.slidesUploadError', 'Ошибка загрузки слайдов'));
    } finally {
      setUploadingLessonId(null);
      setUploadProgress(0);
    }
  };

  const handleTogglePublish = async (lessonId: string, currentState: boolean) => {
    try {
      await api.put(`/admin/lessons/${lessonId}/publish`, {
        published: !currentState,
      });
      fetchCourses();
      toast.success(!currentState ? t('admin.lessonPublished', 'Урок опубликован') : t('admin.lessonUnpublished', 'Урок снят с публикации'));
    } catch {
      toast.error(t('common.error', 'Ошибка'));
    }
  };

  const handleDeleteCourse = async (courseId: string) => {
    if (!confirm(t('admin.deleteCourseConfirm', 'Удалить курс и все его уроки?'))) return;
    try {
      await api.delete(`/admin/courses/${courseId}`);
      fetchCourses();
      toast.success(t('admin.courseDeleted', 'Курс удалён'));
    } catch {
      toast.error(t('admin.deleteError', 'Ошибка удаления'));
    }
  };

  const fileInputRef = useState<HTMLInputElement | null>(null);
  const [currentLessonId, setCurrentLessonId] = useState<string | null>(null);
  const [currentLessonLevel, setCurrentLessonLevel] = useState<string>('B1');

  const getStatusBadge = (lesson: any) => {
    const status = lesson.aiStatus;
    const variants: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      pending: { label: t('admin.statusPending', 'Ожидает'), variant: 'outline' },
      processing: { label: t('admin.statusProcessing', 'ИИ обрабатывает...'), variant: 'secondary' },
      completed: { label: t('admin.statusCompleted', 'Готов'), variant: 'default' },
      failed: { label: t('admin.statusFailed', 'Ошибка'), variant: 'destructive' },
    };
    const cfg = variants[status] || variants.pending;
    return (
      <div className="flex items-center gap-2">
        <Badge variant={cfg.variant} title={status === 'failed' ? lesson.aiError : undefined}>
          {cfg.label}
        </Badge>
        {status === 'failed' && lesson.aiError && (
          <span className="text-[10px] text-destructive max-w-[150px] truncate" title={lesson.aiError}>
            {lesson.aiError}
          </span>
        )}
      </div>
    );
  };

  const triggerFileUpload = (lessonId: string, level: string) => {
    console.log('🔘 Upload button clicked for lesson:', lessonId);
    setCurrentLessonId(lessonId);
    setCurrentLessonLevel(level || 'B1');
    const input = document.getElementById('global-slide-upload') as HTMLInputElement;
    if (input) {
      input.click();
    }
  };

  return (
    <div className="space-y-6">
      {/* Hidden Global Input */}
      <input
        id="global-slide-upload"
        type="file"
        multiple
        accept="image/png,image/jpeg"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && currentLessonId) {
            console.log('📁 Files selected:', e.target.files.length);
            handleUploadSlides(currentLessonId, e.target.files, currentLessonLevel);
            // Reset input so the same file can be picked again if needed
            e.target.value = '';
          }
        }}
      />
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('admin.title')}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {t('admin.subtitle', 'Управление курсами, уроками и учебными материалами')}
          </p>
        </div>

        <Dialog open={isCreatingCourse} onOpenChange={setIsCreatingCourse}>
          <DialogTrigger render={
            <Button className="gradient-brand text-white shadow-md shadow-primary/20 cursor-pointer" id="create-course-btn">
              + {t('admin.createCourse')}
            </Button>
          } />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('admin.createCourse')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>{t('admin.courseName')}</Label>
                <Input
                  value={newCourseTitle}
                  onChange={(e) => setNewCourseTitle(e.target.value)}
                  placeholder={t('admin.coursePlaceholder', 'Английский для начинающих')}
                  id="course-title-input"
                />
              </div>
              <div className="space-y-2">
                <Label>{t('admin.courseDescription')}</Label>
                <Input
                  value={newCourseDesc}
                  onChange={(e) => setNewCourseDesc(e.target.value)}
                  placeholder={t('admin.descPlaceholder', 'Описание курса...')}
                  id="course-desc-input"
                />
              </div>
              <div className="space-y-2">
                <Label>{t('admin.courseColor', 'Цвет карточки курса')}</Label>
                 <div className="flex items-center gap-3">
                   {['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#64748b'].map(c => (
                     <button key={c} type="button" onClick={() => setNewCourseColor(c)} className={`w-8 h-8 rounded-full border-2 transition-all ${newCourseColor === c ? 'border-foreground scale-110 shadow-sm' : 'border-transparent opacity-70 hover:opacity-100'}`} style={{ backgroundColor: c }} title={c} />
                   ))}
                   <div className="h-8 w-[1px] bg-border mx-1" />
                   <div className="relative flex items-center gap-2 bg-secondary/50 px-2 py-1 rounded-lg border border-border">
                     <span className="text-[10px] font-mono text-muted-foreground">{newCourseColor.toUpperCase()}</span>
                     <input 
                       type="color" 
                       value={newCourseColor} 
                       onChange={(e) => setNewCourseColor(e.target.value)}
                       className="w-6 h-6 rounded border-none cursor-pointer bg-transparent"
                     />
                   </div>
                 </div>
              </div>
              <div className="space-y-2">
                <Label>{t('admin.courseOrder', 'Порядок (например: 1, 2, 3...)')}</Label>
                <Input
                  type="number"
                  value={newCourseOrder}
                  onChange={(e) => setNewCourseOrder(Number(e.target.value))}
                />
              </div>
              <Button onClick={handleCreateCourse} className="w-full cursor-pointer" id="submit-course-btn">
                {t('common.create')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Separator />

      {/* Courses Grid */}
      {courses.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <span className="text-4xl mb-3">📚</span>
            <p className="text-lg font-medium">{t('admin.noCourses', 'Курсов пока нет')}</p>
            <p className="text-sm">{t('admin.createFirstCourse', 'Создайте первый курс, чтобы начать')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {courses.map((course) => (
            <Card key={course.id} className="overflow-hidden" id={`course-${course.id}`}>
              <CardHeader className="flex flex-row items-center justify-between transition-colors" style={{ backgroundColor: course.color ? `${course.color}20` : 'hsl(var(--accent)/0.3)' }}>
                <div>
                  <CardTitle className="text-lg">{course.title}</CardTitle>
                  {course.description && (
                    <p className="text-sm text-muted-foreground mt-1">{course.description}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Dialog>
                    <DialogTrigger render={
                      <Button
                        variant="outline"
                        size="sm"
                        className="cursor-pointer"
                        onClick={() => setSelectedCourseId(course.id)}
                      >
                        + {t('admin.createLesson')}
                      </Button>
                    } />
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>{t('admin.createLesson')}</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 pt-2">
                        <div className="space-y-2">
                          <Label>{t('admin.lessonName')}</Label>
                          <Input
                            value={newLessonTitle}
                            onChange={(e) => setNewLessonTitle(e.target.value)}
                            placeholder={t('admin.lessonPlaceholder', 'Present Simple — Введение')}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>{t('admin.lessonOrder', 'Порядок (например: 001, 002...)')}</Label>
                          <Input
                            type="number"
                            value={newLessonOrder}
                            onChange={(e) => setNewLessonOrder(Number(e.target.value))}
                            placeholder="1"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>{t('teacher.level', 'Уровень (CEFR)')}</Label>
                          <select
                            className="w-full border border-border rounded-lg p-2 bg-card text-foreground"
                            value={newLessonLevel}
                            onChange={(e) => setNewLessonLevel(e.target.value)}
                          >
                            {['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map(lvl => (
                              <option key={lvl} value={lvl}>{lvl}</option>
                            ))}
                          </select>
                        </div>
                        <Button
                          onClick={() => handleCreateLesson(course.id)}
                          className="w-full cursor-pointer"
                        >
                          {t('common.create')}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>

                  {/* Edit Course Dialog */}
                  <Dialog open={isEditingCourseDialog} onOpenChange={setIsEditingCourseDialog}>
                    <DialogTrigger render={
                      <Button variant="ghost" size="sm" onClick={() => setEditingCourse(course)} className="cursor-pointer">
                        ✏️
                      </Button>
                    } />
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>{t('admin.editCourse', 'Редактировать курс')}</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 pt-2">
                        <div className="space-y-2">
                          <Label>{t('admin.courseName')}</Label>
                          <Input
                            value={editingCourse?.title || ''}
                            onChange={(e) => setEditingCourse(prev => prev ? { ...prev, title: e.target.value } : null)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>{t('admin.courseDescription')}</Label>
                          <Input
                            value={editingCourse?.description || ''}
                            onChange={(e) => setEditingCourse(prev => prev ? { ...prev, description: e.target.value } : null)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>{t('admin.courseColor')}</Label>
                          <div className="flex items-center gap-3">
                            {['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#64748b'].map(c => (
                              <button key={c} type="button" onClick={() => setEditingCourse(prev => prev ? { ...prev, color: c } : null)} className={`w-8 h-8 rounded-full border-2 transition-all ${editingCourse?.color === c ? 'border-foreground scale-110 shadow-sm' : 'border-transparent opacity-70 hover:opacity-100'}`} style={{ backgroundColor: c }} />
                            ))}
                            <input type="color" value={editingCourse?.color || '#3b82f6'} onChange={(e) => setEditingCourse(prev => prev ? { ...prev, color: e.target.value } : null)} className="w-6 h-6 rounded cursor-pointer" />
                          </div>
                        </div>
                        <Button onClick={handleUpdateCourse} className="w-full cursor-pointer">{t('common.save')}</Button>
                      </div>
                    </DialogContent>
                  </Dialog>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive cursor-pointer"
                    onClick={() => handleDeleteCourse(course.id)}
                  >
                    {t('common.delete')}
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                {course.lessons.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground text-sm">
                    {t('admin.noLessonsInCourse', 'В этом курсе пока нет уроков')}
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {course.lessons.map((lesson) => (
                      <div
                        key={lesson.id}
                        className="flex items-center justify-between px-6 py-3 hover:bg-accent/20 transition-colors"
                        id={`lesson-${lesson.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-lg">📄</span>
                          <div>
                             <p className="font-medium text-sm">{lesson.title}</p>
                             <div className="flex items-center gap-2 mt-0.5">
                               {getStatusBadge(lesson)}
                               <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-bold border border-primary/20">
                                 {lesson.level || 'B1'}
                               </span>
                               {lesson.published && (
                                <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50 px-1.5 py-0">
                                  {t('admin.published', 'Опубликован')}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="sm" onClick={() => {
                            setEditingLesson({ id: lesson.id, title: lesson.title, level: lesson.level || 'B1', orderIndex: lesson.orderIndex });
                            setIsEditingLessonDialog(true);
                          }} className="cursor-pointer">✏️</Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteLesson(lesson.id)} className="text-destructive cursor-pointer">🗑️</Button>
                          <div className="w-[1px] h-4 bg-border mx-1" />
                          {/* Upload slides */}
                          <div className="flex flex-col gap-1 items-end">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              disabled={uploadingLessonId === lesson.id}
                              onClick={() => triggerFileUpload(lesson.id, lesson.level)}
                              className="cursor-pointer min-w-[140px]"
                            >
                              <span>
                                {uploadingLessonId === lesson.id 
                                  ? uploadProgress < 100 
                                      ? `📤 ${uploadProgress}%...` 
                                      : t('admin.uploading', '⏳ ИИ...') 
                                  : `📤 ${t('admin.uploadSlides')}`}
                              </span>
                            </Button>
                            {uploadingLessonId === lesson.id && uploadProgress < 100 && (
                              <div className="w-full h-1 bg-secondary rounded-full overflow-hidden mt-1 max-w-[140px]">
                                <div className="h-full bg-primary transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                              </div>
                            )}
                          </div>

                          <Button
                            variant="secondary"
                            size="sm"
                            className="cursor-pointer"
                            onClick={() => window.location.href = `/admin/lessons/${lesson.id}`}
                            disabled={lesson.aiStatus !== 'completed'}
                          >
                            ✏️ {t('admin.mediaAndHw', 'Медиа и ДЗ')}
                          </Button>

                          {/* Publish toggle */}
                          <Button
                            variant="outline"
                            size="sm"
                            className="cursor-pointer"
                            onClick={() => handleTogglePublish(lesson.id, lesson.published)}
                            disabled={lesson.aiStatus !== 'completed'}
                          >
                            {lesson.published ? t('admin.unpublish') : t('admin.publish')}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {/* Edit Lesson Dialog */}
      <Dialog open={isEditingLessonDialog} onOpenChange={setIsEditingLessonDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin.editLesson', 'Редактировать урок')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>{t('admin.lessonName')}</Label>
              <Input
                value={editingLesson?.title || ''}
                onChange={(e) => setEditingLesson(prev => prev ? { ...prev, title: e.target.value } : null)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('teacher.level', 'Уровень (CEFR)')}</Label>
              <select
                className="w-full border border-border rounded-lg p-2 bg-card text-foreground"
                value={editingLesson?.level || 'B1'}
                onChange={(e) => setEditingLesson(prev => prev ? { ...prev, level: e.target.value } : null)}
              >
                {['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map(lvl => (
                  <option key={lvl} value={lvl}>{lvl}</option>
                ))}
              </select>
            </div>
            <Button onClick={handleUpdateLesson} className="w-full cursor-pointer">{t('common.save')}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
