'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import '@/lib/i18n';
import api from '@/lib/api';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';

interface Student {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  _count: { homeworkAssignments: number };
}

interface CourseWithLessons {
  id: string;
  title: string;
  lessons: {
    id: string;
    title: string;
    orderIndex: number;
    _count: { slides: number; homework: number };
  }[];
}

export default function TeacherDashboard() {
  const { t } = useTranslation();
  const router = useRouter();
  const [library, setLibrary] = useState<CourseWithLessons[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [isAddingStudent, setIsAddingStudent] = useState(false);
  const [studentName, setStudentName] = useState('');
  const [studentEmail, setStudentEmail] = useState('');
  const [studentPassword, setStudentPassword] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const [libRes, stuRes] = await Promise.all([
        api.get('/teacher/library'),
        api.get('/teacher/students'),
      ]);
      setLibrary(libRes.data);
      setStudents(stuRes.data);
    } catch {
      toast.error('Ошибка загрузки данных');
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAddStudent = async () => {
    if (!studentName || !studentEmail || !studentPassword) return;
    try {
      await api.post('/teacher/students', {
        name: studentName,
        email: studentEmail,
        password: studentPassword,
      });
      setStudentName('');
      setStudentEmail('');
      setStudentPassword('');
      setIsAddingStudent(false);
      fetchData();
      toast.success('Ученик добавлен');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Ошибка');
    }
  };

  const handleStartClass = async (lessonId: string) => {
    try {
      const res = await api.post('/teacher/classroom/start', { lessonId });
      router.push(`/classroom?session=${res.data.id}&role=teacher`);
    } catch {
      toast.error('Ошибка запуска урока');
    }
  };

  const handleAssignHomework = async (lessonId: string) => {
    if (students.length === 0) {
      toast.error('Сначала добавьте учеников');
      return;
    }
    try {
      await api.post('/teacher/assign-homework', {
        lessonId,
        studentIds: students.map((s) => s.id),
      });
      toast.success('Домашнее задание назначено всем ученикам');
    } catch {
      toast.error('Ошибка назначения');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">{t('teacher.title')}</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Ваши уроки, ученики и начало занятий
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Students panel */}
        <Card className="lg:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">{t('teacher.myStudents')}</CardTitle>
            <Dialog open={isAddingStudent} onOpenChange={setIsAddingStudent}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="cursor-pointer" id="add-student-btn">
                  + {t('teacher.addStudent')}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t('teacher.addStudent')}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label>{t('auth.name')}</Label>
                    <Input value={studentName} onChange={(e) => setStudentName(e.target.value)} placeholder="Иван Иванов" />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('auth.email')}</Label>
                    <Input value={studentEmail} onChange={(e) => setStudentEmail(e.target.value)} placeholder="student@email.com" />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('auth.password')}</Label>
                    <Input value={studentPassword} onChange={(e) => setStudentPassword(e.target.value)} placeholder="Пароль для ученика" type="password" />
                  </div>
                  <Button onClick={handleAddStudent} className="w-full cursor-pointer">
                    {t('common.create')}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <Separator />
          <CardContent className="pt-3">
            {students.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                {t('teacher.noStudents')}
              </p>
            ) : (
              <div className="space-y-2">
                {students.map((student) => (
                  <div
                    key={student.id}
                    className="flex items-center justify-between px-3 py-2 rounded-lg bg-accent/30 hover:bg-accent/50 transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium">{student.name}</p>
                      <p className="text-xs text-muted-foreground">{student.email}</p>
                    </div>
                    <Badge variant="outline">{student._count.homeworkAssignments} дз</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Lesson Library */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            📖 {t('nav.library')}
          </h2>

          {library.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <span className="text-4xl mb-3">📚</span>
                <p>Библиотека пуста. Попросите администратора добавить уроки.</p>
              </CardContent>
            </Card>
          ) : (
            library.map((course) => (
              <Card key={course.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{course.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  {course.lessons.map((lesson) => (
                    <div
                      key={lesson.id}
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-accent/30 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-lg">📄</span>
                        <div>
                          <p className="text-sm font-medium">{lesson.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {lesson._count.slides} слайдов · {lesson._count.homework} заданий
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="gradient-brand text-white shadow-sm cursor-pointer"
                          onClick={() => handleStartClass(lesson.id)}
                          id={`start-class-${lesson.id}`}
                        >
                          ▶ {t('teacher.startClass')}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="cursor-pointer"
                          onClick={() => handleAssignHomework(lesson.id)}
                        >
                          📝 {t('teacher.assignHomework')}
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
