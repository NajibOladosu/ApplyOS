/**
 * Cache identity for the AI escalation cache.
 *
 * Spec: extension/AUTOFILL_ARCHITECTURE.md section 10.1.
 *
 * The resolve-fields cache is GLOBAL — one row per (ats, fieldKey), shared by
 * every user who ever opens that employer's form. That only pays for itself if
 * a key computed on one user's machine equals the key computed on another's, so
 * every input here is employer-authored page structure and none of it is user
 * data. Nothing derived from a profile value, a session, or a requisition id may
 * enter these hashes.
 *
 * CONSTRAINTS ON THIS DIRECTORY (see AUTOFILL_ARCHITECTURE.md section 0.3):
 *  - Relative imports only; `@/` resolves differently in the Next app and the
 *    extension build.
 *  - No `chrome.*`, no Node builtins — hence WebCrypto rather than `node:crypto`.
 */

import type { AtsId, FieldDescriptor } from './types'
import { normalizeText } from './tokenize'

/**
 * The employer-authored slice of a descriptor.
 *
 * Deliberately a structural subset rather than the whole FieldDescriptor: the
 * server recomputes fieldKey from the redacted wire payload (section 10.2,
 * requirement 1) and must reach the same value without ever seeing `domPath`,
 * `frameKey`, `hasExistingValue` or the scan-local `id`. Typing the input as the
 * subset makes "the hash saw something it should not have" a compile error.
 */
export type FieldIdentity = Pick<
  FieldDescriptor,
  'kind' | 'name' | 'elementId' | 'atsHint' | 'label' | 'repeatGroup' | 'occurrenceIndex'
>

/** Length of every hash this module returns. Matches the `char(32)` cache columns. */
const KEY_LENGTH = 32

function subtle(): SubtleCrypto {
  const c = globalThis.crypto as Crypto | undefined
  // Without this guard the failure is `Cannot read properties of undefined
  // (reading 'digest')` thrown from inside a hash of an unnamed field — which
  // says nothing about the actual cause (an insecure origin, or a bundler
  // target old enough to drop WebCrypto).
  if (!c || !c.subtle) {
    throw new Error(
      'autofill/fingerprint: globalThis.crypto.subtle is unavailable. ' +
        'WebCrypto requires a secure context; check the execution environment.',
    )
  }
  return c.subtle
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await subtle().digest('SHA-256', new TextEncoder().encode(input))
  let out = ''
  for (const byte of new Uint8Array(digest)) out += byte.toString(16).padStart(2, '0')
  return out
}

/**
 * Escape the field separator inside each component.
 *
 * `name`, `elementId` and `atsHint` go into the hash unnormalized, and all three
 * are employer-controlled. Without escaping, a `data-automation-id` of
 * `"a|b"` and a (name, id) pair of `("a", "b")` hash identically — a collision
 * an attacker can author on purpose, which in a globally shared cache is the
 * cache-poisoning primitive section 10.2 exists to prevent.
 */
function esc(part: string): string {
  return part.replace(/\\/g, '\\\\').replace(/\|/g, '\\|')
}

function join(parts: readonly string[]): string {
  return parts.map(esc).join('|')
}

/**
 * Identity of ONE field, stable across users and page loads.
 *
 * Two normalizations keep the cache from shattering:
 *  - trailing digits are stripped from `elementId`, because a Greenhouse
 *    question id (`question_12345`) is minted per requisition;
 *  - `[N]` collapses to `[]` in `name`, because a Rails/Workday repeater index
 *    (`answers[3][text]`) is a row position, not a field identity.
 *
 * `repeatGroup` and `occurrenceIndex` are then added back, and they are not
 * optional: they are the ONLY thing separating row 1's "Company" from row 3's
 * "Company" once `[N]` has been collapsed. Drop them and a Workday
 * work-experience widget resolves every row from one cache entry.
 */
export async function fieldKey(ats: AtsId, d: FieldIdentity): Promise<string> {
  const id = (d.elementId ?? '').replace(/[-_]?\d+$/, '')
  const nm = (d.name ?? '').replace(/\[\d+\]/g, '[]')

  const hash = await sha256Hex(
    join([
      ats,
      nm,
      id,
      d.atsHint ?? '',
      // Labels arrive with required-markers and inconsistent casing/spacing
      // ("First Name *" vs "first name"); normalizeText collapses all of it.
      normalizeText(d.label),
      d.kind,
      d.repeatGroup ?? '',
      d.occurrenceIndex === null ? '' : String(d.occurrenceIndex),
    ]),
  )
  return hash.slice(0, KEY_LENGTH)
}

/**
 * Identity of the FORM: the sorted, de-duplicated set of its field keys.
 *
 * Sorted because the scan order depends on which frame painted first and on
 * adapter rule ordering, neither of which changes the form. De-duplicated
 * because a field enumerated twice — two selector rules hitting one element —
 * would otherwise change the form's identity and miss the entire cache, while
 * costing nothing when it genuinely cannot happen.
 *
 * A field added or removed does change the set, which is the point: it is the
 * signal that a cached plan for this form is stale.
 */
export async function formFingerprint(ats: AtsId, keys: Iterable<string>): Promise<string> {
  const unique = [...new Set(keys)].sort()
  return (await sha256Hex(join([ats, ...unique]))).slice(0, KEY_LENGTH)
}
