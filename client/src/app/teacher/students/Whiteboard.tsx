"use client";

import React, { useEffect, useRef, useState } from 'react';
import { fabric } from 'fabric';
import { Socket } from 'socket.io-client';

interface WhiteboardProps {
  socket: Socket | null;
  slideIndex: number;
  isTeacher: boolean;
  tool: 'cursor' | 'pen' | 'eraser';
  color?: string;
}

export function Whiteboard({ socket, slideIndex, isTeacher, tool, color = '#ff0000' }: WhiteboardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fabricCanvas, setFabricCanvas] = useState<fabric.Canvas | null>(null);

  // Initialize Fabric Canvas
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = new fabric.Canvas(canvasRef.current, {
      isDrawingMode: tool === 'pen',
      width: 1280, // Internal resolution stays fixed for perfect sync
      height: 720, // Internal resolution stays fixed for perfect sync
      backgroundColor: 'transparent',
    });

    canvas.freeDrawingBrush.color = color;
    canvas.freeDrawingBrush.width = 4;

    setFabricCanvas(canvas);

    return () => {
      canvas.dispose();
    };
  }, []); // Empty dependency array, init only once

  // Handle Tool Changes
  useEffect(() => {
    if (!fabricCanvas) return;
    fabricCanvas.isDrawingMode = tool === 'pen';
    fabricCanvas.freeDrawingBrush.color = color;

    // Eraser Logic
    const handleMouseDown = (opt: fabric.IEvent) => {
      if (tool === 'eraser' && opt.target) {
        fabricCanvas.remove(opt.target);
        if (opt.target.name && socket) {
          socket.emit('canvas:object_removed', { objectId: opt.target.name, slideIndex });
        }
      }
    };

    if (tool === 'eraser') {
      fabricCanvas.on('mouse:down', handleMouseDown);
      fabricCanvas.defaultCursor = 'crosshair';
      fabricCanvas.forEachObject(obj => { obj.selectable = true; obj.evented = true; });
    } else {
      fabricCanvas.off('mouse:down', handleMouseDown);
      fabricCanvas.defaultCursor = 'default';
      fabricCanvas.forEachObject(obj => { obj.selectable = false; obj.evented = false; });
    }

    return () => fabricCanvas.off('mouse:down', handleMouseDown);
  }, [tool, color, fabricCanvas, socket, slideIndex]);

  // Handle Socket Events & Emitting
  useEffect(() => {
    if (!fabricCanvas || !socket) return;

    // 1. When I draw something, emit to server
    const handlePathCreated = (e: any) => {
      const path = e.path;
      if (path) {
        // Assign a unique ID so it can be erased later
        path.set({ name: Math.random().toString(36).substring(2, 9) });
        socket.emit('canvas:path_created', {
          path: path.toJSON(),
          slideIndex,
        });
      }
    };

    fabricCanvas.on('path:created', handlePathCreated);

    // 2. When someone else draws, render it
    const handleRemotePath = (data: { path: any; slideIndex: number }) => {
      if (data.slideIndex !== slideIndex) return; // Only draw if on the same slide
      
      fabric.util.enlivenObjects([data.path], (objects: fabric.Object[]) => {
        objects.forEach((obj) => {
          // Ensure incoming paths aren't movable unless the eraser is active
          obj.selectable = tool === 'eraser';
          obj.evented = tool === 'eraser';
          fabricCanvas.add(obj);
        });
        fabricCanvas.renderAll();
      }, 'fabric');
    };

    socket.on('canvas:path_created', handleRemotePath);
    
    socket.on('canvas:clear', (data: { slideIndex: number }) => {
      if (data.slideIndex === slideIndex) {
        fabricCanvas.clear();
        fabricCanvas.setBackgroundColor('transparent', fabricCanvas.renderAll.bind(fabricCanvas));
      }
    });
    
    socket.on('canvas:object_removed', (data: { objectId: string; slideIndex: number }) => {
      if (data.slideIndex === slideIndex) {
        const objToRemove = fabricCanvas.getObjects().find(obj => obj.name === data.objectId);
        if (objToRemove) fabricCanvas.remove(objToRemove);
      }
    });

    return () => {
      fabricCanvas.off('path:created', handlePathCreated);
      socket.off('canvas:path_created', handleRemotePath);
      socket.off('canvas:clear');
      socket.off('canvas:object_removed');
    };
  }, [fabricCanvas, socket, slideIndex]);

  return (
    <div className="absolute inset-0 w-full h-full pointer-events-auto [&>.canvas-container]:!w-full [&>.canvas-container]:!h-full [&_canvas]:!w-full [&_canvas]:!h-full [&_canvas]:!object-contain">
      <canvas ref={canvasRef} />
    </div>
  );
}