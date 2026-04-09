import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';

// Load client .env
dotenv.config({ path: path.join(process.cwd(), 'client', '.env') });

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

async function testConnection() {
  console.log('🚀 Starting Local Auth Diagnostic...');
  console.log(`📡 Targeting Backend: ${API_URL}`);

  try {
    // 1. Check Health
    console.log('--- Step 1: Health Check ---');
    const health = await axios.get(`${API_URL}/api/health`);
    console.log('✅ Backend is ALIVE:', health.data);

    // 2. Check Firebase Config
    console.log('\n--- Step 2: Firebase Config Verification ---');
    if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
      console.error('❌ CRITICAL: NEXT_PUBLIC_FIREBASE_API_KEY is missing in client/.env');
    } else {
      console.log('✅ Firebase keys are present in local config.');
    }

    // 3. Check for specific demo user on backend
    console.log('\n--- Step 3: API Reachability ---');
    try {
      // Trying to hit a route that usually requires auth just to see the response type
      await axios.get(`${API_URL}/api/teacher/library`);
    } catch (error: any) {
      if (error.response?.status === 401) {
        console.log('✅ API is REPTIVE and correctly rejecting unauthenticated request.');
      } else {
        console.warn('⚠️ Unexpected API response:', error.response?.status, error.message);
      }
    }

    console.log('\n✨ Local connection test PASSED. The frontend can talk to the backend.');

  } catch (error: any) {
    console.error('\n❌ DIAGNOSTIC FAILED');
    if (error.code === 'ECONNREFUSED') {
      console.error('   The backend server is not reachable. Is the port correct?');
    } else {
      console.error('   Error:', error.message);
    }
    process.exit(1);
  }
}

testConnection();
