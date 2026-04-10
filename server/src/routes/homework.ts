import { Router, Response } from 'express';
import prisma from '../utils/prisma.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

export const homeworkRouter = Router();

homeworkRouter.use(authenticate);

// GET /api/homework/lesson/:lessonId — Get homework for a lesson
homeworkRouter.get('/lesson/:lessonId', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const isTeacherOrAdmin = req.user!.role === 'TEACHER' || req.user!.role === 'ADMIN';

    const homework = await prisma.homework.findMany({
      where: { lessonId: req.params.lessonId as string },
      orderBy: { orderIndex: 'asc' },
      select: {
        id: true,
        questionText: true,
        exerciseType: true,
        options: true,
        orderIndex: true,
        correctAnswer: isTeacherOrAdmin, // Only show correct answer to teacher/admin
      },
    });

    res.json(homework);
  } catch (error) {
    console.error('Get homework error:', error);
    res.status(500).json({ error: 'Ошибка получения заданий' });
  }
});
