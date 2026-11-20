import cuvs from '@/data/bibles/cuvs';
import cuvt from '@/data/bibles/cuvt';
import kjv from '@/data/bibles/kjv';
import lsg from '@/data/bibles/lsg';
import rv1909 from '@/data/bibles/rv1909';
import web from '@/data/bibles/web';

import type { Translation } from './types';

/**
 * Every modern translation the app can show. To add one, run
 * scripts/import-vpl.mjs and add an entry here. Only add texts that are
 * public domain or openly licensed (see README).
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
  {
    id: 'cuvs',
    abbreviation: '和合本 简',
    name: '和合本 (简体) Chinese Union Version, Simplified',
    language: 'zh-Hans',
    license: 'Public domain',
    source: 'eBible.org cmn-cu89s',
    load: cuvs,
  },
  {
    id: 'cuvt',
    abbreviation: '和合本 繁',
    name: '和合本 (繁體) Chinese Union Version, Traditional',
    language: 'zh-Hant',
    license: 'Public domain',
    source: 'eBible.org cmn-cu89t',
    load: cuvt,
  },
  {
    id: 'lsg',
    abbreviation: 'LSG',
    name: 'Louis Segond 1910 (Français)',
    language: 'fr',
    license: 'Public domain',
    source: 'eBible.org fraLSG',
    load: lsg,
  },
  {
    id: 'rv1909',
    abbreviation: 'RV1909',
    name: 'Reina-Valera 1909 (Español)',
    language: 'es',
    license: 'Public domain',
    source: 'eBible.org spaRV1909',
    load: rv1909,
  },
];

export const DEFAULT_TRANSLATION = 'kjv';

export function getTranslation(id: string | undefined): Translation {
  return TRANSLATIONS.find((t) => t.id === id) ?? TRANSLATIONS[0];
}
