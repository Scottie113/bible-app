#!/usr/bin/env node
/**
 * Word-by-word meanings of the Hebrew/Greek in other languages, taken from
 * Bible translations whose words are tagged with Strong's numbers: for each
 * original word we show the word(s) that translation used for it in that verse.
 *
 *   node scripts/import-meanings.mjs <sword folder> <usfm folder>
 *
 * <sword folder> must contain the unzipped CrossWire modules (public domain):
 *   ChiUns/  和合本 Simplified with Strong's   (crosswire.org .../rawzip/ChiUns.zip)
 *   ChiUn/   和合本 Traditional with Strong's  (.../rawzip/ChiUn.zip)
 *   FreJND/  French J.N. Darby with Strong's  (.../rawzip/FreJND.zip)
 * <usfm folder> must contain spaRV1909/ (eBible.org spaRV1909_usfm.zip, public domain).
 *
 * Output: src/data/meanings/<lang>/<BB>.json  chapters[c][v] = string[] (one per
 * original word, '' if that translation has no word for it) + index.ts loaders.
 * Languages: zh-Hans, zh-Hant, fr, es (Spanish: STEPBible's own Spanish for the
 * New Testament, Reina-Valera 1909 tags for the Old Testament).
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { openZText } from './sword-reader.mjs';

const [swordDir, usfmDir] = process.argv.slice(2);
if (!swordDir || !usfmDir) {
  console.error('usage: node scripts/import-meanings.mjs <sword folder> <usfm folder>');
  process.exit(1);
}
const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const OSIS = (
  'Gen Exod Lev Num Deut Josh Judg Ruth 1Sam 2Sam 1Kgs 2Kgs 1Chr 2Chr Ezra Neh Esth Job Ps Prov Eccl Song Isa ' +
  'Jer Lam Ezek Dan Hos Joel Amos Obad Jonah Mic Nah Hab Zeph Hag Zech Mal Matt Mark Luke John Acts Rom 1Cor ' +
  '2Cor Gal Eph Phil Col 1Thess 2Thess 1Tim 2Tim Titus Phlm Heb Jas 1Pet 2Pet 1John 2John 3John Jude Rev'
).split(' ');
const USFM = (
  'GEN EXO LEV NUM DEU JOS JDG RUT 1SA 2SA 1KI 2KI 1CH 2CH EZR NEH EST JOB PSA PRO ECC SNG ISA JER LAM EZK DAN ' +
  'HOS JOL AMO OBA JON MIC NAM HAB ZEP HAG ZEC MAL MAT MRK LUK JHN ACT ROM 1CO 2CO GAL EPH PHP COL 1TH 2TH 1TI ' +
  '2TI TIT PHM HEB JAS 1PE 2PE 1JN 2JN 3JN JUD REV'
).split(' ');
const vid = (b, c, v) => b * 1_000_000 + c * 1_000 + v;

// ------------------------------------------------------------------ Strong's numbers
/** "G0025" / "H7225G" / "strong:H09002" -> "G25" / "H7225" / "H9002" */
const norm = (s) => {
  const m = String(s).match(/([GH])0*(\d+)/i);
  return m ? m[1].toUpperCase() + Number(m[2]) : '';
};
/** Real dictionary words (not grammar codes like G5656 / H8804, nor STEP's H9xxx prefix codes). */
const isWord = (k) => {
  const n = Number(k.slice(1));
  return k[0] === 'G' ? n >= 1 && n <= 5624 : n >= 1 && n <= 8674;
};

/**
 * A run of translated text and the original words it renders.
 * `start`/`end` = position in the verse's source text, so neighbours can be told apart
 * from repeats ("afin que" is one rendering; "道，道" are two).
 */
function segment(strongs, text, start, end) {
  const words = strongs.map(norm).filter((k) => k && isWord(k));
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!words.length || !clean) return null;
  return { owner: words[0], others: words.slice(1), text: clean, start, end };
}

/** Join segments that render the same word and touch (only spaces between): "afin" + "que". */
function mergeRuns(segs, body) {
  const out = [];
  for (const s of segs) {
    const last = out[out.length - 1];
    const touching = last && /^\s*$/.test(body.slice(last.end, s.start));
    if (touching && last.owner === s.owner && !s.others.length && !last.others.length) {
      last.text += ' ' + s.text;
      last.end = s.end;
    } else out.push({ ...s });
  }
  return out;
}

// ------------------------------------------------------------------ readers
/** SWORD OSIS module -> Map(verseId -> segments) using its own book/chapter markers. */
function readSword(dir) {
  const verses = new Map();
  const mod = openZText(dir);
  let book = 0;
  let chapter = 0;
  let verse = 0;
  for (const testament of ['ot', 'nt']) {
    for (const entry of mod.entries(testament)) {
      const bk = entry.match(/<div[^>]*type="book"[^>]*>/)?.[0].match(/osisID="([^"]+)"/);
      const ch = entry.match(/<chapter [^>]*osisID="([1-3]?[A-Za-z]+)\.(\d+)"/);
      if (ch) {
        book = OSIS.indexOf(ch[1]) + 1;
        chapter = Number(ch[2]);
        verse = 0;
        continue;
      }
      if (bk) {
        book = OSIS.indexOf(bk[1]) + 1;
        chapter = 0;
        continue;
      }
      if (!book || !chapter) continue;
      verse++;
      const body = entry.replace(/<note[\s\S]*?<\/note>/g, '');
      const segs = [];
      for (const m of body.matchAll(/<w\s([^>]*)>([\s\S]*?)<\/w>/g)) {
        const strongs = [...m[1].matchAll(/strong:([GH]\d+)/g)].map((x) => x[1]);
        const s = segment(strongs, m[2].replace(/<[^>]+>/g, ''), m.index, m.index + m[0].length);
        if (s) segs.push(s);
      }
      verses.set(vid(book, chapter, verse), mergeRuns(segs, body));
    }
  }
  return verses;
}

/** USFM folder (eBible.org) -> Map(verseId -> segments). */
function readUsfm(dir) {
  const verses = new Map();
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.usfm'))) {
    const text = readFileSync(join(dir, file), 'utf8');
    const code = text.match(/\\id\s+(\S+)/)?.[1];
    const book = USFM.indexOf(code) + 1;
    if (!book) continue;
    let chapter = 0;
    for (const part of text.split(/(?=\\c\s+\d+)/)) {
      const c = part.match(/^\\c\s+(\d+)/);
      if (c) chapter = Number(c[1]);
      if (!chapter) continue;
      for (const v of part.split(/(?=\\v\s+\d+)/)) {
        const vm = v.match(/^\\v\s+(\d+)/);
        if (!vm) continue;
        const body = v.replace(/\\x\s[\s\S]*?\\x\*/g, '').replace(/\\f\s[\s\S]*?\\f\*/g, '');
        const segs = [];
        for (const m of body.matchAll(/\\\+?w\s+([^|\\]*)\|strong="([^"]+)"\\\+?w\*/g)) {
          const s = segment(m[2].split(/[,\s]+/), m[1], m.index, m.index + m[0].length);
          if (s) segs.push(s);
        }
        verses.set(vid(book, chapter, Number(vm[1])), mergeRuns(segs, body));
      }
    }
  }
  return verses;
}

// ------------------------------------------------------------------ matching
/** Meanings for one verse's words from one source verse; returns [meanings, matched count]. */
function matchVerse(words, segs = []) {
  const used = new Set();
  let matched = 0;
  const meanings = words.map((w) => {
    const key = norm(w[3]);
    if (!key) return '';
    // Only the first word a translated phrase is tagged with gets the phrase: later tags on the same
    // phrase are usually small words it absorbed (e.g. 创造 "create" is also tagged with אֵת, the
    // object marker), and a blank is better than a wrong meaning.
    const i = segs.findIndex((s, j) => !used.has(j) && s.owner === key);
    if (i < 0) return '';
    used.add(i);
    matched++;
    return segs[i].text;
  });
  return [meanings, matched];
}

function buildLanguage(lang, source, { onlyOT = false, ntFromStep = false } = {}) {
  const outDir = join(root, 'src/data/meanings', lang);
  mkdirSync(outDir, { recursive: true });
  let words = 0;
  let filled = 0;
  for (let book = 1; book <= 66; book++) {
    const original = JSON.parse(readFileSync(join(root, 'src/data/original', `${String(book).padStart(2, '0')}.json`), 'utf8'));
    const result = original.map((verses, ci) => {
      const chapter = ci + 1;
      if (book >= 40 && ntFromStep) return verses.map((ws) => ws.map((w) => w[6] ?? ''));
      if (onlyOT && book >= 40) return verses.map((ws) => ws.map(() => ''));
      // Pick the verse offset (-2..+2) that matches best for this chapter,
      // e.g. Psalm titles counted as verses 1-2 in some translations.
      let best = { offset: 0, score: -1 };
      for (const offset of [0, 1, -1, 2, -2]) {
        let score = 0;
        verses.forEach((ws, vi) => (score += matchVerse(ws, source.get(vid(book, chapter, vi + 1 + offset)))[1]));
        if (score > best.score) best = { offset, score };
      }
      return verses.map((ws, vi) => matchVerse(ws, source.get(vid(book, chapter, vi + 1 + best.offset)))[0]);
    });
    result.forEach((c) => c.forEach((v) => v.forEach((m) => (words++, m && filled++))));
    writeFileSync(join(outDir, `${String(book).padStart(2, '0')}.json`), JSON.stringify(result));
  }
  console.log(`${lang}: ${filled} of ${words} words have a meaning (${Math.round((100 * filled) / words)}%)`);
}

const sword = (name, module) => join(swordDir, name, 'modules/texts/ztext', module);
buildLanguage('zh-Hans', readSword(sword('ChiUns', 'chiuns')));
buildLanguage('zh-Hant', readSword(sword('ChiUn', 'chiun')));
buildLanguage('fr', readSword(sword('FreJND', 'frejnd')));
buildLanguage('es', readUsfm(join(usfmDir, 'spaRV1909')), { ntFromStep: true });

const langs = ['zh-Hans', 'zh-Hant', 'fr', 'es'];
writeFileSync(
  join(root, 'src/data/meanings/index.ts'),
  '// Generated by scripts/import-meanings.mjs — do not edit.\n' +
    "export type MeaningBook = string[][][];\n\n" +
    'const loaders: Record<string, Record<number, () => Promise<MeaningBook>>> = {\n' +
    langs
      .map(
        (lang) =>
          `  '${lang}': {\n` +
          Array.from({ length: 66 }, (_, i) => {
            const n = String(i + 1).padStart(2, '0');
            return `    ${i + 1}: () => import('./${lang}/${n}.json').then((m) => m.default as MeaningBook),`;
          }).join('\n') +
          '\n  },',
      )
      .join('\n') +
    '\n};\n\nexport default loaders;\n',
);
