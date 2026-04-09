'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import api from '@/lib/api';

interface Slide {
  id: string;
  imageUrl: string;
  orderIndex: number;
}

interface Lesson {
  id: string;
  title: string;
  slides: Slide[];
}

export default function PastLessonViewerPage() {
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const params = useParams();

  useEffect(() => {
    const fetchLesson = async () => {
      try {
        const res = await api.get(`/student/lessons/${params.id}`);
        setLesson(res.data);
      } catch (error) {
        console.error('Failed to load lesson slides', error);
      } finally {
        setLoading(false);
      }
    };
    fetchLesson();
  }, [params.id]);

  if (loading) return <DashboardLayout><div className="p-8">Загрузка...</div></DashboardLayout>;
  if (!lesson) return <DashboardLayout><div className="p-8">Урок не найден</div></DashboardLayout>;

  const slides = lesson.slides || [];
  const currentSlideData = slides[currentSlide];

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto flex flex-col h-[calc(100vh-8rem)]">
        <div className="flex items-center justify-between mb-4 shrink-0">
          <div>
            <h1 className="text-2xl font-bold">{lesson.title}</h1>
            <p className="text-sm text-muted-foreground">Просмотр слайдов</p>
          </div>
          <Button variant="outline" onClick={() => router.push('/student/lessons')}>
            Вернуться к списку
          </Button>
        </div>

        <div className="flex-1 flex flex-col min-h-0 bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          {/* Slide area */}
          <div className="flex-1 relative bg-muted/30 flex items-center justify-center p-4 min-h-0">
            {currentSlideData ? (
              <img
                src={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}${currentSlideData.imageUrl}`}
                alt={`Slide ${currentSlide + 1}`}
                className="w-full h-full object-contain bg-white rounded shadow-sm"
              />
            ) : (
              <p>Слайд не найден</p>
            )}
          </div>

          {/* Navigation */}
          <div className="h-14 border-t border-border flex items-center justify-center gap-4 px-4 bg-background shrink-0">
            <Button
              variant="outline"
              onClick={() => setCurrentSlide(s => Math.max(0, s - 1))}
              disabled={currentSlide === 0}
            >
              ← Назад
            </Button>

            <span className="text-sm px-4">
              {currentSlide + 1} / {slides.length}
            </span>

            <Button
              variant="outline"
              onClick={() => setCurrentSlide(s => Math.min(slides.length - 1, s + 1))}
              disabled={currentSlide >= slides.length - 1}
            >
              Вперед →
            </Button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
