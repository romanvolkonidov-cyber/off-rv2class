"use client";

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Play, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
  lessons: Lesson[];
}

export default function LibraryPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLibrary = async () => {
      try {
        const res = await api.get('/teacher/library');
        setCourses(res.data);
      } catch (error) {
        console.error("Failed to load library", error);
        toast.error("Ошибка загрузки библиотеки уроков");
      } finally {
        setLoading(false);
      }
    };

    fetchLibrary();
  }, []);

  if (loading) {
    return <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin w-8 h-8 text-primary" /></div>;
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-foreground">{t('navigation.library')}</h1>
        <p className="text-muted-foreground mt-2">Выберите урок для начала занятия.</p>
      </div>
      
      {courses.map((course) => (
        <div key={course.id} className="space-y-4">
          <h2 className="text-xl font-semibold text-secondary-foreground border-b border-border pb-2">{course.title}</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {course.lessons.map((lesson) => (
              <Card key={lesson.id} className="hover:shadow-lg transition-all bg-card flex flex-col border-secondary">
                <CardHeader>
                  <CardTitle className="text-lg line-clamp-2 text-foreground">{lesson.title}</CardTitle>
                </CardHeader>
                <CardContent className="flex-1 text-sm text-muted-foreground space-y-1">
                  <p>Слайдов: {lesson._count.slides}</p>
                  <p>Заданий: {lesson._count.homework}</p>
                </CardContent>
                <CardFooter className="flex gap-2">
                  <Button className="flex-1 bg-primary hover:bg-primary/90 text-white" onClick={() => router.push(`/classroom/${lesson.id}`)}>
                    <Play className="w-4 h-4 mr-2" /> Начать
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}