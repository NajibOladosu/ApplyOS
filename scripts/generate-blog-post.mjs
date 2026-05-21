#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'

const BLOG_DIR = path.join(process.cwd(), 'content', 'blog')
const HISTORY_FILE = path.join(BLOG_DIR, '.post-history.json')
const COVER_DIR_PUBLIC = '/blog'
const MODEL = 'gemini-2.5-flash'
const API_KEY = process.env.GEMINI_API_KEY
const SITE = 'https://blog.applyos.io'

if (!API_KEY) {
  console.error('GEMINI_API_KEY missing')
  process.exit(1)
}

function readHistory() {
  if (!fs.existsSync(HISTORY_FILE)) return []
  try {
    const raw = fs.readFileSync(HISTORY_FILE, 'utf8')
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch (err) {
    console.warn(`Could not parse ${HISTORY_FILE}: ${err.message}. Starting empty.`)
    return []
  }
}

function appendHistory(entry) {
  const history = readHistory()
  history.push(entry)
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2) + '\n', 'utf8')
}

function readExistingPosts() {
  const files = fs.readdirSync(BLOG_DIR).filter((f) => f.endsWith('.mdx'))
  const fromFiles = files.map((filename) => {
    const slug = filename.replace('.mdx', '')
    const raw = fs.readFileSync(path.join(BLOG_DIR, filename), 'utf8')
    const { data, content } = matter(raw)
    return {
      slug,
      title: data.title,
      excerpt: data.excerpt,
      tags: data.tags || [],
      date: data.date,
      firstHeading: (content.match(/^#\s+(.+)$/m) || [])[1] || '',
      targetKeyword: '',
    }
  })

  const bySlug = new Map(fromFiles.map((p) => [p.slug, p]))
  for (const h of readHistory()) {
    if (!h.slug) continue
    const existing = bySlug.get(h.slug)
    if (existing) {
      if (!existing.targetKeyword && h.targetKeyword) existing.targetKeyword = h.targetKeyword
    } else {
      bySlug.set(h.slug, {
        slug: h.slug,
        title: h.title || '',
        excerpt: h.excerpt || '',
        tags: h.tags || [],
        date: h.date || '',
        firstHeading: '',
        targetKeyword: h.targetKeyword || '',
      })
    }
  }
  return [...bySlug.values()]
}

function slugify(title) {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
}

function buildPrompt(existing) {
  const inventory = existing
    .map((p) => {
      const kw = p.targetKeyword ? ` | keyword: ${p.targetKeyword}` : ''
      return `- ${p.slug} | "${p.title}" | tags: ${(p.tags || []).join(', ')}${kw} | excerpt: ${p.excerpt}`
    })
    .join('\n')

  const today = new Date().toISOString().slice(0, 10)

  return `You are the staff writer for ApplyOS, an AI-powered job application platform.

Goal: write ONE new MDX blog post that ranks on Google for job seekers searching long-tail queries (e.g. "how to answer behavioral interview questions", "ATS resume tips 2026", "follow up email after interview", "best way to track job applications", "tailor resume to job description"). The post must showcase ApplyOS features naturally — never feel like an ad, but always tie the topic back to how ApplyOS solves the problem.

About ApplyOS:
- Upload resume/transcripts/certificates → AI extracts structured profile.
- Paste any job/scholarship URL → auto-extracts application questions.
- AI generates personalized answers grounded in your documents.
- Context Engine: directives for tone, focus, length.
- Resume Grill: AI interview that interrogates resume claims.
- Live + text interview practice modes.
- Chrome extension for one-click extraction from LinkedIn, Greenhouse, Lever, Workday.
- Pipeline tracking, deadline reminders, weekly digests.
- Sign-up: https://www.applyos.io/auth/signup. Product: https://www.applyos.io. Blog: ${SITE}.

Existing posts (DO NOT repeat any of these topics or angles, but DO link to ONE relevant one inside the new post via ${SITE}/{slug}):
${inventory}

Voice + format rules:
- Match the existing house style: confident, sharp, slightly "tactical" / terminal-flavored, occasional sub-headings like "The Calculation", "The Fix", "Behind the AI Logic". Not every post needs the "Tactical Briefing" prefix — vary it.
- 600–900 words.
- Use H1 (#), H2 (##), H3 (###), bullet lists, numbered lists, blockquotes (>) where useful.
- One inline link to a previous post, chosen from the list above. Use the full URL ${SITE}/{slug}.
- One CTA at the end linking to https://www.applyos.io or https://www.applyos.io/auth/signup.
- Optimize the title and the first 120 words for a clear search query the post targets.
- No emoji spam. Max 2 emojis total, only if they fit the existing style.
- Do NOT mention that you are an AI or that this was generated.

Output STRICT JSON only, no markdown fences, with this exact shape:
{
  "title": "string — under 70 chars, SEO-optimized",
  "slug": "string — kebab-case, unique, not in existing list",
  "excerpt": "string — 140-180 chars, compelling, includes primary keyword",
  "tags": ["3-5 lowercase tags from: tutorial, features, ai, strategy, efficiency, job-search, interview, resume, career, scholarships, applications, productivity, remote, networking"],
  "targetKeyword": "string — the primary search query this post targets",
  "body": "string — full MDX body starting with the H1 heading. No frontmatter. Use \\n for newlines."
}

Today's date: ${today}.`
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function callGeminiOnce(prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.85,
        maxOutputTokens: 8192,
        responseMimeType: 'application/json',
        thinkingConfig: { thinkingBudget: 0 },
      },
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    const err = new Error(`Gemini ${res.status}: ${body}`)
    err.status = res.status
    err.retryable = res.status === 429 || res.status === 500 || res.status === 503 || res.status === 504
    throw err
  }

  const json = await res.json()
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error(`Empty Gemini response: ${JSON.stringify(json)}`)
  return text
}

async function callGeminiWithRetry(prompt, maxAttempts = 4) {
  let lastErr
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const text = await callGeminiOnce(prompt)
      return extractJson(text)
    } catch (err) {
      lastErr = err
      const isParseErr = err instanceof SyntaxError
      const retryable = isParseErr || err.retryable
      if (!retryable || attempt === maxAttempts) throw err
      const delay = Math.min(2000 * 2 ** (attempt - 1), 15000)
      console.warn(`Attempt ${attempt} failed (${err.message.slice(0, 120)}). Retrying in ${delay}ms.`)
      await sleep(delay)
    }
  }
  throw lastErr
}

function extractJson(raw) {
  let s = raw.trim()
  const fenced = s.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenced) s = fenced[1].trim()
  return JSON.parse(s)
}

function ensureUniqueSlug(baseSlug, existingSlugs) {
  let slug = baseSlug
  let i = 2
  while (existingSlugs.includes(slug)) {
    slug = `${baseSlug}-${i++}`
  }
  return slug
}

function buildMdx({ title, excerpt, date, coverImage, tags, body }) {
  const tagsYaml = tags.map((t) => `  - ${t}`).join('\n')
  return `---
title: "${title.replace(/"/g, '\\"')}"
excerpt: "${excerpt.replace(/"/g, '\\"')}"
date: "${date}"
coverImage: "${coverImage}"
author:
  name: "ApplyOS Team"
tags:
${tagsYaml}
---

${body.trim()}
`
}

async function main() {
  const existing = readExistingPosts()
  const existingSlugs = existing.map((p) => p.slug)
  const prompt = buildPrompt(existing)

  console.log(`Generating post. ${existing.length} existing posts to avoid.`)

  const parsed = await callGeminiWithRetry(prompt)

  const required = ['title', 'slug', 'excerpt', 'tags', 'body']
  for (const k of required) {
    if (!parsed[k]) throw new Error(`Missing field: ${k}`)
  }

  const baseSlug = slugify(parsed.slug || parsed.title)
  const slug = ensureUniqueSlug(baseSlug, existingSlugs)
  const date = new Date().toISOString().slice(0, 10)
  const coverImage = `${COVER_DIR_PUBLIC}/${slug}.png`

  const mdx = buildMdx({
    title: parsed.title,
    excerpt: parsed.excerpt,
    date,
    coverImage,
    tags: parsed.tags.slice(0, 5),
    body: parsed.body,
  })

  const outPath = path.join(BLOG_DIR, `${slug}.mdx`)
  if (fs.existsSync(outPath)) {
    throw new Error(`File already exists: ${outPath}`)
  }
  fs.writeFileSync(outPath, mdx, 'utf8')

  appendHistory({
    slug,
    title: parsed.title,
    excerpt: parsed.excerpt,
    tags: parsed.tags.slice(0, 5),
    date,
    targetKeyword: parsed.targetKeyword || '',
  })

  console.log(`Wrote ${outPath}`)
  console.log(`Title: ${parsed.title}`)
  console.log(`Target keyword: ${parsed.targetKeyword || '(not provided)'}`)
  console.log(`Cover image expected at: public${coverImage}`)

  const ghOut = process.env.GITHUB_OUTPUT
  if (ghOut) {
    fs.appendFileSync(ghOut, `slug=${slug}\n`)
    fs.appendFileSync(ghOut, `title=${parsed.title.replace(/\n/g, ' ')}\n`)
    fs.appendFileSync(ghOut, `path=content/blog/${slug}.mdx\n`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
