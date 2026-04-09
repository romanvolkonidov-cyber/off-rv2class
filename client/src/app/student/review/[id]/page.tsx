'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import '@/lib/i18n';
import api from '@/lib/api';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface Slide {
  id: string;
  orderIndex: number;
  imageUrl: string;
}

interface Session {
  id: string;
  lesson: { id: string; title: string; slides: Slide[] };
  canvasStates: string | null;
}

export default function StudentReviewMode() {
  const { t } = useTranslation();
  const params = useParams();
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasDimensions, setCanvasDimensions] = useState({ width: 0, height: 0 });

  const fetchSession = useCallback(async () => {
    try {
      const res = await api.get(`/student/sessions/${params.id}`);
      setSession(res.data);
    } catch {
      toast.error('Ошибка загрузки архива урока');
      router.push('/student');
    }
  }, [params.id, router]);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        setCanvasDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, [session]);

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const slides = session.lesson.slides;
  const currentSlide = slides[currentSlideIndex];
  
  // Render text annotations if any
  const canvasStatesMap = session.canvasStates ? JSON.parse(session.canvasStates!) : {};
  const currentStateStr = canvasStatesMap[currentSlideIndex];
  let textObjects: any[] = [];
  if (currentStateStr) {
    try {
      const parsed = JSON.parse(currentStateStr);
      if (parsed.objects) {
        textObjects = parsed.objects.filter((obj: any) => obj.type === 'i-text' || obj.type === 'text');
      }
    } catch (e) {}
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top Bar */}
      <header className="h-16 px-6 flex items-center justify-between border-b bg-card z-10 glass shadow-sm">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.push('/student')}>
            ← Назад
          </Button>
          <h1 className="text-xl font-bold flex items-center gap-3">
            {session.lesson.title}
            <Badge variant="outline" className="bg-primary/10">Архив</Badge>
          </h1>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground mr-4">
          Слайд {currentSlideIndex + 1} из {slides.length}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden relative" ref={containerRef}>
        <div className="w-full h-full relative flex items-center justify-center p-4">
          <div 
            className="relative bg-white shadow-xl rounded-xl overflow-hidden"
            style={{
              width: canvasDimensions.height * (16/9) <= canvasDimensions.width 
                ? canvasDimensions.height * (16/9) 
                : canvasDimensions.width,
              height: canvasDimensions.height * (16/9) <= canvasDimensions.width 
                ? canvasDimensions.height 
                : canvasDimensions.width * (9/16),
            }}
          >
            {/* Background Image */}
            <img 
              src={`${process.env.NEXT_PUBLIC_API_URL}${currentSlide.imageUrl}`} 
              alt="Slide" 
              className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none"
            />
            {/* Render Text Annotations preserved from the lesson */}
            {textObjects.map((txt: any, idx: number) => {
               // Scale coordinates mapping if needed, simplified positioning
               return (
                  <div
                    key={idx}
                    className="absolute pointer-events-none"
                    style={{
                       left: `${txt.left}px`,
                       top: `${txt.top}px`,
                       color: txt.fill,
                       fontSize: `${txt.fontSize}px`,
                       fontFamily: txt.fontFamily,
                       transform: `scale(${txt.scaleX}, ${txt.scaleY})`,
                       transformOrigin: 'top left'
                    }}
                  >
                    {txt.text}
                  </div>
               )
            })}
          </div>
        </div>

        {/* Navigation Overlays */}
        <div className="absolute inset-y-0 left-4 flex items-center">
          <Button 
            variant="outline" 
            size="icon" 
            className="rounded-full shadow-lg w-12 h-12 glass"
            onClick={() => setCurrentSlideIndex(v => Math.max(0, v - 1))}
            disabled={currentSlideIndex === 0}
          >
            {'<'}
          </Button>
        </div>
        <div className="absolute inset-y-0 right-4 flex items-center">
          <Button 
            variant="outline" 
            size="icon" 
            className="rounded-full shadow-lg w-12 h-12 glass gradient-brand text-white border-0"
            onClick={() => setCurrentSlideIndex(v => Math.min(slides.length - 1, v + 1))}
            disabled={currentSlideIndex === slides.length - 1}
          >
            {'>'}
          </Button>
        </div>
      </main>
    </div>
  );
}
