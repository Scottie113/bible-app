import kjv from '@/data/bibles/kjv';
import web from '@/data/bibles/web';

import type { Translation } from './types';

/**
 * Every translation the app can show. To add one, run scripts/import-vpl.mjs
 * and add an entry here. Only add texts that are public domain or openly
 * licensed (see README).
 */
export const TRANSLATIONS: Translation[] = [
  {
    id: 'kjv',
    abbreviation: 'KJV',
    name: 'King James Version (1769)',
    language: 'en',
    license: 'Public domain (outside the UK)',
    source: 'eBible.org eng-kjv2006',
    load: kjv,
  },
  {
    id: 'web',
    abbreviation: 'WEB',
    name: 'World English Bible',
    language: 'en',
    license: 'Public domain',
    source: 'eBible.org eng-web',
    load: web,
  },
];

export const DEFAULT_TRANSLATION = 'kjv';

export function getTranslation(id: string | undefined): Translation {
  return TRANSLATIONS.find((t) => t.id === id) ?? TRANSLATIONS[0];
}
