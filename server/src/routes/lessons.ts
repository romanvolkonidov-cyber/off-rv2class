import { Router, Response } from 'express';
import prisma from '../utils/prisma.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

export const lessonsRouter = Router();

lessonsRouter.use(authenticate);

// GET /api/lessons/:lessonId — Get lesson details (role-aware)
lessonsRouter.get('/:lessonId', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const isTeacherOrAdmin = req.user!.role === 'TEACHER' || req.user!.role === 'ADMIN';

    const lesson = await prisma.lesson.findUnique({
      where: { id: req.params.lessonId },
      include: {
        course: { select: { title: true } },
        slides: {
          orderBy: { orderIndex: 'asc' },
          include: isTeacherOrAdmin ? { teacherNote: true } : undefined,
        },
        homework: isTeacherOrAdmin
          ? { orderBy: { orderIndex: 'asc' } }
          : {
              orderBy: { orderIndex: 'asc' },
              select: {
                id: true,
                questionText: true,
                exerciseType: true,
                options: true,
                orderIndex: true,
              },
            },
      },
    });

    if (!lesson) {
      res.status(404).json({ error: 'Урок не найден' });
      return;
    }

    res.json(lesson);
  } catch (error) {
    console.error('Get lesson error:', error);
    res.status(500).json({ error: 'Ошибка получения урока' });
  }
});
