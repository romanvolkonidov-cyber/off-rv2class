import { Router, Response } from 'express';
import prisma from '../utils/prisma.js';
import bcrypt from 'bcryptjs';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';
import admin from '../utils/firebase-admin.js';

export const teacherRouter = Router();

teacherRouter.use(authenticate);
teacherRouter.use(requireRole('TEACHER'));

// ==========================================
// LESSON LIBRARY
// ==========================================

// GET /api/teacher/library — Browse all published courses & lessons
teacherRouter.get('/library', async (_req, res: Response): Promise<void> => {
  try {
    const courses = await prisma.course.findMany({
      include: {
        lessons: {
          where: { published: true },
          select: {
            id: true,
            title: true,
            orderIndex: true,
            _count: { select: { slides: true, homework: true } },
          },
          orderBy: { orderIndex: 'asc' },
        },
      },
      orderBy: { orderIndex: 'asc' },
    });
    res.json(courses);
  } catch (error) {
    console.error('Get library error:', error);
    res.status(500).json({ error: 'Ошибка получения библиотеки' });
  }
});

// ==========================================
// STUDENT MANAGEMENT
// ==========================================

// GET /api/teacher/students
teacherRouter.get('/students', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const students = await prisma.user.findMany({
      where: { teacherId: req.user!.userId, role: 'STUDENT' },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        _count: { select: { homeworkAssignments: true } },
      },
      orderBy: { name: 'asc' },
    });
    res.json(students);
  } catch (error) {
    console.error('Get students error:', error);
    res.status(500).json({ error: 'Ошибка получения учеников' });
  }
});

// POST /api/teacher/students — Create a student account
teacherRouter.post('/students', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      res.status(400).json({ error: 'Имя, email и пароль обязательны' });
      return;
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ error: 'Пользователь с таким email уже существует' });
      return;
    }

    // Create the student in Firebase Auth
    let firebaseUid = '';
    try {
      const fbUser = await admin.auth().createUser({
        email,
        password,
        displayName: name,
      });
      firebaseUid = fbUser.uid;
    } catch (firebaseErr: any) {
      if (firebaseErr.code === 'auth/email-already-exists') {
        res.status(409).json({ error: 'Пользователь с таким email уже существует в Firebase' });
        return;
      }
      throw firebaseErr;
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const student = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword, // Kept for generic JWT manual login if needed later, but auth will be Firebase
        role: 'STUDENT',
        teacherId: req.user!.userId,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    res.status(201).json(student);
  } catch (error) {
    console.error('Create student error:', error);
    res.status(500).json({ error: 'Ошибка создания ученика' });
  }
});

// DELETE /api/teacher/students/:studentId
teacherRouter.delete('/students/:studentId', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Ensure the student belongs to this teacher
    const student = await prisma.user.findFirst({
      where: { id: req.params.studentId, teacherId: req.user!.userId },
    });

    if (!student) {
      res.status(404).json({ error: 'Ученик не найден' });
      return;
    }

    await prisma.user.delete({ where: { id: req.params.studentId } });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete student error:', error);
    res.status(500).json({ error: 'Ошибка удаления ученика' });
  }
});

// ==========================================
// GRADEBOOK
// ==========================================

// GET /api/teacher/gradebook
teacherRouter.get('/gradebook', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const assignments = await prisma.homeworkAssignment.findMany({
      where: { teacherId: req.user!.userId },
      include: {
        student: { select: { id: true, name: true, email: true } },
        lesson: { select: { id: true, title: true } },
        responses: {
          include: {
            homework: { select: { questionText: true, correctAnswer: true, exerciseType: true } },
          },
        },
      },
      orderBy: { assignedAt: 'desc' },
    });
    res.json(assignments);
  } catch (error) {
    console.error('Get gradebook error:', error);
    res.status(500).json({ error: 'Ошибка получения журнала оценок' });
  }
});

// PUT /api/teacher/gradebook/:assignmentId — Override grade / add comment
teacherRouter.put('/gradebook/:assignmentId', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { gradeOverride, teacherComment } = req.body;

    const assignment = await prisma.homeworkAssignment.findFirst({
      where: { id: req.params.assignmentId, teacherId: req.user!.userId },
    });

    if (!assignment) {
      res.status(404).json({ error: 'Задание не найдено' });
      return;
    }

    const updated = await prisma.homeworkAssignment.update({
      where: { id: req.params.assignmentId },
      data: { gradeOverride, teacherComment },
    });

    res.json(updated);
  } catch (error) {
    console.error('Update grade error:', error);
    res.status(500).json({ error: 'Ошибка обновления оценки' });
  }
});

// ==========================================
// CLASSROOM
// ==========================================

// POST /api/teacher/classroom/start — Start a live class session
teacherRouter.post('/classroom/start', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { lessonId } = req.body;

    if (!lessonId) {
      res.status(400).json({ error: 'ID урока обязателен' });
      return;
    }

    // Close any existing active sessions
    await prisma.classSession.updateMany({
      where: { teacherId: req.user!.userId, isActive: true },
      data: { isActive: false, endedAt: new Date() },
    });

    const session = await prisma.classSession.create({
      data: {
        lessonId,
        teacherId: req.user!.userId,
        currentSlide: 0,
      },
      include: {
        lesson: {
          include: {
            slides: {
              orderBy: { orderIndex: 'asc' },
              include: { teacherNote: true },
            },
          },
        },
      },
    });

    res.status(201).json(session);
  } catch (error) {
    console.error('Start classroom error:', error);
    res.status(500).json({ error: 'Ошибка запуска урока' });
  }
});

// PUT /api/teacher/classroom/:sessionId/end
teacherRouter.put('/classroom/:sessionId/end', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const session = await prisma.classSession.update({
      where: { id: req.params.sessionId },
      data: { isActive: false, endedAt: new Date() },
    });
    res.json(session);
  } catch (error) {
    console.error('End classroom error:', error);
    res.status(500).json({ error: 'Ошибка завершения урока' });
  }
});

// ==========================================
// HOMEWORK ASSIGNMENT
// ==========================================

// POST /api/teacher/assign-homework
teacherRouter.post('/assign-homework', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { lessonId, studentIds } = req.body;

    if (!lessonId || !studentIds || !Array.isArray(studentIds)) {
      res.status(400).json({ error: 'ID урока и список учеников обязательны' });
      return;
    }

    const assignments = await Promise.all(
      studentIds.map((studentId: string) =>
        prisma.homeworkAssignment.create({
          data: {
            lessonId,
            studentId,
            teacherId: req.user!.userId,
          },
        })
      )
    );

    res.status(201).json(assignments);
  } catch (error) {
    console.error('Assign homework error:', error);
    res.status(500).json({ error: 'Ошибка назначения домашнего задания' });
  }
});
