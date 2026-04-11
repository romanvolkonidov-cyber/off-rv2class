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
            level: true,
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
      where: { id: req.params.studentId as string, teacherId: req.user!.userId },
    });

    if (!student) {
      res.status(404).json({ error: 'Ученик не найден' });
      return;
    }

    await prisma.user.delete({ where: { id: req.params.studentId as string } });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete student error:', error);
    res.status(500).json({ error: 'Ошибка удаления ученика' });
  }
});

import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';

const storage = multer.diskStorage({
  destination: async (_req, _file, cb) => {
    const dir = path.join(process.cwd(), 'uploads', 'avatars');
    await fs.mkdir(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const uniqueName = `avatar-${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});
const avatarUpload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

// GET /api/teacher/students/:id/details
teacherRouter.get('/students/:id/details', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const student = await prisma.user.findFirst({
      where: { id: req.params.id as string, teacherId: req.user!.userId },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        createdAt: true,
        attendedSessions: {
          include: { lesson: { select: { title: true, level: true } } },
          orderBy: { startedAt: 'desc' }
        },
        homeworkAssignments: {
          include: { lesson: { select: { title: true, level: true } }, responses: { include: { homework: true } } },
          orderBy: { assignedAt: 'desc' }
        },
        observationsReceived: {
          orderBy: { createdAt: 'desc' }
        }
      }
    });
    if (!student) {
      res.status(404).json({ error: 'Ученик не найден' });
      return;
    }
    res.json(student);
  } catch (error) {
    console.error('Get student details error:', error);
    res.status(500).json({ error: 'Ошибка получения профиля ученика' });
  }
});

// PUT /api/teacher/students/:id/settings
teacherRouter.put('/students/:id/settings', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { password } = req.body;
    const student = await prisma.user.findFirst({
      where: { id: req.params.id as string, teacherId: req.user!.userId },
    });
    
    if (!student) {
      res.status(404).json({ error: 'Ученик не найден' });
      return;
    }
    
    if (password) {
      // Find firebase user by email to update password
      try {
        const fbUser = await admin.auth().getUserByEmail(student.email);
        await admin.auth().updateUser(fbUser.uid, { password });
      } catch (err) {
        console.warn("Could not update Firebase password, perhaps this user doesn't exist in Firebase yet", err);
      }
      const hashedPassword = await bcrypt.hash(password, 12);
      await prisma.user.update({
        where: { id: student.id },
        data: { password: hashedPassword }
      });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Update student settings error:', error);
    res.status(500).json({ error: 'Ошибка обновления настроек' });
  }
});

// POST /api/teacher/students/:id/photo
teacherRouter.post('/students/:id/photo', avatarUpload.single('avatar'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const student = await prisma.user.findFirst({
      where: { id: req.params.id as string, teacherId: req.user!.userId },
    });
    
    if (!student) {
      res.status(404).json({ error: 'Ученик не найден' });
      return;
    }
    
    if (!req.file) {
      res.status(400).json({ error: 'Файл не загружен' });
      return;
    }

    const avatarUrl = `/uploads/avatars/${req.file.filename}`;
    const updated = await prisma.user.update({
      where: { id: student.id },
      data: { avatarUrl }
    });
    
    res.json(updated);
  } catch (error) {
    console.error('Upload avatar error:', error);
    res.status(500).json({ error: 'Ошибка загрузки фото' });
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
      where: { id: req.params.assignmentId as string, teacherId: req.user!.userId },
    });

    if (!assignment) {
      res.status(404).json({ error: 'Задание не найдено' });
      return;
    }

    const updated = await prisma.homeworkAssignment.update({
      where: { id: req.params.assignmentId as string },
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

// GET /api/teacher/classroom/active — Get current active session for the teacher
teacherRouter.get('/classroom/active', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const session = await prisma.classSession.findFirst({
      where: { teacherId: req.user!.userId, isActive: true },
      include: {
        lesson: {
          include: {
            slides: {
              orderBy: { orderIndex: 'asc' },
              include: { teacherNote: true },
            },
          },
        },
        students: { select: { id: true, name: true, email: true } },
      },
    });

    if (!session) {
      res.status(404).json({ error: 'Нет активного урока' });
      return;
    }

    res.json(session);
  } catch (error) {
    console.error('Get active classroom error:', error);
    res.status(500).json({ error: 'Ошибка получения активного урока' });
  }
});

// PUT /api/teacher/classroom/:sessionId/end
teacherRouter.put('/classroom/:sessionId/end', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const session = await prisma.classSession.update({
      where: { id: req.params.sessionId as string },
      data: { isActive: false, endedAt: new Date() },
      include: {
        students: { select: { id: true, name: true, email: true } },
        lesson: { select: { id: true, title: true } }
      }
    });
    res.json(session);
  } catch (error) {
    console.error('End classroom error:', error);
    res.status(500).json({ error: 'Ошибка завершения урока' });
  }
});

// GET /api/teacher/history - Get past sessions
teacherRouter.get('/history', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const history = await prisma.classSession.findMany({
      where: { teacherId: req.user!.userId, isActive: false },
      include: {
        lesson: { select: { id: true, title: true } },
        students: { select: { id: true, name: true, email: true } }
      },
      orderBy: { startedAt: 'desc' }
    });
    res.json(history);
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({ error: 'Ошибка загрузки архива уроков' });
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
// POST /api/teacher/classroom/observations — Record a yellow note during a session
teacherRouter.post('/classroom/observations', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { studentId, sessionId, content } = req.body;

    if (!studentId || !content) {
      res.status(400).json({ error: 'ID ученика и содержание обязательны' });
      return;
    }

    const observation = await prisma.lessonObservation.create({
      data: {
        studentId,
        teacherId: req.user!.userId,
        sessionId,
        content,
      },
    });

    res.status(201).json(observation);
  } catch (error) {
    console.error('Create observation error:', error);
    res.status(500).json({ error: 'Ошибка сохранения заметки' });
  }
});
