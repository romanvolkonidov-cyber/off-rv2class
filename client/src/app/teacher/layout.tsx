import React from 'react';
import { Sidebar } from '@/lib/Sidebar'; // Using the Sidebar component you have in lib

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      
      <main className="flex-1 overflow-y-auto p-8">
        {children}
      </main>
    </div>
  );
}