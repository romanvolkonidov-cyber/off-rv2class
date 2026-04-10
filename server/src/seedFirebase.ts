import admin from 'firebase-admin';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), 'server', '.env') });

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '{}');

if (!serviceAccount.project_id) {
  console.error('❌ Missing FIREBASE_SERVICE_ACCOUNT_JSON in server/.env');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const demoUsers = [
  { email: 'admin@rv2class.ru', password: 'admin123', displayName: 'Admin' },
  { email: 'teacher@rv2class.ru', password: 'teacher123', displayName: 'Teacher' },
  { email: 'student@rv2class.ru', password: 'student123', displayName: 'Student' },
];

async function seed() {
  console.log('🚀 Seeding Demo Users into Firebase Auth...');
  
  for (const user of demoUsers) {
    try {
      await admin.auth().createUser({
        email: user.email,
        password: user.password,
        displayName: user.displayName,
      });
      console.log(`✅ Created: ${user.email}`);
    } catch (error: any) {
      if (error.code === 'auth/email-already-exists') {
        console.log(`ℹ️ Already exists: ${user.email}`);
      } else {
        console.error(`❌ Error creating ${user.email}:`, error.message);
      }
    }
  }
  
  console.log('\n✨ Seeding Complete. You can now log in with these accounts!');
  process.exit(0);
}

seed();
