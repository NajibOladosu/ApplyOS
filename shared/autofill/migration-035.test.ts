/**
 * Contract tests for supabase/migrations/035_create_autofill_mappings.sql.
 *
 * The migration is applied by hand in the Supabase SQL editor, so nothing in CI
 * ever executes it. What CI *can* do is hold it to the two contracts that break
 * silently and in production rather than loudly at apply time:
 *
 *  1. KEY-SPACE PARITY. Every closed vocabulary in the SQL is a copy of a union
 *     declared in this directory. A key added to PROFILE_KEYS but not to the
 *     three CHECK lists does not fail a build -- it fails at runtime as a 23514
 *     on the write path, after the resolver has already produced the key.
 *  2. THE NO-USER-VALUES RULE. The five redaction patterns in
 *     validate_autofill_field_signature() are the last line of defence for a
 *     GLOBAL cache every applicant reads. They are regexes in a string literal
 *     that no test can reach unless it parses them out, so this file parses them
 *     out and runs them against real payloads.
 *
 * Reading the SQL as text is the point, not a workaround: the assertions have to
 * fail when the file is edited, which is exactly when someone is most likely to
 * widen a vocabulary or soften a pattern without noticing what depends on it.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { fieldKey, formFingerprint } from './fingerprint'
import { ACCEPT_THRESHOLD } from './score'
import { ATS_IDS, PROFILE_KEYS } from './types'
import type { FieldIdentity } from './fingerprint'
import type { FieldKind, ResolutionSource, Sensitivity } from './types'

// resolve() against cwd, not import.meta.url: under the jsdom environment
// import.meta.url is an http:// URL from the jsdom base and readFileSync rejects
// it. vitest sets cwd to the config's root, which is the repo root.
const SQL = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/035_create_autofill_mappings.sql'),
  'utf8',
)

// ---------------------------------------------------------------------------
// Exhaustive runtime mirrors of the type-only unions.
//
// FieldKind / Sensitivity / ResolutionSource are types, so there is no array to
// import. A Record keyed by the union is checked in BOTH directions: `tsc` fails
// if the union gains a member this object omits, and the tests below fail if the
// SQL disagrees with the object. vitest does not typecheck, so the first half of
// that guarantee is delivered by `npm run build`, not by this run.
// ---------------------------------------------------------------------------
const FIELD_KINDS: Record<FieldKind, true> = {
  text: true, email: true, tel: true, url: true, number: true, textarea: true,
  select: true, combobox: true, typeahead: true, radio_group: true, checkbox: true,
  checkbox_group: true, date: true, date_segmented: true, file: true, unknown: true,
}
const SENSITIVITIES: Record<Sensitivity, true> = {
  public: true, contact: true, compensation: true, eligibility: true, protected: true,
}
const RESOLUTION_SOURCES: Record<ResolutionSource, true> = {
  adapter: true, heuristic: true, cached_ai: true, ai: true, user: true,
}

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

/** Index of the ')' closing the '(' at `open`. */
function matchParen(sql: string, open: number): number {
  let depth = 0
  for (let i = open; i < sql.length; i++) {
    if (sql[i] === '(') depth++
    else if (sql[i] === ')' && --depth === 0) return i
  }
  throw new Error(`unbalanced parenthesis from offset ${open}`)
}

/** Every `CHECK (<column> IN ('a', 'b', ...))` list in the file, in file order. */
function enumChecks(sql: string, column: string): string[][] {
  const needle = `CHECK (${column} IN (`
  const lists: string[][] = []
  for (let from = 0; ; ) {
    const at = sql.indexOf(needle, from)
    if (at === -1) return lists
    const open = at + needle.length - 1
    const close = matchParen(sql, open)
    lists.push([...sql.slice(open + 1, close).matchAll(/'([^']*)'/g)].map((m) => m[1]))
    from = close
  }
}

/** The body of one `CREATE TABLE IF NOT EXISTS public.<table> ( ... )`. */
function tableBody(sql: string, table: string): string {
  const needle = `CREATE TABLE IF NOT EXISTS public.${table} (`
  const at = sql.indexOf(needle)
  expect(at, `${table} is not created in the migration`).toBeGreaterThan(-1)
  const open = at + needle.length - 1
  return sql.slice(open + 1, matchParen(sql, open))
}

/** Column declarations, which this file indents by exactly two spaces. */
function columns(body: string): Array<{ name: string; type: string }> {
  return [...body.matchAll(/^ {2}(\w+) +([A-Z]+)\b/gm)].map((m) => ({ name: m[1], type: m[2] }))
}

describe('035 migration: closed vocabularies match the TypeScript unions', () => {
  // A drifted list is a 23514 on the write path with a key the resolver already
  // produced -- the cache silently stops accepting exactly the new key.
  it('every canonical_profile_key CHECK is PROFILE_KEYS, on all three tables', () => {
    const lists = enumChecks(SQL, 'canonical_profile_key')
    expect(lists).toHaveLength(3)
    for (const list of lists) {
      expect([...list].sort()).toEqual([...PROFILE_KEYS].sort())
    }
  })

  it('every ats_platform CHECK is ATS_IDS, on both tables', () => {
    const lists = enumChecks(SQL, 'ats_platform')
    expect(lists).toHaveLength(2)
    for (const list of lists) {
      expect([...list].sort()).toEqual([...ATS_IDS].sort())
    }
  })

  it('sensitivity, field_kind and resolution_source match their unions', () => {
    expect(enumChecks(SQL, 'sensitivity')[0].sort()).toEqual(Object.keys(SENSITIVITIES).sort())
    expect(enumChecks(SQL, 'field_kind')[0].sort()).toEqual(Object.keys(FIELD_KINDS).sort())
    expect(enumChecks(SQL, 'resolution_source')[0].sort()).toEqual(
      Object.keys(RESOLUTION_SOURCES).sort(),
    )
  })

  it('error_code is the closed enum that leaves nowhere for an exception message', () => {
    // The whole reason error_code is an enum: catch (e) { log(e.message) } on a
    // rejected value logs "'+1 555 867 5309' is not a valid phone number".
    expect(enumChecks(SQL, 'error_code')[0].sort()).toEqual(
      [
        'none', 'selector_not_found', 'element_not_interactable', 'value_rejected',
        'framework_state_desync', 'iframe_inaccessible', 'timeout', 'unknown',
      ].sort(),
    )
  })
})

describe('035 migration: the no-user-values rule', () => {
  it('autofill_events has no JSON column and no unconstrained TEXT column', () => {
    const body = tableBody(SQL, 'autofill_events')
    const cols = columns(body)
    expect(cols.length).toBeGreaterThan(10)

    expect(cols.filter((c) => c.type === 'JSONB' || c.type === 'JSON')).toEqual([])

    // Nothing but a UUID, a timestamp, a numeric, or a CHECK-constrained enum.
    for (const c of cols) {
      expect(
        ['UUID', 'TEXT', 'TIMESTAMPTZ', 'NUMERIC', 'INTEGER', 'SMALLINT'],
        `autofill_events.${c.name} is ${c.type}`,
      ).toContain(c.type)
    }

    for (const c of cols.filter((x) => x.type === 'TEXT')) {
      expect(
        new RegExp(`CHECK \\(\\s*${c.name}\\b`).test(body),
        `autofill_events.${c.name} is TEXT with no CHECK -- free text can receive a field value`,
      ).toBe(true)
    }
  })

  it('no table carries a column that could hold a field value or a client fingerprint', () => {
    for (const table of [
      'ats_form_signatures', 'profile_field_mappings', 'autofill_mapping_votes',
      'autofill_sessions', 'autofill_events',
    ]) {
      const names = columns(tableBody(SQL, table)).map((c) => c.name)
      for (const banned of [
        'value', 'sample_value', 'example', 'user_value', 'raw_label', 'correction_text',
        'ip', 'ip_address', 'user_agent', 'url', 'full_url', 'file_name', 'filename',
      ]) {
        expect(names, `${table} must not have a ${banned} column`).not.toContain(banned)
      }
    }
  })

  it('every hash column is pinned to the 32-char digest fingerprint.ts actually emits', () => {
    // 32, not 64. shared/autofill/fingerprint.ts slices the SHA-256 to 32 chars
    // (AUTOFILL_ARCHITECTURE.md section 10.1) and this CHECK is what every insert
    // from real engine output has to pass. An earlier version of this migration
    // demanded 64 and would have rejected every row the engine ever produced --
    // the two sides are asserted together here precisely so they cannot drift
    // apart again.
    //
    // The charset half is the one doing the privacy work: it is what makes "a hex
    // digest cannot smuggle a phone number" true rather than merely asserted. 128
    // bits is ample for a cache key, so shortening costs nothing that matters.
    //
    // Five: form_fingerprint, repeat_group, and field_signature_hash on each of
    // profile_field_mappings, autofill_mapping_votes and autofill_events. The
    // count is exact so that a sixth hash column has to come past this test.
    const hashChecks = [...SQL.matchAll(/~ '\^\[0-9a-f\]\{(\d+)\}\$'/g)].map((m) => m[1])
    expect(hashChecks).toHaveLength(5)
    expect([...new Set(hashChecks)]).toEqual(['32'])
  })

  it('the migration and fingerprint.ts agree on digest length', async () => {
    // The integration assertion, not a restatement of the one above: it runs the
    // real fingerprint functions and checks their output against the real CHECK
    // pattern pulled out of the SQL.
    const { fieldKey, formFingerprint } = await import('./fingerprint')
    const pattern = new RegExp(
      `^[0-9a-f]{${[...SQL.matchAll(/~ '\^\[0-9a-f\]\{(\d+)\}\$'/g)][0][1]}}$`,
    )
    const fk = await fieldKey('greenhouse', {
      kind: 'text',
      name: 'job_application[first_name]',
      elementId: 'first_name',
      atsHint: null,
      label: 'First Name',
      repeatGroup: null,
      occurrenceIndex: null,
    })
    expect(fk).toMatch(pattern)
    expect(await formFingerprint('greenhouse', [fk])).toMatch(pattern)
  })
})

describe('035 migration: the field_signature redaction patterns', () => {
  // Parsed out of the SQL with the operator each is applied with: ~ is
  // case-sensitive, ~* is not, and "Resume.PDF" only fails on the ~* ones.
  const declared = new Map(
    [...SQL.matchAll(/^\s*(pat_\w+)\s+TEXT\s*:=\s*'([^']*)';/gm)].map((m) => [m[1], m[2]]),
  )
  const applied = new Map(
    [...SQL.matchAll(/IF s (~\*?) (pat_\w+) THEN/g)].map((m) => [m[2], m[1] === '~*' ? 'i' : '']),
  )

  const patterns = [...declared].map(([name, src]) => {
    const flags = applied.get(name)
    if (flags === undefined) throw new Error(`${name} is declared but never applied`)
    return { name, re: new RegExp(src, flags) }
  })

  const rejects = (s: string): string[] => patterns.filter((p) => p.re.test(s)).map((p) => p.name)

  it('declares and applies exactly the five documented patterns', () => {
    expect([...declared.keys()].sort()).toEqual([
      'pat_digit_run', 'pat_email', 'pat_filename', 'pat_phone', 'pat_userinfo',
    ])
    expect([...applied.keys()].sort()).toEqual([...declared.keys()].sort())
  })

  it.each([
    // The Greenhouse case: once a resume is attached, the file input's rendered
    // label becomes the uploaded filename, which carries the user's legal name.
    ['Ada_Lovelace_Resume.pdf', 'pat_filename'],
    ['Ada_Lovelace_Resume.PDF', 'pat_filename'],
    ['cover letter.docx', 'pat_filename'],
    ['notes.txt', 'pat_filename'],
    ['ada.lovelace@example.com', 'pat_email'],
    ['Ada Lovelace <ada@example.com>', 'pat_email'],
    ['+1 (555) 867-5309', 'pat_phone'],
    ['555-867-5309', 'pat_phone'],
    ['https://ada:hunter2@example.com/apply', 'pat_userinfo'],
    ['Cambridge, MA 02139', 'pat_digit_run'],
    ['Form 1099', 'pat_digit_run'],
  ])('rejects %j via %s', (payload, expected) => {
    expect(rejects(payload)).toContain(expected)
  })

  it.each([
    'first name', 'last name', 'email address', 'phone number', 'linkedin profile url',
    'are you legally authorized to work in the united states', 'how did you hear about us',
    'company', 'city', 'desired salary', 'resume/cv', 'select one', 'work experience',
    'job_application[answers_attributes][][text_value]', 'data-automation-id', '401k',
  ])('passes the real employer label %j', (label) => {
    expect(rejects(label)).toEqual([])
  })

  it('draws the digit-run boundary at four, as documented', () => {
    // Three digits is a form name ("I-9", "401k"); four is a postal code, a year,
    // a salary or a phone fragment.
    expect(rejects('ref 123')).toEqual([])
    expect(rejects('ref 1234')).toEqual(['pat_digit_run'])
  })

  it('caps every text value at 64 characters', () => {
    expect(SQL).toContain('IF length(s) > 64 THEN')
  })
})

describe('035 migration: the cache-poisoning defence', () => {
  it('one user gets one vote per (form, field)', () => {
    expect(tableBody(SQL, 'autofill_mapping_votes')).toContain(
      'UNIQUE (form_signature_id, field_signature_hash, user_id)',
    )
  })

  it('the mapping unique key separates repeater rows', () => {
    // Without the ordinal, Workday work-experience row 3's "Company" collides
    // with row 1's and the itemised entries cannot be filled correctly.
    expect(tableBody(SQL, 'profile_field_mappings')).toContain(
      'UNIQUE (form_signature_id, field_signature_hash, occurrence_index, repeat_group)',
    )
  })

  it("a client can never stamp provenance 'user' on a globally shared row", () => {
    expect(enumChecks(SQL, 'base_provenance')[0]).toEqual(['adapter', 'heuristic', 'ai'])
    expect(enumChecks(SQL, 'provenance')[0]).toEqual(['adapter', 'heuristic', 'ai', 'consensus'])
    for (const list of enumChecks(SQL, 'provenance').concat(enumChecks(SQL, 'base_provenance'))) {
      expect(list).not.toContain('user')
    }
  })

  it('promotion to consensus counts distinct users and needs at least three', () => {
    expect(SQL).toContain('count(DISTINCT v.user_id)')
    expect(SQL).toMatch(/IF c >= 3 AND c > r THEN\s*\n\s*NEW\.provenance := 'consensus';/)
    // count(*) would make ten thousand rows from one account look like agreement.
    expect(SQL).not.toContain('count(*) FILTER')
  })

  it('nothing without consensus can reach the planner pre-accept threshold', () => {
    const cap = SQL.match(/provenance = 'consensus' OR confidence <= ([\d.]+)\)/)
    expect(cap, 'the unconsensed confidence cap constraint is gone').not.toBeNull()
    expect(Number(cap?.[1])).toBeLessThan(ACCEPT_THRESHOLD)
  })

  it('the three global tables are readable by authenticated and writable by none', () => {
    for (const table of ['ats_form_signatures', 'profile_field_mappings', 'autofill_mapping_votes']) {
      const policies = [...SQL.matchAll(
        new RegExp(`CREATE POLICY "[^"]+"\\s*\\nON public\\.${table}\\s*\\nFOR (\\w+)`, 'g'),
      )].map((m) => m[1])
      expect(policies, `${table} must have exactly one policy`).toEqual(['SELECT'])

      // The second lock on the same door: ALL includes TRUNCATE, which RLS does
      // not filter, so a write policy added by mistake still finds no privilege.
      const revoke = SQL.indexOf(`REVOKE ALL ON public.${table} FROM authenticated;`)
      const grant = SQL.indexOf(`GRANT SELECT ON public.${table} TO authenticated;`)
      expect(revoke, `${table} never revokes from authenticated`).toBeGreaterThan(-1)
      expect(grant, `${table} never grants SELECT to authenticated`).toBeGreaterThan(revoke)
      expect(SQL).not.toContain(`GRANT SELECT, INSERT, UPDATE, DELETE ON public.${table} TO authenticated`)
    }
  })

  it('the two user-scoped tables carry all four policies', () => {
    for (const table of ['autofill_sessions', 'autofill_events']) {
      const policies = [...SQL.matchAll(
        new RegExp(`CREATE POLICY "[^"]+"\\s*\\nON public\\.${table}\\s*\\nFOR (\\w+)`, 'g'),
      )].map((m) => m[1]).sort()
      expect(policies).toEqual(['DELETE', 'INSERT', 'SELECT', 'UPDATE'])
    }
  })

  it('the SECURITY DEFINER tally helper is not reachable as a PostgREST RPC', () => {
    // EXECUTE defaults to PUBLIC, and this one bypasses RLS on the votes table.
    expect(SQL).toMatch(
      /REVOKE EXECUTE ON FUNCTION public\.autofill_mapping_vote_tally\(UUID, TEXT, TEXT\)\s*\n\s*FROM PUBLIC, anon, authenticated;/,
    )
  })

  it('every function pins its search_path', () => {
    const defined = [...SQL.matchAll(/CREATE OR REPLACE FUNCTION public\.(\w+)/g)].length
    const pinned = [...SQL.matchAll(/SET search_path = public, pg_catalog/g)].length
    expect(defined).toBeGreaterThan(0)
    expect(pinned).toBe(defined)
  })
})

describe('035 migration: retention and transactional shape', () => {
  it('the 90-day delete has an index to use', () => {
    expect(SQL).toContain(
      'CREATE INDEX IF NOT EXISTS idx_autofill_events_occurred_at\n  ON public.autofill_events(occurred_at);',
    )
    expect(SQL).toContain('isAuthorizedCronRequest')
  })

  it('applies whole or not at all', () => {
    // The window the transaction closes: Supabase's default privileges grant ALL
    // on a new public table at CREATE TABLE time, and the REVOKE lands later.
    expect(SQL.match(/^BEGIN;$/gm)).toHaveLength(1)
    expect(SQL.match(/^COMMIT;$/gm)).toHaveLength(1)
    expect(SQL.indexOf('\nBEGIN;')).toBeLessThan(SQL.indexOf('CREATE TABLE IF NOT EXISTS'))
    expect(SQL.lastIndexOf('\nCOMMIT;')).toBeGreaterThan(SQL.lastIndexOf('CREATE POLICY'))
  })
})

describe('035 migration: hash length contract with fingerprint.ts', () => {
  const identity = (over: Partial<FieldIdentity> = {}): FieldIdentity => ({
    kind: 'text',
    name: 'job_application[first_name]',
    elementId: 'first_name',
    atsHint: null,
    label: 'First Name *',
    repeatGroup: null,
    occurrenceIndex: null,
    ...over,
  })

  // THE CROSS-MODULE CONTRACT, and the reason it is asserted here rather than
  // described in a comment: the fingerprint helpers produce the values that go
  // into field_signature_hash and form_fingerprint, so a disagreement about
  // digest length is not a style difference -- it is every cache write failing
  // 23514 the first time the route runs, with nothing in CI to catch it.
  const hashCheck = new RegExp(
    SQL.match(/field_signature_hash ~ '(\^\[0-9a-f\]\{\d+\}\$)'/)?.[1] ?? 'NO CHECK FOUND',
  )

  it('fieldKey() produces a digest the field_signature_hash CHECK accepts', async () => {
    expect(await fieldKey('greenhouse', identity())).toMatch(hashCheck)
  })

  it('formFingerprint() produces a digest the form_fingerprint CHECK accepts', async () => {
    const keys = await Promise.all([
      fieldKey('greenhouse', identity()),
      fieldKey('greenhouse', identity({ elementId: 'last_name', label: 'Last Name *' })),
    ])
    expect(await formFingerprint('greenhouse', keys)).toMatch(hashCheck)
  })
})
