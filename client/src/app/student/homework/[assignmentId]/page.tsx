'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { useTranslation } from 'react-i18next';
import '@/lib/i18n';
import api, { PROD_URL } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Clapperboard, Loader2, CheckCircle2 } from 'lucide-react';

interface HomeworkQuestion {
  id: string;
  questionText: string;
  exerciseType: string;
  options: string | null;
  audioUrl: string | null;
  orderIndex: number;
}

interface Assignment {
  id: string;
  submittedAt: string | null;
  score: number | null;
  lesson: {
    homework: HomeworkQuestion[];
    homeworkVideoUrl?: string;
    homeworkVideoQuestion?: string;
    homeworkVideoOptions?: string;
    homeworkVideoAnswer?: string;
  };
  videoAnswer?: string;
  isVideoCorrect?: boolean;
  responses: {
    homeworkId: string;
    studentAnswer: string;
    isCorrect: boolean;
  }[];
}

export default function HomeworkPage({ params }: { params: Promise<{ assignmentId: string }> }) {
  const { assignmentId } = use(params);
  const { t } = useTranslation();
  const router = useRouter();
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [videoAnswer, setVideoAnswer] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ score: number; correctCount: number; totalQuestions: number } | null>(null);
  const [showTeaser, setShowTeaser] = useState(true);

  const fetchAssignment = useCallback(async () => {
    try {
      const res = await api.get(`/student/homework/${assignmentId}`);
      setAssignment(res.data);

      // Pre-fill from saved responses if already submitted
      if (res.data.responses?.length > 0) {
        const saved: Record<string, string> = {};
        res.data.responses.forEach((r: any) => {
          saved[r.homeworkId] = r.studentAnswer;
        });
        setAnswers(saved);
      }
      if (res.data.videoAnswer) {
        setVideoAnswer(res.data.videoAnswer);
        setShowTeaser(false); // Hide overlay if already answered
      }
    } catch {
      toast.error('Ошибка загрузки задания');
    }
  }, [assignmentId]);

  useEffect(() => {
    fetchAssignment();
  }, [fetchAssignment]);

  const handleSubmit = async () => {
    if (!assignment) return;

    const unanswered = assignment.lesson.homework.filter((q) => !answers[q.id]?.trim());
    const videoUnanswered = assignment.lesson.homeworkVideoUrl && !videoAnswer;

    if (unanswered.length > 0 || videoUnanswered) {
      toast.error(`Ответьте на все вопросы${videoUnanswered ? ' (включая видео)' : ''}`);
      return;
    }

    setSubmitting(true);
    try {
      const formattedAnswers = Object.entries(answers).map(([homeworkId, answer]) => ({
        homeworkId,
        answer,
      }));

      const res = await api.post(`/student/homework/${assignmentId}/submit`, {
        answers: formattedAnswers,
        videoAnswer,
      });

      setResult(res.data);
      toast.success(`Результат: ${Math.round(res.data.score)}%`);
      fetchAssignment(); // Refresh to see responses
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Ошибка сдачи');
    } finally {
      setSubmitting(false);
    }
  };

  if (!assignment) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const isSubmitted = !!assignment.submittedAt;
  const questions = assignment.lesson.homework;

  return (
    <div className="max-w-3xl mx-auto space-y-6 relative">
      {/* Homework Teaser / Video Task Overlay */}
      {showTeaser && assignment?.lesson?.homeworkVideoUrl && (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-3xl flex flex-col items-center justify-center p-8 animate-in fade-in duration-700">
           <div className="max-w-6xl w-full flex flex-col lg:flex-row gap-12 items-center">
              {/* Video Section */}
              <div className="flex-1 space-y-6 text-center w-full">
                <div className="space-y-2">
                  <h2 className="text-3xl md:text-5xl font-bold text-white tracking-tight">{t('homework.introTitle')}</h2>
                  <p className="text-white/40 text-sm md:text-base uppercase tracking-widest font-bold">{t('homework.videoInstruction')}</p>
                </div>
                
                <div className="relative aspect-video rounded-[3rem] overflow-hidden shadow-[0_0_100px_rgba(255,255,255,0.1)] ring-1 ring-white/20">
                   <video 
                      src={`${(process.env.NODE_ENV === 'production' ? PROD_URL : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'))}${assignment.lesson.homeworkVideoUrl}`}
                      className="w-full h-full object-cover"
                      autoPlay
                      controls
                   />
                </div>
              </div>

              {/* Interaction Section */}
              <Card className="w-full lg:w-[450px] bg-white/5 backdrop-blur-2xl rounded-[2.5rem] border-white/10 shadow-2xl overflow-hidden animate-in slide-in-from-right duration-1000">
                 <CardHeader className="bg-white/5 border-b border-white/10 p-8">
                    <CardTitle className="text-white text-xl flex items-center gap-3">
                       <div className="w-10 h-10 rounded-2xl bg-primary/20 flex items-center justify-center">
                          <Clapperboard className="w-5 h-5 text-primary" />
                       </div>
                       {t('homework.videoTask')}
                    </CardTitle>
                 </CardHeader>
                 <CardContent className="p-8 space-y-8">
                    <div className="space-y-6">
                       <h3 className="text-2xl font-medium text-neutral-100 leading-tight">
                          {assignment.lesson.homeworkVideoQuestion}
                       </h3>
                       {assignment.lesson.homeworkVideoOptions && (
                         <div className="space-y-3">
                            {JSON.parse(assignment.lesson.homeworkVideoOptions).map((option: string) => (
                               <label key={option} className={`flex items-center gap-4 p-5 rounded-3xl border transition-all cursor-pointer group ${
                                  videoAnswer === option ? 'border-primary bg-primary/10 text-white shadow-[0_0_20px_rgba(var(--primary),0.2)]' : 'border-white/10 text-neutral-400 hover:bg-white/5'
                               }`}>
                                  <input 
                                     type="radio" 
                                     name="videoOption" 
                                     value={option} 
                                     checked={videoAnswer === option}
                                     onChange={(e) => setVideoAnswer(e.target.value)}
                                     className="sr-only"
                                  />
                                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${videoAnswer === option ? 'border-primary' : 'border-neutral-600 group-hover:border-neutral-400'}`}>
                                     {videoAnswer === option && <div className="w-3 h-3 rounded-full bg-primary" />}
                                  </div>
                                  <span className="text-lg font-medium">{option}</span>
                               </label>
                            ))}
                         </div>
                       )}
                    </div>
                    
                    <Button 
                       onClick={() => setShowTeaser(false)} 
                       disabled={!videoAnswer}
                       className="w-full h-16 rounded-[2rem] bg-white text-black hover:bg-neutral-200 font-bold text-lg shadow-xl hover:scale-[1.02] active:scale-95 transition-all"
                    >
                       {t('homework.confirmVideoTask')}
                    </Button>
                 </CardContent>
              </Card>
           </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/student')}
            className="mb-2 cursor-pointer"
          >
            ← {t('common.back')}
          </Button>
          <h1 className="text-2xl font-bold">{t('homework.title')}</h1>
        </div>

        {result && (
          <Card className="p-4 shadow-lg">
            <div className="text-center">
              <p className="text-3xl font-bold text-gradient">{Math.round(result.score)}%</p>
              <p className="text-sm text-muted-foreground">
                {result.correctCount} из {result.totalQuestions} верно
              </p>
            </div>
          </Card>
        )}
      </div>

      {/* Questions */}
      <div className="space-y-4">
        {questions.map((question, idx) => {
          const response = assignment.responses?.find((r) => r.homeworkId === question.id);
          let parsedOptions: string[] = [];
          try {
            if (question.options) {
              parsedOptions = JSON.parse(question.options);
            }
          } catch {
            // Ignore parse errors
          }

          return (
            <Card key={question.id} className="overflow-hidden" id={`question-${question.id}`}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">
                    {idx + 1}. {question.questionText}
                  </CardTitle>
                  {isSubmitted && response && (
                    <Badge className={response.isCorrect ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                      {response.isCorrect ? t('homework.correct') : t('homework.incorrect')}
                    </Badge>
                  )}
                </div>
                <Badge variant="outline" className="w-fit text-xs">
                  {question.exerciseType === 'MULTIPLE_CHOICE' && t('homework.multipleChoice')}
                  {question.exerciseType === 'FILL_IN_BLANK' && t('homework.fillBlank')}
                  {question.exerciseType === 'TRUE_FALSE' && t('homework.trueFalse')}
                  {question.exerciseType === 'SHORT_ANSWER' && t('homework.shortAnswer')}
                </Badge>
              </CardHeader>
              <Separator />
              <CardContent className="pt-3 space-y-4">
                {question.audioUrl && (
                  <div className="w-full bg-accent/50 p-3 rounded-lg flex items-center justify-center">
                    <audio 
                      controls 
                      src={`${(process.env.NODE_ENV === 'production' ? PROD_URL : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'))}${question.audioUrl}`} 
                      className="w-full max-w-sm"
                    />
                  </div>
                )}
                
                {question.exerciseType === 'MULTIPLE_CHOICE' && parsedOptions.length > 0 ? (
                  <div className="space-y-2">
                    {parsedOptions.map((option) => (
                      <label
                        key={option}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                          answers[question.id] === option
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:bg-accent/30'
                        } ${isSubmitted ? 'pointer-events-none opacity-75' : ''}`}
                      >
                        <input
                          type="radio"
                          name={question.id}
                          value={option}
                          checked={answers[question.id] === option}
                          onChange={(e) => setAnswers({ ...answers, [question.id]: e.target.value })}
                          disabled={isSubmitted}
                          className="accent-primary"
                        />
                        <span className="text-sm">{option}</span>
                      </label>
                    ))}
                  </div>
                ) : question.exerciseType === 'TRUE_FALSE' ? (
                  <div className="flex gap-3">
                    {['True', 'False'].map((val) => (
                      <Button
                        key={val}
                        variant={answers[question.id] === val ? 'default' : 'outline'}
                        className="flex-1 cursor-pointer"
                        onClick={() => !isSubmitted && setAnswers({ ...answers, [question.id]: val })}
                        disabled={isSubmitted}
                      >
                        {val === 'True' ? 'Верно' : 'Неверно'}
                      </Button>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Ваш ответ:</Label>
                    <Input
                      value={answers[question.id] || ''}
                      onChange={(e) => setAnswers({ ...answers, [question.id]: e.target.value })}
                      disabled={isSubmitted}
                      placeholder="Введите ответ..."
                      className="transition-all focus:shadow-md focus:shadow-primary/10"
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Submit */}
      {!isSubmitted && (
        <Button
          className="w-full gradient-brand text-white shadow-lg py-6 text-lg font-medium cursor-pointer"
          onClick={handleSubmit}
          disabled={submitting}
          id="submit-homework-btn"
        >
          {submitting ? t('common.loading') : t('homework.submitAll')}
        </Button>
      )}
    </div>
  );
}
