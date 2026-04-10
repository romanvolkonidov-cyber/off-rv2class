"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RadioTower, BookOpen, Loader2, CheckCircle } from 'lucide-react';
import api from '@/lib/api';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface ActiveSession {
  id: string;
  lesson: { title: string };
  teacher: { name: string };
}

interface Homework {
  id: string;
  assignedAt: string;
  lesson: { title: string };
  score: number | null;
}

export default function StudentPortal() {
  const router = useRouter();
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [homeworks, setHomeworks] = useState<Homework[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const hwRes = await api.get('/student/homework');
        setHomeworks(hwRes.data || []);
      } catch (error) {
        console.error("Failed to fetch student data", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();

    // Polling: Check every 5 seconds if the teacher started a class
    const checkActiveSession = async () => {
      try {
        const sessionRes = await api.get('/student/classroom/active');
        setActiveSession(sessionRes.data);
      } catch (error) {
        setActiveSession(null);
      }
    };

    checkActiveSession(); // Initial check
    const interval = setInterval(checkActiveSession, 5000);

    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return <div className="flex h-full items-center justify-center pt-20"><Loader2 className="animate-spin w-8 h-8 text-primary" /></div>;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Join Class Banner */}
      {activeSession && (
        <div className="bg-primary text-primary-foreground p-6 md:p-8 rounded-2xl shadow-xl flex flex-col md:flex-row items-center justify-between gap-4 animate-in fade-in zoom-in slide-in-from-bottom-4">
          <div className="flex items-center gap-4 text-center md:text-left">
            <div className="p-3 bg-white/20 rounded-full animate-pulse"><RadioTower className="w-8 h-8" /></div>
            <div>
              <h2 className="text-2xl font-bold">Урок начался!</h2>
              <p className="text-primary-foreground/80">{activeSession.teacher.name} приглашает вас на: {activeSession.lesson.title}</p>
            </div>
          </div>
          <Button size="lg" className="w-full md:w-auto bg-white text-primary hover:bg-white/90 font-bold" onClick={() => router.push(`/classroom/${activeSession.id}`)}>
            Присоединиться к классу
          </Button>
        </div>
      )}

      {/* Homework Section */}
      <div>
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2 mb-4"><BookOpen className="w-6 h-6 text-primary" /> Мои задания</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {homeworks.map(hw => (
            <Card key={hw.id} className="bg-card border-secondary hover:border-primary/50 transition-colors">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg line-clamp-1">{hw.lesson.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground pb-4">
                {hw.score !== null ? (
                  <span className="flex items-center text-green-600 font-medium gap-1"><CheckCircle className="w-4 h-4" /> Оценка: {hw.score}%</span>
                ) : (
                  <span className="text-accent font-medium">Ожидает выполнения</span>
                )}
              </CardContent>
              <CardFooter>
                <Button variant={hw.score !== null ? 'outline' : 'default'} className="w-full" onClick={() => router.push(`/student/homework/${hw.id}`)}>
                  {hw.score !== null ? 'Посмотреть результаты' : 'Начать выполнение'}
                </Button>
              </CardFooter>
            </Card>
          ))}
          {homeworks.length === 0 && (
            <div className="col-span-full p-8 text-center border-2 border-dashed border-secondary rounded-xl text-muted-foreground">У вас пока нет домашних заданий.</div>
          )}
        </div>
      </div>
    </div>
  );
}