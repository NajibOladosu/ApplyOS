/**
 * Label-based sensitivity classification.
 *
 * Spec: extension/AUTOFILL_ARCHITECTURE.md section 5.2.
 *
 * This is the complement to `sensitivityOf(key)` (types.ts:173), which answers
 * "is this KEY sensitive". That one cannot see a field the resolver failed to
 * map: an unmapped free-text control labelled "Voluntary Self-Identification of
 * Disability" resolves to `unmapped`, whose key sensitivity is `public`. This
 * module reads the employer's own words instead, so the planner can take the
 * stricter of the two verdicts (see `strictestSensitivity`, used by score.ts).
 *
 * THE RULE THAT MAKES THIS SAFE (section 5.2): every term is matched as a
 * CONTIGUOUS TOKEN SEQUENCE via containsPhrase, never with String.includes.
 * Substring matching on short terms is catastrophic in both directions --
 * 'age' is inside "Hiring manager", "Average GPA", "Page 2 of 3" and "Package";
 * 'opt' is inside "Cover letter (Optional)"; 'sex' is inside "Middlesex" -- and
 * a false `protected` verdict hard-blocks an ordinary field behind the EEO
 * opt-in gate. Short ambiguous terms are therefore replaced by anchored full
 * terms ('date of birth', 'years of age', 'sexual orientation', 'employment
 * authorization document') rather than trimmed down to the shared root.
 *
 * CONSTRAINTS ON THIS DIRECTORY (see AUTOFILL_ARCHITECTURE.md section 0.3, same
 * as types.ts:6-12): relative imports only, no `chrome.*`, no Node builtins.
 */

import { containsPhrase, tokenize, type Phrase } from './tokenize'
import type { Sensitivity } from './types'

/**
 * Special-category demographics, age, and the voluntary self-ID forms.
 *
 * Note the short terms section 5.2 names are absent by design: no bare 'age',
 * 'sex', 'opt', 'ead', 'cpt', 'sin' or 'itar'. Token matching already defends
 * against "Middlesex" (one token, 'middlesex'), but not against a label that
 * genuinely tokenizes to a bare match -- "Middle Sex County" or a "Sex
 * Education Coordinator" value in a position field both produce a 'sex' token.
 * The taxonomy can afford ph('sex') for `gender` because there a phrase hit is
 * one of nine weighted channels that negatives and the ambiguity demotion can
 * overrule; here one hit is a hard block, so the bar is higher.
 */
const PROTECTED_TERMS: ReadonlyArray<Phrase> = [
  // Gender / sexuality
  ph('gender'),
  ph('gender identity'),
  ph('gender expression'),
  ph('sexual orientation'),
  ph('sex assigned at birth'),
  ph('biological sex'),
  ph('transgender'),
  ph('lgbtq'),
  // Race / ethnicity / origin
  ph('race'),
  ph('races'),
  ph('racial'),
  ph('ethnicity'),
  ph('ethnic background'),
  ph('ethnic group'),
  ph('ethnic origin'),
  ph('hispanic'),
  ph('latino'),
  ph('latina'),
  ph('latinx'),
  ph('national origin'),
  ph('nationality'),
  ph('citizenship'), // the demographic form of the question; "are you a citizen" is eligibility
  ph('caste'),
  ph('indigenous'),
  ph('aboriginal'),
  // Veteran / military
  ph('veteran'),
  ph('veterans'),
  ph('protected veteran'),
  ph('military service'),
  ph('military status'),
  ph('uniformed service'),
  // Disability
  ph('disability'),
  ph('disabilities'),
  ph('disabled'),
  ph('self identification'),
  ph('voluntary self identification'),
  ph('form cc-305'),
  ph('cc-305'),
  ph('reasonable accommodation'),
  // Age and birth -- anchored, never a bare 'age' token
  ph('date of birth'),
  ph('birth date'),
  ph('birthdate'),
  ph('dob'),
  ph('year of birth'),
  ph('place of birth'),
  ph('country of birth'),
  ph('city of birth'),
  ph('state of birth'),
  ph('your age'),
  ph('age range'),
  ph('what is your age'),
  ph('years of age'), // "Are you 18 years of age or older?"
  ph('age or older'),
  ph('age of 18'), // "Are you over the age of 18?"
  ph('over 18'),
  ph('18 or older'),
  // Other special-category / attestation
  ph('marital status'),
  ph('religion'),
  ph('religious affiliation'),
  ph('genetic information'),
  ph('pregnancy'),
]

/**
 * Compensation. Ranked above `eligibility` because `compensation` is in
 * NEVER_PRE_ACCEPT (types.ts:111-114) and `eligibility` is not, so a field that
 * reads as both must come back as the one that cannot be pre-accepted.
 */
const COMPENSATION_TERMS: ReadonlyArray<Phrase> = [
  ph('salary'),
  ph('salaries'),
  ph('compensation'),
  ph('remuneration'),
  ph('wage'),
  ph('wages'),
  ph('pay rate'),
  ph('rate of pay'),
  ph('hourly rate'),
  ph('pay expectations'),
  ph('base pay'),
  ph('base salary'),
  ph('total compensation'),
  ph('salary history'),
  ph('expected ctc'),
  ph('current ctc'),
  ph('bonus'),
  ph('stock options'),
  ph('equity compensation'), // NOT bare 'equity': "Diversity, Equity and Inclusion"
  ph('compensation package'), // NOT bare 'package': the 'age' substring trap, section 5.2
]

/** Work authorization, visa, clearance. Not in NEVER_PRE_ACCEPT, but rail-flagged. */
const ELIGIBILITY_TERMS: ReadonlyArray<Phrase> = [
  ph('work authorization'),
  ph('work authorisation'),
  ph('authorized to work'),
  ph('authorised to work'),
  ph('legally authorized'),
  ph('eligible to work'),
  ph('legally eligible to work'),
  ph('right to work'),
  ph('employment eligibility'),
  ph('employment authorization document'), // anchored; never a bare 'ead'
  ph('sponsorship'),
  ph('visa'),
  ph('visa status'),
  ph('immigration status'),
  ph('work permit'),
  ph('permanent resident'),
  ph('green card'),
  ph('citizen'), // "Are you a U.S. citizen?" -- eligibility; 'citizenship' is protected
  ph('citizens'),
  ph('security clearance'),
  ph('clearance level'),
  ph('optional practical training'), // anchored; never a bare 'opt' or 'cpt'
  ph('curricular practical training'),
  ph('i-9'),
]

/** PII that is ordinary for a job application but still worth labelling in the rail. */
const CONTACT_TERMS: ReadonlyArray<Phrase> = [
  ph('email'),
  ph('e-mail'),
  ph('phone'),
  ph('telephone'),
  ph('mobile'),
  ph('cell phone'),
  ph('address'),
  ph('street address'),
  ph('address line'),
  ph('postal code'),
  ph('post code'),
  ph('postcode'),
  ph('zip'),
  ph('zip code'),
  ph('city'),
  ph('town'),
  ph('state'),
  ph('province'),
  ph('country'),
]

/**
 * Strictness order, highest first. Iterating this rather than a hand-written
 * if/else chain is what keeps the CHECK order and the RANK order below from
 * drifting apart -- and the check order is the whole semantics of this function
 * when a label matches two tables.
 */
const TERM_TABLES: ReadonlyArray<readonly [Sensitivity, ReadonlyArray<Phrase>]> = [
  ['protected', PROTECTED_TERMS],
  ['compensation', COMPENSATION_TERMS],
  ['eligibility', ELIGIBILITY_TERMS],
  ['contact', CONTACT_TERMS],
]

/** Exposed so a test can assert the tables stay ordered by descending strictness. */
export const SENSITIVITY_TERMS = TERM_TABLES

const SENSITIVITY_RANK: Readonly<Record<Sensitivity, number>> = {
  public: 0,
  contact: 1,
  eligibility: 2,
  compensation: 3,
  protected: 4,
}

/**
 * Classify one piece of employer-authored text.
 *
 * Takes ONE string on purpose. Concatenating a descriptor's channels before
 * classifying would fabricate phrases across the join: label "Date" plus name
 * "of_birth_school_id" tokenizes to ['date','of','birth','school','id'] and
 * matches 'date of birth' in text where no such phrase exists. score.ts
 * classifies each channel separately and merges with strictestSensitivity.
 */
export function classifyLabelSensitivity(text: string | null | undefined): Sensitivity {
  const tokens = tokenize(text)
  if (tokens.length === 0) return 'public'

  for (const [sensitivity, terms] of TERM_TABLES) {
    for (const term of terms) {
      if (containsPhrase(term, tokens)) return sensitivity
    }
  }
  return 'public'
}

/** The stricter of two verdicts. Used to merge the key-based and label-based classifiers. */
export function strictestSensitivity(a: Sensitivity, b: Sensitivity): Sensitivity {
  return SENSITIVITY_RANK[b] > SENSITIVITY_RANK[a] ? b : a
}

/**
 * Phrases are tokenized from their surface form for the same reason as in
 * taxonomy.ts: a hand-written token literal can silently stop matching the text
 * it was copied from ('i-9' -> ['i','9'], 'cc-305' -> ['cc','305']).
 */
function ph(surface: string): Phrase {
  return tokenize(surface)
}
