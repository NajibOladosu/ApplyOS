#!/usr/bin/env node

/**
 * Test script to verify Supabase REST API user deletion works
 * Run with: node test-delete-user.js <USER_ID>
 * Example: node test-delete-user.js 12345678-1234-1234-1234-123456789012
 */

import dotenv from 'dotenv';
import fetch from 'node-fetch';

// Load environment variables
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TEST_USER_ID = process.argv[2];

console.log('🧪 Testing Supabase User Deletion via REST API\n');

// Check environment variables
console.log('📋 Environment Check:');
console.log(`   NEXT_PUBLIC_SUPABASE_URL: ${SUPABASE_URL ? '✓' : '✗'}`);
console.log(`   SUPABASE_SERVICE_ROLE_KEY: ${SERVICE_ROLE_KEY ? '✓ (' + SERVICE_ROLE_KEY.length + ' chars)' : '✗'}`);
console.log(`   User ID to delete: ${TEST_USER_ID || '✗ (provide as argument)'}\n`);

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !TEST_USER_ID) {
  console.error('❌ Missing required values!');
  console.log('\nUsage: node test-delete-user.js <USER_ID>');
  console.log('Example: node test-delete-user.js 550e8400-e29b-41d4-a716-446655440000');
  process.exit(1);
}

(async () => {
  try {
    const deleteUrl = `${SUPABASE_URL}/auth/v1/admin/users/${TEST_USER_ID}`;

    console.log('📤 Sending DELETE request...');
    console.log(`   URL: ${deleteUrl}`);
    console.log(`   Headers: Authorization (Bearer), apikey, Content-Type`);

    const response = await fetch(deleteUrl, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'apikey': SERVICE_ROLE_KEY,
      },
    });

    console.log(`\n📊 Response Status: ${response.status} ${response.statusText}`);

    // Try to parse response body
    let responseBody = null;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      responseBody = await response.json();
      console.log(`📋 Response Body:`, JSON.stringify(responseBody, null, 2));
    } else {
      const text = await response.text();
      if (text) {
        console.log(`📋 Response Body:`, text);
      } else {
        console.log(`📋 Response Body: (empty - typical for 204 No Content)`);
      }
    }

    if (response.ok) {
      console.log(`\n✅ User deletion successful!`);
      console.log(`   Status ${response.status} means the user was deleted from auth.users`);
    } else {
      console.error(`\n❌ User deletion failed!`);
      console.error(`   Status: ${response.status}`);
      console.error(`   This could mean:`);
      if (response.status === 401) {
        console.error(`   - Invalid or expired service role key`);
        console.error(`   - Generate a fresh key from Supabase dashboard → Settings → API`);
      } else if (response.status === 404) {
        console.error(`   - User not found (may have already been deleted)`);
      } else if (response.status === 400) {
        console.error(`   - Invalid request format`);
      }
    }

  } catch (err) {
    console.error('❌ Error during test:', err.message);
    if (err.stack) {
      console.error('\nStack trace:', err.stack);
    }
  }
})();
