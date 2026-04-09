import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../utils/prisma.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import admin from '../utils/firebase-admin.js';

export const authRouter = Router();

// POST /api/auth/login
authRouter.post('/login', async (req, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email и пароль обязательны' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      res.status(401).json({ error: 'Неверный email или пароль' });
      return;
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      res.status(401).json({ error: 'Неверный email или пароль' });
      return;
    }

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// POST /api/auth/firebase-login
authRouter.post('/firebase-login', async (req, res: Response): Promise<void> => {
  try {
    const { idToken, name, role } = req.body;

    if (!idToken) {
      res.status(400).json({ error: 'ID Token обязателен' });
      return;
    }

    // Verify the Firebase token
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const email = decodedToken.email;

    if (!email) {
      res.status(400).json({ error: 'Не удалось получить email из токена' });
      return;
    }

    // Find user in our Prisma DB
    let user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      // If user doesn't exist, and they passed role=TEACHER, create a new Teacher
      if (role === 'TEACHER') {
        user = await prisma.user.create({
          data: {
            email,
            name: name || email.split('@')[0],
            password: 'FIREBASE_MANAGED_PASSWORD',
            role: 'TEACHER',
          },
        });
      } else {
        // If it's a student trying to log in but their email is not in DB
        res.status(403).json({ error: 'Аккаунт не найден. Преподаватель еще не добавил вас.' });
        return;
      }
    }

    // Generate our app's JWT token for the session
    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error: any) {
    console.error('Firebase Login error:', error);
    res.status(401).json({ error: 'Недействительный Firebase токен', details: error.message });
  }
});


// POST /api/auth/register/teacher (Open self-registration for teachers)
authRouter.post('/register/teacher', async (req, res: Response): Promise<void> => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      res.status(400).json({ error: 'Email, пароль и имя обязательны' });
      return;
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      res.status(409).json({ error: 'Пользователь с таким email уже существует' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const newUser = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: 'TEACHER',
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    const token = jwt.sign(
      { userId: newUser.id, role: newUser.role },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.status(201).json({
      token,
      user: newUser,
    });
  } catch (error) {
    console.error('Register teacher error:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// POST /api/auth/register (Admin creates teachers, Teachers create students)
authRouter.post('/register', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { email, password, name, role } = req.body;

    if (!email || !password || !name) {
      res.status(400).json({ error: 'Email, пароль и имя обязательны' });
      return;
    }

    // Only Admin can create Teachers, only Teachers can create Students
    if (req.user?.role === 'ADMIN' && role !== 'TEACHER') {
      // Admin can create anyone, but the main use case is creating teachers
    } else if (req.user?.role === 'TEACHER' && role !== 'STUDENT') {
      res.status(403).json({ error: 'Учитель может создавать только учеников' });
      return;
    } else if (req.user?.role === 'STUDENT') {
      res.status(403).json({ error: 'Ученик не может создавать пользователей' });
      return;
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      res.status(409).json({ error: 'Пользователь с таким email уже существует' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const newUser = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: role || 'STUDENT',
        teacherId: req.user?.role === 'TEACHER' ? req.user.userId : undefined,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    res.status(201).json(newUser);
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// GET /api/auth/me
authRouter.get('/me', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        subscription: req.user!.role === 'TEACHER' ? true : false,
      },
    });

    if (!user) {
      res.status(404).json({ error: 'Пользователь не найден' });
      return;
    }

    res.json(user);
  } catch (error) {
    console.error('Me error:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});
