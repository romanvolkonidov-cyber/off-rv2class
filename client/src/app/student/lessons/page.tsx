'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import api from '@/lib/api';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

interface Lesson {
  id: string;
  title: string;
  createdAt: string;
}

export default function PastLessonsPage() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchLessons = async () => {
      try {
        const res = await api.get('/student/lessons');
        setLessons(res.data);
      } catch (error) {
        console.error('Failed to load past lessons', error);
      } finally {
        setLoading(false);
      }
    };
    fetchLessons();
  }, []);

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Прошлые Уроки</h1>
          <p className="text-muted-foreground mt-1">Здесь вы можете посмотреть слайды из пройденных уроков</p>
        </div>

        {loading ? (
          <div>Загрузка...</div>
        ) : lessons.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              У вас еще нет пройденных уроков
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {lessons.map((lesson) => (
              <Card key={lesson.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">{lesson.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Пройдено: {format(new Date(lesson.createdAt), 'd MMMM yyyy, HH:mm', { locale: ru })}
                  </p>
                  <Button 
                    className="w-full" 
                    variant="outline"
                    onClick={() => router.push(`/student/lessons/${lesson.id}`)}
                  >
                    Посмотреть слайды
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
