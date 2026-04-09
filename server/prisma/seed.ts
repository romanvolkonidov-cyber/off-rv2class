import bcrypt from 'bcryptjs';
import prisma from '../src/utils/prisma.js';

async function main() {
  console.log('🌱 Seeding database...');

  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@rv2class.ru' },
    update: {},
    create: {
      email: 'admin@rv2class.ru',
      password: adminPassword,
      name: 'Администратор',
      role: 'ADMIN',
    },
  });
  console.log(`✅ Admin created: ${admin.email}`);

  // Create a demo teacher
  const teacherPassword = await bcrypt.hash('teacher123', 12);
  const teacher = await prisma.user.upsert({
    where: { email: 'teacher@rv2class.ru' },
    update: {},
    create: {
      email: 'teacher@rv2class.ru',
      password: teacherPassword,
      name: 'Учитель Демо',
      role: 'TEACHER',
    },
  });
  console.log(`✅ Teacher created: ${teacher.email}`);

  // Create a demo student under the teacher
  const studentPassword = await bcrypt.hash('student123', 12);
  const student = await prisma.user.upsert({
    where: { email: 'student@rv2class.ru' },
    update: {},
    create: {
      email: 'student@rv2class.ru',
      password: studentPassword,
      name: 'Ученик Демо',
      role: 'STUDENT',
      teacherId: teacher.id,
    },
  });
  console.log(`✅ Student created: ${student.email}`);

  // Create a demo course
  const course = await prisma.course.upsert({
    where: { id: 'demo-course' },
    update: {},
    create: {
      id: 'demo-course',
      title: 'Английский для начинающих',
      description: 'Базовый курс английского языка для начинающих',
      orderIndex: 0,
    },
  });
  console.log(`✅ Course created: ${course.title}`);

  // Create a demo lesson
  const lesson = await prisma.lesson.upsert({
    where: { id: 'demo-lesson' },
    update: {},
    create: {
      id: 'demo-lesson',
      title: 'Present Simple — Введение',
      courseId: course.id,
      published: true,
      aiStatus: 'completed',
      orderIndex: 0,
    },
  });
  console.log(`✅ Lesson created: ${lesson.title}`);

  console.log('\n🎉 Seed completed!');
  console.log('\n📋 Login credentials:');
  console.log('  Admin:   admin@rv2class.ru   / admin123');
  console.log('  Teacher: teacher@rv2class.ru  / teacher123');
  console.log('  Student: student@rv2class.ru  / student123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
