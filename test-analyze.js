#!/usr/bin/env node

/**
 * Test the /api/documents/reprocess endpoint to verify parsed_data is populated correctly
 */

const docId = '63e7bfd8-beb0-4876-94a3-3a7785f9e1bb';
const baseUrl = 'http://localhost:3000';

async function testAnalyzeDocument() {
  console.log('🧪 Testing Analyze Document Feature...\n');
  console.log(`📄 Document ID: ${docId}`);
  console.log(`🌐 API Endpoint: POST ${baseUrl}/api/documents/reprocess\n`);

  try {
    console.log('⏳ Calling /api/documents/reprocess...');
    const response = await fetch(`${baseUrl}/api/documents/reprocess`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: docId,
        force: true,
      }),
    });

    console.log(`📡 Response Status: ${response.status}`);

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ API Error:', data.error);
      return;
    }

    console.log('\n✅ API Response received successfully\n');

    // Check if parsed_data exists and has content
    if (!data.parsed_data) {
      console.error('❌ FAIL: parsed_data is null or undefined');
      return;
    }

    const pd = data.parsed_data;
    console.log('📊 Parsed Data Summary:');
    console.log(`  - Education entries: ${Array.isArray(pd.education) ? pd.education.length : 0}`);
    console.log(`  - Experience entries: ${Array.isArray(pd.experience) ? pd.experience.length : 0}`);
    console.log(`  - Technical skills: ${Array.isArray(pd.skills?.technical) ? pd.skills.technical.length : 0}`);
    console.log(`  - Soft skills: ${Array.isArray(pd.skills?.soft) ? pd.skills.soft.length : 0}`);
    console.log(`  - Other skills: ${Array.isArray(pd.skills?.other) ? pd.skills.other.length : 0}`);
    console.log(`  - Achievements: ${Array.isArray(pd.achievements) ? pd.achievements.length : 0}`);
    console.log(`  - Certifications: ${Array.isArray(pd.certifications) ? pd.certifications.length : 0}`);
    console.log(`  - Keywords: ${Array.isArray(pd.keywords) ? pd.keywords.length : 0}`);

    // Validate that we have actual data
    const hasEducation = Array.isArray(pd.education) && pd.education.length > 0;
    const hasExperience = Array.isArray(pd.experience) && pd.experience.length > 0;
    const hasSkills = pd.skills && (pd.skills.technical?.length > 0 || pd.skills.soft?.length > 0 || pd.skills.other?.length > 0);

    console.log('\n✨ Data Validation:');
    console.log(`  ${hasEducation ? '✅' : '❌'} Education found`);
    console.log(`  ${hasExperience ? '✅' : '❌'} Experience found`);
    console.log(`  ${hasSkills ? '✅' : '❌'} Skills found`);

    if (hasEducation) {
      console.log('\n🎓 Sample Education:');
      const edu = pd.education[0];
      console.log(`  - Institution: ${edu.institution}`);
      console.log(`  - Degree: ${edu.degree}`);
      console.log(`  - Field: ${edu.field}`);
      console.log(`  - Dates: ${edu.start_date} to ${edu.end_date}`);
    }

    if (hasExperience) {
      console.log('\n💼 Sample Experience:');
      const exp = pd.experience[0];
      console.log(`  - Company: ${exp.company}`);
      console.log(`  - Role: ${exp.role}`);
      console.log(`  - Dates: ${exp.start_date} to ${exp.end_date}`);
      console.log(`  - Description: ${exp.description.substring(0, 100)}...`);
    }

    if (hasSkills) {
      console.log('\n🛠️ Skills Summary:');
      if (pd.skills.technical?.length > 0) {
        console.log(`  Technical (${pd.skills.technical.length}): ${pd.skills.technical.slice(0, 3).join(', ')}`);
      }
      if (pd.skills.soft?.length > 0) {
        console.log(`  Soft (${pd.skills.soft.length}): ${pd.skills.soft.slice(0, 3).join(', ')}`);
      }
      if (pd.skills.other?.length > 0) {
        console.log(`  Other (${pd.skills.other.length}): ${pd.skills.other.slice(0, 3).join(', ')}`);
      }
    }

    console.log('\n' + '='.repeat(50));
    if (hasEducation && hasExperience && hasSkills) {
      console.log('✅ TEST PASSED: All data extracted successfully!');
    } else {
      console.log('⚠️ TEST INCOMPLETE: Some expected data is missing');
    }
    console.log('='.repeat(50));
  } catch (error) {
    console.error('❌ Test Error:', error.message);
    console.error('\nMake sure:');
    console.error('1. Dev server is running (npm run dev)');
    console.error('2. You have set GEMINI_API_KEY in .env.local');
    console.error('3. Document ID exists in database');
  }
}

testAnalyzeDocument();
