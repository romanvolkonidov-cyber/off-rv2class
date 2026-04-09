import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import prisma from '../utils/prisma.js';
import { AuthPayload } from '../middleware/auth.js';


interface ClassroomSocket extends Socket {
  user?: AuthPayload;
  sessionId?: string;
}

export function setupSocket(io: SocketIOServer): void {
  // JWT Authentication middleware for WebSocket connections
  io.use((socket: ClassroomSocket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Токен авторизации не предоставлен'));
    }

    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret') as AuthPayload;
      socket.user = payload;
      next();
    } catch {
      next(new Error('Недействительный токен'));
    }
  });

  io.on('connection', (socket: ClassroomSocket) => {
    console.log(`🔌 Connected: ${socket.user?.userId} (${socket.user?.role})`);

    // ==========================================
    // ROOM MANAGEMENT
    // ==========================================

    // Teacher creates a classroom room
    socket.on('create_room', async (data: { sessionId: string }) => {
      if (socket.user?.role !== 'TEACHER') return;

      socket.sessionId = data.sessionId;
      await socket.join(`classroom:${data.sessionId}`);
      console.log(`📚 Teacher created room: classroom:${data.sessionId}`);

      socket.emit('room_created', { sessionId: data.sessionId });
    });

    // Student joins a classroom room
    socket.on('join_room', async (data: { sessionId: string }) => {
      if (socket.user?.role !== 'STUDENT') return;

      socket.sessionId = data.sessionId;
      await socket.join(`classroom:${data.sessionId}`);
      console.log(`🎒 Student joined room: classroom:${data.sessionId}`);

      // Get current state and send to the joining student
      const session = await prisma.classSession.findUnique({
        where: { id: data.sessionId },
      });

      if (session) {
        socket.emit('sync_state', {
          currentSlide: session.currentSlide,
          canvasStates: session.canvasStates ? JSON.parse(session.canvasStates) : {},
          studentCanAnnotate: session.studentCanAnnotate,
        });
      }

      // Notify teacher that a student joined
      socket.to(`classroom:${data.sessionId}`).emit('student_joined', {
        userId: socket.user?.userId,
      });
    });

    // Leave room
    socket.on('leave_room', () => {
      if (socket.sessionId) {
        socket.leave(`classroom:${socket.sessionId}`);
        socket.to(`classroom:${socket.sessionId}`).emit('user_left', {
          userId: socket.user?.userId,
          role: socket.user?.role,
        });
      }
    });

    // ==========================================
    // SLIDE SYNCHRONIZATION
    // ==========================================

    socket.on('change_slide', async (data: { slideIndex: number; canvasState?: string }) => {
      if (socket.user?.role !== 'TEACHER' || !socket.sessionId) return;

      // Update database
      const updateData: any = { currentSlide: data.slideIndex };

      // Save canvas state for the slide we're leaving
      if (data.canvasState) {
        const session = await prisma.classSession.findUnique({
          where: { id: socket.sessionId },
        });

        const canvasStates = session?.canvasStates
          ? JSON.parse(session.canvasStates)
          : {};

        // The canvasState is for the PREVIOUS slide
        // data.canvasState contains the state to save
        canvasStates[data.slideIndex] = data.canvasState;
        updateData.canvasStates = JSON.stringify(canvasStates);
      }

      await prisma.classSession.update({
        where: { id: socket.sessionId },
        data: updateData,
      });

      // Broadcast to all in room (including sender for confirmation)
      io.to(`classroom:${socket.sessionId}`).emit('slide_changed', {
        slideIndex: data.slideIndex,
      });
    });

    // ==========================================
    // WHITEBOARD / CANVAS ANNOTATIONS
    // ==========================================

    // A path was drawn on the canvas
    socket.on('canvas:path_created', (data: { path: any; slideIndex: number }) => {
      if (!socket.sessionId) return;

      // Broadcast to everyone else in the room
      socket.to(`classroom:${socket.sessionId}`).emit('canvas:path_created', {
        path: data.path,
        slideIndex: data.slideIndex,
        userId: socket.user?.userId,
        role: socket.user?.role,
      });
    });

    // Text was created or updated on the canvas
    socket.on('canvas:text_update', (data: { textId: string; text: string; x: number; y: number; slideIndex: number }) => {
      if (!socket.sessionId) return;

      socket.to(`classroom:${socket.sessionId}`).emit('canvas:text_update', {
        ...data,
        userId: socket.user?.userId,
        role: socket.user?.role,
      });
    });

    socket.on('canvas:text_delete', (data: { textId: string; slideIndex: number }) => {
      if (!socket.sessionId) return;
      socket.to(`classroom:${socket.sessionId}`).emit('canvas:text_delete', data);
    });

    // Object erased from canvas
    socket.on('canvas:object_removed', (data: { objectId: string; slideIndex: number }) => {
      if (!socket.sessionId) return;

      socket.to(`classroom:${socket.sessionId}`).emit('canvas:object_removed', {
        objectId: data.objectId,
        slideIndex: data.slideIndex,
      });
    });

    // Canvas cleared
    socket.on('canvas:clear', (data: { slideIndex: number }) => {
      if (socket.user?.role !== 'TEACHER' || !socket.sessionId) return;

      socket.to(`classroom:${socket.sessionId}`).emit('canvas:clear', {
        slideIndex: data.slideIndex,
      });
    });

    // Save canvas state (periodic or on slide change)
    socket.on('canvas:save_state', async (data: {
      slideIndex: number;
      canvasJSON: string;
    }) => {
      if (socket.user?.role !== 'TEACHER' || !socket.sessionId) return;

      const session = await prisma.classSession.findUnique({
        where: { id: socket.sessionId },
      });

      const canvasStates = session?.canvasStates
        ? JSON.parse(session.canvasStates)
        : {};

      canvasStates[data.slideIndex] = data.canvasJSON;

      await prisma.classSession.update({
        where: { id: socket.sessionId },
        data: { canvasStates: JSON.stringify(canvasStates) },
      });
    });

    socket.on('session:toggle_annotation', async (data: { canAnnotate: boolean }) => {
      if (socket.user?.role !== 'TEACHER' || !socket.sessionId) return;

      await prisma.classSession.update({
        where: { id: socket.sessionId },
        data: { studentCanAnnotate: data.canAnnotate },
      });

      socket.to(`classroom:${socket.sessionId}`).emit('session:annotation_toggled', {
        canAnnotate: data.canAnnotate,
      });
    });

    // Restore canvas state for a slide
    socket.on('canvas:request_state', async (data: { slideIndex: number }) => {
      if (!socket.sessionId) return;

      const session = await prisma.classSession.findUnique({
        where: { id: socket.sessionId },
      });

      const canvasStates = session?.canvasStates
        ? JSON.parse(session.canvasStates)
        : {};

      socket.emit('canvas:state_restored', {
        slideIndex: data.slideIndex,
        canvasJSON: canvasStates[data.slideIndex] || null,
      });
    });

    // ==========================================
    // AUDIO SYNCHRONIZATION
    // ==========================================

    socket.on('audio:play', (data: { currentTime: number; slideIndex: number }) => {
      if (socket.user?.role !== 'TEACHER' || !socket.sessionId) return;
      socket.to(`classroom:${socket.sessionId}`).emit('audio:play', data);
    });

    socket.on('audio:pause', (data: { currentTime: number; slideIndex: number }) => {
      if (socket.user?.role !== 'TEACHER' || !socket.sessionId) return;
      socket.to(`classroom:${socket.sessionId}`).emit('audio:pause', data);
    });

    socket.on('audio:seek', (data: { currentTime: number; slideIndex: number }) => {
      if (socket.user?.role !== 'TEACHER' || !socket.sessionId) return;
      socket.to(`classroom:${socket.sessionId}`).emit('audio:seek', data);
    });

    socket.on('video:play', (data: { currentTime: number; slideIndex: number }) => {
      if (socket.user?.role !== 'TEACHER' || !socket.sessionId) return;
      socket.to(`classroom:${socket.sessionId}`).emit('video:play', data);
    });

    socket.on('video:pause', (data: { currentTime: number; slideIndex: number }) => {
      if (socket.user?.role !== 'TEACHER' || !socket.sessionId) return;
      socket.to(`classroom:${socket.sessionId}`).emit('video:pause', data);
    });

    socket.on('video:seek', (data: { currentTime: number; slideIndex: number }) => {
      if (socket.user?.role !== 'TEACHER' || !socket.sessionId) return;
      socket.to(`classroom:${socket.sessionId}`).emit('video:seek', data);
    });

    // ==========================================
    // DISCONNECT
    // ==========================================

    socket.on('disconnect', () => {
      console.log(`🔌 Disconnected: ${socket.user?.userId}`);
      if (socket.sessionId) {
        socket.to(`classroom:${socket.sessionId}`).emit('user_left', {
          userId: socket.user?.userId,
          role: socket.user?.role,
        });
      }
    });
  });
}
