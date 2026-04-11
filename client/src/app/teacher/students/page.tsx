"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Loader2, Search, Trash2 } from 'lucide-react';
import api from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { CreateStudentDialog } from '@/components/teacher/CreateStudentDialog';

interface Student {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  _count: {
    homeworkAssignments: number;
  };
}

export default function StudentsPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchStudents = async () => {
    try {
      const res = await api.get('/teacher/students');
      setStudents(res.data);
    } catch (error) {
      console.error("Failed to load students", error);
      toast.error(t('teacher.studentsLoadError', 'Ошибка загрузки списка учеников'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, [t]);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(t('teacher.deleteStudentConfirm', `Вы уверены, что хотите удалить ученика ${name}?`))) {
      return;
    }
    
    try {
      await api.delete(`/teacher/students/${id}`);
      toast.success(t('teacher.studentDeleted', 'Ученик удален'));
      setStudents(students.filter(s => s.id !== id));
    } catch (err: any) {
      console.error(err);
      toast.error(t('teacher.studentDeleteError', 'Ошибка при удалении ученика'));
    }
  };

  const filtered = students.filter(s => 
    s.name.toLowerCase().includes(search.toLowerCase()) || 
    s.email.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto pb-20 px-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between md:items-end gap-8 mb-12 border-b border-border pb-8">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-foreground">{t('navigation.students', 'Ученики')}</h1>
          <p className="text-muted-foreground mt-2 text-lg">{t('teacher.studentsDesc', 'Управляйте своими учениками и следите за их прогрессом.')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder={t('teacher.searchStudent', 'Search students...')} 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
              className="pl-11 h-12 rounded-xl bg-card border-border/50 focus:ring-2 focus:ring-primary/20 transition-all" 
            />
          </div>
          <CreateStudentDialog onStudentCreated={fetchStudents} />
        </div>
      </div>

      {/* Gallery Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-24 bg-card/50 rounded-[2rem] border-2 border-dashed border-border flex flex-col items-center">
          <div className="w-16 h-16 bg-secondary/20 rounded-2xl flex items-center justify-center mb-6 text-2xl">👤</div>
          <p className="text-muted-foreground text-lg italic">
            {search ? t('teacher.noStudentsFound', 'Ученики не найдены') : t('teacher.emptyStudentsList', 'Ваш список учеников пуст.')}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filtered.map((s) => {
            const initials = s.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
            
            return (
              <div 
                key={s.id} 
                className="group relative bg-card border border-border/50 rounded-[2rem] p-6 transition-all duration-300 hover:shadow-2xl hover:border-primary/30 hover:translate-y-[-4px]"
              >
                {/* Actions Menu */}
                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                   <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={(e) => { e.stopPropagation(); handleDelete(s.id, s.name); }} 
                    className="w-8 h-8 rounded-full text-destructive hover:bg-destructive/10 cursor-pointer"
                   >
                    <Trash2 className="w-4 h-4" />
                   </Button>
                </div>

                <div className="flex flex-col items-center text-center">
                  <div 
                    onClick={() => router.push(`/teacher/students/${s.id}`)}
                    className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center mb-4 border-2 border-primary/5 group-hover:border-primary/20 transition-all cursor-pointer shadow-inner"
                  >
                    <span className="text-2xl font-black text-primary">{initials}</span>
                  </div>
                  
                  <h3 
                    onClick={() => router.push(`/teacher/students/${s.id}`)}
                    className="font-bold text-lg text-foreground mb-1 group-hover:text-primary transition-colors cursor-pointer line-clamp-1 px-4"
                  >
                    {s.name}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-6 font-medium">{s.email}</p>
                  
                  <div className="w-full flex items-center justify-center gap-3 pt-4 border-t border-border/50">
                     <div className="flex flex-col items-center px-4">
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1 opacity-60">HW</span>
                        <span className="text-sm font-black text-primary bg-primary/5 px-2 py-0.5 rounded-full">{s._count.homeworkAssignments}</span>
                     </div>
                     <div className="w-[1px] h-6 bg-border/50" />
                     <div className="flex flex-col items-center px-4">
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1 opacity-60">JOINED</span>
                        <span className="text-[10px] font-bold text-foreground bg-secondary/50 px-2 py-0.5 rounded-full">
                           {new Date(s.createdAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
                        </span>
                     </div>
                  </div>

                  <Button 
                    variant="secondary" 
                    onClick={() => router.push(`/teacher/students/${s.id}`)}
                    className="w-full mt-6 rounded-xl font-bold bg-secondary/80 hover:bg-primary hover:text-white transition-all cursor-pointer"
                  >
                    {t('teacher.viewProfile', 'View Profile')}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
