/**
 * The 66 books of the Protestant canon, in order.
 * `id` (1-66) is the "BB" part of every verse id (see verse-id.ts).
 * `chapters` is the standard (KJV) versification; the import script checks
 * each translation against it.
 */
export type Testament = 'OT' | 'NT';

export type Book = {
  id: number;
  /** Short code used in the source data files (eBible.org VPL codes). */
  code: string;
  name: string;
  /** Extra names people type, lower-case, used by the reference parser. */
  aliases: string[];
  chapters: number;
  testament: Testament;
};

type Row = [code: string, name: string, chapters: number, aliases: string[]];

const rows: Row[] = [
  ['GEN', 'Genesis', 50, ['gen', 'ge', 'gn']],
  ['EXO', 'Exodus', 40, ['exo', 'ex', 'exod']],
  ['LEV', 'Leviticus', 27, ['lev', 'le', 'lv']],
  ['NUM', 'Numbers', 36, ['num', 'nu', 'nm']],
  ['DEU', 'Deuteronomy', 34, ['deut', 'deu', 'dt']],
  ['JOS', 'Joshua', 24, ['josh', 'jos']],
  ['JDG', 'Judges', 21, ['judg', 'jdg', 'jg']],
  ['RUT', 'Ruth', 4, ['ruth', 'ru', 'rut']],
  ['1SA', '1 Samuel', 31, ['1sam', '1sa', '1 sam', 'i samuel', 'first samuel']],
  ['2SA', '2 Samuel', 24, ['2sam', '2sa', '2 sam', 'ii samuel', 'second samuel']],
  ['1KI', '1 Kings', 22, ['1kgs', '1ki', '1 kgs', 'i kings', 'first kings']],
  ['2KI', '2 Kings', 25, ['2kgs', '2ki', '2 kgs', 'ii kings', 'second kings']],
  ['1CH', '1 Chronicles', 29, ['1chr', '1ch', '1 chr', 'i chronicles', 'first chronicles']],
  ['2CH', '2 Chronicles', 36, ['2chr', '2ch', '2 chr', 'ii chronicles', 'second chronicles']],
  ['EZR', 'Ezra', 10, ['ezra', 'ezr']],
  ['NEH', 'Nehemiah', 13, ['neh', 'ne']],
  ['EST', 'Esther', 10, ['esth', 'est', 'es']],
  ['JOB', 'Job', 42, ['job', 'jb']],
  ['PSA', 'Psalms', 150, ['ps', 'psa', 'psalm', 'pss']],
  ['PRO', 'Proverbs', 31, ['prov', 'pro', 'pr', 'prv']],
  ['ECC', 'Ecclesiastes', 12, ['eccl', 'ecc', 'ec', 'qoh']],
  ['SOL', 'Song of Solomon', 8, ['song', 'sos', 'song of songs', 'canticles', 'sng']],
  ['ISA', 'Isaiah', 66, ['isa', 'is']],
  ['JER', 'Jeremiah', 52, ['jer', 'je']],
  ['LAM', 'Lamentations', 5, ['lam', 'la']],
  ['EZE', 'Ezekiel', 48, ['ezek', 'eze', 'ezk']],
  ['DAN', 'Daniel', 12, ['dan', 'da', 'dn']],
  ['HOS', 'Hosea', 14, ['hos', 'ho']],
  ['JOE', 'Joel', 3, ['joel', 'jl']],
  ['AMO', 'Amos', 9, ['amos', 'am']],
  ['OBA', 'Obadiah', 1, ['obad', 'ob', 'oba']],
  ['JON', 'Jonah', 4, ['jonah', 'jon', 'jnh']],
  ['MIC', 'Micah', 7, ['mic', 'mi']],
  ['NAH', 'Nahum', 3, ['nah', 'na']],
  ['HAB', 'Habakkuk', 3, ['hab', 'hb']],
  ['ZEP', 'Zephaniah', 3, ['zeph', 'zep', 'zp']],
  ['HAG', 'Haggai', 2, ['hag', 'hg']],
  ['ZEC', 'Zechariah', 14, ['zech', 'zec', 'zc']],
  ['MAL', 'Malachi', 4, ['mal', 'ml']],
  ['MAT', 'Matthew', 28, ['matt', 'mat', 'mt']],
  ['MAR', 'Mark', 16, ['mark', 'mar', 'mk', 'mrk']],
  ['LUK', 'Luke', 24, ['luke', 'luk', 'lk']],
  ['JOH', 'John', 21, ['john', 'joh', 'jn', 'jhn']],
  ['ACT', 'Acts', 28, ['acts', 'act', 'ac']],
  ['ROM', 'Romans', 16, ['rom', 'ro', 'rm']],
  ['1CO', '1 Corinthians', 16, ['1cor', '1co', '1 cor', 'i corinthians', 'first corinthians']],
  ['2CO', '2 Corinthians', 13, ['2cor', '2co', '2 cor', 'ii corinthians', 'second corinthians']],
  ['GAL', 'Galatians', 6, ['gal', 'ga']],
  ['EPH', 'Ephesians', 6, ['eph', 'ep']],
  ['PHI', 'Philippians', 4, ['phil', 'php', 'phi', 'pp']],
  ['COL', 'Colossians', 4, ['col', 'co']],
  ['1TH', '1 Thessalonians', 5, ['1thess', '1th', '1 thess', 'i thessalonians']],
  ['2TH', '2 Thessalonians', 3, ['2thess', '2th', '2 thess', 'ii thessalonians']],
  ['1TI', '1 Timothy', 6, ['1tim', '1ti', '1 tim', 'i timothy']],
  ['2TI', '2 Timothy', 4, ['2tim', '2ti', '2 tim', 'ii timothy']],
  ['TIT', 'Titus', 3, ['titus', 'tit']],
  ['PHM', 'Philemon', 1, ['philem', 'phm', 'phlm']],
  ['HEB', 'Hebrews', 13, ['heb']],
  ['JAM', 'James', 5, ['jas', 'jam', 'jm']],
  ['1PE', '1 Peter', 5, ['1pet', '1pe', '1 pet', 'i peter']],
  ['2PE', '2 Peter', 3, ['2pet', '2pe', '2 pet', 'ii peter']],
  ['1JO', '1 John', 5, ['1jn', '1jo', '1 jn', 'i john', 'first john']],
  ['2JO', '2 John', 1, ['2jn', '2jo', '2 jn', 'ii john']],
  ['3JO', '3 John', 1, ['3jn', '3jo', '3 jn', 'iii john']],
  ['JUD', 'Jude', 1, ['jude', 'jud', 'jd']],
  ['REV', 'Revelation', 22, ['rev', 're', 'rv', 'revelations', 'apocalypse']],
];

export const BOOKS: Book[] = rows.map(([code, name, chapters, aliases], i) => ({
  id: i + 1,
  code,
  name,
  aliases,
  chapters,
  testament: i < 39 ? 'OT' : 'NT',
}));

export function getBook(id: number): Book {
  const book = BOOKS[id - 1];
  if (!book) throw new Error(`Unknown book id ${id}`);
  return book;
}

const lookup = new Map<string, Book>();
for (const book of BOOKS) {
  lookup.set(book.name.toLowerCase(), book);
  lookup.set(book.code.toLowerCase(), book);
  for (const alias of book.aliases) lookup.set(alias, book);
}

/** Find a book by name, code or common abbreviation ("Jn", "1 Cor", "Psalm"). */
export function findBook(text: string): Book | undefined {
  const key = text.trim().toLowerCase().replace(/\.$/, '').replace(/\s+/g, ' ');
  return lookup.get(key) ?? lookup.get(key.replace(/ /g, ''));
}
