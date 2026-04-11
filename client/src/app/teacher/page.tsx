"use client";

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Play, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useRouter } from 'next/navigation';

interface Lesson {
  id: string;
  title: string;
  orderIndex: number;
  _count: { slides: number; homework: number };
}

interface Course {
  id: string;
  title: string;
  description: string | null;
  color: string | null;
  lessons: Lesson[];
}

interface Student {
  id: string;
  name: string;
  email: string;
}

export default function LibraryPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCourse, setExpandedCourse] = useState<string | null>(null);
  const [lessonToStart, setLessonToStart] = useState<Lesson | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');

  useEffect(() => {
    const fetchLibrary = async () => {
      try {
        const [coursesRes, studentsRes] = await Promise.all([
          api.get('/teacher/library'),
          api.get('/teacher/students'),
        ]);
        setCourses(coursesRes.data);
        setStudents(studentsRes.data);
      } catch (error) {
        console.error("Failed to load library", error);
        toast.error(t('teacher.libraryLoadError', 'Ошибка загрузки библиотеки уроков'));
      } finally {
        setLoading(false);
      }
    };

    fetchLibrary();
  }, []);

  const handleStartSession = async () => {
    if (!lessonToStart) return;
    try {
      const res = await api.post('/teacher/classroom/start', {
        lessonId: lessonToStart.id,
        studentId: selectedStudentId || undefined,
      });
      router.push(`/classroom?session=${res.data.id}&role=teacher`);
    } catch (err) {
      toast.error('Ошибка запуска урока');
    }
  };

  if (loading) {
    return <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin w-8 h-8 text-primary" /></div>;
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-foreground">{t('navigation.library')}</h1>
        <p className="text-muted-foreground mt-2">{t('teacher.selectLesson')}</p>
      </div>
      
      {courses.map((course) => (
        <div key={course.id} className="border border-border rounded-xl mb-4 overflow-hidden shadow-sm bg-card">
          <div
            className="p-6 cursor-pointer flex justify-between items-center transition-colors hover:opacity-90"
            style={{ 
              backgroundColor: course.color ? `${course.color}15` : 'hsl(var(--accent)/0.1)', 
              borderLeft: `8px solid ${course.color || 'hsl(var(--primary))'}` 
            }}
            onClick={() => setExpandedCourse(expandedCourse === course.id ? null : course.id)}
          >
            <div>
              <h2 className="text-xl font-bold text-foreground">{course.title}</h2>
              {course.description && <p className="text-muted-foreground mt-1">{course.description}</p>}
            </div>
            <div className="text-2xl text-muted-foreground opacity-50 transition-transform">
              {expandedCourse === course.id ? '▴' : '▾'}
            </div>
          </div>

          {expandedCourse === course.id && (
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 bg-card">
              {course.lessons.map((lesson) => (
                <div key={lesson.id} className="border border-border rounded-xl p-5 flex flex-col justify-between hover:border-primary/50 transition-colors shadow-sm">
                  <div>
                    <h3 className="font-semibold text-lg line-clamp-2 mb-2 text-foreground">{lesson.title}</h3>
                    <div className="text-sm text-muted-foreground mb-6 space-y-1">
                      <p>{t('teacher.slides')}: {lesson._count.slides}</p>
                      <p>{t('teacher.assignments')}: {lesson._count.homework}</p>
                    </div>
                  </div>
                  <Button 
                    className="w-full bg-primary text-primary-foreground shadow-md hover:bg-primary/90 transition-all cursor-pointer" 
                    onClick={() => setLessonToStart(lesson)}
                  >
                    <Play className="w-4 h-4 mr-2" /> {t('teacher.start')}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      <Dialog open={!!lessonToStart} onOpenChange={(open) => !open && setLessonToStart(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-xl">{t('teacher.startLesson', 'Начать урок')}: {lessonToStart?.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 pt-4">
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-foreground">{t('teacher.inviteStudent', 'Пригласить ученика на урок')}</h4>
              <select
                className="w-full border border-border rounded-md p-2.5 bg-background text-foreground focus:ring-2 focus:ring-primary outline-none"
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
              >
                <option value="">-- Только просмотр (без ученика) --</option>
                {students.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.email})</option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">Если вы выберете ученика, он сможет подключиться к уроку из своего кабинета.</p>
            </div>
            <Button
              className="w-full bg-primary text-primary-foreground cursor-pointer shadow-md py-6 text-lg"
              onClick={handleStartSession}
            >
              🚀 Запустить класс
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}