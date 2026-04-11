import { Router, Response } from 'express';
import prisma from '../utils/prisma.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';
import { gradeHomeworkSubmission } from '../services/autoGrader.js';

export const studentRouter = Router();

studentRouter.use(authenticate);
studentRouter.use(requireRole('STUDENT'));

// ==========================================
// DASHBOARD
// ==========================================

// GET /api/student/dashboard
studentRouter.get('/dashboard', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const studentId = req.user!.userId;

    // Get homework assignments
    const assignments = await prisma.homeworkAssignment.findMany({
      where: { studentId },
      include: {
        lesson: { select: { id: true, title: true } },
        teacher: { select: { name: true } },
      },
      orderBy: { assignedAt: 'desc' },
    });

    // Check for active class session from their teacher
    const student = await prisma.user.findUnique({
      where: { id: studentId },
      select: { teacherId: true },
    });

    let activeSession = null;
    if (student?.teacherId) {
      activeSession = await prisma.classSession.findFirst({
        where: { teacherId: student.teacherId, isActive: true },
        include: {
          lesson: { select: { title: true } },
        },
      });
    }

    // Get past attended sessions
    const pastSessions = await prisma.classSession.findMany({
      where: { 
        students: { some: { id: studentId } },
        isActive: false
      },
      include: {
        lesson: { select: { id: true, title: true } },
        teacher: { select: { name: true } },
        observations: {
          where: { studentId },
          select: { content: true, createdAt: true }
        }
      },
      orderBy: { endedAt: 'desc' }
    });

    res.json({
      assignments,
      activeSession,
      pastSessions
    });
  } catch (error) {
    console.error('Student dashboard error:', error);
    res.status(500).json({ error: 'Ошибка загрузки панели ученика' });
  }
});

// ==========================================
// PAST LESSONS
// ==========================================

// GET /api/student/lessons
studentRouter.get('/lessons', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const studentId = req.user!.userId;
    // Find lessons where the student has an assignment
    const assignments = await prisma.homeworkAssignment.findMany({
      where: { studentId },
      include: {
        lesson: { select: { id: true, title: true, createdAt: true } },
      },
      orderBy: { assignedAt: 'desc' },
    });

    // Deduplicate lessons
    const uniqueLessonsMap = new Map();
    assignments.forEach((a) => {
      if (!uniqueLessonsMap.has(a.lesson.id)) {
        uniqueLessonsMap.set(a.lesson.id, a.lesson);
      }
    });

    res.json(Array.from(uniqueLessonsMap.values()));
  } catch (error) {
    console.error('Get past lessons error:', error);
    res.status(500).json({ error: 'Ошибка получения уроков' });
  }
});

// GET /api/student/lessons/:lessonId
studentRouter.get('/lessons/:lessonId', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const studentId = req.user!.userId;
    
    // Verify the student actually has an assignment for this lesson (authorization)
    const hasAccess = await prisma.homeworkAssignment.findFirst({
      where: { studentId, lessonId: req.params.lessonId as string },
    });

    const attended = await prisma.classSession.findFirst({
      where: { lessonId: req.params.lessonId as string, students: { some: { id: studentId } } }
    });

    if (!hasAccess && !attended) {
      res.status(403).json({ error: 'У вас нет доступа к этому уроку' });
      return;
    }

    const lesson = await prisma.lesson.findUnique({
      where: { id: req.params.lessonId as string },
      include: {
        slides: {
          orderBy: { orderIndex: 'asc' },
          select: { id: true, imageUrl: true, orderIndex: true },
        },
      },
    });

    if (!lesson) {
      res.status(404).json({ error: 'Урок не найден' });
      return;
    }

    res.json(lesson);
  } catch (error) {
    console.error('Get lesson slides error:', error);
    res.status(500).json({ error: 'Ошибка получения слайдов урока' });
  }
});

// GET /api/student/sessions/:sessionId - Get past session for review
studentRouter.get('/sessions/:sessionId', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const studentId = req.user!.userId;
    
    // Check if student attended
    const attended = await prisma.classSession.findFirst({
      where: { 
        id: req.params.sessionId as string, 
        students: { some: { id: studentId } } 
      },
      include: {
        lesson: {
          include: {
            slides: {
              orderBy: { orderIndex: 'asc' }
            }
          }
        },
        observations: {
          where: { studentId },
          select: { content: true, createdAt: true }
        }
      }
    });

    if (!attended) {
      res.status(403).json({ error: 'У вас нет доступа к этому уроку' });
      return;
    }

    res.json(attended);
  } catch (error) {
    console.error('Get past session error:', error);
    res.status(500).json({ error: 'Ошибка загрузки архивного урока' });
  }
});

// GET /api/student/homework — Get list of assignments
studentRouter.get('/homework', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const assignments = await prisma.homeworkAssignment.findMany({
      where: { studentId: req.user!.userId },
      include: {
        lesson: { select: { id: true, title: true, level: true } as any },
      },
      orderBy: { assignedAt: 'desc' },
    });
    res.json(assignments);
  } catch (error) {
    console.error('Get student homework error:', error);
    res.status(500).json({ error: 'Ошибка получения заданий' });
  }
});

// ==========================================
// HOMEWORK
// ==========================================

// GET /api/student/homework/:assignmentId — Get homework questions
studentRouter.get('/homework/:assignmentId', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const assignment = await prisma.homeworkAssignment.findFirst({
      where: { id: req.params.assignmentId as string, studentId: req.user!.userId },
      include: {
        lesson: {
          include: {
            homework: {
              orderBy: { orderIndex: 'asc' },
              select: {
                id: true,
                questionText: true,
                exerciseType: true,
                options: true,
                orderIndex: true,
                audioUrl: true,
                // NOTE: correctAnswer is NOT sent to student
              },
            },
          },
        },
        responses: true,
      },
    });

    if (!assignment) {
      res.status(404).json({ error: 'Задание не найдено' });
      return;
    }

    res.json(assignment);
  } catch (error) {
    console.error('Get homework error:', error);
    res.status(500).json({ error: 'Ошибка получения задания' });
  }
});

// POST /api/student/homework/:assignmentId/submit — Submit answers
studentRouter.post('/homework/:assignmentId/submit', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { answers } = req.body;
    // answers = [{ homeworkId: string, answer: string }, ...]

    if (!answers || !Array.isArray(answers)) {
      res.status(400).json({ error: 'Ответы обязательны' });
      return;
    }

    const assignment = await prisma.homeworkAssignment.findFirst({
      where: { id: req.params.assignmentId as string, studentId: req.user!.userId },
    });

    if (!assignment) {
      res.status(404).json({ error: 'Задание не найдено' });
      return;
    }

    if (assignment.submittedAt) {
      res.status(400).json({ error: 'Задание уже сдано' });
      return;
    }

    const { videoAnswer } = req.body;
    
    // Auto-grade
    const result = await gradeHomeworkSubmission(req.params.assignmentId as string, answers, videoAnswer);

    res.json({
      score: result.score,
      totalQuestions: result.totalQuestions,
      correctCount: result.correctCount,
    });
  } catch (error) {
    console.error('Submit homework error:', error);
    res.status(500).json({ error: 'Ошибка сдачи задания' });
  }
});

// ==========================================
// CLASSROOM
// ==========================================

// GET /api/student/classroom/active — Find active session from teacher
studentRouter.get('/classroom/active', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const student = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { teacherId: true },
    });

    if (!student?.teacherId) {
      res.status(404).json({ error: 'Учитель не назначен' });
      return;
    }

    const session = await prisma.classSession.findFirst({
      where: { teacherId: student.teacherId, isActive: true },
      include: {
        lesson: {
          include: {
            slides: {
              orderBy: { orderIndex: 'asc' },
              select: { 
                id: true, 
                imageUrl: true, 
                orderIndex: true,
                audioUrl: true,
                videoUrl: true,
                audioWidgetX: true,
                audioWidgetY: true,
                audioWidgetScale: true
              },
              // NOTE: teacherNote is NOT included for students
            },
          },
        },
      },
    });

    if (!session) {
      res.status(404).json({ error: 'Активный урок не найден' });
      return;
    }

    res.json(session);
  } catch (error) {
    console.error('Get active classroom error:', error);
    res.status(500).json({ error: 'Ошибка поиска активного урока' });
  }
});
