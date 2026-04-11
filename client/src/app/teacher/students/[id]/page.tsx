"use client";

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import api from '@/lib/api';
import { 
  Loader2, 
  ArrowLeft, 
  History, 
  BookOpen, 
  Settings, 
  CheckCircle, 
  XCircle, 
  FileImage, 
  KeyRound, 
  Upload,
  ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Label } from '@/components/ui/label';

interface HomeworkResponse {
  id: string;
  studentAnswer: string;
  isCorrect: boolean;
  homework: {
    questionText: string;
    exerciseType: string;
    correctAnswer: string | null;
  };
}

interface HomeworkAssignment {
  id: string;
  assignedAt: string;
  submittedAt: string | null;
  score: number | null;
  gradeOverride: number | null;
  teacherComment: string | null;
  lesson: { title: string, level: string };
  responses: HomeworkResponse[];
}

interface AttendedSession {
  id: string;
  startedAt: string;
  endedAt: string | null;
  lesson: { title: string, level: string };
}

interface StudentDetails {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  createdAt: string;
  attendedSessions: AttendedSession[];
  homeworkAssignments: HomeworkAssignment[];
}

export default function StudentProfilePage() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [student, setStudent] = useState<StudentDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'history' | 'homework' | 'settings'>('history');

  // Grading states
  const [gradingAssignment, setGradingAssignment] = useState<string | null>(null);
  const [gradeOverride, setGradeOverride] = useState<number | ''>('');
  const [teacherComment, setTeacherComment] = useState('');
  
  // Settings states
  const [newPassword, setNewPassword] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchStudent = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get(`/teacher/students/${id}/details`);
      setStudent(res.data);
    } catch (error) {
      console.error(error);
      toast.error(t('teacher.studentLoadError', 'Ошибка загрузки профиля ученика'));
      router.push('/teacher/students');
    } finally {
      setLoading(false);
    }
  }, [id, t, router]);

  useEffect(() => {
    fetchStudent();
  }, [fetchStudent]);

  const handleSaveGrade = async (assignmentId: string) => {
    try {
      await api.put(`/teacher/gradebook/${assignmentId}`, {
        gradeOverride: gradeOverride !== '' ? Number(gradeOverride) : null,
        teacherComment
      });
      toast.success(t('teacher.gradeSaved', 'Оценка сохранена'));
      setGradingAssignment(null);
      fetchStudent(); // Refresh data
    } catch (error) {
      toast.error(t('teacher.gradeSaveError', 'Ошибка сохранения оценки'));
    }
  };

  const handleUpdatePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast.error(t('auth.passwordTooShort', 'Пароль должен быть не менее 6 символов'));
      return;
    }
    
    setSavingSettings(true);
    try {
      await api.put(`/teacher/students/${id}/settings`, { password: newPassword });
      toast.success(t('common.saved', 'Пароль успешно обновлен'));
      setNewPassword('');
    } catch (error) {
      toast.error(t('common.error', 'Ошибка обновления настроек'));
    } finally {
      setSavingSettings(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('avatar', file);

    try {
      setSavingSettings(true);
      toast.info(t('common.loading', 'Загрузка...'));
      await api.post(`/teacher/students/${id}/photo`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success(t('common.saved', 'Фото успешно обновлено'));
      fetchStudent();
    } catch (err) {
      toast.error(t('common.error', 'Ошибка загрузки фото'));
    } finally {
      setSavingSettings(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (loading || !student) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
      </div>
    );
  }

  const initials = student.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="max-w-6xl mx-auto pb-24 px-4 sm:px-6">
      {/* Premium Header */}
      <div className="flex flex-col md:flex-row items-center gap-8 mb-12 border-b border-border pb-10">
        <div className="relative group">
           <Avatar className="w-28 h-28 border-4 border-card shadow-2xl transition-transform duration-500 group-hover:scale-105">
            <AvatarImage src={student.avatarUrl ? `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}${student.avatarUrl}` : undefined} className="object-cover" />
            <AvatarFallback className="bg-gradient-to-tr from-primary to-primary/60 text-white text-3xl font-black">{initials}</AvatarFallback>
          </Avatar>
          <Button 
            variant="secondary" 
            size="icon" 
            onClick={() => fileInputRef.current?.click()}
            className="absolute bottom-0 right-0 rounded-2xl shadow-lg border border-border/50 cursor-pointer"
          >
            <Upload className="w-4 h-4" />
          </Button>
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="image/*" 
            onChange={handlePhotoUpload}
          />
        </div>

        <div className="flex-1 text-center md:text-left">
          <div className="flex flex-col md:flex-row md:items-center gap-4 mb-2">
            <h1 className="text-4xl font-black text-foreground">{student.name}</h1>
            <div className="flex items-center justify-center gap-2">
               <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-black uppercase tracking-widest border border-primary/20">
                STUDENT
               </span>
               <span className="px-3 py-1 rounded-full bg-secondary text-muted-foreground text-[10px] font-bold">
                ID: {student.id.slice(0, 8)}
               </span>
            </div>
          </div>
          <p className="text-muted-foreground text-lg mb-4 font-medium">{student.email}</p>
          <p className="text-xs font-bold text-muted-foreground/60 uppercase tracking-tighter">
            {t('teacher.memberSince', 'MEMBER SINCE')} {new Date(student.createdAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" size="lg" onClick={() => router.push('/teacher/students')} className="rounded-2xl font-bold bg-card shadow-sm cursor-pointer hover:bg-accent">
            <ArrowLeft className="w-4 h-4 mr-2" /> {t('common.back', 'Back')}
          </Button>
          <Button variant="secondary" size="lg" onClick={() => setActiveTab('settings')} className="rounded-2xl font-bold bg-secondary/50 cursor-pointer hover:bg-secondary">
            <Settings className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-secondary/20 p-2 rounded-[2rem] border border-border/50 w-full mb-12 max-w-sm mx-auto shadow-inner overflow-x-auto">
        {(['activity', 'settings'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as any)}
            className={`flex-1 flex items-center justify-center gap-2 px-6 py-4 rounded-[1.5rem] text-sm font-black transition-all duration-300 uppercase tracking-widest
              ${(activeTab === 'history' || activeTab === 'homework' ? 'activity' : activeTab) === tab 
                ? 'bg-card text-primary shadow-xl shadow-primary/5 scale-[1.02]' 
                : 'text-muted-foreground hover:text-foreground'}`}
          >
            {tab === 'activity' && <History className="w-4 h-4" />}
            {tab === 'settings' && <Settings className="w-4 h-4" />}
            {t(`teacher.${tab}`, tab.charAt(0).toUpperCase() + tab.slice(1))}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* ACTIVITY TABLE TAB */}
        {(activeTab === 'history' || activeTab === 'homework') && (
          <div className="space-y-8">
            <div className="flex justify-between items-center px-4">
               <h2 className="text-2xl font-black tracking-tight">{t('teacher.activityHistory', 'Student Activity & Progress')}</h2>
               <div className="flex items-center gap-4">
                 <div className="text-xs font-black uppercase text-muted-foreground bg-secondary/30 px-3 py-1 rounded-full border border-border/50">
                    {student.attendedSessions.length} {t('teacher.pastSessions', 'Sessions')}
                 </div>
                 <div className="text-xs font-black uppercase text-muted-foreground bg-secondary/30 px-3 py-1 rounded-full border border-border/50">
                    {student.homeworkAssignments.length} {t('teacher.activityHomework', 'Homeworks')}
                 </div>
               </div>
            </div>

            <div className="bg-white border border-gray-100 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.03)] overflow-hidden">
               <table className="w-full text-left border-collapse">
                  <thead>
                     <tr className="bg-gray-50/50 border-b border-gray-100">
                        <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">{t('teacher.activityDate', 'Date')}</th>
                        <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">{t('teacher.activityLesson', 'Lesson')}</th>
                        <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">{t('teacher.activityStatus', 'Status')}</th>
                        <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">{t('teacher.activityScore', 'Score')}</th>
                        <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Actions</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                     {student.attendedSessions.length === 0 && student.homeworkAssignments.length === 0 ? (
                        <tr>
                           <td colSpan={5} className="px-8 py-32 text-center italic text-muted-foreground opacity-60">
                              <div className="text-4xl mb-4">🏜️</div>
                              {t('teacher.noHistory', 'No activity found yet.')}
                           </td>
                        </tr>
                     ) : (
                        student.attendedSessions.map((session) => {
                           // Find corresponding homework for this lesson
                           const hw = student.homeworkAssignments.find(a => a.lesson.title === session.lesson?.title);
                           
                           return (
                              <React.Fragment key={session.id}>
                                <tr className="hover:bg-gray-50 transition-colors group">
                                   <td className="px-8 py-6">
                                      <div className="text-sm font-bold text-slate-600">{new Date(session.startedAt).toLocaleDateString()}</div>
                                      <div className="text-[10px] font-bold text-slate-400 uppercase">{new Date(session.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                   </td>
                                   <td className="px-8 py-6">
                                      <div className="flex items-center gap-3">
                                         <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                                            <BookOpen className="w-5 h-5" />
                                         </div>
                                         <div>
                                            <div className="text-sm font-black text-slate-800">{session.lesson?.title}</div>
                                            <span className="text-[10px] font-black text-primary uppercase bg-primary/5 px-2 py-0.5 rounded border border-primary/10">
                                               {session.lesson?.level}
                                            </span>
                                         </div>
                                      </div>
                                   </td>
                                   <td className="px-8 py-6">
                                      <div className="flex flex-col gap-1.5">
                                         <div className="flex items-center gap-2">
                                            <div className={`w-1.5 h-1.5 rounded-full ${session.endedAt ? 'bg-green-500' : 'bg-orange-500 animate-pulse'}`} />
                                            <span className="text-[10px] font-black uppercase tracking-tight text-slate-500">
                                               {session.endedAt ? 'Lesson Finished' : 'Class Ongoing'}
                                            </span>
                                         </div>
                                         {hw && (
                                            <div className="flex items-center gap-2">
                                               <div className={`w-1.5 h-1.5 rounded-full ${hw.submittedAt ? 'bg-blue-500' : 'bg-slate-300'}`} />
                                               <span className="text-[10px] font-black uppercase tracking-tight text-slate-400">
                                                  Homework: {hw.submittedAt ? 'Submitted' : 'Pending'}
                                               </span>
                                            </div>
                                         )}
                                      </div>
                                   </td>
                                   <td className="px-8 py-6 text-center">
                                      {hw && (hw.score !== null || hw.gradeOverride !== null) ? (
                                         <div className="inline-flex flex-col items-center justify-center min-w-[60px] p-2 bg-primary/5 rounded-xl border border-primary/10">
                                            <span className="text-lg font-black text-primary leading-none">
                                               {hw.gradeOverride !== null ? hw.gradeOverride : hw.score}
                                            </span>
                                            <span className="text-[8px] font-black text-primary/60 mt-0.5 uppercase">PERCENT</span>
                                         </div>
                                      ) : (
                                         <span className="text-sm font-black text-slate-300">—</span>
                                      )}
                                   </td>
                                   <td className="px-8 py-6 text-right">
                                      {hw ? (
                                         <Button 
                                            size="sm"
                                            onClick={() => {
                                              setGradingAssignment(gradingAssignment === hw.id ? null : hw.id);
                                              setGradeOverride(hw.gradeOverride !== null ? hw.gradeOverride : (hw.score !== null ? hw.score : ''));
                                              setTeacherComment(hw.teacherComment || '');
                                            }}
                                            className={`rounded-xl font-black text-[10px] h-9 transition-all cursor-pointer
                                               ${gradingAssignment === hw.id ? 'bg-slate-800 text-white' : 'bg-white text-slate-700 border border-slate-200 hover:border-primary hover:text-primary shadow-sm'}
                                            `}
                                         >
                                            {gradingAssignment === hw.id ? t('common.close', 'Close') : t('teacher.gradeBtn', 'Review')}
                                         </Button>
                                      ) : (
                                         <Button variant="ghost" disabled size="sm" className="rounded-xl text-[10px] opacity-20 uppercase font-black tracking-widest">No Homework</Button>
                                      )}
                                   </td>
                                </tr>
                                
                                {gradingAssignment === hw?.id && (
                                   <tr className="bg-gray-50/30">
                                      <td colSpan={5} className="px-8 py-8">
                                         <div className="animate-in slide-in-from-top-2 duration-300">
                                            <h4 className="text-sm font-black text-slate-800 mb-6 flex items-center gap-2">
                                               🔍 {t('teacher.gradingInterface', 'Reviewing Responses')}
                                            </h4>
                                            
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                                               {hw.responses.map(resp => (
                                                  <div key={resp.id} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm relative overflow-hidden group/card">
                                                     <div className={`absolute top-0 left-0 w-1 h-full ${resp.isCorrect ? 'bg-green-400' : 'bg-orange-400'}`} />
                                                     <div className="flex justify-between items-start mb-4">
                                                        <span className="text-[8px] font-black uppercase px-2 py-0.5 bg-slate-100 rounded text-slate-500">{resp.homework.exerciseType}</span>
                                                        {resp.isCorrect ? 
                                                           <CheckCircle className="w-4 h-4 text-green-500" /> : 
                                                           <XCircle className="w-4 h-4 text-orange-500" />
                                                        }
                                                     </div>
                                                     <p className="text-xs font-bold text-slate-800 mb-4 line-clamp-2 leading-relaxed">{resp.homework.questionText}</p>
                                                     <div className="space-y-3">
                                                        <div>
                                                           <div className="text-[9px] font-black text-slate-400 uppercase mb-1">{t('teacher.studentAnswer', 'Student Answer')}</div>
                                                           <div className="text-xs font-medium text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100">{resp.studentAnswer || '—'}</div>
                                                        </div>
                                                        <div>
                                                           <div className="text-[9px] font-black text-green-600/60 uppercase mb-1">{t('teacher.correctAnswer', 'Correct Answer')}</div>
                                                           <div className="text-xs font-bold text-green-700/80 italic">{resp.homework.correctAnswer || t('teacher.manualCheckRequired', 'Ручная проверка')}</div>
                                                        </div>
                                                     </div>
                                                  </div>
                                               ))}
                                               {hw.responses.length === 0 && (
                                                  <div className="col-span-full py-8 text-center italic text-slate-400 text-xs">
                                                     {t('teacher.noResponsesYet', 'Student has not started yet.')}
                                                  </div>
                                               )}
                                            </div>

                                            <div className="bg-primary/5 p-8 rounded-[2rem] border border-primary/10">
                                               <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
                                                  <div className="md:col-span-1">
                                                     <Label className="text-[10px] font-black uppercase tracking-widest text-primary mb-2 block">{t('teacher.finalGrade', 'Final Grade (%)')}</Label>
                                                     <Input 
                                                        type="number" 
                                                        value={gradeOverride} 
                                                        onChange={(e) => setGradeOverride(e.target.value === "" ? "" : Number(e.target.value))} 
                                                        className="h-12 rounded-xl bg-white border-none text-xl font-black text-center focus:ring-4 focus:ring-primary/10"
                                                     />
                                                  </div>
                                                  <div className="md:col-span-3">
                                                     <Label className="text-[10px] font-black uppercase tracking-widest text-primary mb-2 block">{t('teacher.comment', 'Teacher comment')}</Label>
                                                     <div className="flex gap-2">
                                                        <Input 
                                                           value={teacherComment} 
                                                           onChange={(e) => setTeacherComment(e.target.value)} 
                                                           placeholder={t('teacher.commentPlaceholder', "Great job! Pay attention to...")}
                                                           className="h-12 rounded-xl bg-white border-none text-sm font-medium focus:ring-4 focus:ring-primary/10 flex-1"
                                                        />
                                                        <Button 
                                                           onClick={() => handleSaveGrade(hw.id)} 
                                                           className="h-12 px-8 rounded-xl font-black bg-primary text-white shadow-xl shadow-primary/20 shrink-0"
                                                        >
                                                           {t('common.save', 'SAVE')}
                                                        </Button>
                                                     </div>
                                                  </div>
                                               </div>
                                            </div>
                                         </div>
                                      </td>
                                   </tr>
                                )}
                              </React.Fragment>
                           );
                        })
                     )}
                  </tbody>
               </table>
            </div>
          </div>
        )}

        {/* SETTINGS TAB */}
        {activeTab === 'settings' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-8">
               <h2 className="text-2xl font-black tracking-tight">{t('teacher.resetPassword', 'Student Settings')}</h2>
               
               {/* Photo Section */}
               <div className="bg-card p-8 rounded-[2.5rem] border border-border/50 shadow-sm relative overflow-hidden group">
                  <div className="absolute top-[-20px] right-[-20px] w-24 h-24 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-all" />
                  <h3 className="text-lg font-black flex items-center gap-3 mb-4">
                     <FileImage className="w-5 h-5 text-primary" /> Profile Identity
                  </h3>
                  <p className="text-sm text-muted-foreground mb-8 font-medium italic">Update the profile picture for this student across the platform.</p>
                  
                  <div className="flex items-center gap-6">
                    <Avatar className="w-24 h-24 border-2 border-primary/10">
                      <AvatarImage src={student.avatarUrl ? `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}${student.avatarUrl}` : undefined} className="object-cover" />
                      <AvatarFallback className="bg-secondary text-primary font-bold">{initials}</AvatarFallback>
                    </Avatar>
                    <Button 
                      variant="outline" 
                      onClick={() => fileInputRef.current?.click()} 
                      className="h-12 rounded-2xl font-bold px-6 shadow-sm cursor-pointer hover:bg-accent"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      {t('teacher.uploadNewPhoto', 'Upload New')}
                    </Button>
                  </div>
               </div>

                {/* Password Section */}
               <div className="bg-card p-8 rounded-[2.5rem] border border-border/50 shadow-sm relative overflow-hidden group">
                  <div className="absolute top-[-20px] right-[-20px] w-24 h-24 bg-orange-500/5 rounded-full blur-2xl group-hover:bg-orange-500/10 transition-all" />
                  <h3 className="text-lg font-black flex items-center gap-3 mb-4">
                     <KeyRound className="w-5 h-5 text-orange-500" /> Account Security
                  </h3>
                  <p className="text-sm text-muted-foreground mb-8 font-medium italic">Manually reset the password for this student&apos;s access.</p>
                  
                  <div className="space-y-6">
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">New Access Password</Label>
                       <div className="relative">
                        <Input 
                          type={showPassword ? "text" : "password"} 
                          value={newPassword} 
                          onChange={e => setNewPassword(e.target.value)} 
                          placeholder="••••••••" 
                          className="h-14 rounded-2xl bg-secondary/10 border-none focus:ring-4 focus:ring-primary/10 transition-all"
                        />
                        <button 
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-2"
                        >
                          {showPassword ? "👁️" : "👁️‍🗨️"}
                        </button>
                      </div>
                    </div>
                    <Button onClick={handleUpdatePassword} disabled={savingSettings || !newPassword} className="h-14 w-full rounded-2xl font-black bg-foreground text-card cursor-pointer hover:bg-foreground/90 transition-all">
                      RESET PASSWORD
                    </Button>
                  </div>
               </div>
            </div>

            <div className="hidden lg:flex flex-col justify-center items-center p-12 bg-primary/5 rounded-[3rem] border border-primary/10 text-center">
               <div className="text-6xl mb-8">🛠️</div>
               <h3 className="text-2xl font-black text-primary/80 mb-4 tracking-tighter italic uppercase">Admin Controls</h3>
               <p className="text-muted-foreground text-sm font-medium leading-relaxed max-w-xs">
                 You are managing sensitive student data. Ensure any changes are requested by the student or necessary for account recovery.
               </p>
               <div className="mt-8 flex flex-col gap-2 w-full max-w-[200px]">
                  <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest opacity-40">
                    <span>Account Active</span>
                    <span className="text-green-600">YES</span>
                  </div>
                  <div className="w-full h-[1px] bg-primary/10" />
                  <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest opacity-40">
                    <span>Verified</span>
                    <span className="text-green-600">YES</span>
                  </div>
               </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
