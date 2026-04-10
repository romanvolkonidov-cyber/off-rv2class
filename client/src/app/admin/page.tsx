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
  lessons: {
    id: string;
    title: string;
    published: boolean;
    aiStatus: string;
    orderIndex: number;
  }[];
  orderIndex: number;
}

export default function AdminDashboard() {
  const { t } = useTranslation();
  const [courses, setCourses] = useState<Course[]>([]);
  const [newCourseTitle, setNewCourseTitle] = useState('');
  const [newCourseDesc, setNewCourseDesc] = useState('');
  const [newLessonTitle, setNewLessonTitle] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [uploadingLessonId, setUploadingLessonId] = useState<string | null>(null);
  const [isCreatingCourse, setIsCreatingCourse] = useState(false);
  const [newCourseOrder, setNewCourseOrder] = useState(0);
  const [newLessonOrder, setNewLessonOrder] = useState(0);

  const fetchCourses = useCallback(async () => {
    try {
      const res = await api.get('/admin/courses');
      setCourses(res.data);
    } catch {
      toast.error('Ошибка загрузки курсов');
    }
  }, []);

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
      });
      setNewCourseTitle('');
      setNewCourseDesc('');
      setNewCourseOrder(0);
      setIsCreatingCourse(false);
      fetchCourses();
      toast.success('Курс создан');
    } catch {
      toast.error('Ошибка создания курса');
    }
  };

  const handleCreateLesson = async (courseId: string) => {
    if (!newLessonTitle.trim()) return;
    try {
      await api.post(`/admin/courses/${courseId}/lessons`, {
        title: newLessonTitle,
        orderIndex: Number(newLessonOrder),
      });
      setNewLessonTitle('');
      setNewLessonOrder(0);
      setSelectedCourseId(null);
      fetchCourses();
      toast.success('Урок создан');
    } catch {
      toast.error('Ошибка создания урока');
    }
  };

  const handleUploadSlides = async (lessonId: string, files: FileList) => {
    setUploadingLessonId(lessonId);
    const formData = new FormData();
    Array.from(files).forEach((file) => formData.append('slides', file));

    try {
      await api.post(`/admin/lessons/${lessonId}/slides`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000,
      });
      toast.success('Слайды загружены. ИИ генерирует материалы...');
      fetchCourses();
    } catch {
      toast.error('Ошибка загрузки слайдов');
    } finally {
      setUploadingLessonId(null);
    }
  };

  const handleTogglePublish = async (lessonId: string, currentState: boolean) => {
    try {
      await api.put(`/admin/lessons/${lessonId}/publish`, {
        published: !currentState,
      });
      fetchCourses();
      toast.success(!currentState ? 'Урок опубликован' : 'Урок снят с публикации');
    } catch {
      toast.error('Ошибка');
    }
  };

  const handleDeleteCourse = async (courseId: string) => {
    if (!confirm('Удалить курс и все его уроки?')) return;
    try {
      await api.delete(`/admin/courses/${courseId}`);
      fetchCourses();
      toast.success('Курс удалён');
    } catch {
      toast.error('Ошибка удаления');
    }
  };

  const fileInputRef = useState<HTMLInputElement | null>(null);
  const [currentLessonId, setCurrentLessonId] = useState<string | null>(null);

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      pending: { label: 'Ожидает', variant: 'outline' },
      processing: { label: 'ИИ обрабатывает...', variant: 'secondary' },
      completed: { label: 'Готов', variant: 'default' },
      failed: { label: 'Ошибка', variant: 'destructive' },
    };
    const cfg = variants[status] || variants.pending;
    return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
  };

  const triggerFileUpload = (lessonId: string) => {
    console.log('🔘 Upload button clicked for lesson:', lessonId);
    setCurrentLessonId(lessonId);
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
            handleUploadSlides(currentLessonId, e.target.files);
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
            Управление курсами, уроками и учебными материалами
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
                  placeholder="Английский для начинающих"
                  id="course-title-input"
                />
              </div>
              <div className="space-y-2">
                <Label>{t('admin.courseDescription')}</Label>
                <Input
                  value={newCourseDesc}
                  onChange={(e) => setNewCourseDesc(e.target.value)}
                  placeholder="Описание курса..."
                  id="course-desc-input"
                />
              </div>
              <div className="space-y-2">
                <Label>Порядок (например: 1, 2, 3...)</Label>
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
            <p className="text-lg font-medium">Курсов пока нет</p>
            <p className="text-sm">Создайте первый курс, чтобы начать</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {courses.map((course) => (
            <Card key={course.id} className="overflow-hidden" id={`course-${course.id}`}>
              <CardHeader className="flex flex-row items-center justify-between bg-accent/30">
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
                            placeholder="Present Simple — Введение"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Порядок (например: 001, 002...)</Label>
                          <Input
                            type="number"
                            value={newLessonOrder}
                            onChange={(e) => setNewLessonOrder(Number(e.target.value))}
                            placeholder="1"
                          />
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
                    В этом курсе пока нет уроков
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
                              {getStatusBadge(lesson.aiStatus)}
                              {lesson.published && (
                                <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
                                  Опубликован
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {/* Upload slides */}
                          <Button 
                            variant="outline" 
                            size="sm" 
                            disabled={uploadingLessonId === lesson.id}
                            onClick={() => triggerFileUpload(lesson.id)}
                            className="cursor-pointer"
                          >
                            <span>
                              {uploadingLessonId === lesson.id ? '⏳ Загрузка...' : `📤 ${t('admin.uploadSlides')}`}
                            </span>
                          </Button>

                          <Button
                            variant="secondary"
                            size="sm"
                            className="cursor-pointer"
                            onClick={() => window.location.href = `/admin/lessons/${lesson.id}`}
                            disabled={lesson.aiStatus !== 'completed'}
                          >
                            ✏️ Медиа и ДЗ
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
    </div>
  );
}
