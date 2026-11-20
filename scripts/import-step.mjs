#!/usr/bin/env node
/**
 * Import the original-language Bible (Hebrew OT + Greek NT) and the brief
 * lexicons from STEPBible.org (CC BY 4.0) into the app's data files.
 *
 *   node scripts/import-step.mjs <folder with the STEPBible .txt files>
 *
 * The folder must contain (from github.com/STEPBible/STEPBible-Data):
 *   TAHOT Gen-Deu / Jos-Est / Job-Sng / Isa-Mal  ...txt   (Hebrew OT, word by word)
 *   TAGNT Mat-Jhn / Act-Rev ...txt                         (Greek NT, word by word)
 *   TBESH ...txt, TBESG ...txt                             (brief Hebrew / Greek lexicons)
 *
 * Output:
 *   src/data/original/<BB>.json   chapters[c][v] = Word[]  (see src/bible/original.ts)
 *   src/data/original/index.ts    lazy loader per book
 *   src/data/lexicon/<chunk>.json  entries keyed by Strong's id, with usage counts
 *   src/data/lexicon/index.ts     lazy loader per chunk
 *
 * Verses use English (KJV) numbering, so they line up with the translations.
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const src = process.argv[2];
if (!src) {
  console.error('usage: node scripts/import-step.mjs <folder with STEPBible txt files>');
  process.exit(1);
}
const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// STEPBible book codes, in canonical order (index + 1 = book id in src/bible/books.ts).
const STEP_BOOKS = (
  'Gen Exo Lev Num Deu Jos Jdg Rut 1Sa 2Sa 1Ki 2Ki 1Ch 2Ch Ezr Neh Est Job Psa Pro Ecc Sng Isa Jer Lam ' +
  'Ezk Dan Hos Jol Amo Oba Jon Mic Nam Hab Zep Hag Zec Mal Mat Mrk Luk Jhn Act Rom 1Co 2Co Gal Eph Php ' +
  'Col 1Th 2Th 1Ti 2Ti Tit Phm Heb Jas 1Pe 2Pe 1Jn 2Jn 3Jn Jud Rev'
).split(' ');
const bookId = new Map(STEP_BOOKS.map((code, i) => [code, i + 1]));

const files = readdirSync(src);
const pick = (prefix) => files.filter((f) => f.startsWith(prefix)).map((f) => join(src, f));
const hebrewFiles = pick('TAHOT');
const greekFiles = pick('TAGNT');
const [hebrewLex] = pick('TBESH');
const [greekLex] = pick('TBESG');
if (hebrewFiles.length !== 4 || greekFiles.length !== 2 || !hebrewLex || !greekLex) {
  throw new Error(`expected 4 TAHOT, 2 TAGNT, 1 TBESH, 1 TBESG files in ${src}; found ${files.join(', ')}`);
}

// ---------------------------------------------------------------- lexicon
/** Map of lexicon key (e.g. "G0025", "H1254A") -> entry. */
const lexicon = new Map();

function cleanDefinition(html) {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/__/g, '')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

for (const file of [hebrewLex, greekLex]) {
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (!/^[GH]\d/.test(line)) continue;
    const cols = line.split('\t');
    const key = cols[1].split('=')[0].trim();
    if (!key || lexicon.has(key)) continue;
    lexicon.set(key, {
      lemma: cols[3]?.trim() ?? '',
      translit: cols[4]?.trim() ?? '',
      pos: (cols[5] ?? '').replace(/^[GH]:/, '').trim(),
      gloss: cols[6]?.trim() ?? '',
      def: cleanDefinition(cols[7] ?? ''),
    });
  }
}

/** Lexicon keys sorted, so a bare "G0025" can find "G0025" or "G0025G". */
const lexKeysByBase = new Map();
for (const key of lexicon.keys()) {
  const base = key.slice(0, 5);
  if (!lexKeysByBase.has(base)) lexKeysByBase.set(base, key);
}
function resolveStrong(id) {
  if (!id) return '';
  const clean = id.replace(/_.*$/, '');
  if (lexicon.has(clean)) return clean;
  const upper = clean.toUpperCase();
  if (lexicon.has(upper)) return upper;
  return lexKeysByBase.get(clean.slice(0, 5)) ?? clean;
}

// ---------------------------------------------------------------- word text
/**
 * One word = [text, transliteration, gloss, strong, morphology, flags, spanish?]
 * flags: 1 = Greek word found only in some manuscripts (not in Nestle-Aland).
 */
const books = new Map(); // bookId -> chapters[c][v] = words
const usage = new Map(); // strong -> { count, glosses: Map<gloss, n>, refs: number[] }
const REF = /^([1-3]?[A-Z][a-z]{1,2})\.(\d+)\.(\d+)(?:\([^)]*\))?#(\d+)=(\S+)$/;
let skipped = 0;

/** Keep case ("God" vs "gods" matters); drop brackets, punctuation and sentence-initial capitals. */
function normalizeGloss(gloss) {
  const g = gloss
    .replace(/[<>[\]{}]/g, '')
    .replace(/\s*\/\s*/g, ' ')
    .replace(/[.,;:!?"“”‘’()]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  // Lower-case a leading capital unless the word is a name/title that is capitalised everywhere.
  return /^(God|LORD|Lord|Jesus|Christ|Spirit|Israel)\b/.test(g) ? g : g.charAt(0).toLowerCase() + g.slice(1);
}

/**
 * @param usageGloss the part of the gloss that translates the main word itself
 *   (Hebrew glosses also cover attached "and"/"the"/"your" etc.)
 */
function addWord(code, chapter, verse, word, usageGloss = word[2]) {
  const id = bookId.get(code);
  if (!id) {
    skipped++;
    return;
  }
  const chapters = books.get(id) ?? [];
  books.set(id, chapters);
  const verses = (chapters[chapter - 1] ??= []);
  (verses[verse - 1] ??= []).push(word);

  const strong = word[3];
  if (!strong) return;
  const u = usage.get(strong) ?? { count: 0, glosses: new Map(), refs: [] };
  usage.set(strong, u);
  u.count++;
  const g = normalizeGloss(usageGloss);
  if (g) u.glosses.set(g, (u.glosses.get(g) ?? 0) + 1);
  const verseId = id * 1_000_000 + chapter * 1_000 + verse;
  if (u.refs[u.refs.length - 1] !== verseId) u.refs.push(verseId);
}

/** At most `max` verse ids, spread evenly across the whole list (so common words show examples from every book). */
function sampleRefs(refs, max = 300) {
  if (refs.length <= max) return refs;
  return Array.from({ length: max }, (_, i) => refs[Math.floor((i * refs.length) / max)]);
}

for (const file of greekFiles) {
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const cols = line.split('\t');
    const m = cols[0].match(REF);
    if (!m) continue;
    const [, code, ch, vs, , type] = m;
    const [, text = cols[1], translit = ''] = cols[1].match(/^(.*?)\s*\(([^)]*)\)\s*$/) ?? [];
    const [strong, morph = ''] = cols[3].split('=');
    const flags = /n/i.test(type) ? 0 : 1;
    const word = [text.replace(/¶/g, "").trim(), translit.trim(), cols[2].replace(/¶/g, "").trim(), resolveStrong(strong.trim()), morph.trim(), flags];
    const spanish = cols[8]?.trim();
    if (spanish) word.push(spanish);
    addWord(code, Number(ch), Number(vs), word);
  }
}

for (const file of hebrewFiles) {
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const cols = line.split('\t');
    const m = cols[0].match(REF);
    if (!m) continue;
    const [, code, ch, vs] = m;
    // The main word's Strong's number is the one in {braces}; prefixes like "and"/"the" are not.
    const main = cols[4].match(/\{([^}]+)\}/)?.[1] ?? cols[8] ?? cols[4].split('/').pop();
    // Gloss parts line up with the "/"-separated parts of the Strong's numbers: "and/ the/ earth".
    const strongParts = cols[4].split('/');
    const glossParts = cols[3].split('/');
    const mainIndex = strongParts.findIndex((s) => s.includes('{'));
    const usageGloss =
      mainIndex >= 0 && glossParts.length === strongParts.length ? glossParts[mainIndex] : cols[3];
    const word = [
      cols[1].replace(/\\/g, '').trim(),
      cols[2].trim(),
      cols[3].trim(),
      resolveStrong(main.trim()),
      cols[5].trim(),
      0,
    ];
    addWord(code, Number(ch), Number(vs), word, usageGloss);
  }
}

// ---------------------------------------------------------------- write books
const outBooks = join(root, 'src/data/original');
// Overwrite in place (deleting the folder confuses a running Metro dev server).
mkdirSync(outBooks, { recursive: true });
let wordCount = 0;
for (let id = 1; id <= 66; id++) {
  const chapters = books.get(id);
  if (!chapters) throw new Error(`no original-language text for book ${STEP_BOOKS[id - 1]}`);
  const filled = Array.from({ length: chapters.length }, (_, c) =>
    Array.from({ length: chapters[c]?.length ?? 0 }, (_, v) => chapters[c][v] ?? []),
  );
  filled.forEach((c) => c.forEach((v) => (wordCount += v.length)));
  writeFileSync(join(outBooks, `${String(id).padStart(2, '0')}.json`), JSON.stringify(filled));
}
writeFileSync(
  join(outBooks, 'index.ts'),
  '// Generated by scripts/import-step.mjs — do not edit.\n' +
    "import type { OriginalBook } from '@/bible/original';\n\n" +
    'const loaders: Record<number, () => Promise<OriginalBook>> = {\n' +
    Array.from({ length: 66 }, (_, i) => {
      const n = String(i + 1).padStart(2, '0');
      return `  ${i + 1}: () => import('./${n}.json').then((m) => m.default as unknown as OriginalBook),`;
    }).join('\n') +
    '\n};\n\nexport default loaders;\n',
);

// ---------------------------------------------------------------- write lexicon
/** Chunk key: language letter + hundreds block, e.g. G0025 -> "G0", H1254A -> "H2". */
const chunkOf = (key) => key[0] + Math.floor(Number(key.slice(1, 5)) / 500);
const chunks = new Map();
for (const [key, entry] of lexicon) {
  const u = usage.get(key);
  const out = { ...entry };
  if (u) {
    out.count = u.count;
    out.renderings = [...u.glosses.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
    // Source files are read in file-name order (Isa before Jos), so put refs back in Bible order.
    out.refs = sampleRefs([...new Set(u.refs)].sort((a, b) => a - b));
    out.verses = new Set(u.refs).size;
  }
  const chunk = chunkOf(key);
  if (!chunks.has(chunk)) chunks.set(chunk, {});
  chunks.get(chunk)[key] = out;
}
const outLex = join(root, 'src/data/lexicon');
// Overwrite in place.
mkdirSync(outLex, { recursive: true });
for (const [chunk, entries] of chunks) writeFileSync(join(outLex, `${chunk}.json`), JSON.stringify(entries));
writeFileSync(
  join(outLex, 'index.ts'),
  '// Generated by scripts/import-step.mjs — do not edit.\n' +
    "import type { LexiconChunk } from '@/bible/original';\n\n" +
    'const loaders: Record<string, () => Promise<LexiconChunk>> = {\n' +
    [...chunks.keys()]
      .sort()
      .map((c) => `  ${c}: () => import('./${c}.json').then((m) => m.default as unknown as LexiconChunk),`)
      .join('\n') +
    '\n};\n\nexport default loaders;\n',
);

const unresolved = [...usage.keys()].filter((k) => !lexicon.has(k));
console.log(`${wordCount} words in 66 books; ${lexicon.size} lexicon entries in ${chunks.size} chunks`);
console.log(`${skipped} words skipped (unknown book); ${unresolved.length} Strong's ids without a lexicon entry`);
if (unresolved.length) console.log('e.g.', unresolved.slice(0, 10).join(' '));
