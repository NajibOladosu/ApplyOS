#!/usr/bin/env node

/**
 * Direct test of parseDocument() function with the actual resume text from the database
 */

const fs = require('fs');
const path = require('path');

// Import the function - we'll use dynamic import for ES modules
async function testParseDocument() {
  console.log('🧪 Testing parseDocument() function directly...\n');

  // The actual resume text extracted from the PDF (from the database)
  const resumeText = `Najib Oladosu Ibadan, Nigeria | @najibaio | 07018135061 | najibaioladosu@gmail.com EDUCATION University of Ibadan Ibadan, Nigeria Bachelor of Science in Electrical and Electronics Engineering 2023 ●Object-oriented Programming, Data Structures and Algorithms, Database Development, Data Science, Data Analysis. KEY WORK EXPERIENCE Huawei Technologies Ltd. Lagos, Nigeria Python Developer / Network Solutions Engineer.                                          September 2023–Present •Network Optimization: Spearheaded multiple WiFi 6/7 PoC projects, increasing client network throughput by 30% and lowering latency by 25%. Leveraged SD-WAN deployments to optimise network performance, reduce bandwidth costs by 20%, and improve scalability.•Automation & Monitoring: Developed Python scripts that automated critical network conﬁgurations and deployed monitoring systems, cutting deployment errors by 50% and reducing downtime by 15%. Implemented real-time data analysis solutions for early fault detection, improving network efﬁciency by 30%.•Operational Troubleshooting & Change Management: Engaged in high-impact troubleshooting for routing, interconnectivity, and hardware failures, collaborating with ISPs and vendors to restore service rapidly. Established change management protocols that ensured a smooth, compliant transition in network updates and enhancements.•Documentation & Knowledge Sharing: Created and maintained detailed documentation for network conﬁgurations, troubleshooting workﬂows, and best practices. This documentation facilitated sustainable, repeatable solutions across teams.•Customer Support & Training: Partnered with sales and engineering teams to support clients through technical training sessions, resulting in a 25% increase in proposal acceptance and a signiﬁcant boost in customer satisfaction.O'dua Telecoms Ltd. Ibadan, Nigeria Software Engineer Intern                                                                    September 2021–February 2022 •Network Maintenance & Troubleshooting: Enhanced network stability by 30% through diligent troubleshooting and resolution of network and security issues. Optimised resource allocation strategies, achieving 15% cost savings and strengthening overall network resilience.•Process Automation & Efﬁciency: Developed Python applications that automated routine operational tasks, increasing team efﬁciency by 25%. Collaborated in the design and integration of APIs, expanding system capabilities and improving user engagement.•Technical Development & Support: Conducted Python-based data analysis for customer support, reaching 95% satisfaction through prompt technical assistance and training.KEY PROJECTS SD-WAN Implementation for Enterprise Clients•Enhanced Application Performance: Successfully deployed SD-WAN with QoS prioritisation for multiple organisations, improving critical application performance by 30% and reducing costs by 20%.•Interconnectivity Optimization: Collaborated with ISPs and third-party vendors to resolve connectivity challenges, ensuring smooth SD-WAN deployment and boosting network reliability by 25%.•Redundant Pathways: Leveraged SD-WAN's architecture to deploy redundant pathways and failover mechanisms, minimising service disruptions and enhancing operational stability.Intrusion & DDoS Detection System\\n•Advanced Security Measures: Developed a high-accuracy intrusion and DDoS detection system, achieving a 75% reduction in false positives and a 95% success rate in threat detection.•Machine Learning Integration: Integrated machine learning algorithms into the IDS/IPS, which reduced network threats by 60%, providing clients with a robust, proactive security layer.WiFi 6/7 Deployment for Financial Institutions•Network Optimization: Deployed WiFi 6/7 solutions across multiple client locations, enhancing network throughput by 30% and reducing interference by strategically placing access points.•Customer Satisfaction: Ensured a 25% boost in user satisfaction by implementing low-latency protocols, leading to more stable connectivity and consistent performance.Learning Management System (LMS) Development•Cross-functional Collaboration: Contributed to the development of a Learning Management System, implementing robust authentication and authorisation to secure user data.•User Experience: Achieved a 95% user satisfaction rating by optimising the frontend design and enhancing operational reliability.SKILLS • Networking: TCP/IP, BGP, MPLS, OSPF, WiFi 6/7, SD-WAN, Data Center Networking • Programming & Automation: Python, Shell/Bash, C++ • Frameworks & Tools: Django, Flask, Git, Docker, AWS EC2, Postman, Huawei iMaster-NCE •Database Management: MySQL, PostgreSQL CERTIFICATIONS • Udacity Machine Learning Program Graduate •iCode Institute of Programing Completion Program and Showcase ACHIEVEMENTS • 2nd place in Huawei ICT Competition Regional Stage • Published research paper on efficient DDoS attack detection and mitigation • Distinctions: Further Mathematics, General Mathematics, and Science - West African Certificate Examinations (2014).\\n`;

  console.log(`📄 Resume text length: ${resumeText.length} characters\n`);
  console.log('First 200 chars:', resumeText.substring(0, 200));
  console.log('\n' + '='.repeat(50) + '\n');

  try {
    // Import the parseDocument function
    const { parseDocument } = await import('./lib/ai.ts');

    console.log('⏳ Calling parseDocument()...\n');
    const startTime = Date.now();
    const result = await parseDocument(resumeText);
    const duration = Date.now() - startTime;

    console.log(`✅ parseDocument() completed in ${duration}ms\n`);

    // Check the result
    if (!result) {
      console.error('❌ FAIL: parseDocument returned null or undefined');
      return;
    }

    console.log('📊 Parsed Data Summary:');
    console.log(`  - Education entries: ${Array.isArray(result.education) ? result.education.length : 0}`);
    console.log(`  - Experience entries: ${Array.isArray(result.experience) ? result.experience.length : 0}`);
    console.log(`  - Projects entries: ${Array.isArray(result.projects) ? result.projects.length : 0}`);
    console.log(`  - Technical skills: ${Array.isArray(result.skills?.technical) ? result.skills.technical.length : 0}`);
    console.log(`  - Soft skills: ${Array.isArray(result.skills?.soft) ? result.skills.soft.length : 0}`);
    console.log(`  - Other skills: ${Array.isArray(result.skills?.other) ? result.skills.other.length : 0}`);
    console.log(`  - Achievements: ${Array.isArray(result.achievements) ? result.achievements.length : 0}`);
    console.log(`  - Certifications: ${Array.isArray(result.certifications) ? result.certifications.length : 0}`);
    console.log(`  - Keywords: ${Array.isArray(result.keywords) ? result.keywords.length : 0}`);

    // Validate that we have actual data
    const hasEducation = Array.isArray(result.education) && result.education.length > 0;
    const hasExperience = Array.isArray(result.experience) && result.experience.length > 0;
    const hasProjects = Array.isArray(result.projects) && result.projects.length > 0;
    const hasSkills = result.skills && (result.skills.technical?.length > 0 || result.skills.soft?.length > 0 || result.skills.other?.length > 0);

    console.log('\n✨ Data Validation:');
    console.log(`  ${hasEducation ? '✅' : '❌'} Education found`);
    console.log(`  ${hasExperience ? '✅' : '❌'} Experience found`);
    console.log(`  ${hasProjects ? '✅' : '❌'} Projects found`);
    console.log(`  ${hasSkills ? '✅' : '❌'} Skills found`);

    if (hasEducation) {
      console.log('\n🎓 Education Data:');
      result.education.forEach((edu, i) => {
        console.log(`  [${i}] ${edu.degree} in ${edu.field} from ${edu.institution} (${edu.start_date}-${edu.end_date})`);
      });
    }

    if (hasExperience) {
      console.log('\n💼 Experience Data:');
      result.experience.forEach((exp, i) => {
        console.log(`  [${i}] ${exp.role} at ${exp.company} (${exp.start_date}-${exp.end_date})`);
        console.log(`      ${exp.description.substring(0, 80)}...`);
      });
    }

    if (hasProjects) {
      console.log('\n🚀 Projects Data:');
      result.projects.forEach((proj, i) => {
        console.log(`  [${i}] ${proj.name}${proj.start_date || proj.end_date ? ` (${proj.start_date}-${proj.end_date})` : ''}`);
        console.log(`      ${proj.description.substring(0, 80)}...`);
        if (proj.technologies?.length > 0) {
          console.log(`      Technologies: ${proj.technologies.join(', ')}`);
        }
      });
    }

    if (hasSkills) {
      console.log('\n🛠️ Skills Data:');
      if (result.skills.technical?.length > 0) {
        console.log(`  Technical: ${result.skills.technical.join(', ')}`);
      }
      if (result.skills.soft?.length > 0) {
        console.log(`  Soft: ${result.skills.soft.join(', ')}`);
      }
      if (result.skills.other?.length > 0) {
        console.log(`  Other: ${result.skills.other.join(', ')}`);
      }
    }

    console.log('\n' + '='.repeat(50));
    if (hasEducation && hasExperience && hasProjects && hasSkills) {
      console.log('✅ TEST PASSED: All data extracted successfully (including projects)!');
    } else if (hasEducation && hasExperience && hasSkills) {
      console.log('⚠️ TEST PARTIAL: Core data extracted (no projects found)');
      console.log('\nFull result:', JSON.stringify(result, null, 2));
    } else {
      console.log('⚠️ TEST INCOMPLETE: Some expected data is missing');
      console.log('\nFull result:', JSON.stringify(result, null, 2));
    }
    console.log('='.repeat(50));
  } catch (error) {
    console.error('❌ Test Error:', error.message);
    console.error('\nNote: This test requires the development environment to be set up.');
    console.error('Make sure GEMINI_API_KEY is set in .env.local');
    console.error('\nAlternatively, you can test via the browser UI by:');
    console.error('1. Go to http://localhost:3000/documents/63e7bfd8-beb0-4876-94a3-3a7785f9e1bb');
    console.error('2. Click the "Analyze Document" button');
    console.error('3. Check the parsed_data is populated in the database');
  }
}

testParseDocument();
