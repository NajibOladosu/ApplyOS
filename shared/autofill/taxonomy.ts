/**
 * Per-key signatures for the heuristic resolver.
 *
 * Spec: extension/AUTOFILL_ARCHITECTURE.md section 5.
 *
 * A signature is the evidence that a field means one profile key: the phrases
 * that argue FOR it, the phrases that argue against it, the control kinds it can
 * plausibly appear as, and the HTML autocomplete tokens that settle the matter
 * outright (section 5 weights `autocomplete` at 60 against a 30-point label,
 * because it is the one signal the employer authored for exactly this purpose).
 *
 * The negatives are the load-bearing half. Job forms ask for the applicant's
 * name and the employer's name with the same words, and a resolver with only
 * positive phrases puts the user's surname in "Manager name". Every negative
 * below names the label it defends against.
 *
 * CONSTRAINTS ON THIS DIRECTORY (see AUTOFILL_ARCHITECTURE.md section 0.3, same
 * as types.ts:6-12): relative imports only, no `chrome.*`, no Node builtins.
 */

import { PROFILE_KEYS, type FieldKind, type ProfileKey } from './types'
import { tokenize, type Phrase } from './tokenize'

/**
 * Every key except the terminal `unmapped` (types.ts:83), which by definition
 * has no signature: it is what a field gets when nothing matched.
 */
export type MappableProfileKey = Exclude<ProfileKey, 'unmapped'>

export interface KeySignature {
  readonly key: MappableProfileKey
  readonly phrases: ReadonlyArray<Phrase>
  readonly negatives: ReadonlyArray<Phrase>
  /**
   * Plausible control kinds. Empty means "no constraint". A descriptor whose
   * kind is `unknown` never counts as a mismatch — see score.ts.
   */
  readonly kinds: ReadonlyArray<FieldKind>
  /** Real HTML autocomplete tokens, lowercase, hyphenated as the attribute writes them. */
  readonly autocomplete: ReadonlyArray<string>
}

type SignatureSpec = Omit<KeySignature, 'key'>

/**
 * Phrases are built by running the surface form through the real tokenizer
 * rather than hand-written as token literals.
 *
 * Hand-written literals drift from the tokenizer the moment the tokenizer is
 * right and the author's intuition is wrong: tokenize('LinkedIn') is
 * ['linked','in'] and tokenize('linkedin') is ['linkedin'] (tokenize.ts:40-43),
 * tokenize('address line 1') keeps the digit as its own token, and
 * tokenize('e-mail') is ['e','mail']. Writing the label and letting tokenize()
 * split it means a phrase can never fail to match the text it was copied from.
 */
const ph = (surface: string): Phrase => tokenize(surface)

/**
 * The drift guard section 5 asks for, at the type level: `Record` over
 * MappableProfileKey means adding a key to PROFILE_KEYS (types.ts:31-84)
 * without adding a signature is a `tsc` error, not a silent coverage hole.
 */
const SPECS: Readonly<Record<MappableProfileKey, SignatureSpec>> = {
  // -------------------------------------------------------------------------
  // Identity
  // -------------------------------------------------------------------------

  legal_first_name: {
    // The bare ['first'] phrase earns its keep on `<input name="first">`, which
    // is common enough to matter and carries no other signal. It is only safe
    // because of the negatives directly below it.
    phrases: [
      ph('first name'),
      ph('given name'),
      ph('legal first name'),
      ph('firstname'),
      ph('fname'),
      ph('forename'),
      ph('first'),
    ],
    negatives: [
      ph('first day'), // "First day available" -> earliest_start_date
      ph('first choice'), // "First choice of office location"
      ph('first language'), // "First language" -> languages, not a name
      ph('first line'), // "First line of address" -> address_line1
      ph('first year'), // "First year of attendance" -> education row
      ph('company name'), // "Company name" -> current_employer
      ph('school name'), // education repeater
      ph('manager name'), // "Manager first name" on a reference block
      ph('reference name'),
      ph('emergency contact'), // emergency-contact blocks repeat every name field
    ],
    kinds: ['text'],
    autocomplete: ['given-name'],
  },

  legal_last_name: {
    phrases: [
      ph('last name'),
      ph('family name'),
      ph('surname'),
      ph('legal last name'),
      ph('lastname'),
      ph('lname'),
      ph('last'),
    ],
    negatives: [
      ph('manager name'), // "Manager's last name" -- required by section 5
      ph('reference name'), // "Reference's last name"
      ph('supervisor name'),
      ph('company name'), // "Company name" -> current_employer
      ph('employer name'),
      ph('school name'),
      ph('last day'), // "Last day of employment" -> a date, not a name
      ph('last four'), // "Last four digits of SSN" -- never ours to fill
      ph('last employer'), // work-history row
      ph('last company'),
      ph('last position'),
    ],
    kinds: ['text'],
    autocomplete: ['family-name'],
  },

  preferred_name: {
    phrases: [
      ph('preferred name'),
      ph('preferred first name'),
      ph('nickname'),
      ph('chosen name'),
      ph('goes by'),
      ph('name you go by'),
      ph('display name'),
    ],
    negatives: [
      ph('preferred language'), // a languages question, and a national-origin proxy
      ph('preferred location'), // "Preferred work location" -> remote_preference
      ph('preferred pronouns'), // -> pronouns
      ph('preferred start date'), // -> earliest_start_date
      ph('preferred contact method'),
      ph('preferred salary'), // -> desired_salary
      ph('company name'),
    ],
    kinds: ['text'],
    autocomplete: ['nickname'],
  },

  full_name: {
    // ['name'] alone is deliberately included: "Name" is the whole label on
    // plenty of forms and there is nothing else to go on. It is also the single
    // greediest phrase in this file, which is why full_name carries the longest
    // negative list -- every other thing a job form calls a "name".
    phrases: [
      ph('full name'),
      ph('legal name'),
      ph('full legal name'),
      ph('your name'),
      ph('first and last name'),
      ph('name as it appears'),
      ph('candidate name'),
      ph('applicant name'),
      ph('name'),
    ],
    negatives: [
      ph('first name'), // the name-parts fields, which have their own keys
      ph('last name'),
      ph('middle name'),
      ph('given name'),
      ph('family name'),
      ph('preferred name'),
      ph('nickname'),
      ph('company name'), // "Company name" -> current_employer
      ph('employer name'),
      ph('organization name'),
      ph('school name'), // education repeater
      ph('university name'),
      ph('institution name'),
      ph('program name'),
      ph('degree name'),
      ph('manager name'), // reference / supervisor blocks
      ph('supervisor name'),
      ph('reference name'),
      ph('contact name'),
      ph('recruiter name'),
      ph('user name'), // credential fields
      ph('username'),
      ph('file name'), // an upload widget's rendered filename
      ph('job title'),
      ph('name of company'),
      ph('name of employer'),
      ph('name of school'),
      ph('name of reference'),
      ph('name of supervisor'),
    ],
    kinds: ['text'],
    autocomplete: ['name'],
  },

  pronouns: {
    phrases: [ph('pronouns'), ph('preferred pronouns'), ph('your pronouns'), ph('gender pronouns')],
    negatives: [
      ph('gender identity'), // -> gender, which is protected and opt-in gated
      ph('sexual orientation'),
    ],
    kinds: ['text', 'select', 'combobox', 'radio_group'],
    autocomplete: [],
  },

  // -------------------------------------------------------------------------
  // Contact
  // -------------------------------------------------------------------------

  email: {
    phrases: [
      ph('email'),
      ph('email address'),
      ph('e-mail'),
      ph('your email'),
      ph('contact email'),
      ph('personal email'),
    ],
    negatives: [
      ph('employer email'), // reference / current-employer blocks
      ph('reference email'),
      ph('manager email'),
      ph('supervisor email'),
      ph('recruiter email'),
      ph('email me about'), // marketing opt-in checkbox, not an address field
      ph('email updates'),
      ph('email notifications'),
      ph('email consent'),
      ph('subscribe'),
    ],
    kinds: ['email', 'text'],
    autocomplete: ['email'],
  },

  phone: {
    phrases: [
      ph('phone'),
      ph('phone number'),
      ph('mobile'),
      ph('mobile number'),
      ph('mobile phone'),
      ph('cell phone'),
      ph('cell number'),
      ph('telephone'),
      ph('contact number'),
      ph('primary phone'),
    ],
    negatives: [
      ph('employer phone'), // required by section 5 -- the employer's switchboard
      ph('company phone'),
      ph('reference phone'),
      ph('manager phone'),
      ph('supervisor phone'),
      ph('emergency contact'),
      ph('country code'), // -> phone_country_code
      ph('phone country code'),
      ph('phone type'), // mobile/home/work selector, not the number
      ph('phone extension'),
      ph('fax'),
    ],
    kinds: ['tel', 'text', 'number'],
    autocomplete: ['tel', 'tel-national'],
  },

  phone_country_code: {
    phrases: [
      ph('country code'),
      ph('phone country code'),
      ph('dial code'),
      ph('dialing code'),
      ph('country calling code'),
      ph('phone code'),
    ],
    negatives: [
      ph('postal code'), // -> postal_code
      ph('zip code'),
      ph('country of residence'), // -> country
      ph('area code'), // part of the number itself
      ph('referral code'),
    ],
    kinds: ['select', 'combobox', 'typeahead', 'text'],
    autocomplete: ['tel-country-code'],
  },

  address_line1: {
    phrases: [
      ph('address line 1'),
      ph('address line one'),
      ph('street address'),
      ph('address 1'),
      ph('street'),
      ph('street name and number'),
      ph('mailing address'),
      ph('home address'),
      ph('address'),
    ],
    negatives: [
      ph('email address'), // the single most common "address" that is not postal
      ph('e-mail address'),
      ph('ip address'),
      ph('website address'),
      ph('address line 2'), // -> address_line2
      ph('address 2'),
      ph('apartment'),
      ph('suite'),
      ph('address city'), // Workday-style composite names for the other parts
      ph('address state'),
      ph('address country'),
      ph('address postal code'),
      ph('employer address'), // work-history row
      ph('company address'),
      ph('school address'),
    ],
    kinds: ['text'],
    autocomplete: ['address-line1', 'street-address'],
  },

  address_line2: {
    phrases: [
      ph('address line 2'),
      ph('address line two'),
      ph('address 2'),
      ph('apartment'),
      ph('apartment suite'),
      ph('apt'),
      ph('suite'),
      ph('unit'),
      ph('floor'),
    ],
    negatives: [
      ph('address line 1'), // -> address_line1
      ph('address 1'),
      ph('street address'),
      ph('unit of study'), // education row
      ph('business unit'), // internal-transfer forms
    ],
    kinds: ['text'],
    autocomplete: ['address-line2'],
  },

  city: {
    phrases: [ph('city'), ph('town'), ph('city or town'), ph('address city'), ph('locality')],
    negatives: [
      ph('city of birth'), // protected demographic, not an address
      ph('employer city'), // work-history row
      ph('company city'),
      ph('school city'),
      ph('city you are applying'), // a job-location question
    ],
    kinds: ['text', 'select', 'combobox', 'typeahead'],
    autocomplete: ['address-level2'],
  },

  state_region: {
    phrases: [
      ph('state'),
      ph('province'),
      ph('state or province'),
      ph('state province'),
      ph('region'),
      ph('county'),
      ph('prefecture'),
      ph('address state'),
    ],
    negatives: [
      ph('united states'), // a country VALUE, not a state field
      ph('employer state'), // work-history row
      ph('school state'),
      ph('state of birth'), // protected demographic
    ],
    kinds: ['text', 'select', 'combobox', 'typeahead'],
    autocomplete: ['address-level1'],
  },

  postal_code: {
    phrases: [
      ph('postal code'),
      ph('zip code'),
      ph('zip'),
      ph('postcode'),
      ph('post code'),
      ph('zip postal code'),
      ph('postal'),
    ],
    negatives: [
      ph('country code'), // -> phone_country_code
      ph('area code'),
      ph('referral code'),
      ph('promo code'),
      ph('requisition'), // "Requisition code" is the employer's id
    ],
    kinds: ['text', 'number'],
    autocomplete: ['postal-code'],
  },

  country: {
    phrases: [
      ph('country'),
      ph('country of residence'),
      ph('address country'),
      ph('which country do you live in'),
      ph('nation'),
    ],
    negatives: [
      ph('country code'), // -> phone_country_code
      ph('phone country code'),
      ph('country of birth'), // protected demographic
      ph('country of citizenship'), // eligibility / protected, never this
      ph('nationality'),
      ph('work authorization country'), // -> work_authorized
      ph('countries you are authorized'),
    ],
    kinds: ['select', 'combobox', 'typeahead', 'text'],
    autocomplete: ['country', 'country-name'],
  },

  // -------------------------------------------------------------------------
  // Links
  //
  // Both spellings of each brand are listed because tokenize() cannot know a
  // brand is one word: 'LinkedIn' -> ['linked','in'] but 'linkedin' ->
  // ['linkedin'], and 'GitHub' -> ['git','hub'] but 'github' -> ['github'].
  // -------------------------------------------------------------------------

  linkedin_url: {
    phrases: [
      ph('LinkedIn'),
      ph('linkedin'),
      ph('LinkedIn profile'),
      ph('linkedin url'),
      ph('LinkedIn profile url'),
      ph('linked in'),
    ],
    negatives: [
      // "How did you hear about this role? (LinkedIn, Indeed, ...)" mentions the
      // brand in a select whose answer is a source, not a URL.
      ph('how did you hear'),
      ph('where did you hear'),
    ],
    kinds: ['url', 'text'],
    autocomplete: [],
  },

  github_url: {
    phrases: [ph('GitHub'), ph('github'), ph('git hub'), ph('github url'), ph('GitHub profile')],
    negatives: [ph('how did you hear'), ph('where did you hear')],
    kinds: ['url', 'text'],
    autocomplete: [],
  },

  portfolio_url: {
    phrases: [
      ph('portfolio'),
      ph('portfolio url'),
      ph('portfolio website'),
      ph('portfolio link'),
      ph('personal website'),
      ph('personal site'),
      ph('personal url'),
      ph('your website'),
      ph('website'),
      ph('web site'),
    ],
    negatives: [
      ph('company website'), // required by section 5 -- the employer's own site
      ph('employer website'),
      ph('company url'),
      ph('school website'),
      ph('university website'),
      ph('where did you hear'),
      ph('how did you hear'),
      ph('LinkedIn'), // the branded link fields have their own keys
      ph('linkedin'),
      ph('GitHub'),
      ph('github'),
    ],
    kinds: ['url', 'text'],
    autocomplete: ['url'],
  },

  other_url: {
    phrases: [
      ph('other url'),
      ph('other website'),
      ph('other link'),
      ph('other profile'),
      ph('additional links'),
      ph('additional url'),
      ph('social media'),
      ph('twitter'),
      ph('dribbble'),
      ph('behance'),
      ph('stack overflow'),
      ph('stackoverflow'),
    ],
    negatives: [
      ph('company website'), // the employer's site is nobody's profile link
      ph('portfolio'), // -> portfolio_url
      ph('LinkedIn'),
      ph('linkedin'),
      ph('GitHub'),
      ph('github'),
      ph('how did you hear'),
    ],
    kinds: ['url', 'text'],
    autocomplete: [],
  },

  // -------------------------------------------------------------------------
  // Employment
  // -------------------------------------------------------------------------

  current_employer: {
    // 'company name' is a POSITIVE here. That is the other half of why it is a
    // negative on full_name: the phrase has a correct home to go to.
    phrases: [
      ph('current employer'),
      ph('current company'),
      ph('current organization'),
      ph('present employer'),
      ph('most recent employer'),
      ph('most recent company'),
      ph('company name'),
      ph('employer name'),
      ph('employer'),
      ph('company'),
      ph('organization'),
    ],
    negatives: [
      ph('company website'), // required by section 5
      ph('company url'),
      ph('company email'),
      ph('company phone'),
      ph('company address'),
      ph('company size'),
      ph('our company'), // "Why do you want to work at our company?"
      ph('why do you want to work'),
      ph('how did you hear'),
      ph('company values'),
    ],
    kinds: ['text', 'combobox', 'typeahead'],
    autocomplete: ['organization'],
  },

  current_title: {
    phrases: [
      ph('current title'),
      ph('current job title'),
      ph('current position'),
      ph('current role'),
      ph('most recent title'),
      ph('job title'),
      ph('position title'),
      ph('occupation'),
      ph('title'),
    ],
    negatives: [
      ph('position you are applying for'), // the REQUISITION's title, not ours
      ph('job you are applying for'),
      ph('title of the position you are applying'),
      ph('requisition title'),
      ph('title prefix'), // "Title (Mr./Ms.)" -- an honorific
      ph('salutation'),
      ph('degree title'), // education row
      ph('thesis title'),
      ph('project title'),
      ph('title of reference'),
    ],
    kinds: ['text', 'combobox', 'typeahead'],
    autocomplete: ['organization-title'],
  },

  years_experience: {
    phrases: [
      ph('years of experience'),
      ph('years experience'),
      ph('total years of experience'),
      ph('years of relevant experience'),
      ph('how many years of experience'),
      ph('experience in years'),
      ph('yrs of experience'),
    ],
    negatives: [
      ph('years of education'), // education row
      ph('years of school'),
      ph('years at company'), // tenure in one role, not a career total
      ph('years in role'),
      ph('years of management experience'), // a narrower question than ours
    ],
    kinds: ['number', 'text', 'select', 'combobox'],
    autocomplete: [],
  },

  // -------------------------------------------------------------------------
  // Eligibility
  // -------------------------------------------------------------------------

  work_authorized: {
    phrases: [
      ph('legally authorized to work'),
      ph('legally authorised to work'),
      ph('authorized to work'),
      ph('authorised to work'),
      ph('eligible to work'),
      ph('legally eligible to work'),
      ph('right to work'),
      ph('work authorization'),
      ph('work authorisation'),
      ph('work permit'),
    ],
    negatives: [
      // The sponsorship question is the near-mirror of this one, and answering
      // one with the other's value inverts the meaning.
      ph('require sponsorship'),
      ph('need sponsorship'),
      ph('visa sponsorship'),
      ph('now or in the future require'),
      ph('visa status'), // -> visa_status
      ph('security clearance'),
      ph('employment authorization document'), // the EAD document, not the answer
    ],
    kinds: ['radio_group', 'select', 'checkbox', 'combobox'],
    autocomplete: [],
  },

  requires_sponsorship: {
    phrases: [
      ph('require sponsorship'),
      ph('require visa sponsorship'),
      ph('require employment sponsorship'),
      ph('need sponsorship'),
      ph('visa sponsorship'),
      ph('immigration sponsorship'),
      ph('now or in the future require sponsorship'),
      ph('sponsorship'),
    ],
    negatives: [
      ph('legally authorized to work'), // -> work_authorized, opposite polarity
      ph('authorized to work'),
      ph('eligible to work'),
    ],
    kinds: ['radio_group', 'select', 'checkbox', 'combobox'],
    autocomplete: [],
  },

  visa_status: {
    phrases: [
      ph('visa status'),
      ph('visa type'),
      ph('type of visa'),
      ph('current visa'),
      ph('work visa'),
      ph('immigration status'),
      ph('work permit type'),
      ph('visa'),
    ],
    negatives: [
      ph('require sponsorship'), // -> requires_sponsorship
      ph('authorized to work'), // -> work_authorized
      ph('marital status'), // the other "... status" fields on the same form
      ph('veteran status'),
      ph('disability status'),
      ph('employment status'),
      ph('application status'),
    ],
    kinds: ['select', 'combobox', 'typeahead', 'radio_group', 'text'],
    autocomplete: [],
  },

  security_clearance: {
    phrases: [
      ph('security clearance'),
      ph('clearance level'),
      ph('active clearance'),
      ph('government clearance'),
      ph('do you have a security clearance'),
      ph('clearance'),
    ],
    negatives: [
      ph('background check'), // a consent question, not a clearance
      ph('drug test'),
      ph('medical clearance'),
    ],
    kinds: ['select', 'combobox', 'radio_group', 'checkbox', 'text'],
    autocomplete: [],
  },

  // -------------------------------------------------------------------------
  // Logistics
  // -------------------------------------------------------------------------

  desired_salary: {
    phrases: [
      ph('desired salary'),
      ph('salary expectations'),
      ph('salary expectation'),
      ph('expected salary'),
      ph('salary requirements'),
      ph('desired compensation'),
      ph('expected compensation'),
      ph('compensation expectations'),
      ph('pay expectations'),
      ph('desired pay rate'),
      ph('expected hourly rate'),
      ph('base salary expectation'),
      ph('salary range'),
      ph('desired salary range'),
      ph('salary'),
    ],
    negatives: [
      // Current pay is a different question, illegal to ask in several US
      // states, and never answerable from a desired-salary value.
      ph('current salary'),
      ph('current compensation'),
      ph('salary history'),
      ph('last drawn salary'),
      ph('salary offered'), // the employer's number
    ],
    kinds: ['text', 'number', 'select', 'combobox'],
    autocomplete: [],
  },

  earliest_start_date: {
    phrases: [
      ph('start date'),
      ph('earliest start date'),
      ph('available start date'),
      ph('earliest available date'),
      ph('date available'),
      ph('availability date'),
      ph('when can you start'),
      ph('available to start'),
      ph('first day'),
    ],
    negatives: [
      ph('end date'), // work-history / education rows
      ph('employment start date'),
      ph('start date of employment'),
      ph('graduation date'),
      ph('date of birth'), // protected, and the other date on many forms
      ph('date of application'),
      ph('todays date'),
    ],
    kinds: ['date', 'date_segmented', 'text'],
    autocomplete: [],
  },

  notice_period: {
    phrases: [
      ph('notice period'),
      ph('period of notice'),
      ph('notice required'),
      ph('how much notice'),
      ph('weeks notice'),
      ph('notice'),
    ],
    negatives: [
      // Consent checkboxes are worded as notices, and this engine must never
      // tick a legal acknowledgement.
      ph('privacy notice'),
      ph('legal notice'),
      ph('notice and consent'),
      ph('i have read the notice'),
    ],
    kinds: ['text', 'number', 'select', 'combobox'],
    autocomplete: [],
  },

  willing_to_relocate: {
    phrases: [
      ph('willing to relocate'),
      ph('able to relocate'),
      ph('open to relocation'),
      ph('open to relocating'),
      ph('are you willing to relocate'),
      ph('relocation'),
      ph('relocate'),
    ],
    negatives: [
      // "Will you require relocation assistance?" asks whether the employer has
      // to pay. Answering it with "yes, I am willing to move" is a different
      // claim entirely.
      ph('relocation assistance'),
      ph('relocation package'),
      ph('relocation expenses'),
      ph('require relocation assistance'),
    ],
    kinds: ['radio_group', 'select', 'checkbox', 'combobox'],
    autocomplete: [],
  },

  remote_preference: {
    phrases: [
      ph('remote preference'),
      ph('work preference'),
      ph('work location preference'),
      ph('work arrangement'),
      ph('work model'),
      ph('onsite or remote'),
      ph('open to remote'),
      ph('hybrid'),
      ph('remote'),
    ],
    negatives: [
      ph('remote work experience'), // an experience question, not a preference
      ph('have you worked remotely'),
      ph('years of remote'),
    ],
    kinds: ['select', 'radio_group', 'combobox', 'text'],
    autocomplete: [],
  },

  // -------------------------------------------------------------------------
  // Provenance
  // -------------------------------------------------------------------------

  referral_source: {
    phrases: [
      ph('referred by'),
      ph('who referred you'),
      ph('employee referral'),
      ph('referral name'),
      ph('name of referrer'),
      ph('referrer'),
      ph('referral'),
    ],
    negatives: [
      ph('how did you hear about'), // -> how_heard, a channel not a person
      ph('reference name'), // a professional reference is not a referrer
      ph('professional references'),
      ph('referral code'), // a promo/tracking code
    ],
    kinds: ['text', 'select', 'combobox', 'typeahead'],
    autocomplete: [],
  },

  previously_employed_here: {
    phrases: [
      ph('previously employed'),
      ph('have you ever worked for'),
      ph('have you previously worked at'),
      ph('ever been employed by'),
      ph('former employee'),
      ph('are you a former employee'),
      ph('worked here before'),
      ph('rehire'),
    ],
    negatives: [
      ph('previous employer'), // work-history row -> current_employer's siblings
      ph('previously applied'), // a different yes/no on the same form
      ph('ever been convicted'), // a legal attestation, never auto-filled
      ph('ever been terminated'),
    ],
    kinds: ['radio_group', 'select', 'checkbox', 'combobox'],
    autocomplete: [],
  },

  how_heard: {
    phrases: [
      ph('how did you hear'),
      ph('how did you hear about us'),
      ph('how did you hear about this'),
      ph('where did you hear about'),
      ph('how did you find'),
      ph('how did you learn about'),
      ph('what made you apply'),
      ph('source'),
    ],
    negatives: [
      ph('referred by'), // -> referral_source
      ph('open source'), // "Link to open source contributions"
      ph('source code'),
      ph('source of income'),
    ],
    kinds: ['select', 'combobox', 'typeahead', 'text', 'textarea', 'radio_group'],
    autocomplete: [],
  },

  // -------------------------------------------------------------------------
  // EEO -- protected, never pre-accepted, opt-in gated (types.ts:100-117).
  // Signatures exist so the field can be RECOGNIZED and correctly withheld;
  // recognition is what keeps these out of the AI-escalation payload.
  // -------------------------------------------------------------------------

  gender: {
    phrases: [
      ph('gender'),
      ph('gender identity'),
      ph('what is your gender'),
      ph('sex'),
      ph('sex assigned at birth'),
    ],
    negatives: [
      ph('sexual orientation'), // a separate question with separate answers
      ph('pronouns'), // -> pronouns, which is not EEO data
      ph('gender pronouns'),
    ],
    kinds: ['select', 'radio_group', 'combobox', 'checkbox_group', 'text'],
    autocomplete: ['sex'],
  },

  race_ethnicity: {
    phrases: [
      ph('race'),
      ph('ethnicity'),
      ph('race ethnicity'),
      ph('race or ethnicity'),
      ph('racial identity'),
      ph('ethnic background'),
      ph('ethnic group'),
      ph('what is your race'),
    ],
    negatives: [
      ph('hispanic or latino'), // has its own key and its own answer set
      ph('are you hispanic'),
    ],
    kinds: ['select', 'radio_group', 'combobox', 'checkbox_group', 'text'],
    autocomplete: [],
  },

  hispanic_latino: {
    phrases: [
      ph('hispanic or latino'),
      ph('hispanic latino'),
      ph('are you hispanic or latino'),
      ph('hispanic'),
      ph('latino'),
      ph('latinx'),
    ],
    negatives: [
      ph('race or ethnicity'), // the combined question -> race_ethnicity
      ph('race ethnicity'),
    ],
    kinds: ['select', 'radio_group', 'combobox', 'text'],
    autocomplete: [],
  },

  veteran_status: {
    phrases: [
      ph('veteran status'),
      ph('protected veteran'),
      ph('are you a veteran'),
      ph('military service'),
      ph('military status'),
      ph('uniformed service'),
      ph('vietnam era'),
      ph('veteran'),
    ],
    negatives: [
      // The CC-305 disability form mentions disabled veterans; it is still the
      // disability question.
      ph('voluntary self identification of disability'),
      ph('disability status'),
    ],
    kinds: ['select', 'radio_group', 'combobox', 'checkbox_group', 'text'],
    autocomplete: [],
  },

  disability_status: {
    phrases: [
      ph('disability status'),
      ph('voluntary self identification of disability'),
      ph('disability self identification'),
      ph('do you have a disability'),
      ph('form cc-305'),
      ph('cc-305'),
      ph('disability'),
      ph('disabled'),
    ],
    negatives: [
      ph('disabled veteran'), // -> veteran_status
      ph('short term disability'), // benefits enrollment, not self-ID
      ph('long term disability'),
      ph('disability insurance'),
    ],
    kinds: ['select', 'radio_group', 'combobox', 'checkbox', 'text'],
    autocomplete: [],
  },

  // -------------------------------------------------------------------------
  // Documents
  //
  // cover_letter_file and cover_letter_text share their phrases on purpose --
  // the label is identical and only the control kind tells them apart, which is
  // exactly what KIND_MISMATCH in score.ts is for.
  // -------------------------------------------------------------------------

  resume_file: {
    phrases: [
      ph('resume'),
      ph('resume cv'),
      ph('upload resume'),
      ph('attach resume'),
      ph('resume upload'),
      ph('curriculum vitae'),
      ph('cv'),
    ],
    negatives: [
      ph('cover letter'), // -> cover_letter_file
      ph('transcript'),
      ph('writing sample'),
      ph('portfolio file'),
      ph('resume text'), // the paste-your-resume textarea, not the upload
    ],
    kinds: ['file'],
    autocomplete: [],
  },

  cover_letter_file: {
    phrases: [
      ph('cover letter'),
      ph('upload cover letter'),
      ph('attach cover letter'),
      ph('cover letter upload'),
      ph('letter of interest'),
      ph('motivation letter'),
    ],
    negatives: [
      ph('resume'), // -> resume_file
      ph('curriculum vitae'),
      ph('transcript'),
      ph('paste your cover letter'), // that is the textarea variant
      ph('cover letter text'),
    ],
    kinds: ['file'],
    autocomplete: [],
  },

  cover_letter_text: {
    phrases: [
      ph('cover letter'),
      ph('cover letter text'),
      ph('paste your cover letter'),
      ph('enter your cover letter'),
      ph('letter of interest'),
      ph('motivation letter'),
    ],
    negatives: [
      ph('upload cover letter'), // -> cover_letter_file
      ph('attach cover letter'),
      ph('resume'),
      // Essay prompts are NOT a cover letter. There is no answer bank in this
      // repo (types.ts:25-29), so these must stay unmapped and be finished by
      // hand rather than receive a stored cover letter.
      ph('why do you want to work'),
      ph('tell us about a time'),
      ph('additional information'),
    ],
    kinds: ['textarea', 'text'],
    autocomplete: [],
  },
}

function isMappable(key: ProfileKey): key is MappableProfileKey {
  return key !== 'unmapped'
}

/**
 * Signature list in PROFILE_KEYS order. The order is not cosmetic: score.ts
 * breaks exact score ties by it, so the resolver is deterministic across runs
 * and across machines.
 */
export const SIGNATURES: ReadonlyArray<KeySignature> = PROFILE_KEYS.filter(isMappable).map(
  (key) => ({ key, ...SPECS[key] }),
)

const BY_KEY: ReadonlyMap<ProfileKey, KeySignature> = new Map(SIGNATURES.map((s) => [s.key, s]))

/** Null for `unmapped` and for anything that is not a ProfileKey at runtime. */
export function signatureFor(key: ProfileKey): KeySignature | null {
  return BY_KEY.get(key) ?? null
}
