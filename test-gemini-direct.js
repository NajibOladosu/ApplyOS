#!/usr/bin/env node

/**
 * Direct test of Gemini API to see what it returns for the resume text
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

const resumeText = `Najib Oladosu Ibadan, Nigeria | @najibaio | 07018135061 | najibaioladosu@gmail.com EDUCATION University of Ibadan Ibadan, Nigeria Bachelor of Science in Electrical and Electronics Engineering 2023 ●Object-oriented Programming, Data Structures and Algorithms, Database Development, Data Science, Data Analysis. KEY WORK EXPERIENCE Huawei Technologies Ltd. Lagos, Nigeria Python Developer / Network Solutions Engineer. September 2023–Present •Network Optimization: Spearheaded multiple WiFi 6/7 PoC projects, increasing client network throughput by 30% and lowering latency by 25%. Leveraged SD-WAN deployments to optimise network performance, reduce bandwidth costs by 20%, and improve scalability.•Automation & Monitoring: Developed Python scripts that automated critical network conﬁgurations and deployed monitoring systems, cutting deployment errors by 50% and reducing downtime by 15%. Implemented real-time data analysis solutions for early fault detection, improving network efﬁciency by 30%.•Operational Troubleshooting & Change Management: Engaged in high-impact troubleshooting for routing, interconnectivity, and hardware failures, collaborating with ISPs and vendors to restore service rapidly. Established change management protocols that ensured a smooth, compliant transition in network updates and enhancements.•Documentation & Knowledge Sharing: Created and maintained detailed documentation for network conﬁgurations, troubleshooting workﬂows, and best practices. This documentation facilitated sustainable, repeatable solutions across teams.•Customer Support & Training: Partnered with sales and engineering teams to support clients through technical training sessions, resulting in a 25% increase in proposal acceptance and a signiﬁcant boost in customer satisfaction.O'dua Telecoms Ltd. Ibadan, Nigeria Software Engineer Intern September 2021–February 2022 •Network Maintenance & Troubleshooting: Enhanced network stability by 30% through diligent troubleshooting and resolution of network and security issues. Optimised resource allocation strategies, achieving 15% cost savings and strengthening overall network resilience.•Process Automation & Efﬁciency: Developed Python applications that automated routine operational tasks, increasing team efﬁciency by 25%. Collaborated in the design and integration of APIs, expanding system capabilities and improving user engagement.•Technical Development & Support: Conducted Python-based data analysis for customer support, reaching 95% satisfaction through prompt technical assistance and training.KEY PROJECTS SD-WAN Implementation for Enterprise Clients•Enhanced Application Performance: Successfully deployed SD-WAN with QoS prioritisation for multiple organisations, improving critical application performance by 30% and reducing costs by 20%.•Interconnectivity Optimization: Collaborated with ISPs and third-party vendors to resolve connectivity challenges, ensuring smooth SD-WAN deployment and boosting network reliability by 25%.•Redundant Pathways: Leveraged SD-WAN's architecture to deploy redundant pathways and failover mechanisms, minimising service disruptions and enhancing operational stability.Intrusion & DDoS Detection System\\n•Advanced Security Measures: Developed a high-accuracy intrusion and DDoS detection system, achieving a 75% reduction in false positives and a 95% success rate in threat detection.•Machine Learning Integration: Integrated machine learning algorithms into the IDS/IPS, which reduced network threats by 60%, providing clients with a robust, proactive security layer.WiFi 6/7 Deployment for Financial Institutions•Network Optimization: Deployed WiFi 6/7 solutions across multiple client locations, enhancing network throughput by 30% and reducing interference by strategically placing access points.•Customer Satisfaction: Ensured a 25% boost in user satisfaction by implementing low-latency protocols, leading to more stable connectivity and consistent performance.Learning Management System (LMS) Development•Cross-functional Collaboration: Contributed to the development of a Learning Management System, implementing robust authentication and authorisation to secure user data.•User Experience: Achieved a 95% user satisfaction rating by optimising the frontend design and enhancing operational reliability.SKILLS • Networking: TCP/IP, BGP, MPLS, OSPF, WiFi 6/7, SD-WAN, Data Center Networking • Programming & Automation: Python, Shell/Bash, C++ • Frameworks & Tools: Django, Flask, Git, Docker, AWS EC2, Postman, Huawei iMaster-NCE •Database Management: MySQL, PostgreSQL CERTIFICATIONS • Udacity Machine Learning Program Graduate •iCode Institute of Programing Completion Program and Showcase ACHIEVEMENTS • 2nd place in Huawei ICT Competition Regional Stage • Published research paper on efficient DDoS attack detection and mitigation • Distinctions: Further Mathematics, General Mathematics, and Science - West African Certificate Examinations (2014).\\n`;

async function testGeminiAPI() {
  console.log('🧪 Testing Gemini API Response Format...\n');

  if (!process.env.GEMINI_API_KEY) {
    console.error('❌ Error: GEMINI_API_KEY not set in environment');
    return;
  }

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'models/gemini-2.0-flash' });

    const prompt = `Extract structured information from this resume/document:

${resumeText}

IMPORTANT: Return ONLY valid JSON (no markdown, no code fences, no extra text). Extract EVERYTHING you can find:

{
  "education": [
    {
      "institution": "school/university name",
      "degree": "Bachelor/Master/PhD/Certificate etc",
      "field": "major/subject",
      "start_date": "2020 or 2020-01",
      "end_date": "2024 or 2024-05",
      "description": "relevant coursework or achievements"
    }
  ],
  "experience": [
    {
      "company": "company name",
      "role": "job title",
      "start_date": "2022 or 2022-01",
      "end_date": "2023 or 2023-12",
      "description": "what you did, achievements, impact"
    }
  ],
  "skills": {
    "technical": ["Python", "JavaScript", "React", etc],
    "soft": ["Leadership", "Communication", etc],
    "other": ["Languages", "Tools", etc]
  },
  "achievements": ["Notable accomplishment 1", "Notable accomplishment 2"],
  "certifications": [
    {
      "name": "Certification name",
      "issuer": "Issuing organization",
      "date": "2023"
    }
  ],
  "keywords": ["Key terms", "Industries", "Technologies"],
  "raw_highlights": ["Bullet point 1", "Bullet point 2"]
}

Rules:
- Return ONLY the JSON object, nothing else
- Include ALL education found
- Include ALL work experience found
- Extract technical AND soft skills
- Use empty arrays [] if section not found
- Use empty strings "" for missing details
- NO markdown, NO code fences, NO explanations`;

    console.log('⏳ Calling Gemini API...\n');
    const startTime = Date.now();
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    const duration = Date.now() - startTime;

    console.log(`✅ API Response received in ${duration}ms\n`);
    console.log('📄 Raw Response (first 500 chars):');
    console.log(text.substring(0, 500));
    console.log('...\n');

    // Check if response has markdown code fences
    if (text.includes('```')) {
      console.log('⚠️ Response contains markdown code fences');
      const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (match) {
        console.log('📦 Extracted from code fence:\n', match[1].trim().substring(0, 300));
      }
    } else {
      console.log('✅ Response does NOT contain markdown code fences');
    }

    // Try to parse the JSON
    console.log('\n⏳ Attempting to parse JSON...');

    let jsonText = text;
    const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      jsonText = codeBlockMatch[1].trim();
    }

    const jsonMatch = jsonText.match(/\{[\s\S]*\}$/);
    if (!jsonMatch) {
      console.error('❌ Could not find JSON object in response');
      return;
    }

    try {
      const parsed = JSON.parse(jsonMatch[0]);
      console.log('✅ JSON parsed successfully!\n');

      console.log('📊 Parsed Data Summary:');
      console.log(`  - Education entries: ${Array.isArray(parsed.education) ? parsed.education.length : 0}`);
      console.log(`  - Experience entries: ${Array.isArray(parsed.experience) ? parsed.experience.length : 0}`);
      console.log(`  - Technical skills: ${Array.isArray(parsed.skills?.technical) ? parsed.skills.technical.length : 0}`);
      console.log(`  - Soft skills: ${Array.isArray(parsed.skills?.soft) ? parsed.skills.soft.length : 0}`);
      console.log(`  - Other skills: ${Array.isArray(parsed.skills?.other) ? parsed.skills.other.length : 0}`);
      console.log(`  - Achievements: ${Array.isArray(parsed.achievements) ? parsed.achievements.length : 0}`);
      console.log(`  - Certifications: ${Array.isArray(parsed.certifications) ? parsed.certifications.length : 0}`);

      // Validate that we have actual data
      const hasEducation = Array.isArray(parsed.education) && parsed.education.length > 0;
      const hasExperience = Array.isArray(parsed.experience) && parsed.experience.length > 0;
      const hasSkills = parsed.skills && (parsed.skills.technical?.length > 0 || parsed.skills.soft?.length > 0 || parsed.skills.other?.length > 0);

      console.log('\n✨ Validation:');
      console.log(`  ${hasEducation ? '✅' : '❌'} Education found`);
      console.log(`  ${hasExperience ? '✅' : '❌'} Experience found`);
      console.log(`  ${hasSkills ? '✅' : '❌'} Skills found`);

      if (hasEducation) {
        console.log('\n🎓 Sample Education:');
        const edu = parsed.education[0];
        console.log(`  Institution: ${edu.institution}`);
        console.log(`  Degree: ${edu.degree} in ${edu.field}`);
        console.log(`  Dates: ${edu.start_date} to ${edu.end_date}`);
      }

      if (hasExperience) {
        console.log('\n💼 Sample Experience:');
        const exp = parsed.experience[0];
        console.log(`  Company: ${exp.company}`);
        console.log(`  Role: ${exp.role}`);
        console.log(`  Dates: ${exp.start_date} to ${exp.end_date}`);
      }

      if (hasSkills) {
        console.log('\n🛠️ Skills:');
        if (parsed.skills.technical?.length > 0) {
          console.log(`  Technical (${parsed.skills.technical.length}): ${parsed.skills.technical.slice(0, 3).join(', ')}...`);
        }
        if (parsed.skills.soft?.length > 0) {
          console.log(`  Soft (${parsed.skills.soft.length}): ${parsed.skills.soft.slice(0, 3).join(', ')}...`);
        }
      }

      console.log('\n' + '='.repeat(50));
      if (hasEducation && hasExperience && hasSkills) {
        console.log('✅ SUCCESS: Gemini API returns properly structured data!');
      } else {
        console.log('⚠️ PARTIAL: Some sections are empty');
      }
      console.log('='.repeat(50));
    } catch (error) {
      console.error('❌ Failed to parse JSON:', error.message);
    }
  } catch (error) {
    console.error('❌ API Error:', error.message);
  }
}

testGeminiAPI();
