const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function testParse() {
  if (!process.env.GEMINI_API_KEY) {
    console.error('ERROR: GEMINI_API_KEY not set!');
    return;
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'models/gemini-2.0-flash' });

    const testText = `Najib Oladosu Ibadan, Nigeria | @najibaio | 07018135061

EDUCATION
University of Ibadan
Bachelor of Science in Electrical and Electronics Engineering 2023

EXPERIENCE
Senior Software Engineer 2022-2023
Led development of cloud infrastructure
Managed team of 5 engineers

SKILLS
Python, JavaScript, React, Node.js, AWS`;

    const prompt = `Extract JSON from this resume:
${testText}

Return ONLY this JSON structure with no other text:
{"education": [], "experience": [], "skills": {"technical": [], "soft": [], "other": []}, "achievements": [], "certifications": [], "keywords": [], "raw_highlights": []}`;

    console.log('Testing Gemini API...');
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    console.log('✅ API Response received');
    console.log('Response:', text.substring(0, 300));
    
    try {
      const parsed = JSON.parse(text);
      console.log('✅ Valid JSON parsed');
      console.log('Data:', JSON.stringify(parsed, null, 2));
    } catch (e) {
      console.log('⚠️ Response is not valid JSON');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testParse();
