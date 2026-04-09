'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import '@/lib/i18n';
import api from '@/lib/api';
import { connectSocket, disconnectSocket } from '@/lib/socket';
import { useAuthStore } from '@/stores/auth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import type { Socket } from 'socket.io-client';

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
  lesson: {
    title: string;
    slides: Slide[];
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
  const [activeTool, setActiveTool] = useState<'pen' | 'text' | 'eraser' | null>('pen');
  const [penColor, setPenColor] = useState('#3b82f6');
  const [isConnected, setIsConnected] = useState(false);
  const [canAnnotate, setCanAnnotate] = useState(false);
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
          // Teacher already has session data from starting the class
          res = await api.get(`/lessons/${sessionId}`);
          // Build session-like structure  
          const sessionRes = await api.get(`/teacher/classroom/active`).catch(() => null);
          if (!sessionRes) {
            // Session data was already set when starting class
          }
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
      toast.info(data.canAnnotate ? 'Учитель разрешил вам рисовать на доске' : 'Вы больше не можете рисовать на доске');
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
      toast.info('Ученик присоединился к уроку');
    });

    socket.on('user_left', (data: { role: string }) => {
      if (data.role === 'STUDENT') {
        toast.info('Ученик покинул урок');
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
  }, [sessionId, user, role, currentSlide]);

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
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0);
      };
      img.src = savedState;
    }
  }, [currentSlide, session]);

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
      toast.success('Урок завершен');
      router.push(`/teacher?assignHw=${sessionId}`);
    } catch {
      toast.error('Ошибка завершения урока');
    }
  };

  const slides = session?.lesson?.slides || [];
  const currentSlideData = slides[currentSlide];
  const currentNote = currentSlideData?.teacherNote;

  const colors = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#000000'];

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Top bar */}
      <div className="h-14 border-b border-border flex items-center justify-between px-4 shrink-0 bg-card">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg gradient-brand flex items-center justify-center">
            <span className="text-xs font-bold text-white">rv</span>
          </div>
          <h1 className="text-sm font-semibold">{session?.lesson?.title || 'Загрузка...'}</h1>
          <Badge variant={isConnected ? 'default' : 'destructive'} className="text-xs">
            {isConnected ? '🟢 Подключено' : '🔴 Нет связи'}
          </Badge>
        </div>

        <div className="flex items-center gap-3">
          {currentSlideData?.audioUrl && (
            <audio
              ref={audioRef}
              src={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}${currentSlideData.audioUrl}`}
              controls={role === 'teacher'}
              className={role === 'student' ? 'hidden' : 'h-8 w-64 max-w-full shadow-sm rounded-full bg-background border border-border/50'}
              onPlay={handleAudioPlay}
              onPause={handleAudioPause}
              onSeeked={handleAudioSeeked}
            />
          )}

          <span className="text-sm text-muted-foreground mr-2">
            {t('classroom.slide')} {currentSlide + 1} {t('classroom.of')} {slides.length}
          </span>
          {role === 'teacher' && (
            <>
              <div className="flex items-center gap-2 mr-2">
                <label className="text-xs font-semibold uppercase text-muted-foreground">Ученик пишет:</label>
                <button 
                  onClick={handleToggleAnnotation}
                  className={`w-10 h-5 rounded-full relative transition-colors ${canAnnotate ? 'bg-green-500' : 'bg-muted'}`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-transform ${canAnnotate ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>
              <Button variant="destructive" size="sm" onClick={handleEndClass} className="cursor-pointer">
                {t('teacher.endClass')}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Slide area */}
        <div className="flex-1 flex flex-col">
          {/* Toolbar (teachers always see it; students see it only if canAnnotate is true) */}
          {(role === 'teacher' || canAnnotate) && (
            <div className="h-12 border-b border-border flex items-center gap-2 px-4 bg-card/50">
              {[
                { tool: 'pen' as const, label: t('classroom.draw'), icon: '✏️' },
                { tool: 'text' as const, label: 'Текст', icon: 'T' },
                { tool: 'eraser' as const, label: t('classroom.erase'), icon: '🧹' },
              ].map(({ tool, label, icon }) => (
              <Button
                key={tool}
                variant={activeTool === tool ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveTool(tool)}
                className="cursor-pointer gap-1"
              >
                {icon} {label}
              </Button>
            ))}

            <Separator orientation="vertical" className="h-6" />

            {/* Color picker */}
            {colors.map((color) => (
              <button
                key={color}
                className={`w-6 h-6 rounded-full border-2 transition-all cursor-pointer ${
                  penColor === color ? 'border-foreground scale-125' : 'border-transparent'
                }`}
                style={{ backgroundColor: color }}
                onClick={() => setPenColor(color)}
              />
            ))}

            <Separator orientation="vertical" className="h-6" />

            <Button variant="ghost" size="sm" onClick={handleClearCanvas} className="cursor-pointer text-destructive">
              🗑️ {t('classroom.clear')}
            </Button>
          </div>
        )}

          {/* Slide + Canvas + Video wrapper */}
          <div className="flex-1 relative bg-muted/30 flex items-center justify-center p-4 gap-4">
            
            {/* 1) Slide / Board Container */}
            <div className={`relative ${currentSlideData?.videoUrl ? 'w-1/2' : 'w-full max-w-4xl'} h-full bg-white rounded-xl shadow-xl overflow-hidden`}>
              
              {/* Slide image */}
              {currentSlideData && (
                <img
                  src={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}${currentSlideData.imageUrl}`}
                  alt={`Slide ${currentSlide + 1}`}
                  className="absolute inset-0 w-full h-full object-contain"
                  draggable={false}
                />
              )}

              {/* Text Objects Overlay */}
              {textObjects.map(obj => (
                <textarea
                  key={obj.id}
                  value={obj.text}
                  onChange={(e) => handleTextChange(obj.id, e.target.value, obj.x, obj.y)}
                  onBlur={() => {
                    if (!obj.text.trim()) handleTextDelete(obj.id);
                  }}
                  readOnly={role === 'student' && !canAnnotate}
                  autoFocus
                  placeholder="Текст..."
                  className="absolute bg-transparent outline-none border border-dashed border-primary/50 text-foreground text-2xl font-medium p-1 w-48 min-h-12 resize-y z-10"
                  style={{
                    left: `${obj.x}px`,
                    top: `${obj.y}px`,
                  }}
                />
              ))}

              {/* Drawing canvas overlay */}
              <canvas
                ref={canvasRef}
                className={`absolute inset-0 w-full h-full z-20 ${(role === 'teacher' || canAnnotate) && activeTool !== 'text' ? 'cursor-crosshair' : 'pointer-events-none'}`}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              />
            </div>
            
            {/* 2) Video Player Container (right half) */}
            {currentSlideData?.videoUrl && (
              <div className="w-1/2 h-full bg-black rounded-xl shadow-xl overflow-hidden flex items-center justify-center relative">
                <video
                  ref={videoRef}
                  src={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}${currentSlideData.videoUrl}`}
                  controls={role === 'teacher'} // Only teacher has controls
                  className={`w-full h-full object-contain ${role === 'student' ? 'pointer-events-none' : ''}`}
                  onPlay={handleVideoPlay}
                  onPause={handleVideoPause}
                  onSeeked={handleVideoSeeked}
                  playsInline
                />
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="h-14 border-t border-border flex items-center justify-center gap-4 px-4 bg-card">
            <Button
              variant="outline"
              onClick={() => handleChangeSlide(currentSlide - 1)}
              disabled={currentSlide === 0 || (role === 'student')}
              className="cursor-pointer"
            >
              ← {t('classroom.previous')}
            </Button>

            {/* Slide thumbnails */}
            <div className="flex gap-1">
              {slides.slice(
                Math.max(0, currentSlide - 3),
                Math.min(slides.length, currentSlide + 4)
              ).map((slide) => (
                <button
                  key={slide.id}
                  className={`w-8 h-8 rounded text-xs font-medium transition-all cursor-pointer ${
                    slide.orderIndex === currentSlide
                      ? 'bg-primary text-primary-foreground shadow-md'
                      : 'bg-muted text-muted-foreground hover:bg-accent'
                  }`}
                  onClick={() => role === 'teacher' && handleChangeSlide(slide.orderIndex)}
                  disabled={role === 'student'}
                >
                  {slide.orderIndex + 1}
                </button>
              ))}
            </div>

            <Button
              variant="outline"
              onClick={() => handleChangeSlide(currentSlide + 1)}
              disabled={currentSlide >= slides.length - 1 || (role === 'student')}
              className="cursor-pointer"
            >
              {t('classroom.next')} →
            </Button>
          </div>
        </div>

        {/* Teacher Notes Panel (only for teacher) */}
        {role === 'teacher' && (
          <div className="w-80 border-l border-border bg-card overflow-y-auto shrink-0">
            <div className="p-4">
              <h2 className="font-semibold text-sm flex items-center gap-2 mb-3">
                📋 {t('teacher.notes')}
              </h2>

              {currentNote ? (
                <div className="space-y-4">
                  {/* Questions to ask */}
                  <div>
                    <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                      {t('teacher.questions')}
                    </h3>
                    <div className="space-y-1.5">
                      {(() => {
                        try {
                          const questions = JSON.parse(currentNote.suggestedQuestions);
                          return questions.map((q: string, i: number) => (
                            <div key={i} className="text-sm p-2 rounded bg-primary/5 border border-primary/10">
                              {q}
                            </div>
                          ));
                        } catch {
                          return <p className="text-sm">{currentNote.suggestedQuestions}</p>;
                        }
                      })()}
                    </div>
                  </div>

                  <Separator />

                  {/* Correct answers */}
                  <div>
                    <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                      {t('teacher.answers')}
                    </h3>
                    <div className="space-y-1.5">
                      {(() => {
                        try {
                          const answers = JSON.parse(currentNote.correctAnswers);
                          return answers.map((a: string, i: number) => (
                            <div key={i} className="text-sm p-2 rounded bg-green-50 border border-green-100 text-green-800">
                              ✅ {a}
                            </div>
                          ));
                        } catch {
                          return <p className="text-sm">{currentNote.correctAnswers}</p>;
                        }
                      })()}
                    </div>
                  </div>

                  {currentNote.tips && (
                    <>
                      <Separator />
                      <div>
                        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                          💡 Советы
                        </h3>
                        <p className="text-sm text-muted-foreground">{currentNote.tips}</p>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Нет заметок для этого слайда
                </p>
              )}
            </div>
          </div>
        )}
      </div>
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
