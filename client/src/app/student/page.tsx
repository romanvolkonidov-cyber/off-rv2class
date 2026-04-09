'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import '@/lib/i18n';
import api from '@/lib/api';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';

interface Assignment {
  id: string;
  lessonId: string;
  submittedAt: string | null;
  score: number | null;
  gradeOverride: number | null;
  teacherComment: string | null;
  lesson: { id: string; title: string };
  teacher: { name: string };
}

interface ActiveSession {
  id: string;
  lessonId: string;
  lesson: { title: string };
}

interface PastSession {
  id: string;
  lesson: { id: string; title: string };
  teacher: { name: string };
}

interface DashboardData {
  assignments: Assignment[];
  activeSession: ActiveSession | null;
  pastSessions: PastSession[];
}

export default function StudentDashboard() {
  const { t } = useTranslation();
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await api.get('/student/dashboard');
      setData(res.data);
    } catch {
      toast.error('Ошибка загрузки');
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const handleJoinClass = (sessionId: string) => {
    router.push(`/classroom?session=${sessionId}&role=student`);
  };

  if (!data) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const pendingAssignments = data.assignments.filter((a) => !a.submittedAt);
  const completedAssignments = data.assignments.filter((a) => a.submittedAt);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">{t('student.title')}</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Ваши уроки и домашние задания
        </p>
      </div>

      {/* Active Class Banner */}
      {data.activeSession && (
        <Card className="border-primary/30 bg-primary/5 shadow-lg shadow-primary/10">
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center animate-pulse">
                <span className="text-xl">🟢</span>
              </div>
              <div>
                <p className="font-semibold">Активный урок</p>
                <p className="text-sm text-muted-foreground">{data.activeSession.lesson.title}</p>
              </div>
            </div>
            <Button
              className="gradient-brand text-white shadow-md cursor-pointer"
              onClick={() => handleJoinClass(data.activeSession!.id)}
              id="join-class-btn"
            >
              {t('student.joinClass')} →
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Pending Homework */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              📝 Невыполненные задания
              {pendingAssignments.length > 0 && (
                <Badge className="gradient-brand text-white">{pendingAssignments.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <Separator />
          <CardContent className="pt-3">
            {pendingAssignments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                🎉 Все задания выполнены!
              </p>
            ) : (
              <div className="space-y-2">
                {pendingAssignments.map((assignment) => (
                  <div
                    key={assignment.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-accent/30 hover:bg-accent/50 transition-colors cursor-pointer"
                    onClick={() => router.push(`/student/homework/${assignment.id}`)}
                  >
                    <div>
                      <p className="text-sm font-medium">{assignment.lesson.title}</p>
                      <p className="text-xs text-muted-foreground">от {assignment.teacher.name}</p>
                    </div>
                    <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">
                      {t('gradebook.pending')}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Completed Homework */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              ✅ Выполненные задания
            </CardTitle>
          </CardHeader>
          <Separator />
          <CardContent className="pt-3">
            {completedAssignments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Выполненных заданий пока нет
              </p>
            ) : (
              <div className="space-y-2">
                {completedAssignments.map((assignment) => {
                  const displayScore = assignment.gradeOverride ?? assignment.score ?? 0;
                  return (
                    <div
                      key={assignment.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-accent/30"
                    >
                      <div>
                        <p className="text-sm font-medium">{assignment.lesson.title}</p>
                        {assignment.teacherComment && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            💬 {assignment.teacherComment}
                          </p>
                        )}
                      </div>
                      <Badge
                        className={displayScore >= 80 ? 'bg-green-100 text-green-700' : displayScore >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}
                      >
                        {Math.round(displayScore)}%
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Past Class Sessions (Archive) */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            🗂 Пройденные уроки (Архив)
          </CardTitle>
        </CardHeader>
        <Separator />
        <CardContent className="pt-3">
          {!data.pastSessions || data.pastSessions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Вы еще не посетили ни одного живого урока
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {data.pastSessions.map((session) => (
                <div
                  key={session.id}
                  className="p-4 rounded-lg border bg-card hover:shadow-md transition-shadow cursor-pointer flex flex-col justify-between"
                  onClick={() => router.push(`/student/review/${session.id}`)}
                >
                  <div>
                    <Badge variant="outline" className="mb-2 bg-primary/5">Урок завершен</Badge>
                    <p className="font-semibold">{session.lesson.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">Преподаватель: {session.teacher.name}</p>
                  </div>
                  <Button variant="secondary" size="sm" className="mt-3 w-full cursor-pointer">
                    Открыть материалы
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
