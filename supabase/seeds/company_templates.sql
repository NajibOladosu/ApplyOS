-- Seed Data: Company Interview Templates
-- Created: 2025-11-25
-- Description: Pre-defined interview question templates for major tech companies
-- Note: Using dollar-quoted strings ($$) to avoid escaping apostrophes
--
-- Companies included:
-- 1. Google - Problem-solving, Googleyness, system design
-- 2. Meta (Facebook) - Past performance, system design, collaboration
-- 3. Amazon - Leadership Principles, STAR behavioral
-- 4. Netflix - Culture fit, freedom & responsibility, technical depth

-- ============================================================================
-- GOOGLE - Software Engineer
-- ============================================================================
INSERT INTO public.company_interview_templates (
  company_name,
  company_slug,
  job_role,
  description,
  tips,
  questions
) VALUES (
  'Google',
  'google',
  'Software Engineer',
  'Google interviews focus on problem-solving, coding proficiency, and Googleyness (culture fit). Expect 2-3 coding rounds, 1 system design (senior roles), and 1 behavioral.',
  ARRAY[
    'Practice LeetCode medium/hard problems daily',
    'Study Google products and their architecture (Gmail, YouTube, Search)',
    'Prepare for Googleyness questions about teamwork, innovation, and ownership',
    'Be ready to code on a whiteboard or Google Docs',
    'Communicate your thought process clearly - interviewers value problem-solving approach',
    'Review data structures: trees, graphs, hash tables, heaps',
    'Practice system design: scalability, load balancing, caching strategies'
  ],
  $$[
    {
      "text": "Tell me about a time you had to work with a difficult teammate. How did you handle it?",
      "category": "behavioral_teamwork",
      "difficulty": "medium",
      "idealOutline": {
        "structure": "STAR (Situation, Task, Action, Result)",
        "keyPoints": [
          "Specific situation with context",
          "What made the teammate difficult",
          "Your diplomatic approach to resolution",
          "Positive outcome and lessons learned"
        ],
        "exampleMetrics": [
          "Project completed on time despite conflicts",
          "Team collaboration improved",
          "Relationship strengthened"
        ],
        "commonPitfalls": [
          "Blaming the teammate without self-reflection",
          "Not showing empathy or understanding",
          "Vague resolution without concrete actions",
          "Focusing only on the conflict, not the resolution"
        ]
      },
      "evaluationCriteria": {
        "mustInclude": [
          "Specific example with names removed",
          "Your specific actions to resolve",
          "Measurable positive outcome"
        ],
        "bonusPoints": [
          "Lessons learned about teamwork",
          "Long-term relationship building",
          "Proactive communication strategies"
        ],
        "redFlags": [
          "Talking negatively about others",
          "No ownership of your role in conflict",
          "Unresolved situation"
        ]
      },
      "estimatedDurationSeconds": 180,
      "tags": ["googleyness", "collaboration", "soft_skills"]
    },
    {
      "text": "Design a URL shortening service like bit.ly. How would you build it to handle millions of requests per day?",
      "category": "technical_system_design",
      "difficulty": "hard",
      "idealOutline": {
        "structure": "Top-down: Requirements → API → Database → Scale → Trade-offs",
        "keyPoints": [
          "Hash function for URL encoding (Base62, MD5 with collision handling)",
          "Database choice (SQL for relationships vs NoSQL for scale)",
          "Caching strategy (Redis for hot URLs)",
          "Rate limiting to prevent abuse",
          "Analytics tracking (clicks, referrers)",
          "Custom domain support",
          "Expiration and cleanup"
        ],
        "exampleMetrics": [
          "10M requests/day",
          "100M URLs stored",
          "99.9% uptime",
          "< 200ms response time"
        ],
        "commonPitfalls": [
          "Jumping to implementation without gathering requirements",
          "Ignoring scalability considerations",
          "Not discussing trade-offs between different approaches",
          "Forgetting about data persistence and durability"
        ]
      },
      "evaluationCriteria": {
        "mustInclude": [
          "Requirements gathering (functional and non-functional)",
          "Database schema design",
          "API design (POST create, GET redirect)",
          "Scaling strategy (horizontal vs vertical)"
        ],
        "bonusPoints": [
          "Custom domain support",
          "Analytics and tracking",
          "Security considerations (prevent spam, malicious URLs)",
          "Global distribution (CDN, geo-routing)",
          "Monitoring and alerting"
        ],
        "redFlags": [
          "Single point of failure",
          "No consideration of scale",
          "Overengineering for the stated requirements",
          "Missing critical components (database, caching)"
        ]
      },
      "estimatedDurationSeconds": 600,
      "tags": ["system_design", "scalability", "architecture"]
    },
    {
      "text": "Given an array of integers, find two numbers such that they add up to a specific target number. Return indices of the two numbers.",
      "category": "technical_coding",
      "difficulty": "medium",
      "idealOutline": {
        "structure": "Clarify → Approach → Code → Test → Optimize",
        "keyPoints": [
          "Clarify: Can we use same element twice? Are there duplicates?",
          "Approach 1: Brute force O(n²) - nested loops",
          "Approach 2: Hash map O(n) - store seen numbers",
          "Edge cases: Empty array, no solution, multiple solutions",
          "Test with examples"
        ],
        "exampleMetrics": [
          "Time complexity: O(n)",
          "Space complexity: O(n)",
          "Number of passes: 1"
        ],
        "commonPitfalls": [
          "Not clarifying requirements upfront",
          "Missing edge cases",
          "Not discussing time/space complexity",
          "Writing code before explaining approach"
        ]
      },
      "evaluationCriteria": {
        "mustInclude": [
          "Working solution",
          "Correct algorithm",
          "Edge case handling",
          "Time and space complexity analysis"
        ],
        "bonusPoints": [
          "Multiple solutions with trade-off discussion",
          "Clean, readable code",
          "Comprehensive test cases",
          "Follow-up: What if array is sorted?"
        ],
        "redFlags": [
          "Incorrect solution",
          "Not considering edge cases",
          "Poor code quality",
          "Unable to analyze complexity"
        ]
      },
      "estimatedDurationSeconds": 300,
      "tags": ["coding", "algorithms", "hash_map"]
    }
  ]$$::jsonb
) ON CONFLICT (company_slug) DO NOTHING;

-- ============================================================================
-- META (FACEBOOK) - Software Engineer
-- ============================================================================
INSERT INTO public.company_interview_templates (
  company_name,
  company_slug,
  job_role,
  description,
  tips,
  questions
) VALUES (
  'Meta',
  'meta',
  'Software Engineer',
  'Meta interviews emphasize past performance (behavioral), system design at scale, and collaborative coding. Strong focus on impact, moving fast, and building social infrastructure.',
  ARRAY[
    'Prepare specific examples of significant impact you have driven',
    'Practice coding while explaining your thought process out loud',
    'Study Meta products: Facebook, Instagram, WhatsApp, Messenger',
    'Focus on scalability - Meta operates at massive scale',
    'Be ready to discuss trade-offs in system design',
    'Emphasize collaboration and cross-functional work',
    'Demonstrate bias for action and shipping features'
  ],
  $$[
    {
      "text": "Describe a time when you had to make a decision with incomplete information. What was the outcome?",
      "category": "behavioral_leadership",
      "difficulty": "medium",
      "idealOutline": {
        "structure": "STAR with emphasis on decision-making process",
        "keyPoints": [
          "Context of the uncertain situation",
          "What information you had vs what you needed",
          "Your decision-making framework",
          "Actions taken despite uncertainty",
          "Outcome and what you learned"
        ],
        "exampleMetrics": [
          "Decision made within X days/hours",
          "Project shipped on time",
          "User metrics improved by X%"
        ],
        "commonPitfalls": [
          "Waiting for perfect information instead of acting",
          "Not explaining the decision-making process",
          "Poor outcome without lessons learned"
        ]
      },
      "evaluationCriteria": {
        "mustInclude": [
          "Specific high-stakes decision",
          "Clear decision-making framework",
          "Concrete outcome (good or bad)"
        ],
        "bonusPoints": [
          "Data-driven approach where possible",
          "Involving stakeholders appropriately",
          "Post-decision review and learning",
          "Bias for action while managing risk"
        ],
        "redFlags": [
          "Analysis paralysis",
          "Blame others for lack of information",
          "No clear outcome or learning"
        ]
      },
      "estimatedDurationSeconds": 180,
      "tags": ["decision_making", "leadership", "meta_values"]
    },
    {
      "text": "Design a news feed system like Facebook. How would you rank and serve personalized content to billions of users?",
      "category": "technical_system_design",
      "difficulty": "hard",
      "idealOutline": {
        "structure": "Scale → Ranking → Delivery → Real-time → Trade-offs",
        "keyPoints": [
          "User graph storage (friends, follows, groups)",
          "Content storage (posts, photos, videos)",
          "Ranking algorithm (EdgeRank: affinity, weight, time decay)",
          "Feed generation (pull vs push vs hybrid)",
          "Caching strategies (user feed cache, content cache)",
          "Real-time updates (WebSockets, long polling)",
          "Scalability (sharding, load balancing, CDN)"
        ],
        "exampleMetrics": [
          "2 billion active users",
          "Sub-second feed load times",
          "99.99% availability",
          "Real-time updates within 1 second"
        ],
        "commonPitfalls": [
          "Not addressing the scale (billions of users)",
          "Ignoring personalization/ranking",
          "Missing real-time update mechanism",
          "Not discussing data consistency trade-offs"
        ]
      },
      "evaluationCriteria": {
        "mustInclude": [
          "High-level architecture diagram",
          "Data model (users, posts, relationships)",
          "Ranking/scoring algorithm",
          "Scalability strategy"
        ],
        "bonusPoints": [
          "Machine learning for ranking",
          "A/B testing infrastructure",
          "Privacy and content filtering",
          "Mobile optimization",
          "Spam and abuse prevention"
        ],
        "redFlags": [
          "Naive single-server solution",
          "No ranking logic",
          "Missing cache layer",
          "Ignoring write-heavy nature of social"
        ]
      },
      "estimatedDurationSeconds": 600,
      "tags": ["system_design", "social_media", "scale"]
    }
  ]$$::jsonb
) ON CONFLICT (company_slug) DO NOTHING;

-- ============================================================================
-- AMAZON - Software Development Engineer
-- ============================================================================
INSERT INTO public.company_interview_templates (
  company_name,
  company_slug,
  job_role,
  description,
  tips,
  questions
) VALUES (
  'Amazon',
  'amazon',
  'Software Development Engineer',
  'Amazon interviews are heavily focused on Leadership Principles (14 principles). Expect 5-6 behavioral questions mapped to specific principles, 1-2 coding rounds, and system design for senior roles.',
  ARRAY[
    'Prepare 2-3 STAR stories for EACH of the 14 Leadership Principles',
    'Use the STAR method religiously - Amazon interviewers are trained to evaluate structure',
    'Focus on YOUR specific contribution (use "I" not "we")',
    'Include metrics and measurable outcomes in every story',
    'Study the Leadership Principles: Customer Obsession, Ownership, Invent and Simplify, etc.',
    'Be ready to discuss failures and what you learned',
    'Practice "Have Backbone; Disagree and Commit" scenarios'
  ],
  $$[
    {
      "text": "Tell me about a time when you took on something significant outside your area of responsibility. Why did you do it? What was the outcome? (Ownership)",
      "category": "behavioral_leadership",
      "difficulty": "medium",
      "idealOutline": {
        "structure": "STAR with focus on ownership and initiative",
        "keyPoints": [
          "Situation: Gap or opportunity you identified",
          "Task: Why you felt responsible (even though it was not your job)",
          "Action: Specific steps you took, challenges faced",
          "Result: Impact on the team/company, lessons learned"
        ],
        "exampleMetrics": [
          "Revenue/cost impact",
          "Time saved for the team",
          "Customer satisfaction improvement",
          "Process efficiency gains"
        ],
        "commonPitfalls": [
          "Using we instead of I",
          "Taking credit for team success without personal contribution",
          "No measurable outcome",
          "Not explaining WHY you took ownership"
        ]
      },
      "evaluationCriteria": {
        "mustInclude": [
          "Clear personal initiative",
          "Went beyond job description",
          "Measurable positive impact",
          "Ownership mindset (not blame)"
        ],
        "bonusPoints": [
          "Long-term thinking",
          "Scaled solution beyond immediate need",
          "Mentored others to sustain the work",
          "Cross-team collaboration"
        ],
        "redFlags": [
          "Vague or generic answer",
          "No metrics or outcomes",
          "Blaming others for not doing their job",
          "Minimal effort or impact"
        ]
      },
      "estimatedDurationSeconds": 180,
      "tags": ["leadership_principles", "ownership", "initiative"]
    },
    {
      "text": "Describe a time when you had to make a decision between two important priorities. How did you decide? (Bias for Action)",
      "category": "behavioral_conflict",
      "difficulty": "hard",
      "idealOutline": {
        "structure": "STAR with decision-making framework",
        "keyPoints": [
          "Situation: Two competing priorities (both important)",
          "Task: Need to choose quickly",
          "Action: Your decision framework (customer impact, data, urgency)",
          "Result: Outcome of your choice, speed of decision"
        ],
        "exampleMetrics": [
          "Decision made in X hours/days",
          "Impact metrics for chosen priority",
          "What you learned about prioritization"
        ],
        "commonPitfalls": [
          "Analysis paralysis",
          "Not showing bias for action",
          "No clear decision framework",
          "Choosing based on ease rather than impact"
        ]
      },
      "evaluationCriteria": {
        "mustInclude": [
          "Genuine trade-off between two good options",
          "Clear decision criteria",
          "Timely decision (bias for action)",
          "Measurable outcome"
        ],
        "bonusPoints": [
          "Customer obsession in decision-making",
          "Data-driven where possible",
          "Communicated decision to stakeholders",
          "Revisited decision later with new data"
        ],
        "redFlags": [
          "Slow decision-making",
          "No framework or rationale",
          "Blame others for the dilemma",
          "Poor outcome with no learning"
        ]
      },
      "estimatedDurationSeconds": 180,
      "tags": ["leadership_principles", "bias_for_action", "prioritization"]
    },
    {
      "text": "Design Amazon's recommendation system. How would you recommend products to customers based on their browsing and purchase history?",
      "category": "technical_system_design",
      "difficulty": "hard",
      "idealOutline": {
        "structure": "Data → Algorithms → Pipeline → Scale → Personalization",
        "keyPoints": [
          "Data collection (browsing, purchases, cart, wishlist, reviews)",
          "Collaborative filtering (user-based, item-based)",
          "Content-based filtering (product attributes)",
          "Hybrid approach (combine multiple signals)",
          "Real-time vs batch processing",
          "A/B testing and metrics (CTR, conversion rate, revenue)",
          "Cold start problem (new users, new products)"
        ],
        "exampleMetrics": [
          "Millions of products",
          "Hundreds of millions of customers",
          "Real-time recommendations < 100ms",
          "Conversion rate improvement"
        ],
        "commonPitfalls": [
          "Only mentioning one algorithm without trade-offs",
          "Ignoring cold start problem",
          "Not addressing scale",
          "Missing A/B testing and evaluation"
        ]
      },
      "evaluationCriteria": {
        "mustInclude": [
          "Multiple recommendation algorithms",
          "Data pipeline architecture",
          "Scalability considerations",
          "Evaluation metrics"
        ],
        "bonusPoints": [
          "Machine learning integration",
          "Real-time personalization",
          "Privacy and data handling",
          "Business metrics (revenue impact)",
          "Diversity and serendipity in recommendations"
        ],
        "redFlags": [
          "Naive single-algorithm approach",
          "No consideration of scale",
          "Missing evaluation strategy",
          "Ignoring customer obsession"
        ]
      },
      "estimatedDurationSeconds": 600,
      "tags": ["system_design", "machine_learning", "recommendations"]
    }
  ]$$::jsonb
) ON CONFLICT (company_slug) DO NOTHING;

-- ============================================================================
-- NETFLIX - Software Engineer
-- ============================================================================
INSERT INTO public.company_interview_templates (
  company_name,
  company_slug,
  job_role,
  description,
  tips,
  questions
) VALUES (
  'Netflix',
  'netflix',
  'Software Engineer',
  'Netflix interviews focus on culture fit (Freedom & Responsibility), senior technical depth, and autonomous decision-making. High bar for technical excellence and self-direction.',
  ARRAY[
    'Read and internalize the Netflix Culture Memo',
    'Prepare examples of working autonomously with minimal oversight',
    'Focus on high-impact, high-quality work',
    'Be ready to discuss technical trade-offs in depth',
    'Demonstrate continuous learning and staying current with technology',
    'Show examples of making important decisions independently',
    'Emphasize context over control - how you gather context to make decisions'
  ],
  $$[
    {
      "text": "Tell me about a time when you identified a problem that your team was not aware of. What did you do?",
      "category": "behavioral_leadership",
      "difficulty": "medium",
      "idealOutline": {
        "structure": "STAR with emphasis on initiative and autonomy",
        "keyPoints": [
          "Situation: Problem you uniquely identified",
          "Task: Why it mattered (business/technical impact)",
          "Action: How you investigated, validated, and solved it autonomously",
          "Result: Impact and lessons about proactive problem-solving"
        ],
        "exampleMetrics": [
          "Prevented outage or customer impact",
          "Saved engineering time or costs",
          "Improved system reliability/performance"
        ],
        "commonPitfalls": [
          "Waiting for permission to act",
          "Identifying problem but not taking ownership",
          "No measurable impact",
          "Overstepping boundaries without proper context"
        ]
      },
      "evaluationCriteria": {
        "mustInclude": [
          "Proactive identification of real problem",
          "Autonomous action with good judgment",
          "Significant impact",
          "Appropriate context-gathering"
        ],
        "bonusPoints": [
          "Prevented major issue before it happened",
          "Shared learnings with broader team",
          "Improved processes to prevent similar issues",
          "Balanced autonomy with collaboration"
        ],
        "redFlags": [
          "Trivial problem",
          "Needed extensive approval to act",
          "Poor judgment in decision-making",
          "No follow-through"
        ]
      },
      "estimatedDurationSeconds": 180,
      "tags": ["netflix_culture", "autonomy", "initiative"]
    },
    {
      "text": "Design Netflix's video streaming infrastructure. How would you deliver video content to millions of concurrent users globally?",
      "category": "technical_system_design",
      "difficulty": "hard",
      "idealOutline": {
        "structure": "Content → Encoding → CDN → Streaming → Monitoring",
        "keyPoints": [
          "Content ingestion and storage",
          "Adaptive bitrate encoding (multiple quality levels)",
          "Global CDN (Open Connect Appliances)",
          "Streaming protocols (HLS, DASH)",
          "Player logic (quality adaptation, buffering)",
          "Load balancing and failover",
          "Monitoring and analytics (buffering ratio, startup time)",
          "Cost optimization (bandwidth, storage)"
        ],
        "exampleMetrics": [
          "200M+ subscribers",
          "Millions of concurrent streams",
          "99.99% availability",
          "< 3 second startup time",
          "Minimal buffering"
        ],
        "commonPitfalls": [
          "Ignoring adaptive bitrate streaming",
          "Missing CDN/edge caching strategy",
          "Not addressing global scale",
          "Forgetting mobile/bandwidth constraints"
        ]
      },
      "evaluationCriteria": {
        "mustInclude": [
          "Complete video pipeline (ingest to playback)",
          "CDN architecture",
          "Adaptive streaming",
          "Global distribution strategy"
        ],
        "bonusPoints": [
          "Netflix-specific tech (Open Connect)",
          "Cost optimization strategies",
          "Quality of experience metrics",
          "DRM and security",
          "Personalized thumbnail selection"
        ],
        "redFlags": [
          "Single datacenter design",
          "No CDN or caching",
          "Fixed bitrate streaming",
          "Missing monitoring/analytics"
        ]
      },
      "estimatedDurationSeconds": 600,
      "tags": ["system_design", "video_streaming", "cdn"]
    }
  ]$$::jsonb
) ON CONFLICT (company_slug) DO NOTHING;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- To verify templates were inserted:
-- SELECT company_name, company_slug, job_role, array_length(tips, 1) as tip_count, jsonb_array_length(questions) as question_count FROM public.company_interview_templates ORDER BY company_name;
--
-- Expected output:
-- Amazon  | amazon  | Software Development Engineer | 7 | 3
-- Google  | google  | Software Engineer              | 7 | 3
-- Meta    | meta    | Software Engineer              | 7 | 2
-- Netflix | netflix | Software Engineer              | 7 | 2
