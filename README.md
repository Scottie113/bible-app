# Bible Study

A cross-platform Bible study app (web, iPhone/iPad, Android) built with Expo + React Native.

**Step 1 (this commit):** Bible reader, book/chapter picker, "go to" box (`John 3:16`, `Ps 23`, `1 Cor 13:4-7`), and a parallel Compare view. Includes the KJV and WEB.

## Run it

```bash
npm install
npx expo start --web      # browser
npx expo start            # scan the QR code with Expo Go on a phone
```

Before committing: `npm run typecheck` and `npx eslint .`

## How it's organized

```
src/app/            screens (Expo Router): index.tsx = Read, compare.tsx = Compare
src/bible/          the Bible "engine" — no UI
  books.ts            66 books, names, abbreviations, chapter counts
  verse-id.ts         verse numbers (BBCCCVVV) + reference parser
  translations.ts     list of available translations
  source.ts           the only code that reads Bible text (getChapter, useChapter)
  reading-location.tsx current book/chapter/translation, shared by tabs
src/components/     shared UI (chapter header, book picker, translation chips)
src/data/bibles/    generated text: <translation>/<book>.json, loaded one book at a time
scripts/import-vpl.mjs  converts eBible.org files into src/data/bibles
```

### Verse numbers

Every verse has one id: `book * 1_000_000 + chapter * 1_000 + verse`, so John 3:16 is `43003016`.
Highlights, note links, interlinear words, and AI citations will all use this id, which is how
everything connects across translations and devices.

## Adding a translation

1. Download the "verse per line" zip for a public-domain translation from
   `https://ebible.org/Scriptures/<id>_vpl.zip` (e.g. `fraLSG`, `spaRV1909`, `cmn-cu89s`, `cmn-cu89t`)
   and check its `_about.htm` for the license.
2. `npm run import-bible -- <short-id> path/to/<id>_vpl.txt`
3. Add an entry to `src/bible/translations.ts`.

The script keeps the 66 Protestant-canon books and checks chapter counts.
Some translations number verses differently (e.g. WEB puts the Romans doxology at 14:24-26 and leaves
out a few verses); the app shows those differences rather than hiding them.

## Bible text licenses

| Translation | License | Source |
|---|---|---|
| King James Version (1769) | Public domain (Crown patent applies only in the UK) | eBible.org `eng-kjv2006` |
| World English Bible | Public domain ("World English Bible" is a trademark; don't change the text and keep the name) | eBible.org `eng-web` |

Only add texts that are public domain or openly licensed. NIV, ESV, NKJV, NASB, Reina-Valera 1960, and the revised Chinese Union Version are copyrighted.

## Roadmap

1. ✅ Reader + parallel view (KJV, WEB)
2. Accounts and sync (Supabase + PowerSync): highlights, notes with verse links, reading place
3. More translations (Chinese Union Simplified/Traditional, Louis Segond, Reina-Valera 1909) and Hebrew/Greek interlinear (STEPBible data)
4. AI study assistant with tradition lenses (server-side; provider configurable — OpenAI or Claude)
5. AI over your notes, polish, app store release

## Notes for later

- Bible text currently ships inside the app (about 4 MB per translation). On the web each book is a
  separate download. Before adding many translations, move to downloadable SQLite files; only
  `src/bible/source.ts` needs to change.
- KJV italic markers (`[was]`) and paragraph marks (`¶`) are stripped for now.
