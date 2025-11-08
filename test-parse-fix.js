// Test the markdown code fence parsing fix
const text1 = `\`\`\`json
{"education": [{"institution": "MIT", "degree": "BS", "field": "CS"}], "experience": [], "skills": {"technical": ["Python"], "soft": [], "other": []}, "achievements": [], "certifications": [], "keywords": [], "raw_highlights": []}
\`\`\``;

const text2 = `\`\`\`
{"education": [{"institution": "MIT", "degree": "BS", "field": "CS"}], "experience": [], "skills": {"technical": ["Python"], "soft": [], "other": []}, "achievements": [], "certifications": [], "keywords": [], "raw_highlights": []}
\`\`\``;

const text3 = `{"education": [{"institution": "MIT", "degree": "BS", "field": "CS"}], "experience": [], "skills": {"technical": ["Python"], "soft": [], "other": []}, "achievements": [], "certifications": [], "keywords": [], "raw_highlights": []}`;

function parseWithFix(text) {
  // Handle markdown code fences (```json...``` or ```...```)
  let jsonText = text
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (codeBlockMatch) {
    jsonText = codeBlockMatch[1].trim()
  }

  const jsonMatch = jsonText.match(/\{[\s\S]*\}$/)
  if (!jsonMatch) {
    return null
  }

  try {
    return JSON.parse(jsonMatch[0])
  } catch (error) {
    return null
  }
}

console.log('Test 1 (```json...```):');
const result1 = parseWithFix(text1);
console.log(result1 ? '✅ PASS' : '❌ FAIL');

console.log('\nTest 2 (```...```):');
const result2 = parseWithFix(text2);
console.log(result2 ? '✅ PASS' : '❌ FAIL');

console.log('\nTest 3 (plain JSON):');
const result3 = parseWithFix(text3);
console.log(result3 ? '✅ PASS' : '❌ FAIL');

console.log('\nAll tests:', (result1 && result2 && result3) ? '✅ PASS' : '❌ FAIL');
