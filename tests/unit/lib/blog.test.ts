import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs')
  return {
    ...actual,
    default: {
      ...actual,
      existsSync: vi.fn(),
      readdirSync: vi.fn(),
      readFileSync: vi.fn(),
    },
  }
})

import fs from 'fs'
import { getAllPosts, getPostBySlug, getAllPostSlugs, formatDate, getReadingTime } from '@/lib/blog'

const SAMPLE_MDX = `---
title: Sample Post
excerpt: An excerpt.
date: 2026-01-15
coverImage: /a.jpg
author:
  name: Test
tags:
  - x
---

# Body
Word word word word word word word word word word.
`

const ANOTHER_MDX = `---
title: Older Post
excerpt: Older
date: 2025-12-01
coverImage: /b.jpg
author:
  name: T
---

content
`

beforeEach(() => {
  vi.resetAllMocks()
})

describe('getAllPosts', () => {
  it('returns empty array when content dir missing', async () => {
    ;(fs.existsSync as any) = vi.fn().mockReturnValue(false)
    expect(await getAllPosts()).toEqual([])
  })

  it('parses MDX files and sorts newest first', async () => {
    ;(fs.existsSync as any) = vi.fn().mockReturnValue(true)
    ;(fs.readdirSync as any) = vi.fn().mockReturnValue(['old.mdx', 'new.mdx', 'ignore.txt'])
    ;(fs.readFileSync as any) = vi.fn((p: string) => (p.endsWith('new.mdx') ? SAMPLE_MDX : ANOTHER_MDX))
    const posts = await getAllPosts()
    expect(posts).toHaveLength(2)
    expect(posts[0].slug).toBe('new')
    expect(posts[0].title).toBe('Sample Post')
  })
})

describe('getPostBySlug', () => {
  it('returns null when file missing', async () => {
    ;(fs.existsSync as any) = vi.fn().mockReturnValue(false)
    expect(await getPostBySlug('missing')).toBeNull()
  })

  it('returns parsed post when file exists', async () => {
    ;(fs.existsSync as any) = vi.fn().mockReturnValue(true)
    ;(fs.readFileSync as any) = vi.fn().mockReturnValue(SAMPLE_MDX)
    const post = await getPostBySlug('sample')
    expect(post?.slug).toBe('sample')
    expect(post?.title).toBe('Sample Post')
  })
})

describe('getAllPostSlugs', () => {
  it('returns empty when dir missing', async () => {
    ;(fs.existsSync as any) = vi.fn().mockReturnValue(false)
    expect(await getAllPostSlugs()).toEqual([])
  })

  it('strips .mdx extension', async () => {
    ;(fs.existsSync as any) = vi.fn().mockReturnValue(true)
    ;(fs.readdirSync as any) = vi.fn().mockReturnValue(['a.mdx', 'b.mdx', 'c.txt'])
    expect(await getAllPostSlugs()).toEqual(['a', 'b'])
  })
})

describe('formatDate', () => {
  it('formats ISO date into long form', () => {
    expect(formatDate('2026-01-15')).toMatch(/January 1[45], 2026/)
  })
})

describe('getReadingTime', () => {
  it('returns 1 min for short content', () => {
    expect(getReadingTime('short content')).toBe('1 min read')
  })
  it('returns higher count for long content', () => {
    const longContent = Array(500).fill('word').join(' ')
    expect(getReadingTime(longContent)).toBe('3 min read')
  })
})
