import { getChapter } from './source';
import { getTranslation } from './translations';
import { formatRef, parseRef } from './verse-id';

export type VerseLookup = { label: string; text: string; translation: string } | { error: string };

const MAX_VERSES = 40;

/**
 * Text for a typed reference, for quoting in a document:
 *   "John 3:16"    -> { label: "John 3:16", text: "For God so loved…", translation: "KJV" }
 *   "Ps 23"        -> the whole chapter (verse numbers included)
 *   "Rom 8:28-30"  -> the range
 */
export async function lookupVerses(reference: string, translationId: string): Promise<VerseLookup> {
  const ref = parseRef(reference);
  if (!ref) return { error: 'Couldn’t find that reference. Try “John 3:16” or “Ps 23:1-3”.' };
  const verses = await getChapter(translationId, ref.book, ref.chapter);
  const from = ref.verse || 1;
  const to = Math.min(ref.verse ? (ref.endVerse ?? ref.verse) : verses.length, from + MAX_VERSES - 1);
  const picked = verses.filter((v) => v.verse >= from && v.verse <= to && v.text);
  if (!picked.length) return { error: 'That verse isn’t in this translation.' };
  const text = picked.map((v) => (picked.length > 1 ? `${v.verse} ${v.text}` : v.text)).join(' ');
  return {
    label: formatRef({ book: ref.book, chapter: ref.chapter, verse: from }, to > from ? to : undefined),
    text,
    translation: getTranslation(translationId).abbreviation,
  };
}
