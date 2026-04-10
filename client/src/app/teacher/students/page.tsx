"use client";

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth';
import { io, Socket } from 'socket.io-client';
import { Loader2, ChevronLeft, ChevronRight, PenTool, Eraser, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function LiveClassroomPage() {
  const { id: sessionId } = useParams();
  const router = useRouter();
  const { user } = useAuthStore();
  
  const [socket, setSocket] = useState<Socket | null>(null);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('rv2class_token');
    if (!token || !user) {
      router.push('/');
      return;
    }

    // Connect to WebSocket server
    const socketInstance = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000', {
      auth: { token },
      transports: ['websocket'],
    });

    socketInstance.on('connect', () => {
      setIsConnected(true);
      // Logic maps perfectly to your backend server/src/socket/index.ts
      if (user.role === 'TEACHER') {
        socketInstance.emit('create_room', { sessionId });
      } else {
        socketInstance.emit('join_room', { sessionId });
      }
    });

    socketInstance.on('slide_changed', (data: { slideIndex: number }) => {
      setCurrentSlideIndex(data.slideIndex);
    });

    socketInstance.on('sync_state', (data: { currentSlide: number }) => {
      setCurrentSlideIndex(data.currentSlide);
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.emit('leave_room');
      socketInstance.disconnect();
    };
  }, [sessionId, user, router]);

  const nextSlide = () => {
    if (socket && user?.role === 'TEACHER') {
      socket.emit('change_slide', { slideIndex: currentSlideIndex + 1 });
    }
  };

  const prevSlide = () => {
    if (socket && user?.role === 'TEACHER' && currentSlideIndex > 0) {
      socket.emit('change_slide', { slideIndex: currentSlideIndex - 1 });
    }
  };

  if (!isConnected) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-background">
        <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground font-medium">Подключение к классу...</p>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-background overflow-hidden">
      {/* Top Navbar */}
      <header className="h-14 border-b border-secondary flex items-center justify-between px-6 bg-card shrink-0 shadow-sm z-10">
        <div className="flex items-center gap-4">
          <h1 className="font-bold text-primary text-xl tracking-tight">rv2class</h1>
          <span className="text-sm font-medium text-muted-foreground bg-secondary/50 px-3 py-1 rounded-md border border-border">
            Слайд {currentSlideIndex + 1}
          </span>
        </div>
        <Button variant="ghost" className="text-destructive hover:bg-destructive/10" onClick={() => router.push(user?.role === 'TEACHER' ? '/teacher' : '/student')}>
          <LogOut className="w-4 h-4 mr-2" /> Завершить урок
        </Button>
      </header>

      {/* Main Workspace */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* Slide Area (16:9 constraint for Off2Class feel) */}
        <main className="flex-1 bg-secondary/20 flex items-center justify-center p-6 relative">
          <div className="w-full max-w-[1280px] aspect-video bg-white shadow-2xl rounded-xl border border-border relative overflow-hidden flex items-center justify-center">
            <p className="text-muted-foreground text-2xl font-medium">Место для слайда {currentSlideIndex + 1}</p>
            {/* TODO: In the next step, we will layer the <img src={slide.url}> and <canvas id="fabric-canvas"> here */}
          </div>

          {/* Teacher Floating Toolbar */}
          {user?.role === 'TEACHER' && (
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-card border border-border shadow-xl rounded-full px-4 py-2 flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={prevSlide} disabled={currentSlideIndex === 0}><ChevronLeft className="w-6 h-6 text-foreground" /></Button>
              <div className="w-px h-6 bg-border mx-2"></div>
              <Button variant="ghost" size="icon" className="hover:bg-primary/10 text-primary"><PenTool className="w-5 h-5" /></Button>
              <Button variant="ghost" size="icon" className="hover:bg-destructive/10 text-destructive"><Eraser className="w-5 h-5" /></Button>
              <div className="w-px h-6 bg-border mx-2"></div>
              <Button variant="ghost" size="icon" onClick={nextSlide}><ChevronRight className="w-6 h-6 text-foreground" /></Button>
            </div>
          )}
        </main>

        {/* Teacher Notes Sidebar (Hidden from students) */}
        {user?.role === 'TEACHER' && (
          <aside className="w-80 bg-card border-l border-secondary shrink-0 flex flex-col shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.05)]">
            <div className="p-5 border-b border-secondary bg-background/50">
              <h2 className="font-semibold text-foreground text-lg">Заметки для учителя</h2>
            </div>
            <div className="flex-1 p-5 overflow-y-auto space-y-6">
              <div className="p-4 bg-secondary/40 rounded-xl border border-border">
                <p className="font-semibold text-primary mb-2">Вопросы для обсуждения:</p>
                <ul className="list-disc pl-4 text-sm text-muted-foreground space-y-2">
                  <li>What did you do last weekend?</li>
                  <li>Have you ever traveled abroad?</li>
                </ul>
              </div>
              <div className="p-4 bg-accent/5 rounded-xl border border-accent/20">
                <p className="font-semibold text-accent mb-2">Правильные ответы:</p>
                <ol className="list-decimal pl-4 text-sm text-foreground space-y-2">
                  <li>went</li>
                  <li>have seen</li>
                </ol>
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}