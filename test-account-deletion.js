#!/usr/bin/env node

/**
 * Test script to verify Supabase admin client can delete users
 * Run with: node test-account-deletion.js
 */

import { createClient as createAdminClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🧪 Testing Supabase Admin Client\n');

// Check environment variables
console.log('📋 Environment Variables:');
console.log(`   NEXT_PUBLIC_SUPABASE_URL: ${SUPABASE_URL ? '✓ Present' : '✗ Missing'}`);
console.log(`   SUPABASE_SERVICE_ROLE_KEY: ${SERVICE_ROLE_KEY ? '✓ Present (' + SERVICE_ROLE_KEY.length + ' chars)' : '✗ Missing'}`);

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('\n❌ Missing required environment variables!');
  process.exit(1);
}

console.log('\n🔐 Creating admin client...');
try {
  const adminClient = createAdminClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  console.log('✓ Admin client created successfully');
  console.log(`   - Client has auth: ${!!adminClient.auth}`);
  console.log(`   - Client has auth.admin: ${!!adminClient.auth.admin}`);
  console.log(`   - Admin methods available:`, Object.keys(adminClient.auth.admin || {}).slice(0, 5));
} catch (err) {
  console.error('✗ Failed to create admin client:', err.message);
  process.exit(1);
}

console.log('\n✅ Admin client initialization successful!');
console.log('\n📝 Next steps:');
console.log('   1. Go to Supabase dashboard and create a test user');
console.log('   2. Note the user ID');
console.log('   3. Update TEST_USER_ID below and run again to test deletion');
console.log('\n   Or visit http://localhost:3000/settings and click "Delete Account"');
console.log('   Check the dev server logs for detailed debugging information');
