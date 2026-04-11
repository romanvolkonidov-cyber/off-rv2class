"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { 
  RadioTower, 
  BookOpen, 
  Loader2, 
  CheckCircle, 
  MessageSquare, 
  StickyNote, 
  History, 
  Smile, 
  ChevronRight,
  ClipboardCheck,
  Layout
} from 'lucide-react';
import api from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';

interface ActiveSession {
  id: string;
  lesson: { title: string };
  teacher: { name: string };
}

interface Homework {
  id: string;
  assignedAt: string;
  lesson: { id: string; title: string; level?: string };
  score: number | null;
}

interface PastSession {
  id: string;
  endedAt: string;
  lesson: { title: string };
  teacher: { name: string };
  observations: { content: string; createdAt: string }[];
}

export default function StudentPortal() {
  const { t } = useTranslation();
  const router = useRouter();
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [homeworks, setHomeworks] = useState<Homework[]>([]);
  const [pastSessions, setPastSessions] = useState<PastSession[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const res = await api.get('/student/dashboard');
      setHomeworks(res.data.assignments || []);
      setPastSessions(res.data.pastSessions || []);
      setActiveSession(res.data.activeSession);
    } catch (error) {
      console.error("Failed to fetch student data", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const checkActiveSession = async () => {
      try {
        const sessionRes = await api.get('/student/classroom/active');
        setActiveSession(sessionRes.data);
      } catch (error) {
        setActiveSession(null);
      }
    };

    const interval = setInterval(checkActiveSession, 5000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return <div className="flex h-screen items-center justify-center bg-[#F8FAFC]"><Loader2 className="animate-spin w-10 h-10 text-primary/50" /></div>;
  }

  return (
    <div className="min-h-screen bg-[#FDFCFB] pb-20">
      
      {/* 1. STATUS BANNER (Light gray thin banner as in screenshot) */}
      <div className="bg-[#D1E7DD] text-[#0F5132] px-6 py-2 text-xs font-medium border-b border-[#BADBCC]">
         {t('common.role.student')} login
      </div>

      <div className="max-w-7xl mx-auto px-6 py-10 space-y-8">
        
        {/* 2. TOP CARDS (Active Session / Welcome) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
           <Card className="lg:col-span-2 border-none shadow-sm rounded-xl overflow-hidden bg-white">
              <CardContent className="p-8 flex flex-col md:flex-row items-center gap-8">
                 <div className="w-full md:w-64">
                    {activeSession ? (
                      <Button 
                        onClick={() => router.push(`/classroom/${activeSession.id}`)}
                        className="w-full h-14 bg-primary text-white font-bold rounded-xl shadow-lg hover:scale-[1.02] active:scale-95 transition-all"
                      >
                         {t('student.joinClass')}
                      </Button>
                    ) : (
                      <div className="w-full h-14 bg-[#F2F2F2] flex items-center justify-center text-[#999999] font-medium rounded-xl border border-[#E5E5E5] text-sm text-center">
                         {t('student.noActiveLesson')}
                      </div>
                    )}
                 </div>
                 <div className="flex-1 text-center md:text-left">
                    <p className="text-[#6C757D] font-medium text-lg leading-relaxed">
                       {activeSession 
                        ? `${activeSession.teacher.name} is inviting you to ${activeSession.lesson.title}`
                        : t('student.catchUpMsg')}
                    </p>
                 </div>
              </CardContent>
           </Card>

           <Card className="border-none shadow-sm rounded-xl overflow-hidden bg-white group hover:shadow-md transition-all">
              <CardContent className="p-8 flex items-center gap-6">
                 <div className="w-16 h-16 rounded-2xl bg-[#E7F5FF] flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Smile className="w-10 h-10 text-[#339AF0]" />
                 </div>
                 <div className="space-y-1">
                    <p className="text-[#212529] font-black text-sm">
                       {t('student.welcomeBack')}
                    </p>
                    <p className="text-[#6C757D] text-xs font-medium italic opacity-70 leading-tight">
                       {t('student.reviewTips')}
                    </p>
                 </div>
              </CardContent>
           </Card>
        </div>

        {/* 3. TABS NAVIGATION */}
        <Tabs defaultValue="todo" className="space-y-0">
           <div className="bg-white rounded-t-xl border-x border-t border-[#E5E5E5] px-1">
              <TabsList className="bg-transparent h-14 w-full justify-start gap-12 px-8">
                 {(['todo', 'completed', 'slides'] as const).map(tab => (
                    <TabsTrigger 
                      key={tab}
                      value={tab} 
                      className="bg-transparent h-full px-0 rounded-none border-b-4 border-transparent data-[state=active]:border-[#0F5132] data-[state=active]:bg-transparent shadow-none text-[#6C757D] data-[state=active]:text-[#212529] font-medium text-base transition-all"
                    >
                      {t(`student.${tab === 'todo' ? 'todo' : tab === 'completed' ? 'completedWork' : 'lessonSlides'}`)}
                    </TabsTrigger>
                 ))}
              </TabsList>
           </div>

           <div className="bg-white border border-[#E5E5E5] rounded-b-xl shadow-sm min-h-[600px]">
              
              {/* --- TO DO TAB --- */}
              <TabsContent value="todo" className="m-0 p-12 outline-none animate-in fade-in duration-300">
                 <div className="max-w-3xl mx-auto space-y-12">
                    <div className="space-y-6">
                       <h3 className="text-4xl font-normal text-[#6C757D] text-center tracking-tight">Unit Checks</h3>
                       <div className="bg-[#F8F9FA] border border-[#E9ECEF] rounded-xl p-6 flex items-center justify-center gap-3 text-[#6C757D]">
                          <span className="text-xl">✨</span>
                          <span className="text-sm font-bold uppercase tracking-widest opacity-60">All indicators are green</span>
                       </div>
                    </div>

                    <div className="space-y-6">
                       <h3 className="text-4xl font-normal text-[#6C757D] text-center tracking-tight">Homework</h3>
                       <div className="space-y-4">
                          {homeworks.filter(h => h.score === null).length > 0 ? (
                             homeworks.filter(h => h.score === null).map(hw => (
                               <div key={hw.id} className="group flex items-center justify-between p-6 bg-white border border-[#E9ECEF] rounded-2xl hover:border-primary/50 hover:shadow-md transition-all">
                                  <div className="flex items-center gap-6">
                                     <div className="w-12 h-12 bg-[#F8F9FA] rounded-full flex items-center justify-center text-primary/40 group-hover:text-primary transition-colors">
                                        <BookOpen className="w-6 h-6" />
                                     </div>
                                     <div>
                                        <h4 className="font-bold text-gray-800 text-lg">{hw.lesson.title}</h4>
                                        <p className="text-xs font-medium text-gray-400 uppercase tracking-widest">{hw.lesson.level || 'B1'}</p>
                                     </div>
                                  </div>
                                  <Button 
                                    onClick={() => router.push(`/student/homework/${hw.id}`)}
                                    variant="ghost" 
                                    className="group-hover:bg-primary group-hover:text-white rounded-full w-12 h-12 p-0 flex items-center justify-center transition-all"
                                  >
                                     <ChevronRight className="w-6 h-6" />
                                  </Button>
                               </div>
                             ))
                          ) : (
                             <div className="bg-[#F8F9FA] border border-[#E9ECEF] rounded-3xl p-16 flex flex-col items-center gap-6 text-[#6C757D] text-center">
                                <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-sm text-4xl">
                                   🌈
                                </div>
                                <div className="space-y-2">
                                   <h4 className="text-xl font-bold text-gray-800">{t('student.noWorkMsg')}</h4>
                                   <p className="text-sm font-medium opacity-60 max-w-xs mx-auto">{t('student.catchUpMsg')}</p>
                                </div>
                             </div>
                          )}
                       </div>
                    </div>
                 </div>
              </TabsContent>

              {/* --- COMPLETED WORK TAB --- */}
              <TabsContent value="completed" className="m-0 p-12 outline-none animate-in fade-in duration-300">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Scored HW */}
                    <div className="space-y-6">
                       <h3 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><CheckCircle className="w-6 h-6 text-green-500" /> Completed Homework</h3>
                       <div className="space-y-4">
                          {homeworks.filter(h => h.score !== null).map(hw => (
                             <div key={hw.id} className="p-6 bg-white border border-[#E9ECEF] rounded-2xl flex items-center justify-between">
                                <div>
                                   <h4 className="font-bold text-gray-800">{hw.lesson.title}</h4>
                                   <p className="text-sm font-bold text-green-600">{hw.score}%</p>
                                </div>
                                <Button size="sm" variant="outline" onClick={() => router.push(`/student/homework/${hw.id}`)}>Review</Button>
                             </div>
                          ))}
                       </div>
                    </div>

                    {/* Observations */}
                    <div className="space-y-6">
                       <h3 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><StickyNote className="w-6 h-6 text-yellow-500" /> Teacher Notes</h3>
                       <div className="space-y-4">
                          {pastSessions.flatMap(s => s.observations.map(obs => ({ ...obs, lessonTitle: s.lesson.title }))).map((obs, idx) => (
                             <div key={idx} className="p-6 bg-[#FFE66D]/10 border-l-4 border-[#FFE66D] rounded-xl space-y-2">
                                <p className="text-sm font-bold text-yellow-800 opacity-60 uppercase tracking-tighter">{obs.lessonTitle}</p>
                                <p className="text-gray-700 italic">&quot;{obs.content}&quot;</p>
                             </div>
                          ))}
                       </div>
                    </div>
                 </div>
              </TabsContent>

              {/* --- LESSON SLIDES TAB --- */}
              <TabsContent value="slides" className="m-0 p-12 outline-none animate-in fade-in duration-300">
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {pastSessions.map(session => (
                       <Card key={session.id} className="border border-[#E9ECEF] shadow-sm rounded-2xl overflow-hidden hover:shadow-md transition-all group">
                          <div className="h-32 bg-gray-50 flex items-center justify-center text-gray-200 group-hover:bg-primary/5 transition-colors">
                             <Layout className="w-12 h-12" />
                          </div>
                          <CardContent className="p-6 space-y-4">
                             <div>
                                <h4 className="font-black text-gray-800 line-clamp-1">{session.lesson.title}</h4>
                                <p className="text-xs font-bold text-gray-400 mt-1">{new Date(session.endedAt).toLocaleDateString()}</p>
                             </div>
                             <Button 
                               onClick={() => router.push(`/student/review/${session.id}`)}
                               className="w-full h-12 rounded-xl border border-[#E9ECEF] bg-white text-gray-700 hover:bg-primary hover:text-white hover:border-primary font-bold shadow-none transition-all"
                             >
                                {t('student.lessonSlides')}
                             </Button>
                          </CardContent>
                       </Card>
                    ))}
                    {pastSessions.length === 0 && (
                       <div className="col-span-full py-20 text-center opacity-20">
                          <History className="w-16 h-16 mx-auto mb-4" />
                          <p className="font-bold">{t('teacher.noHistory')}</p>
                       </div>
                    )}
                 </div>
              </TabsContent>
           </div>
        </Tabs>
      </div>
    </div>
  );
}
