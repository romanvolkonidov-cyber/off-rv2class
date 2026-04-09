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

interface SessionHistory {
  id: string;
  createdAt: string;
  lesson: { id: string; title: string };
  students: { id: string; name: string; email: string }[];
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
  const [history, setHistory] = useState<SessionHistory[]>([]);
  const [activeTab, setActiveTab] = useState<'library' | 'history'>('library');

  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [isStartingClass, setIsStartingClass] = useState(false);
  const [startLessonId, setStartLessonId] = useState<string | null>(null);
  const [isAssigningHw, setIsAssigningHw] = useState(false);
  const [hwLessonId, setHwLessonId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [libRes, stuRes, histRes] = await Promise.all([
        api.get('/teacher/library'),
        api.get('/teacher/students'),
        api.get('/teacher/history'),
      ]);
      setLibrary(libRes.data);
      setStudents(stuRes.data);
      setHistory(histRes.data);
    } catch {
      toast.error('Ошибка загрузки данных');
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (history.length > 0) {
      const urlParams = new URLSearchParams(window.location.search);
      const assignHwId = urlParams.get('assignHw');
      if (assignHwId) {
        const session = history.find(h => h.id === assignHwId);
        if (session) {
          setActiveTab('history');
          openAssignModal(session.lesson.id, session.students.map(s => s.id));
          window.history.replaceState({}, '', '/teacher');
        }
      }
    }
  }, [history]);

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

  const openStartClassModal = (lessonId: string) => {
    setStartLessonId(lessonId);
    setSelectedStudentIds(new Set()); // Start with empty selection
    setIsStartingClass(true);
  };

  const handleStartClass = async () => {
    if (!startLessonId) return;
    try {
      const res = await api.post('/teacher/classroom/start', { 
        lessonId: startLessonId,
        studentIds: Array.from(selectedStudentIds) // Backend could use this to filter who can join
      });
      router.push(`/classroom?session=${res.data.id}&role=teacher`);
    } catch {
      toast.error('Ошибка запуска урока');
    }
  };

  const openAssignModal = (lessonId: string, preselectedStudentIds: string[] = []) => {
    setHwLessonId(lessonId);
    setSelectedStudentIds(new Set(preselectedStudentIds.length > 0 ? preselectedStudentIds : []));
    setIsAssigningHw(true);
  };

  const submitAssignHomework = async () => {
    if (!hwLessonId || selectedStudentIds.size === 0) {
      toast.error('Выберите урок и хотя бы одного ученика');
      return;
    }
    try {
      await api.post('/teacher/assign-homework', {
        lessonId: hwLessonId,
        studentIds: Array.from(selectedStudentIds),
      });
      toast.success('Домашнее задание назначено');
      setIsAssigningHw(false);
      setHwLessonId(null);
      setSelectedStudentIds(new Set());
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
              <DialogTrigger render={
                <Button variant="outline" size="sm" className="cursor-pointer" id="add-student-btn">
                  + {t('teacher.addStudent')}
                </Button>
              } />
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

        {/* Main Area: Tabs for Library & History */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex gap-2 border-b pb-2">
            <Button 
              variant={activeTab === 'library' ? 'default' : 'ghost'} 
              onClick={() => setActiveTab('library')}
            >
              📖 {t('nav.library')}
            </Button>
            <Button 
              variant={activeTab === 'history' ? 'default' : 'ghost'} 
              onClick={() => setActiveTab('history')}
            >
              🗂 История занятий
            </Button>
          </div>

          {activeTab === 'library' && (
            library.length === 0 ? (
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
                            onClick={() => openStartClassModal(lesson.id)}
                            id={`start-class-${lesson.id}`}
                          >
                            ▶ {t('teacher.startClass')}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="cursor-pointer"
                            onClick={() => openAssignModal(lesson.id)}
                          >
                            📝 {t('teacher.assignHomework')}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))
            )
          )}

          {activeTab === 'history' && (
            history.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <span className="text-4xl mb-3">🗂</span>
                  <p>Вы еще не провели ни одного урока.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {history.map((session) => (
                  <Card key={session.id}>
                    <CardContent className="flex items-center justify-between p-4">
                      <div>
                        <p className="font-semibold text-lg">{session.lesson.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(session.createdAt).toLocaleDateString()} · {new Date(session.createdAt).toLocaleTimeString()}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {session.students.map((s) => (
                            <Badge key={s.id} variant="secondary">{s.name}</Badge>
                          ))}
                          {session.students.length === 0 && <span className="text-xs text-muted-foreground italic">Никто не присоединился</span>}
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => openAssignModal(session.lesson.id, session.students.map(s => s.id))}
                        disabled={session.students.length === 0}
                      >
                        📝 Назначить ДЗ присутствовавшим
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )
          )}
        </div>
      </div>

      {/* Assign Homework Modal */}
      <Dialog open={isAssigningHw} onOpenChange={setIsAssigningHw}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Назначить домашнее задание</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <p className="text-sm text-muted-foreground">Выберите учеников, которым назначить ДЗ по этому уроку:</p>
            <div className="max-h-[300px] overflow-y-auto space-y-2 border rounded-md p-2">
              {students.map((s) => (
                <div key={s.id} className="flex items-center gap-2 p-2 hover:bg-accent/50 rounded-lg cursor-pointer" onClick={() => {
                  const newSet = new Set(selectedStudentIds);
                  if (newSet.has(s.id)) newSet.delete(s.id);
                  else newSet.add(s.id);
                  setSelectedStudentIds(newSet);
                }}>
                  <input type="checkbox" checked={selectedStudentIds.has(s.id)} readOnly className="w-4 h-4 cursor-pointer" />
                  <span className="text-sm font-medium">{s.name}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between items-center">
              <Button variant="ghost" onClick={() => setSelectedStudentIds(new Set(students.map(s => s.id)))}>
                Выбрать всех
              </Button>
              <Button onClick={submitAssignHomework} className="gradient-brand text-white shadow-md">
                Назначить ({selectedStudentIds.size})
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {/* Start Class Modal */}
      <Dialog open={isStartingClass} onOpenChange={setIsStartingClass}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Начать урок</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <p className="text-sm text-muted-foreground">Выберите учеников, которых вы приглашаете на этот урок:</p>
            <div className="max-h-[300px] overflow-y-auto space-y-2 border rounded-md p-2">
              {students.map((s) => (
                <div key={s.id} className="flex items-center gap-2 p-2 hover:bg-accent/50 rounded-lg cursor-pointer" onClick={() => {
                  const newSet = new Set(selectedStudentIds);
                  if (newSet.has(s.id)) newSet.delete(s.id);
                  else newSet.add(s.id);
                  setSelectedStudentIds(newSet);
                }}>
                  <input type="checkbox" checked={selectedStudentIds.has(s.id)} readOnly className="w-4 h-4 cursor-pointer" />
                  <span className="text-sm font-medium">{s.name}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-end pt-2">
              <Button onClick={handleStartClass} className="gradient-brand text-white shadow-md">
                Запустить урок {selectedStudentIds.size > 0 ? `(${selectedStudentIds.size})` : ''}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
