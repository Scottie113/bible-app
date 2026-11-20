# Bible Study

A cross-platform Bible study app (web, iPhone/iPad, Android) built with Expo + React Native.

**What works now**

- **Read tab:** book/chapter picker, "go to" box (`John 3:16`, `Ps 23`, `1 Cor 13:4-7`), six translations:
  KJV, WEB, 和合本 (Simplified and Traditional), Louis Segond 1910, Reina-Valera 1909.
- **Original tab:** each verse in the language it was written in — Hebrew for the Old Testament,
  Greek for the New — word by word with pronunciation and meaning, and any of the modern
  translations underneath. Tap a word to see:
  - what it means in this verse and its grammar in plain English
  - the dictionary entry
  - how it is usually translated, with counts (e.g. אֱלֹהִים: "God" ×1777, "gods" ×145)
  - other verses where it appears (tap to go there)

  Greek words found only in the Textus Receptus (the text behind the KJV) are shown dashed, which
  explains many KJV differences (e.g. "his only begotten Son" in John 3:16).
- **Accounts (email + password), notes and highlights, synced across devices:**
  - **Notes tab:** write notes; any reference you type (`John 3:16`, `Rom 8:28-30`, `Ps 23`) becomes a
    link. Read view shows links; tapping one opens the Bible at that verse. Search your notes.
  - **In the Read tab:** tap a verse to highlight it (5 colors) or **Add to note** (adds the reference
    and the verse text). Verses your notes mention show 📝 — tap it to open the note.
  - Your reading place (book, chapter, translations) follows you between devices.
- **Documents tab (word processor):** sermons, study guides and longer writing.
  - Fonts (incl. Chinese fonts), sizes, bold/italic/underline/strikethrough, text color, highlight colors,
    headings, alignment, bulleted/numbered lists, quotes, divider lines, web links, undo/redo, word count.
  - **+ Verse:** type a reference (`John 3:16-18`, `Ps 23`) to insert the verse text as a quote, in the
    translation you're reading.
  - **+ Note:** place one of your notes in the page as a card. It always shows the note's latest text, and
    its verse references are clickable.
  - References you type anywhere in the document are underlined; click one, then **Open** to go to it.
  - Templates: blank, sermon outline, topic study guide. Verses a document mentions get a marker in the
    Read tab, like notes.
  - Same editor on web and in the phone/tablet apps (an Expo "DOM component", `'use dom'`, built on Tiptap).
  - Works offline: changes are saved on the device and sent when back online; the newest edit wins.

## Run it

```bash
npm install
npm run db:start          # local backend in Docker (first run downloads images; needs Docker Desktop)
cp .env.example .env.local   # then fill in from `npx supabase status` (API URL + Publishable key)
npx expo start --web      # browser
npx expo start            # scan the QR code with Expo Go on a phone
```

The app runs without the backend too; only accounts/notes are turned off.
Local backend extras: Studio (database browser) at http://127.0.0.1:54323, test emails at http://127.0.0.1:54324.
`npm run db:reset` wipes local data and re-applies `supabase/migrations`.

Before committing: `npm run typecheck` and `npx eslint .`

### Moving the backend to the cloud (needed for real phones / other people)

The local backend only works on this computer. To sync between your real devices:

1. Create a free project at supabase.com (you do this; it needs your account).
2. `npx supabase login`, then `npx supabase link --project-ref <your-project-ref>` and `npx supabase db push`
   (applies `supabase/migrations`).
3. In the dashboard: Authentication > URL Configuration — set the site URL to where the web app is hosted.
   Email confirmation is on by default in the cloud (sign-up shows "check your email").
4. Put the project's URL and publishable key in `.env.local` (or EAS environment variables for app builds).

## Website (GitHub Pages)

Every push to `main` builds the web version and publishes it at **https://scottie113.github.io/bible-app/**
(`.github/workflows/deploy-web.yml`; progress in the repository's Actions tab). The build runs the
typecheck and lint first.

Until a cloud Supabase project exists, the published site has reading and the Hebrew/Greek view, and the
Notes/Documents tabs say sign-in is coming soon. To turn accounts on for the website, add repository variables
`EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_KEY` (Settings > Secrets and variables > Actions >
Variables) and re-run the workflow.

## How sync works

- Tables: `notes`, `highlights`, `reading_state`, `documents` (see `supabase/migrations`; documents store
  the editor's JSON plus a plain-text copy for search). Row-level security: each
  person can only read and write their own rows.
- Each device keeps a full copy of the person's notes/highlights (`src/sync/user-store.ts`), saved locally,
  so everything opens instantly and works offline.
- Changes go into an "outbox" and are upserted to the server; other devices get them live (Supabase Realtime)
  and on every reconnect (rows changed since the last pull, by server time `synced_at`).
- Conflicts: the edit with the newer `updated_at` wins; the server ignores an older edit that arrives late.
- Deletes are "soft" (`deleted_at`) so other devices learn about them.

## How it's organized

```
src/app/            screens (Expo Router): index.tsx = Read, compare.tsx = Original, notes/ = Notes
src/components/editor/  the document editor: rich-editor.tsx ('use dom'), verse-links.ts, note-card.tsx, templates.ts
src/sync/           accounts + sync: supabase.ts (client), account.tsx (sign-in state), user-store.ts (offline store + sync)
supabase/           backend config and database migrations
src/bible/          the Bible "engine" — no UI
  books.ts            66 books, names, abbreviations, chapter counts
  verse-id.ts         verse numbers (BBCCCVVV) + reference parser
  translations.ts     list of available modern translations
  source.ts           reads modern translation text (getChapter, useChapter)
  original.ts         reads Hebrew/Greek words and lexicon entries
  morphology.ts       grammar codes -> plain English ("V-AAI-3S" -> "Verb · aorist active indicative · 3rd person singular")
  find-refs.ts        finds Bible references inside free text (notes)
  reading-location.tsx current book/chapter/translations + "show this verse", shared by tabs, synced
src/components/     shared UI (chapter header, book picker, interlinear verse, word panel)
src/data/bibles/    generated: <translation>/<book>.json
src/data/original/  generated: Hebrew/Greek words per book
src/data/lexicon/   generated: dictionary entries + usage counts, in chunks
scripts/import-vpl.mjs   eBible.org translation -> src/data/bibles
scripts/import-step.mjs  STEPBible Hebrew/Greek + lexicons -> src/data/original, src/data/lexicon
```

All data files load one book (or lexicon chunk) at a time, only when needed.

### Verse numbers

Every verse has one id: `book * 1_000_000 + chapter * 1_000 + verse`, so John 3:16 is `43003016`.
Translations, Hebrew/Greek words, highlights, note links and AI citations all use this id.
The Hebrew/Greek data uses English verse numbering (Hebrew numbering differs in places, e.g. Gen 31:55 = Heb 32:1),
so it lines up with the translations.

## Adding a translation

1. Download the "verse per line" zip for a public-domain translation from
   `https://ebible.org/Scriptures/<id>_vpl.zip` and check its `_about.htm` for the license.
2. `npm run import-bible -- <short-id> path/to/<id>_vpl.txt`
3. Add an entry to `src/bible/translations.ts`.

The script keeps the 66 Protestant-canon books and checks chapter counts.
Some translations number or include verses differently (WEB puts the Romans doxology at 14:24-26;
some verses are absent from some texts); the app shows "—" rather than hiding the difference.

## Updating the Hebrew/Greek data

Download these from <https://github.com/STEPBible/STEPBible-Data> into one folder:
`TAHOT` (4 files), `TAGNT` (2 files) from "Translators Amalgamated OT+NT", and `TBESH`, `TBESG` from "Lexicons". Then:

```bash
node scripts/import-step.mjs path/to/folder
```

## Licenses and credits

| Text | License | Source |
|---|---|---|
| King James Version (1769) | Public domain (Crown patent applies only in the UK) | eBible.org `eng-kjv2006` |
| World English Bible | Public domain ("World English Bible" is a trademark: keep the name only if the text is unchanged) | eBible.org `eng-web` |
| 和合本 Chinese Union Version (Simplified, Traditional) | Public domain | eBible.org `cmn-cu89s`, `cmn-cu89t` |
| Louis Segond 1910 | Public domain | eBible.org `fraLSG` |
| Reina-Valera 1909 | Public domain | eBible.org `spaRV1909` |
| Hebrew OT (Leningrad Codex), Greek NT (Nestle-Aland + variants), word meanings, lexicons | **CC BY 4.0 — credit required** | STEPBible.org (Tyndale House, Cambridge) |

STEPBible data is CC BY: the app must show "STEPBible.org" credit (it does, in the word panel) and
keep it in any about/credits screen.

Only add texts that are public domain or openly licensed. NIV, ESV, NKJV, NASB, Reina-Valera 1960
and the revised Chinese Union Version are copyrighted.

## Roadmap

1. ✅ Reader
2. ✅ Original-language view: Hebrew/Greek word by word with modern translations (EN, 中文, FR, ES)
3. ✅ Accounts and sync (Supabase): highlights, notes with verse links, reading place, offline
4. AI study assistant with tradition lenses, able to explain why a word was translated a certain way
   (server-side; provider configurable — OpenAI or Claude)
5. AI over your notes and documents, polish, app store release

Also done: documents (word processor) with notes and verses inside.

## Known limits / notes for later

- Word meanings under the Hebrew/Greek are in **English** (and Spanish for the Greek NT). There is no
  free word-by-word Chinese or French data; options are AI-generated meanings reviewed by a person, or
  showing the Chinese/French verse alongside (as now).
- App size: text data is about 25 MB for six translations plus 40 MB for Hebrew/Greek and lexicons. On the
  web it is downloaded a book at a time; in the phone apps it is all bundled. Before store release, move to
  downloadable SQLite packs (only `src/bible/source.ts` and `src/bible/original.ts` need to change).
- KJV italic markers (`[was]`) and paragraph marks (`¶`) are stripped for now.
- Documents: if the same document is edited on two devices at the same moment, the last save wins for the
  whole document (no merging of simultaneous edits). Not yet: printing/export to Word or PDF, tables,
  images, comments.
- The document editor has only been tested in a browser so far; on phones it runs inside a web view and
  needs a check on a real device (keyboard, toolbar scrolling).
