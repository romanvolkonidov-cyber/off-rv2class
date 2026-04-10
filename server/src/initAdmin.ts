import prisma from './utils/prisma.js';
import admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config();
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '{}');

if (!serviceAccount.project_id) {
  console.error('❌ Missing FIREBASE_SERVICE_ACCOUNT_JSON in server/.env');
  process.exit(1);
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const demoUsers = [
  { email: 'romanvolkonidov@gmail.com', password: 'admin123', name: 'Roman Volkonidov', role: 'ADMIN' },
  { email: 'teacher@rv2class.ru', password: 'teacher123', name: 'Demo Teacher', role: 'TEACHER' },
  { email: 'student@rv2class.ru', password: 'student123', name: 'Demo Student', role: 'STUDENT' },
];

async function initialize() {
  console.log('🚀 Programmatic Initialization started...');
  
  for (const user of demoUsers) {
    try {
      let fbUser;
      try {
        // 1. Create in Firebase
        fbUser = await admin.auth().createUser({
          email: user.email,
          password: user.password,
          displayName: user.name,
        });
        console.log(`✅ Firebase: Created ${user.email}`);
      } catch (e: any) {
        if (e.code === 'auth/email-already-exists') {
          fbUser = await admin.auth().getUserByEmail(user.email);
          console.log(`ℹ️ Firebase: User ${user.email} already exists`);
        } else {
          throw e;
        }
      }

      // 2. Create in Prisma
      const existingUser = await prisma.user.findUnique({ where: { email: user.email } });
      if (!existingUser) {
        await prisma.user.create({
          data: {
            email: user.email,
            name: user.name,
            role: user.role as any,
            password: 'firebase_managed', // we don't store raw passwords, Firebase handles auth
          }
        });
        console.log(`✅ Prisma: Created ${user.email} with role ${user.role}`);
      } else {
        await prisma.user.update({
          where: { email: user.email },
          data: { role: user.role as any }
        });
        console.log(`ℹ️ Prisma: Updated role to ${user.role} for ${user.email}`);
      }
    } catch (error: any) {
      console.error(`❌ Error processing ${user.email}:`, error.message);
    }
  }
  
  console.log('\n✨ Programmatic access setup complete.');
  await prisma.$disconnect();
  process.exit(0);
}

initialize();
