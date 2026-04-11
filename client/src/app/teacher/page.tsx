"use client";

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '@/lib/api';
import { Loader2, Play, Users, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

interface Lesson {
  id: string;
  title: string;
  level: string;
  orderIndex: number;
  _count: {
    slides: number;
    homework: number;
  };
}

interface Course {
  id: string;
  title: string;
  description: string | null;
  color: string | null;
  lessons: Lesson[];
}

function getContrastColor(hexColor: string) {
  const hex = hexColor.replace('#', '');
  if (hex.length === 3) {
    const r = parseInt(hex[0] + hex[0], 16);
    const g = parseInt(hex[1] + hex[1], 16);
    const b = parseInt(hex[2] + hex[2], 16);
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    return yiq >= 128 ? '#000000' : '#ffffff';
  }
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 128 ? '#000000' : '#ffffff';
}

export default function TeacherLibraryPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCourse, setExpandedCourse] = useState<string | null>(null);
  const [lessonToStart, setLessonToStart] = useState<Lesson | null>(null);
  
  const [students, setStudents] = useState<any[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [startingClass, setStartingClass] = useState(false);

  useEffect(() => {
    const fetchLibrary = async () => {
      try {
        const res = await api.get('/teacher/library');
        setCourses(res.data);
      } catch (error) {
        console.error('Library fetch error', error);
        toast.error(t('teacher.errorLoadLibrary', 'Ошибка загрузки библиотеки'));
      } finally {
        setLoading(false);
      }
    };
    
    // Also fetch students for the assignment dropdown
    const fetchStudents = async () => {
      try {
        const studentsRes = await api.get('/teacher/students');
        setStudents(studentsRes.data);
      } catch (err) {
        console.error(err);
      }
    };

    fetchLibrary();
    fetchStudents();
  }, [t]);

  const handleStartClass = async (isPreview = false) => {
    if (!lessonToStart) return;
    
    if (!isPreview && !selectedStudentId) {
      toast.error(t('teacher.selectStudentWarning', 'Пожалуйста, выберите ученика!'));
      return;
    }
    
    setStartingClass(true);
    try {
      if (!isPreview) {
        // 1. Assign homework to the student
        await api.post('/teacher/assign-homework', {
          lessonId: lessonToStart.id,
          studentIds: [selectedStudentId]
        });
      }

      // 2. Open live classroom session
      await api.post('/teacher/classroom/start', { lessonId: lessonToStart.id });

      toast.success(t('teacher.classStarting', 'Занятие создано, переходим в класс...'));
      router.push(`/classroom?session=active&role=teacher${isPreview ? '&preview=true' : ''}`);
    } catch (err) {
      console.error(err);
      toast.error(t('teacher.classStartError', 'Не удалось запустить урок'));
      setStartingClass(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto pb-20 px-4 sm:px-6">
      <div className="flex flex-col md:flex-row justify-between md:items-end gap-6 mb-12 border-b border-border pb-8">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-foreground">{t('teacher.libraryTitle', 'Библиотека Курсов')}</h1>
          <p className="text-muted-foreground mt-2 text-lg">{t('teacher.libraryDesc', 'Выбирайте курс, раскрывайте уроки и начинайте обучение.')}</p>
        </div>
        <Button variant="outline" size="lg" onClick={() => router.push('/teacher/students')} className="cursor-pointer group shadow-sm bg-card hover:bg-accent rounded-xl">
          <Users className="w-5 h-5 mr-2 text-primary group-hover:scale-110 transition-transform" />
          {t('navigation.students', 'Ученики')}
        </Button>
      </div>

      {courses.length === 0 ? (
        <div className="text-center py-20 bg-card/50 rounded-3xl border border-dashed border-border shadow-inner">
          <p className="text-muted-foreground text-lg italic">{t('teacher.noCourses', 'В библиотеке пока нет доступных курсов.')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-10">
          {courses.map((course) => {
            const isExpanded = expandedCourse === course.id;
            const tileColor = course.color || '#3b82f6';
            const contrastTextColor = getContrastColor(tileColor);

            return (
              <div 
                key={course.id} 
                className={`flex flex-col rounded-[2.5rem] overflow-hidden shadow-xl transition-all duration-500 border border-border/50 group h-fit
                  ${isExpanded ? 'md:col-span-2 scale-[1.01] ring-8 ring-primary/5' : 'hover:scale-[1.02] hover:shadow-2xl'}
                `}
                style={{ backgroundColor: isExpanded ? 'hsl(var(--card))' : tileColor }}
              >
                {/* Course Card Header (The "Tail") */}
                <div 
                  className={`p-8 cursor-pointer flex flex-col justify-between relative min-h-[220px] transition-colors duration-500`}
                  style={{ background: isExpanded ? `linear-gradient(135deg, ${tileColor}, ${tileColor}dd)` : tileColor }}
                  onClick={() => setExpandedCourse(isExpanded ? null : course.id)}
                >
                  <div className="absolute inset-0 opacity-10 pointer-events-none" 
                    style={{ backgroundImage: `radial-gradient(circle at 2px 2px, ${contrastTextColor} 1px, transparent 0)`, backgroundSize: '24px 24px' }} 
                  />
                  
                  <div className="relative z-10 flex justify-between items-start">
                    <div className="flex-1">
                      <div className="inline-flex items-center gap-2 mb-4">
                         <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-white/20 backdrop-blur-md" style={{ color: contrastTextColor }}>
                           COURSE
                         </span>
                         <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-white/20 backdrop-blur-md" style={{ color: contrastTextColor }}>
                           {course.lessons.length} {t('teacher.lessonsCount', 'Lessons')}
                         </span>
                      </div>
                      <h2 className="text-3xl font-black leading-tight mb-3" style={{ color: contrastTextColor }}>{course.title}</h2>
                      {course.description && (
                        <p className="opacity-80 font-medium text-sm line-clamp-2 max-w-sm" style={{ color: contrastTextColor }}>
                          {course.description}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center transition-transform group-hover:rotate-12" style={{ color: contrastTextColor }}>
                      {isExpanded ? <ChevronUp className="w-6 h-6" /> : <ChevronDown className="w-6 h-6" />}
                    </div>
                  </div>
                  
                  {!isExpanded && (
                    <div className="relative z-10 mt-8 flex items-center gap-2">
                       <div className="flex -space-x-2">
                          {[1,2,3].map(i => (
                            <div key={i} className="w-8 h-8 rounded-full border-2 border-white/20 bg-white/10 flex items-center justify-center backdrop-blur-sm" style={{ borderColor: `${contrastTextColor}44`, backgroundColor: `${contrastTextColor}22` }}>
                              <span className="text-[10px] font-bold" style={{ color: contrastTextColor }}>L{i}</span>
                            </div>
                          ))}
                       </div>
                       <span className="ml-2 text-xs font-bold" style={{ color: contrastTextColor }}>+ {Math.max(0, course.lessons.length - 3)} {t('teacher.more', 'more')}</span>
                    </div>
                  )}
                </div>

                {/* Lessons Dropdown */}
                {isExpanded && (
                  <div className="bg-card p-6 md:p-8 animate-in slide-in-from-top-4 duration-500">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                      {course.lessons.length === 0 ? (
                        <div className="col-span-full py-12 text-center text-muted-foreground border-2 border-dashed border-secondary rounded-2xl">
                          {t('teacher.noLessonsInCourse', 'В этом курсе пока нет уроков')}
                        </div>
                      ) : (
                        course.lessons.map((lesson) => (
                          <div 
                            key={lesson.id} 
                            className="bg-secondary/20 hover:bg-secondary/40 border border-secondary/50 rounded-2xl p-6 flex flex-col justify-between transition-all hover:translate-y-[-4px] hover:shadow-lg group/lesson"
                          >
                            <div className="mb-4">
                              <div className="flex justify-between items-start mb-4">
                                <span className="px-2 py-1 rounded-lg bg-primary/10 text-primary text-[10px] font-black border border-primary/20">
                                  {lesson.level || 'B1'}
                                </span>
                                <span className="text-[10px] font-bold text-muted-foreground uppercase opacity-60">#{lesson.orderIndex}</span>
                              </div>
                              <h3 className="font-bold text-lg text-foreground line-clamp-2 leading-tight group-hover/lesson:text-primary transition-colors">
                                {lesson.title}
                              </h3>
                            </div>

                            <div className="space-y-4">
                              <div className="flex gap-4 text-xs font-bold text-muted-foreground">
                                <div className="flex items-center gap-1.5">
                                  <Users className="w-3.5 h-3.5" />
                                  {lesson._count.slides}
                                </div>
                                <div className="flex items-center gap-1.5">
                                  📝 {lesson._count.homework}
                                </div>
                              </div>
                              <Button 
                                className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-bold shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all cursor-pointer" 
                                onClick={() => setLessonToStart(lesson)}
                              >
                                <Play className="w-4 h-4 mr-2" /> {t('teacher.start', 'START')}
                              </Button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Start Lesson Dialog - Who are you teaching today? */}
      <Dialog open={!!lessonToStart} onOpenChange={(open) => !open && setLessonToStart(null)}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden border-none rounded-xl shadow-2xl bg-white">
          <div className="p-8 text-center space-y-8">
            <h2 className="text-xl font-bold text-slate-800 tracking-tight">
              {t('teacher.teachingToday', 'Who are you teaching today?')}
            </h2>
            
            <div className="flex items-center justify-center gap-0 w-full max-w-sm mx-auto">
               <div className="relative flex-1">
                 <select
                  className="w-full appearance-none border-t border-b border-l border-slate-200 rounded-l-md h-12 px-4 bg-white text-sm font-medium focus:ring-0 focus:outline-none cursor-pointer"
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                >
                  <option value="" disabled>{t('teacher.selectStudentDropdown', '-- Select Student --')}</option>
                  {students.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
               </div>
               <Button 
                onClick={() => handleStartClass(false)}
                disabled={startingClass || !selectedStudentId}
                className="bg-[#FF7F22] hover:bg-[#E66D1B] text-white font-bold h-12 px-6 rounded-r-md rounded-l-none transition-colors shrink-0"
               >
                 {startingClass ? <Loader2 className="w-4 h-4 animate-spin" /> : t('teacher.enroll', 'Enroll')}
               </Button>
            </div>

            <div className="relative">
               <div className="absolute inset-0 flex items-center">
                 <div className="w-full border-t border-slate-100"></div>
               </div>
               <div className="relative text-[10px] font-black uppercase tracking-widest text-slate-400 bg-white px-4 inline-block">
                 OR
               </div>
            </div>

            <div className="flex justify-center pb-4">
              <Button 
                onClick={() => handleStartClass(true)}
                disabled={startingClass}
                className="bg-[#56B456] hover:bg-[#4AA04A] text-white font-bold h-12 px-10 rounded-md transition-colors shadow-lg shadow-green-100"
              >
                {startingClass && !selectedStudentId ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {t('teacher.justBrowsing', "I'm just browsing")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}