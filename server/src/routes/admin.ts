import { Router, Response } from 'express';
import prisma from '../utils/prisma.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';
import { processSlideImages, createCollage } from '../services/imageProcessor.js';
import { generateLessonContent } from '../services/ai.js';

export const adminRouter = Router();

// All admin routes require authentication + ADMIN role
adminRouter.use(authenticate);
adminRouter.use(requireRole('ADMIN'));

// Multer config for PNG slide uploads
const storage = multer.diskStorage({
  destination: async (_req, _file, cb) => {
    const dir = path.join(process.cwd(), 'uploads', 'temp');
    await fs.mkdir(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Только PNG и JPEG файлы разрешены'));
    }
  },
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB per file
});

const audioUpload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-m4a'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Только MP3 и WAV файлы разрешены'));
    }
  },
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

const videoUpload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['video/mp4', 'video/webm'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Только MP4 и WebM файлы разрешены'));
    }
  },
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB
});

// ==========================================
// COURSES
// ==========================================

// GET /api/admin/courses
adminRouter.get('/courses', async (_req, res: Response): Promise<void> => {
  try {
    const courses = await prisma.course.findMany({
      include: { 
        lessons: { 
          select: { id: true, title: true, published: true, aiStatus: true, orderIndex: true },
          orderBy: { orderIndex: 'asc' }
        } 
      },
      orderBy: { orderIndex: 'asc' },
    });
    res.json(courses);
  } catch (error) {
    console.error('Get courses error:', error);
    res.status(500).json({ error: 'Ошибка получения курсов' });
  }
});

// POST /api/admin/courses
adminRouter.post('/courses', async (req, res: Response): Promise<void> => {
  try {
    const { title, description } = req.body;
    if (!title) {
      res.status(400).json({ error: 'Название курса обязательно' });
      return;
    }

    const course = await prisma.course.create({
      data: { title, description },
    });
    res.status(201).json(course);
  } catch (error) {
    console.error('Create course error:', error);
    res.status(500).json({ error: 'Ошибка создания курса' });
  }
});

// PUT /api/admin/courses/:id
adminRouter.put('/courses/:id', async (req, res: Response): Promise<void> => {
  try {
    const { title, description, orderIndex } = req.body;
    const course = await prisma.course.update({
      where: { id: req.params.id },
      data: { title, description, orderIndex },
    });
    res.json(course);
  } catch (error) {
    console.error('Update course error:', error);
    res.status(500).json({ error: 'Ошибка обновления курса' });
  }
});

// DELETE /api/admin/courses/:id
adminRouter.delete('/courses/:id', async (req, res: Response): Promise<void> => {
  try {
    await prisma.course.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete course error:', error);
    res.status(500).json({ error: 'Ошибка удаления курса' });
  }
});

// ==========================================
// LESSONS
// ==========================================

// POST /api/admin/courses/:courseId/lessons
adminRouter.post('/courses/:courseId/lessons', async (req, res: Response): Promise<void> => {
  try {
    const { title } = req.body;
    if (!title) {
      res.status(400).json({ error: 'Название урока обязательно' });
      return;
    }

    const lesson = await prisma.lesson.create({
      data: {
        title,
        courseId: req.params.courseId,
      },
    });
    res.status(201).json(lesson);
  } catch (error) {
    console.error('Create lesson error:', error);
    res.status(500).json({ error: 'Ошибка создания урока' });
  }
});

// GET /api/admin/lessons/:lessonId
adminRouter.get('/lessons/:lessonId', async (req, res: Response): Promise<void> => {
  try {
    const lesson = await prisma.lesson.findUnique({
      where: { id: req.params.lessonId },
      include: {
        slides: {
          include: { teacherNote: true },
          orderBy: { orderIndex: 'asc' },
        },
        homework: { orderBy: { orderIndex: 'asc' } },
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

// PUT /api/admin/lessons/:lessonId/publish
adminRouter.put('/lessons/:lessonId/publish', async (req, res: Response): Promise<void> => {
  try {
    const { published } = req.body;
    const lesson = await prisma.lesson.update({
      where: { id: req.params.lessonId },
      data: { published },
    });
    res.json(lesson);
  } catch (error) {
    console.error('Publish lesson error:', error);
    res.status(500).json({ error: 'Ошибка публикации урока' });
  }
});

// ==========================================
// SLIDE UPLOAD + AI PIPELINE
// ==========================================

// POST /api/admin/lessons/:lessonId/slides — Upload slides and trigger AI
adminRouter.post(
  '/lessons/:lessonId/slides',
  upload.array('slides', 30),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { lessonId } = req.params;
      const files = req.files as Express.Multer.File[];

      if (!files || files.length === 0) {
        res.status(400).json({ error: 'Файлы слайдов обязательны' });
        return;
      }

      // Update lesson status
      await prisma.lesson.update({
        where: { id: lessonId },
        data: { aiStatus: 'processing' },
      });

      // Process images: resize + compress
      const processedSlides = await processSlideImages(lessonId, files);
      
      // Create economical collage
      const collagePath = await createCollage(lessonId, processedSlides.map(s => s.compressedPath));

      // Save slides to DB
      const slideRecords = await Promise.all(
        processedSlides.map((slide, index) =>
          prisma.slide.create({
            data: {
              lessonId,
              orderIndex: index,
              imageUrl: slide.compressedPath,
              originalUrl: slide.originalPath,
            },
          })
        )
      );

      // Trigger AI content generation (async — don't block the response)
      generateLessonContent(lessonId, collagePath, processedSlides.length)
        .then(async (content) => {
          // Save teacher notes
          for (const note of content.teacher_notes) {
            const slide = slideRecords[note.slide_number - 1];
            if (slide) {
              await prisma.teacherNote.create({
                data: {
                  slideId: slide.id,
                  suggestedQuestions: JSON.stringify(note.questions),
                  correctAnswers: JSON.stringify(note.answers),
                  tips: note.tips || null,
                },
              });
            }
          }

          // Save homework
          for (let i = 0; i < content.homework.length; i++) {
            const hw = content.homework[i];
            await prisma.homework.create({
              data: {
                lessonId,
                questionText: hw.question_text,
                exerciseType: hw.exercise_type,
                options: hw.options ? JSON.stringify(hw.options) : null,
                correctAnswer: hw.correct_answer,
                needsHumanGrading: hw.needs_human_grading,
                orderIndex: i,
              },
            });
          }

          await prisma.lesson.update({
            where: { id: lessonId },
            data: { 
              aiStatus: 'completed',
              listeningScript: content.listening_script || null,
            },
          });

          console.log(`✅ AI content generated for lesson ${lessonId}`);
        })
        .catch(async (error) => {
          console.error(`❌ AI generation failed for lesson ${lessonId}:`, error);
          await prisma.lesson.update({
            where: { id: lessonId },
            data: { aiStatus: 'failed' },
          });
        });

      res.status(201).json({
        message: 'Слайды загружены. ИИ генерирует материалы...',
        slides: slideRecords,
        aiStatus: 'processing',
      });
    } catch (error) {
      console.error('Upload slides error:', error);
      res.status(500).json({ error: 'Ошибка загрузки слайдов' });
    }
  }
);

// POST /api/admin/slides/:slideId/audio — Attach audio to slide
adminRouter.post('/slides/:slideId/audio', audioUpload.single('audio'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { slideId } = req.params;
    const file = req.file;

    if (!file) {
      res.status(400).json({ error: 'Аудио файл обязателен' });
      return;
    }

    const audioUrl = `/uploads/temp/${file.filename}`; // Or move to persistent storage
    const slide = await prisma.slide.update({
      where: { id: slideId },
      data: { audioUrl },
    });

    res.json(slide);
  } catch (error) {
    console.error('Attach slide audio error:', error);
    res.status(500).json({ error: 'Ошибка загрузки аудио к слайду' });
  }
});

// POST /api/admin/slides/:slideId/video — Attach video to slide
adminRouter.post('/slides/:slideId/video', videoUpload.single('video'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { slideId } = req.params;
    const file = req.file;

    if (!file) {
      res.status(400).json({ error: 'Видео файл обязателен' });
      return;
    }

    const videoUrl = `/uploads/temp/${file.filename}`;
    const slide = await prisma.slide.update({
      where: { id: slideId },
      data: { videoUrl },
    });

    res.json(slide);
  } catch (error) {
    console.error('Attach slide video error:', error);
    res.status(500).json({ error: 'Ошибка загрузки видео к слайду' });
  }
});

// PUT /api/admin/slides/:slideId — Update slide widget coords
adminRouter.put('/slides/:slideId', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { audioWidgetX, audioWidgetY, audioWidgetScale } = req.body;
    const slide = await prisma.slide.update({
      where: { id: req.params.slideId },
      data: { audioWidgetX, audioWidgetY, audioWidgetScale },
    });
    res.json(slide);
  } catch (error) {
    console.error('Update slide coords error:', error);
    res.status(500).json({ error: 'Ошибка обновления слайда' });
  }
});

// ==========================================
// EDIT AI-GENERATED CONTENT
// ==========================================

// PUT /api/admin/teacher-notes/:noteId
adminRouter.put('/teacher-notes/:noteId', async (req, res: Response): Promise<void> => {
  try {
    const { suggestedQuestions, correctAnswers, tips } = req.body;
    const note = await prisma.teacherNote.update({
      where: { id: req.params.noteId },
      data: { suggestedQuestions, correctAnswers, tips },
    });
    res.json(note);
  } catch (error) {
    console.error('Update teacher note error:', error);
    res.status(500).json({ error: 'Ошибка обновления заметки' });
  }
});

// PUT /api/admin/homework/:homeworkId
adminRouter.put('/homework/:homeworkId', async (req, res: Response): Promise<void> => {
  try {
    const { questionText, exerciseType, options, correctAnswer } = req.body;
    const hw = await prisma.homework.update({
      where: { id: req.params.homeworkId },
      data: { questionText, exerciseType, options, correctAnswer },
    });
    res.json(hw);
  } catch (error) {
    console.error('Update homework error:', error);
    res.status(500).json({ error: 'Ошибка обновления задания' });
  }
});

// PUT /api/admin/lessons/:id/script — Update AI listening script
adminRouter.put('/lessons/:id/script', async (req, res: Response): Promise<void> => {
  try {
    const { listeningScript } = req.body;
    const lesson = await prisma.lesson.update({
      where: { id: req.params.id },
      data: { listeningScript },
    });
    res.json(lesson);
  } catch (error) {
    console.error('Update lesson script error:', error);
    res.status(500).json({ error: 'Ошибка обновления сценария' });
  }
});

// POST /api/admin/homework/:homeworkId/audio — Attach audio to homework
adminRouter.post('/homework/:homeworkId/audio', audioUpload.single('audio'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { homeworkId } = req.params;
    const file = req.file;

    if (!file) {
      res.status(400).json({ error: 'Аудио файл обязателен' });
      return;
    }

    const audioUrl = `/uploads/temp/${file.filename}`;
    const hw = await prisma.homework.update({
      where: { id: homeworkId },
      data: { audioUrl },
    });

    res.json(hw);
  } catch (error) {
    console.error('Attach homework audio error:', error);
    res.status(500).json({ error: 'Ошибка загрузки аудио к заданию' });
  }
});

// POST /api/admin/lessons/:lessonId/homework — Manually add homework question
adminRouter.post('/lessons/:lessonId/homework', async (req, res: Response): Promise<void> => {
  try {
    const { questionText, exerciseType, options, correctAnswer } = req.body;

    const maxOrder = await prisma.homework.findFirst({
      where: { lessonId: req.params.lessonId },
      orderBy: { orderIndex: 'desc' },
    });

    const hw = await prisma.homework.create({
      data: {
        lessonId: req.params.lessonId,
        questionText,
        exerciseType,
        options,
        correctAnswer,
        orderIndex: (maxOrder?.orderIndex || 0) + 1,
      },
    });
    res.status(201).json(hw);
  } catch (error) {
    console.error('Add homework error:', error);
    res.status(500).json({ error: 'Ошибка добавления задания' });
  }
});

// DELETE /api/admin/homework/:homeworkId
adminRouter.delete('/homework/:homeworkId', async (req, res: Response): Promise<void> => {
  try {
    await prisma.homework.delete({ where: { id: req.params.homeworkId } });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete homework error:', error);
    res.status(500).json({ error: 'Ошибка удаления задания' });
  }
});

// ==========================================
// USERS MANAGEMENT
// ==========================================

// GET /api/admin/users
adminRouter.get('/users', async (req, res: Response): Promise<void> => {
  try {
    const { role } = req.query;
    const users = await prisma.user.findMany({
      where: role ? { role: role as any } : undefined,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        subscription: true,
        _count: { select: { students: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Ошибка получения пользователей' });
  }
});
