'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import '@/lib/i18n';
import Image from 'next/image';
import api, { PROD_URL } from '@/lib/api';
import { connectSocket, disconnectSocket } from '@/lib/socket';
import { useAuthStore } from '@/stores/auth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import type { Socket } from 'socket.io-client';
import { 
  MessageSquare, Loader2, Play, Pause, SkipForward, SkipBack, X, 
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, 
  BookOpen, Pencil, Maximize2, Search, FileText, StickyNote, HelpCircle
} from 'lucide-react';

interface Slide {
  id: string;
  imageUrl: string;
  orderIndex: number;
  audioUrl?: string;
  videoUrl?: string;
  audioWidgetX?: number;
  audioWidgetY?: number;
  audioWidgetScale?: number;
  teacherNote?: {
    id: string;
    suggestedQuestions: string;
    correctAnswers: string;
    tips: string | null;
  };
}

interface SessionData {
  id: string;
  lessonId: string;
  currentSlide: number;
  students: { id: string; name: string }[];
  lesson: {
    title: string;
    level: string;
    slides: Slide[];
    teaserVideoUrl?: string;
    lessonVideoNotes?: string;
    listeningScript?: string;
  };
}

function ClassroomContent() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loadFromStorage } = useAuthStore();

  const sessionId = searchParams.get('session');
  const role = searchParams.get('role') as 'teacher' | 'student';

  const [session, setSession] = useState<SessionData | null>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [peekNoteIndex, setPeekNoteIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<'canvas' | 'homework'>('canvas');
  const [activeTool, setActiveTool] = useState<'pen' | 'text' | 'eraser' | null>('pen');
  const [penColor, setPenColor] = useState('#3b82f6');
  const [isConnected, setIsConnected] = useState(false);
  const [canAnnotate, setCanAnnotate] = useState(false);
  const [showTeaser, setShowTeaser] = useState(true);
  
  // New States for Notebook & Modals
  const [showScript, setShowScript] = useState(false);
  const [showObservation, setShowObservation] = useState(false);
  const [observationText, setObservationText] = useState('');
  const [totalSeconds, setTotalSeconds] = useState(0);
  const [slideSeconds, setSlideSeconds] = useState(0);
  
  const [textObjects, setTextObjects] = useState<{ id: string; text: string; x: number; y: number }[]>([]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const isDrawingRef = useRef(false);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);
  const canvasStatesRef = useRef<Record<number, string>>({});

  // Flag to distinct programmatic seek/play from real user interactions
  const isRemoteAction = useRef(false);

  const saveCanvasState = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvasStatesRef.current[currentSlide] = canvas.toDataURL();
  }, [currentSlide]);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  const drawRemotePath = useCallback((path: { fromX: number; fromY: number; toX: number; toY: number; color: string; width: number }) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.beginPath();
    ctx.moveTo(path.fromX, path.fromY);
    ctx.lineTo(path.toX, path.toY);
    ctx.strokeStyle = path.color;
    ctx.lineWidth = path.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  }, []);

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  // Fetch session data
  useEffect(() => {
    if (!sessionId) return;

    const fetchSession = async () => {
      try {
        let res;
        if (role === 'teacher') {
          res = await api.get('/teacher/classroom/active');
          setSession(res.data);
          setCurrentSlide(res.data.currentSlide);
        }
        // For students, get the active session
        if (role === 'student') {
          res = await api.get('/student/classroom/active');
          setSession(res.data);
          setCurrentSlide(res.data.currentSlide);
        }
      } catch {
        // Fallback: try getting lesson data directly
      }
    };

    fetchSession();
  }, [sessionId, role]);

  // Timers: Total and per-slide
  useEffect(() => {
    if (!isConnected) return;
    const interval = setInterval(() => {
      setTotalSeconds(prev => prev + 1);
      setSlideSeconds(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isConnected]);

  useEffect(() => {
    setSlideSeconds(0);
  }, [currentSlide]);

  // Socket connection
  useEffect(() => {
    if (!sessionId || !user) return;

    const socket = connectSocket();
    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      if (role === 'teacher') {
        socket.emit('create_room', { sessionId });
      } else {
        socket.emit('join_room', { sessionId });
      }
    });

    socket.on('disconnect', () => setIsConnected(false));

    // Slide sync
    socket.on('slide_changed', (data: { slideIndex: number }) => {
      setCurrentSlide(data.slideIndex);
    });

    socket.on('sync_state', (data: { currentSlide: number; canvasStates: Record<number, string>; studentCanAnnotate?: boolean }) => {
      setCurrentSlide(data.currentSlide);
      canvasStatesRef.current = data.canvasStates || {};
      if (data.studentCanAnnotate !== undefined) {
        setCanAnnotate(data.studentCanAnnotate);
      }
    });

    // Sub-events for text and canvas
    socket.on('canvas:text_update', (data: { textId: string; text: string; x: number; y: number; slideIndex: number }) => {
      if (data.slideIndex !== currentSlide) return;
      setTextObjects((prev) => {
        const ext = prev.find(p => p.id === data.textId);
        if (ext) {
          return prev.map(p => p.id === data.textId ? { ...p, text: data.text, x: data.x, y: data.y } : p);
        }
        return [...prev, { id: data.textId, text: data.text, x: data.x, y: data.y }];
      });
    });

    socket.on('canvas:text_delete', (data: { textId: string; slideIndex: number }) => {
      if (data.slideIndex !== currentSlide) return;
      setTextObjects((prev) => prev.filter(p => p.id !== data.textId));
    });

    socket.on('session:annotation_toggled', (data: { canAnnotate: boolean }) => {
      setCanAnnotate(data.canAnnotate);
      toast.info(data.canAnnotate ? t('classroom.annotationEnabled', 'Учитель разрешил вам рисовать на доске') : t('classroom.annotationDisabled', 'Вы больше не можете рисовать на доске'));
    });

    // Canvas events from remote
    socket.on('canvas:path_created', (data: { path: any }) => {
      drawRemotePath(data.path);
    });

    socket.on('canvas:clear', () => {
      clearCanvas();
      setTextObjects([]);
    });

    socket.on('student_joined', () => {
      toast.info(t('classroom.studentJoined', 'Ученик присоединился к уроку'));
    });

    socket.on('user_left', (data: { role: string }) => {
      if (data.role === 'STUDENT') {
        toast.info(t('classroom.studentLeft', 'Ученик покинул урок'));
      }
    });

    // Audio Sync Handlers (mostly applies to STUDENTS, but could be useful for multi-teacher)
    socket.on('audio:play', (data: { currentTime: number; slideIndex: number }) => {
      if (!audioRef.current || data.slideIndex !== currentSlide) return;
      isRemoteAction.current = true;
      audioRef.current.currentTime = data.currentTime;
      audioRef.current.play().catch(() => {});
      setTimeout(() => { isRemoteAction.current = false; }, 100);
    });

    socket.on('audio:pause', (data: { currentTime: number; slideIndex: number }) => {
      if (!audioRef.current || data.slideIndex !== currentSlide) return;
      isRemoteAction.current = true;
      audioRef.current.currentTime = data.currentTime;
      audioRef.current.pause();
      setTimeout(() => { isRemoteAction.current = false; }, 100);
    });

    socket.on('audio:seek', (data: { currentTime: number; slideIndex: number }) => {
      if (!audioRef.current || data.slideIndex !== currentSlide) return;
      isRemoteAction.current = true;
      audioRef.current.currentTime = data.currentTime;
      setTimeout(() => { isRemoteAction.current = false; }, 100);
    });

    // Video Sync Handlers
    socket.on('video:play', (data: { currentTime: number; slideIndex: number }) => {
      if (!videoRef.current || data.slideIndex !== currentSlide) return;
      isRemoteAction.current = true;
      videoRef.current.currentTime = data.currentTime;
      videoRef.current.play().catch(() => {});
      setTimeout(() => { isRemoteAction.current = false; }, 100);
    });

    socket.on('video:pause', (data: { currentTime: number; slideIndex: number }) => {
      if (!videoRef.current || data.slideIndex !== currentSlide) return;
      isRemoteAction.current = true;
      videoRef.current.currentTime = data.currentTime;
      videoRef.current.pause();
      setTimeout(() => { isRemoteAction.current = false; }, 100);
    });

    socket.on('video:seek', (data: { currentTime: number; slideIndex: number }) => {
      if (!videoRef.current || data.slideIndex !== currentSlide) return;
      isRemoteAction.current = true;
      videoRef.current.currentTime = data.currentTime;
      setTimeout(() => { isRemoteAction.current = false; }, 100);
    });

    return () => {
      disconnectSocket();
    };
  }, [sessionId, user, role, currentSlide, clearCanvas, drawRemotePath, t]);

  // Canvas setup
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const container = canvas.parentElement;
    if (container) {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
    }

    // Restore canvas state for this slide
    const savedState = canvasStatesRef.current[currentSlide];
    if (savedState) {
      const img = new window.Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0);
      };
      img.src = savedState;
    }
  }, [currentSlide, session]);

  // Canvas mouse handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (role === 'student' && !canAnnotate) return;
    
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (activeTool === 'text') {
      const textId = Date.now().toString();
      const newObj = { id: textId, text: '', x, y };
      setTextObjects(prev => [...prev, newObj]);
      
      socketRef.current?.emit('canvas:text_update', {
        textId, text: '', x, y, slideIndex: currentSlide
      });
      return;
    }

    if (!activeTool) return;
    
    isDrawingRef.current = true;
    lastPosRef.current = { x, y };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if ((role === 'student' && !canAnnotate) || !isDrawingRef.current || !lastPosRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const pathData = {
      fromX: lastPosRef.current.x,
      fromY: lastPosRef.current.y,
      toX: x,
      toY: y,
      color: activeTool === 'eraser' ? '#ffffff' : penColor,
      width: activeTool === 'eraser' ? 20 : 3,
    };

    // Draw locally
    ctx.beginPath();
    ctx.moveTo(pathData.fromX, pathData.fromY);
    ctx.lineTo(pathData.toX, pathData.toY);
    ctx.strokeStyle = pathData.color;
    ctx.lineWidth = pathData.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (activeTool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
    } else {
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';

    // Broadcast
    socketRef.current?.emit('canvas:path_created', {
      path: pathData,
      slideIndex: currentSlide,
    });

    lastPosRef.current = { x, y };
  };

  const handleMouseUp = () => {
    isDrawingRef.current = false;
    lastPosRef.current = null;
    saveCanvasState();
  };

  // Slide navigation
  const handleChangeSlide = (newIndex: number) => {
    if (!session || newIndex < 0 || newIndex >= session.lesson.slides.length) return;

    saveCanvasState();

    if (role === 'teacher') {
      socketRef.current?.emit('change_slide', {
        slideIndex: newIndex,
      });
    }

    setCurrentSlide(newIndex);
  };

  const handleClearCanvas = () => {
    if (role === 'student' && !canAnnotate) return;
    if (!confirm(t('classroom.clearConfirm'))) return;
    clearCanvas();
    setTextObjects([]);
    socketRef.current?.emit('canvas:clear', { slideIndex: currentSlide });
  };

  // --- Text Objects Handlers ---
  const handleTextChange = (id: string, newText: string, x: number, y: number) => {
    setTextObjects(prev => prev.map(p => p.id === id ? { ...p, text: newText } : p));
    socketRef.current?.emit('canvas:text_update', {
      textId: id, text: newText, x, y, slideIndex: currentSlide
    });
  };

  const handleTextDelete = (id: string) => {
    setTextObjects(prev => prev.filter(p => p.id !== id));
    socketRef.current?.emit('canvas:text_delete', { textId: id, slideIndex: currentSlide });
  };

  // --- Audio / Video Sink Handlers ---

  const handleAudioPlay = () => {
    if (role !== 'teacher' || isRemoteAction.current || !audioRef.current) return;
    socketRef.current?.emit('audio:play', { currentTime: audioRef.current.currentTime, slideIndex: currentSlide });
  };

  const handleAudioPause = () => {
    if (role !== 'teacher' || isRemoteAction.current || !audioRef.current) return;
    socketRef.current?.emit('audio:pause', { currentTime: audioRef.current.currentTime, slideIndex: currentSlide });
  };

  const handleAudioSeeked = () => {
    if (role !== 'teacher' || isRemoteAction.current || !audioRef.current) return;
    socketRef.current?.emit('audio:seek', { currentTime: audioRef.current.currentTime, slideIndex: currentSlide });
  };

  const handleVideoPlay = () => {
    if (role !== 'teacher' || isRemoteAction.current || !videoRef.current) return;
    socketRef.current?.emit('video:play', { currentTime: videoRef.current.currentTime, slideIndex: currentSlide });
  };

  const handleVideoPause = () => {
    if (role !== 'teacher' || isRemoteAction.current || !videoRef.current) return;
    socketRef.current?.emit('video:pause', { currentTime: videoRef.current.currentTime, slideIndex: currentSlide });
  };

  const handleVideoSeeked = () => {
    if (role !== 'teacher' || isRemoteAction.current || !videoRef.current) return;
    socketRef.current?.emit('video:seek', { currentTime: videoRef.current.currentTime, slideIndex: currentSlide });
  };

  const handleToggleAnnotation = () => {
    const nextState = !canAnnotate;
    setCanAnnotate(nextState);
    socketRef.current?.emit('session:toggle_annotation', { canAnnotate: nextState });
  };

  const handleEndClass = async () => {
    if (!sessionId) return;
    try {
      await api.put(`/teacher/classroom/${sessionId}/end`);
      toast.success(t('classroom.classEnded', 'Урок завершен'));
      router.push(`/teacher?assignHw=${sessionId}`);
    } catch {
      toast.error(t('classroom.endError', 'Ошибка завершения урока'));
    }
  };

  const handleSaveObservation = async () => {
    if (!observationText.trim() || !session) return;
    try {
      // Find the first student in the session (assuming 1-on-1 for now, or use a specific selected student)
      const studentId = session.students?.[0]?.id;
      if (!studentId) {
        toast.error('No student connected');
        return;
      }

      await api.post('/teacher/classroom/observations', {
        studentId,
        sessionId: session.id,
        content: observationText,
      });
      toast.success(t('common.saved'));
      setObservationText('');
      setShowObservation(false);
    } catch (error) {
      toast.error(t('common.error'));
    }
  };

  const formatTime = (total: number) => {
    const mins = Math.floor(total / 60);
    const secs = total % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const slides = session?.lesson?.slides || [];
  const currentSlideData = slides[currentSlide];
  
  // Peek and Sync indices
  const notesSlide = slides[peekNoteIndex] || currentSlideData;
  const currentNote = notesSlide?.teacherNote;

  // Sync Peek index to current slide when and if slide changes automatically
  useEffect(() => {
    setPeekNoteIndex(currentSlide);
  }, [currentSlide]);

  if (!session) return <div className="h-screen flex items-center justify-center bg-background text-foreground"><Loader2 className="animate-spin w-10 h-10 text-primary" /></div>;

  return (
    <div className="h-screen flex flex-col bg-[#F3F4F6] overflow-hidden antialiased">
      
      {/* 1. TOP NAVBAR */}
      <nav className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 shrink-0 z-50">
        <div className="flex items-center gap-8">
           <div className="flex items-center gap-2">
             <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white font-black text-sm">rv</div>
             <span className="font-bold text-gray-800 tracking-tight hidden md:block">rv2class</span>
           </div>
           
           <div className="flex bg-gray-100 p-1 rounded-2xl">
              {(['canvas', 'homework'] as const).map(tab => (
                 <button 
                   key={tab}
                   onClick={() => setActiveTab(tab)}
                   className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-white text-primary shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                 >
                    {t(`classroom.${tab}`)}
                 </button>
              ))}
           </div>
        </div>

        <div className="flex items-center gap-4">
           {/* Media Controls */}
           <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-2xl">
              <button 
                className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-500 hover:bg-white hover:text-primary transition-all cursor-pointer"
                onClick={() => {
                   if (audioRef.current?.paused) audioRef.current.play(); else audioRef.current?.pause();
                }}
              >
                 <Play className="w-5 h-5" />
              </button>
              <button 
                onClick={() => setActiveTool(activeTool === 'pen' ? null : 'pen')}
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer ${activeTool === 'pen' ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-600'}`}
              >
                 <Pencil className="w-5 h-5" />
              </button>
              {role === 'teacher' && (
                <button 
                  onClick={() => setShowScript(true)}
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-500 hover:bg-white hover:text-primary transition-all cursor-pointer"
                >
                   <FileText className="w-5 h-5" />
                </button>
              )}
              <button className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-500 hover:bg-white hover:text-primary transition-all cursor-pointer">
                 <Maximize2 className="w-5 h-5" />
              </button>
           </div>
           
           {role === 'teacher' && (
              <Button size="sm" variant="destructive" onClick={handleEndClass} className="rounded-xl font-bold px-4">
                {t('teacher.endClass')}
              </Button>
           )}
        </div>
      </nav>

      <div className="flex-1 flex overflow-hidden">
        
        {/* 2. LEFT SIDEBAR (PEEKABLE NOTES) */}
        {role === 'teacher' && (
          <aside className="w-96 flex flex-col border-r border-gray-200 bg-[#E5E7EB] shrink-0 overflow-hidden relative">
            {/* Spiral aesthetic */}
            <div className="absolute top-4 left-0 right-0 flex justify-center gap-1 px-8 pointer-events-none">
               {Array.from({ length: 14 }).map((_, i) => (
                  <div key={i} className="w-2.5 h-8 bg-gray-300 rounded-full border border-gray-400/20 shadow-inner" />
               ))}
            </div>

            <div className="flex-1 mt-8 mb-6 mx-6 bg-white rounded-3xl shadow-xl flex flex-col overflow-hidden">
               <div className="p-8 pb-4 border-b border-gray-100 flex justify-between items-center">
                  <h2 className="text-[#FF5D42] font-black text-2xl tracking-tighter uppercase">{t('classroom.teacherNotes')}</h2>
                  <HelpCircle className="w-5 h-5 text-gray-300" />
               </div>

               <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
                  {currentNote ? (
                    <>
                       {/* Task */}
                       <div className="space-y-3">
                          <h3 className="font-black text-gray-900 text-lg">{t('classroom.task')}</h3>
                          <div className="text-gray-600 leading-relaxed space-y-2">
                             {(() => {
                               try {
                                 const q = JSON.parse(currentNote.suggestedQuestions);
                                 return q.map((line: string, i: number) => <p key={i}>{line}</p>);
                               } catch { return <p>{currentNote.suggestedQuestions}</p>; }
                             })()}
                          </div>
                       </div>

                       {/* Before Listening / Tips */}
                       {currentNote.tips && (
                         <div className="space-y-3">
                            <h3 className="font-black text-gray-900 text-lg">{t('classroom.beforeListening')}</h3>
                            <p className="text-gray-600 leading-relaxed italic">{currentNote.tips}</p>
                         </div>
                       )}

                       {/* Answer */}
                       <div className="space-y-3">
                          <h3 className="font-black text-gray-900 text-lg">{t('classroom.answerTitle')}</h3>
                          <div className="text-gray-600 font-medium bg-gray-50 p-4 rounded-2xl border border-gray-100">
                             {(() => {
                               try {
                                 const a = JSON.parse(currentNote.correctAnswers);
                                 return a.join(', ');
                               } catch { return currentNote.correctAnswers; }
                             })()}
                          </div>
                       </div>
                    </>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center opacity-20 py-20 grayscale">
                       <BookOpen className="w-16 h-16 mb-4" />
                       <p className="font-bold text-sm">{t('teacher.noNotes')}</p>
                    </div>
                  )}
               </div>

               {/* Notebook Footer */}
               <div className="p-6 bg-gray-50/50 border-t border-gray-100 space-y-4">
                  <div className="flex items-center justify-between px-2">
                     <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">CEFR {session.lesson.level}</span>
                     <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-4">
                        <span>{t('classroom.totalTime')}: <span className="text-gray-600">{formatTime(totalSeconds)}</span></span>
                        <span>{t('classroom.slideTime')}: <span className="text-gray-600">{formatTime(slideSeconds)}</span></span>
                     </div>
                  </div>

                  <div className="flex items-center justify-center gap-4">
                     <button 
                       onClick={() => setPeekNoteIndex(prev => Math.max(0, prev - 1))}
                       className="w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-white transition-all cursor-pointer disabled:opacity-30"
                       disabled={peekNoteIndex === 0}
                     >
                        <ChevronLeft className="w-5 h-5" />
                     </button>
                     <span className="text-xs font-black text-gray-800 min-w-16 text-center">{peekNoteIndex + 1} / {slides.length}</span>
                     <button 
                       onClick={() => setPeekNoteIndex(prev => Math.min(slides.length - 1, prev + 1))}
                       className="w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-white transition-all cursor-pointer disabled:opacity-30"
                       disabled={peekNoteIndex === slides.length - 1}
                     >
                        <ChevronRight className="w-5 h-5" />
                     </button>
                  </div>
               </div>
            </div>
          </aside>
        )}

        {/* 3. MAIN CONTENT (SLIDE / CANVAS) */}
        <main className="flex-1 flex flex-col relative overflow-hidden bg-gray-50">
           
           {/* Sidebar Toggle for Yellow Note */}
           {role === 'teacher' && (
             <button 
               onClick={() => setShowObservation(true)}
               className="absolute top-8 right-8 z-40 w-14 h-14 rounded-2xl bg-[#FFE66D] shadow-xl flex items-center justify-center text-yellow-800 hover:scale-110 active:scale-95 transition-all cursor-pointer"
               title={t('classroom.addObservation')}
             >
                <StickyNote className="w-7 h-7" />
             </button>
           )}

           <div className="flex-1 flex items-center justify-center p-4">
              <div className="relative w-full h-full max-w-7xl aspect-[4/3] bg-white rounded-2xl shadow-2xl overflow-hidden ring-1 ring-black/5">
                 
                 {/* DRAWING TOOLS OVERLAY (Floating if active) */}
                 {(role === 'teacher' || canAnnotate) && activeTool && (
                   <div className="absolute top-4 left-4 z-[40] bg-white/90 backdrop-blur-md rounded-2xl p-2 shadow-xl border border-gray-200 flex flex-col gap-2">
                      <button onClick={() => setActiveTool('pen')} className={`p-3 rounded-xl transition-all ${activeTool === 'pen' ? 'bg-primary text-white' : 'text-gray-400 hover:bg-gray-100'}`}><Pencil className="w-5 h-5" /></button>
                      <button onClick={() => setActiveTool('text')} className={`p-3 rounded-xl transition-all ${activeTool === 'text' ? 'bg-primary text-white' : 'text-gray-400 hover:bg-gray-100'}`}><FileText className="w-5 h-5" /></button>
                      <button onClick={() => setActiveTool('eraser')} className={`p-3 rounded-xl transition-all ${activeTool === 'eraser' ? 'bg-primary text-white' : 'text-gray-400 hover:bg-gray-100'}`}><Search className="w-5 h-5" /></button>
                      <Separator className="my-1" />
                      <button onClick={handleClearCanvas} className="p-3 rounded-xl text-red-500 hover:bg-red-50"><X className="w-5 h-5" /></button>
                   </div>
                 )}

                 {/* SLIDE IMAGE */}
                 {activeTab === 'canvas' ? (
                   <>
                      {currentSlideData && (
                        <Image
                          src={`${(process.env.NODE_ENV === 'production' ? PROD_URL : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'))}${currentSlideData.imageUrl}`}
                          alt={`Slide ${currentSlide + 1}`}
                          fill
                          priority
                          unoptimized
                          className="object-contain select-none"
                          draggable={false}
                        />
                      )}

                      {/* TEXT OBJECTS */}
                      {textObjects.map(obj => (
                        <textarea
                          key={obj.id}
                          value={obj.text}
                          onChange={(e) => handleTextChange(obj.id, e.target.value, obj.x, obj.y)}
                          onBlur={() => { if (!obj.text.trim()) handleTextDelete(obj.id); }}
                          readOnly={role === 'student' && !canAnnotate}
                          autoFocus
                          className="absolute bg-transparent outline-none border border-dashed border-primary/50 text-foreground text-2xl font-black p-1 w-48 min-h-12 resize-none z-10"
                          style={{ left: `${obj.x}px`, top: `${obj.y}px` }}
                        />
                      ))}

                      {/* CANVAS */}
                      <canvas
                        ref={canvasRef}
                        className={`absolute inset-0 w-full h-full z-20 ${(role === 'teacher' || canAnnotate) && activeTool !== 'text' ? 'cursor-crosshair' : 'pointer-events-none'}`}
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                      />
                      
                      {/* AUDIO WIDGET (IF TEACHER) */}
                      {currentSlideData?.audioUrl && role === 'teacher' && (
                        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50">
                           <audio
                              ref={audioRef}
                              src={`${(process.env.NODE_ENV === 'production' ? PROD_URL : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'))}${currentSlideData.audioUrl}`}
                              controls
                              className="h-10 w-96 rounded-full bg-white/80 backdrop-blur-md shadow-2xl border border-white/20"
                              onPlay={handleAudioPlay}
                              onPause={handleAudioPause}
                              onSeeked={handleAudioSeeked}
                           />
                        </div>
                      )}
                      
                      {/* VIDEO WIDGET (IF STUDENT/TEACHER ATTACHED) */}
                      {currentSlideData?.videoUrl && (
                        <div className="absolute top-4 right-4 z-30 w-64 aspect-video bg-black rounded-xl shadow-2xl overflow-hidden ring-1 ring-white/10">
                           <video
                              ref={videoRef}
                              src={`${(process.env.NODE_ENV === 'production' ? PROD_URL : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'))}${currentSlideData.videoUrl}`}
                              controls={role === 'teacher'}
                              className={`w-full h-full object-cover ${role === 'student' ? 'pointer-events-none' : ''}`}
                              onPlay={handleVideoPlay}
                              onPause={handleVideoPause}
                              onSeeked={handleVideoSeeked}
                              playsInline
                           />
                        </div>
                      )}
                   </>
                 ) : (
                   <div className="w-full h-full bg-white flex flex-col p-12 overflow-y-auto">
                      <h2 className="text-3xl font-black mb-8">{t('classroom.homework')}</h2>
                      <p className="text-gray-500 italic">Homework preview mode active. Students should complete this after class.</p>
                      {/* Homework logic placeholder */}
                   </div>
                 )}
              </div>
           </div>

           {/* 4. BOTTOM NAVIGATION */}
           <footer className="h-20 bg-white border-t border-gray-200 flex items-center justify-center gap-12 shrink-0">
              <div className="flex items-center gap-2">
                 <button 
                   onClick={() => handleChangeSlide(currentSlide - 1)}
                   disabled={currentSlide === 0 || role === 'student'}
                   className="w-14 h-14 rounded-2xl flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-primary transition-all cursor-pointer disabled:opacity-20"
                 >
                    <ChevronLeft className="w-8 h-8" />
                 </button>
                 <button 
                   onClick={() => handleChangeSlide(currentSlide - 1)}
                   disabled={role === 'student'}
                   className="w-14 h-14 rounded-2xl flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-primary transition-all cursor-pointer disabled:opacity-20"
                 >
                    <ChevronsLeft className="w-8 h-8" />
                 </button>
              </div>

              <div className="text-lg font-black text-gray-800 tracking-tighter">
                 {currentSlide + 1} / {slides.length}
              </div>

              <div className="flex items-center gap-2">
                 <button 
                   onClick={() => handleChangeSlide(currentSlide + 1)}
                   disabled={role === 'student'}
                   className="w-14 h-14 rounded-2xl flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-primary transition-all cursor-pointer disabled:opacity-20"
                 >
                    <ChevronsRight className="w-8 h-8" />
                 </button>
                 <button 
                   onClick={() => handleChangeSlide(currentSlide + 1)}
                   disabled={currentSlide >= slides.length - 1 || role === 'student'}
                   className="w-14 h-14 rounded-2xl flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-primary transition-all cursor-pointer disabled:opacity-20"
                 >
                    <ChevronRight className="w-8 h-8" />
                 </button>
              </div>

              {/* Annotation Toggle (Teacher Only) */}
              {role === 'teacher' && (
                <div className="absolute right-8 flex items-center gap-3">
                   <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest">{t('classroom.studentDraws')}</label>
                   <button 
                    onClick={handleToggleAnnotation}
                    className={`w-12 h-6 rounded-full relative transition-colors ${canAnnotate ? 'bg-green-500' : 'bg-gray-200'}`}
                  >
                    <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${canAnnotate ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
              )}
           </footer>
        </main>
      </div>

      {/* MODALS */}
      {showScript && (
         <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-8 animate-in fade-in zoom-in duration-300">
            <Card className="w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden">
               <CardHeader className="p-8 pb-4 flex flex-row items-center justify-between border-b border-gray-100">
                  <CardTitle className="text-2xl font-black text-gray-800 flex items-center gap-3">
                     <FileText className="w-6 h-6 text-primary" /> {t('classroom.audioScript')}
                  </CardTitle>
                  <Button variant="ghost" size="icon" onClick={() => setShowScript(false)} className="rounded-full"><X className="w-5 h-5" /></Button>
               </CardHeader>
               <CardContent className="p-12 text-lg leading-relaxed text-gray-600 font-medium">
                  {session.lesson.listeningScript || "No script available for this lesson."}
               </CardContent>
            </Card>
         </div>
      )}

      {showObservation && (
         <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-8 animate-in fade-in zoom-in duration-300">
            <Card className="w-full max-w-xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border-4 border-[#FFE66D]">
               <CardHeader className="p-8 pb-4 flex flex-row items-center justify-between">
                  <CardTitle className="text-2xl font-black text-gray-800 flex items-center gap-3">
                     <StickyNote className="w-6 h-6 text-yellow-600" /> {t('classroom.addObservation')}
                  </CardTitle>
                  <Button variant="ghost" size="icon" onClick={() => setShowObservation(false)} className="rounded-full"><X className="w-5 h-5" /></Button>
               </CardHeader>
               <CardContent className="p-8 space-y-6">
                  <textarea 
                    value={observationText}
                    onChange={(e) => setObservationText(e.target.value)}
                    placeholder={t('classroom.observationPlaceholder')}
                    className="w-full h-48 bg-gray-50 border-none rounded-2xl p-6 text-lg font-medium outline-none resize-none focus:ring-2 ring-primary/20 transition-all"
                    autoFocus
                  />
                  <div className="flex gap-3">
                     <Button variant="outline" onClick={() => setShowObservation(false)} className="flex-1 h-14 rounded-2xl font-bold">Cancel</Button>
                     <Button onClick={handleSaveObservation} disabled={!observationText.trim()} className="flex-1 h-14 rounded-2xl font-black bg-primary text-white shadow-xl">Post Feedback</Button>
                  </div>
               </CardContent>
            </Card>
         </div>
      )}

      {/* Re-use Teaser Video Overlay from existing logic or refactor here if desired */}
      {showTeaser && session?.lesson?.teaserVideoUrl && (
         <div className="fixed inset-0 z-[300] bg-black/95 backdrop-blur-3xl flex flex-col items-center justify-center p-8 animate-in fade-in duration-700">
            {/* Same Teaser Logic as before, just z-index bumped */}
            <div className="max-w-6xl w-full flex flex-col lg:flex-row gap-8 items-center h-full">
              {/* Video Section */}
              <div className="flex-1 space-y-8 text-center w-full">
                <div className="space-y-2">
                  <h2 className="text-3xl md:text-5xl font-bold text-white tracking-tight">{t('classroom.teaserTitle')}</h2>
                  <p className="text-white/40 text-sm md:text-base uppercase tracking-widest font-bold">{t('classroom.videoIntro')}</p>
                </div>
                
                <div className="relative aspect-video rounded-[3rem] overflow-hidden shadow-[0_0_100px_rgba(255,255,255,0.1)] ring-1 ring-white/20 group">
                   <video 
                      src={`${(process.env.NODE_ENV === 'production' ? PROD_URL : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'))}${session.lesson.teaserVideoUrl}`}
                      className="w-full h-full object-cover"
                      autoPlay
                      onEnded={() => setShowTeaser(false)}
                      onClick={(e) => {
                        const v = e.currentTarget;
                        if (v.paused) v.play(); else v.pause();
                      }}
                   />
                   <div className="absolute inset-x-0 bottom-0 p-8 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-white hover:bg-white/20 rounded-full ml-auto flex"
                        onClick={() => setShowTeaser(false)}
                      >
                         {t('common.skip')} →
                      </Button>
                   </div>
                </div>
              </div>

              {/* Pedagogy Panel (Teacher Only) */}
              {role === 'teacher' && session?.lesson?.lessonVideoNotes && (
                <div className="w-full lg:w-96 bg-white/5 backdrop-blur-2xl rounded-[2.5rem] p-8 border border-white/10 shadow-2xl space-y-6 animate-in slide-in-from-right duration-1000">
                   <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-primary/20 flex items-center justify-center">
                        <MessageSquare className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="text-white font-bold text-lg">{t('admin.teacherNotes')}</h3>
                        <p className="text-[10px] text-primary font-bold uppercase tracking-widest leading-none">{t('admin.lessonTeaser')}</p>
                      </div>
                   </div>
                   
                   <div className="text-base leading-relaxed text-neutral-200 bg-black/40 p-6 rounded-[2rem] border border-white/5 font-medium">
                      {session.lesson.lessonVideoNotes}
                   </div>
                   
                   <div className="pt-4">
                      <Button 
                        onClick={() => setShowTeaser(false)}
                        className="w-full h-16 rounded-3xl bg-white text-black hover:bg-neutral-200 font-bold text-lg shadow-xl hover:scale-[1.02] active:scale-95 transition-all"
                      >
                         {t('teacher.startLesson')}
                      </Button>
                   </div>
                </div>
              )}
           </div>
         </div>
      )}

      {/* Hidden audio element for student context */}
      {currentSlideData?.audioUrl && role === 'student' && (
        <audio
          ref={audioRef}
          src={`${(process.env.NODE_ENV === 'production' ? PROD_URL : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'))}${currentSlideData.audioUrl}`}
        />
      )}
    </div>
  );
}

export default function ClassroomPage() {
  return (
    <Suspense fallback={
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    }>
      <ClassroomContent />
    </Suspense>
  );
}
