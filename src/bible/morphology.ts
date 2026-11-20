/**
 * Turn grammar codes into plain English.
 *   Greek (Robinson codes):  "V-AAI-3S" -> "Verb · aorist active indicative · 3rd person singular"
 *   Hebrew (STEPBible/OSHB): "HVqp3ms"  -> "Verb · Qal perfect · 3rd person masculine singular"
 * Unknown codes are returned as they are.
 */

const GREEK_POS: Record<string, string> = {
  V: 'Verb',
  N: 'Noun',
  A: 'Adjective',
  T: 'Article',
  P: 'Personal pronoun',
  R: 'Relative pronoun',
  C: 'Reciprocal pronoun',
  D: 'Demonstrative pronoun',
  K: 'Correlative pronoun',
  I: 'Interrogative pronoun',
  X: 'Indefinite pronoun',
  Q: 'Correlative/interrogative pronoun',
  F: 'Reflexive pronoun',
  S: 'Possessive pronoun',
  ADV: 'Adverb',
  CONJ: 'Conjunction',
  COND: 'Conditional',
  PRT: 'Particle',
  PREP: 'Preposition',
  INJ: 'Interjection',
  ARAM: 'Aramaic word',
  HEB: 'Hebrew word',
};
const GREEK_TENSE: Record<string, string> = {
  P: 'present',
  I: 'imperfect',
  F: 'future',
  A: 'aorist',
  R: 'perfect',
  L: 'pluperfect',
  '2F': 'second future',
  '2A': 'second aorist',
  '2R': 'second perfect',
  '2L': 'second pluperfect',
};
const GREEK_VOICE: Record<string, string> = {
  A: 'active',
  M: 'middle',
  P: 'passive',
  E: 'middle or passive',
  D: 'middle deponent',
  O: 'passive deponent',
  N: 'middle or passive deponent',
  Q: 'impersonal active',
  X: 'no voice',
};
const GREEK_MOOD: Record<string, string> = {
  I: 'indicative',
  S: 'subjunctive',
  O: 'optative',
  M: 'imperative',
  N: 'infinitive',
  P: 'participle',
  R: 'imperative participle',
};
const CASE: Record<string, string> = { N: 'nominative', G: 'genitive', D: 'dative', A: 'accusative', V: 'vocative' };
const NUMBER: Record<string, string> = { S: 'singular', P: 'plural', s: 'singular', p: 'plural', d: 'dual' };
const GENDER: Record<string, string> = {
  M: 'masculine',
  F: 'feminine',
  N: 'neuter',
  m: 'masculine',
  f: 'feminine',
  c: 'common',
  b: 'both genders',
};
const PERSON: Record<string, string> = { '1': '1st person', '2': '2nd person', '3': '3rd person' };

function caseNumberGender(code: string) {
  // e.g. "NSM", "1NS" (person + case + number), "ASF"
  const m = code.match(/^([123])?([NGDAV])([SP])([MFN])?/);
  if (!m) return code;
  return [m[1] && PERSON[m[1]], CASE[m[2]], NUMBER[m[3]], m[4] && GENDER[m[4]]].filter(Boolean).join(' ');
}

function describeGreek(code: string): string {
  const [pos, ...rest] = code.split('-');
  const name = GREEK_POS[pos];
  if (!name) return code;
  if (pos !== 'V') {
    const details = rest.filter((r) => /^[123]?[NGDAV][SP]/.test(r)).map(caseNumberGender);
    return [name, ...details].join(' · ');
  }
  const tvm = rest[0]?.match(/^(2?[PIFARL])([AMPEDONQX])([ISOMNPR])$/);
  if (!tvm) return [name, ...rest].join(' · ');
  const parts = [name, `${GREEK_TENSE[tvm[1]]} ${GREEK_VOICE[tvm[2]]} ${GREEK_MOOD[tvm[3]]}`];
  const tail = rest[1];
  if (tail) {
    const pn = tail.match(/^([123])([SP])$/);
    parts.push(pn ? `${PERSON[pn[1]]} ${NUMBER[pn[2]]}` : caseNumberGender(tail));
  }
  return parts.join(' · ');
}

const HEB_STEM: Record<string, string> = {
  q: 'Qal',
  N: 'Niphal',
  p: 'Piel',
  P: 'Pual',
  h: 'Hiphil',
  H: 'Hophal',
  t: 'Hithpael',
  o: 'Polel',
  O: 'Polal',
  r: 'Hithpolel',
  m: 'Poel',
  M: 'Poal',
  k: 'Palel',
  K: 'Pulal',
  Q: 'Qal passive',
  l: 'Pilpel',
  L: 'Polpal',
  f: 'Hithpalpel',
  D: 'Nithpael',
  j: 'Pealal',
  i: 'Pilel',
  u: 'Hothpaal',
  c: 'Tiphil',
  v: 'Hishtaphel',
  w: 'Nithpalel',
  y: 'Nithpoel',
  z: 'Hithpoel',
};
const HEB_ASPECT: Record<string, string> = {
  p: 'perfect',
  q: 'sequential perfect',
  i: 'imperfect',
  w: 'sequential imperfect',
  h: 'cohortative',
  j: 'jussive',
  v: 'imperative',
  r: 'active participle',
  s: 'passive participle',
  a: 'infinitive absolute',
  c: 'infinitive construct',
};
const HEB_STATE: Record<string, string> = { a: 'absolute', c: 'construct', d: 'determined' };
const HEB_POS: Record<string, string> = {
  A: 'Adjective',
  C: 'Conjunction',
  D: 'Adverb',
  N: 'Noun',
  P: 'Pronoun',
  R: 'Preposition',
  S: 'Suffix',
  T: 'Particle',
  V: 'Verb',
};
const HEB_NOUN: Record<string, string> = { c: 'common', g: 'gentilic', p: 'proper name' };
const HEB_PARTICLE: Record<string, string> = {
  a: 'affirmation',
  d: 'definite article',
  e: 'exhortation',
  i: 'interrogative',
  j: 'interjection',
  m: 'demonstrative',
  n: 'negative',
  o: 'object marker',
  r: 'relative',
};
const HEB_PRONOUN: Record<string, string> = {
  d: 'demonstrative',
  f: 'indefinite',
  i: 'interrogative',
  p: 'personal',
  r: 'relative',
};

function pgn(s: string) {
  // person? gender number state?
  const m = s.match(/^([123])?([mfcb])?([spd])?([acd])?/);
  if (!m) return '';
  return [m[1] && PERSON[m[1]], m[2] && GENDER[m[2]], m[3] && NUMBER[m[3]], m[4] && HEB_STATE[m[4]]]
    .filter(Boolean)
    .join(' ');
}

function describeHebrewPart(part: string): string {
  const pos = HEB_POS[part[0]];
  if (!pos) return part;
  const rest = part.slice(1);
  switch (part[0]) {
    case 'V': {
      const stem = HEB_STEM[rest[0]];
      const aspect = HEB_ASPECT[rest[1]];
      return [pos, [stem, aspect].filter(Boolean).join(' '), pgn(rest.slice(2))].filter(Boolean).join(' · ');
    }
    case 'N':
      return [HEB_NOUN[rest[0]] === 'proper name' ? 'Proper name' : pos, pgn(rest.slice(1))].filter(Boolean).join(' · ');
    case 'A':
      return [pos, pgn(rest.slice(1))].filter(Boolean).join(' · ');
    case 'T':
      return HEB_PARTICLE[rest[0]] ? capitalize(HEB_PARTICLE[rest[0]]) : pos;
    case 'P':
      return [`${capitalize(HEB_PRONOUN[rest[0]] ?? '')} pronoun`.trim(), pgn(rest.slice(1))].filter(Boolean).join(' · ');
    case 'S':
      return ['Suffix', pgn(rest.replace(/^[dhnp]/, ''))].filter(Boolean).join(' · ');
    default:
      return pos;
  }
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function describeHebrew(code: string): string {
  // "HR/Ncfsa": first letter is the language (H Hebrew, A Aramaic); "/" separates prefix + word + suffix.
  const language = code[0] === 'A' ? 'Aramaic' : 'Hebrew';
  const parts = code.slice(1).split('/').map(describeHebrewPart);
  return (language === 'Aramaic' ? ['(Aramaic)'] : []).concat(parts).join(' + ');
}

export function describeMorphology(code: string, language: 'hebrew' | 'greek'): string {
  if (!code) return '';
  return language === 'hebrew' ? describeHebrew(code) : describeGreek(code);
}
