'use client';

import { useState, useEffect, useRef, useCallback, use } from 'react';
import { useTranslation } from 'react-i18next';
import '@/lib/i18n';
import api, { PROD_URL } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Layout, History, Loader2 } from 'lucide-react';
import Image from 'next/image';

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

export default function StudentReviewMode({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t } = useTranslation();
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);

  const fetchSession = useCallback(async () => {
    try {
      const res = await api.get(`/student/sessions/${id}`);
      setSession(res.data);
    } catch {
      toast.error('Ошибка загрузки архива урока');
      router.push('/student');
    }
  }, [id, router]);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  if (!session) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#F8FAFC]">
        <Loader2 className="animate-spin w-10 h-10 text-primary/30" />
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

  const getMediaUrl = (path: string) => {
    const baseUrl = process.env.NODE_ENV === 'production' ? PROD_URL : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000');
    return `${baseUrl}${path}`;
  };

  return (
    <div className="h-screen flex flex-col bg-[#FDFCFB] overflow-hidden antialiased font-sans">
      
      {/* Top Navigation */}
      <nav className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-8 z-50 shrink-0">
        <div className="flex items-center gap-6">
           <Button 
             variant="ghost" 
             onClick={() => router.push('/student')}
             className="text-gray-400 hover:text-primary transition-all rounded-xl"
           >
             <ChevronLeft className="w-5 h-5 mr-1" /> {t('student.back')}
           </Button>
           
           <div className="h-6 w-px bg-gray-100" />
           
           <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center">
                 <History className="w-4 h-4 text-gray-400" />
              </div>
              <h1 className="text-lg font-black text-gray-800 tracking-tight">
                {session.lesson.title}
              </h1>
              <Badge variant="outline" className="bg-primary/5 text-primary border-primary/10 font-bold uppercase text-[10px] px-2 py-0">
                {t('common.role.student')} Review
              </Badge>
           </div>
        </div>

        <div className="flex items-center gap-6">
           <div className="text-xs font-black text-gray-400 uppercase tracking-widest">
              Slide {currentSlideIndex + 1} / {slides.length}
           </div>
           {/* Tooltip or additional info could go here */}
        </div>
      </nav>

      {/* Slide Canvas Area */}
      <main className="flex-1 relative flex items-center justify-center p-8 bg-gray-50/50">
        
        {/* Navigation Arrows (Fixed Position) */}
        <div className="absolute inset-x-8 flex items-center justify-between pointer-events-none z-40">
           <Button 
             variant="outline" 
             size="icon" 
             onClick={() => setCurrentSlideIndex(v => Math.max(0, v - 1))}
             disabled={currentSlideIndex === 0}
             className="w-14 h-14 rounded-full bg-white/90 backdrop-blur-md border-gray-100 shadow-xl pointer-events-auto hover:bg-white hover:scale-110 active:scale-95 transition-all text-gray-400 hover:text-primary disabled:opacity-20"
           >
              <ChevronLeft className="w-8 h-8" />
           </Button>
           <Button 
             onClick={() => setCurrentSlideIndex(v => Math.min(slides.length - 1, v + 1))}
             disabled={currentSlideIndex === slides.length - 1}
             className="w-14 h-14 rounded-full bg-primary text-white shadow-xl shadow-primary/20 pointer-events-auto hover:scale-110 active:scale-95 transition-all disabled:opacity-20 translate-x-4 md:translate-x-0"
           >
              <ChevronRight className="w-8 h-8" />
           </Button>
        </div>

        {/* Slide Frame */}
        <div className="relative w-full h-full max-w-7xl aspect-[16/9] bg-white rounded-[2.5rem] shadow-[0_40px_100px_rgba(0,0,0,0.08)] overflow-hidden ring-1 ring-black/5 group">
          
           {/* Background Image */}
           <Image 
             src={getMediaUrl(currentSlide.imageUrl)} 
             alt="Slide Content" 
             fill
             priority
             unoptimized
             className="object-contain select-none pointer-events-none transition-transform duration-700 group-hover:scale-[1.01]"
           />

           {/* Preserved Blackboard Annotations */}
           <div className="absolute inset-0 pointer-events-none">
              {textObjects.map((txt: any, idx: number) => (
                 <div
                   key={idx}
                   className="absolute whitespace-pre font-bold"
                   style={{
                      left: `${txt.left}px`,
                      top: `${txt.top}px`,
                      color: txt.fill,
                      fontSize: `${txt.fontSize}px`,
                      fontFamily: txt.fontFamily || 'inherit',
                      transform: `scale(${txt.scaleX}, ${txt.scaleY})`,
                      transformOrigin: 'top left'
                   }}
                 >
                   {txt.text}
                 </div>
              ))}
           </div>

           {/* Review Overlay Indicator */}
           <div className="absolute top-8 left-8 p-3 px-5 rounded-2xl bg-white/60 backdrop-blur-xl border border-white/40 shadow-sm flex items-center gap-3 animate-in fade-in slide-in-from-left duration-700">
              <Layout className="w-5 h-5 text-gray-400" />
              <span className="text-xs font-black text-gray-800 uppercase tracking-widest">Historical View</span>
           </div>
        </div>

        {/* Progress Bar (Bottom) */}
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 w-96 flex gap-1">
           {slides.map((_, i) => (
              <div 
                key={i} 
                className={`h-1 flex-1 rounded-full transition-all duration-500 ${i === currentSlideIndex ? 'bg-primary' : i < currentSlideIndex ? 'bg-primary/30' : 'bg-gray-200'}`} 
              />
           ))}
        </div>
      </main>
    </div>
  );
}
