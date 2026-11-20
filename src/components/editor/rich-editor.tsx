'use dom';

import './editor.css';

import { Highlight } from '@tiptap/extension-highlight';
import { TextAlign } from '@tiptap/extension-text-align';
import { TextStyleKit } from '@tiptap/extension-text-style';
import { CharacterCount, Placeholder } from '@tiptap/extensions';
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import type { DOMProps } from 'expo/dom';
import { useEffect, useMemo, useRef, useState } from 'react';

import { verseIdsIn } from '@/bible/find-refs';
import type { VerseRef } from '@/bible/verse-id';
import type { RichContent } from '@/sync/types';

import { NoteCard, NoteCardContext, noteLookup, type NoteSummary } from './note-card';
import { VerseLinks } from './verse-links';

/**
 * Word-processor style editor for sermons, study guides and longer writing.
 * Runs as a web component: directly on the website, and inside a web view in
 * the phone/tablet apps ('use dom'), so it is the same editor everywhere.
 * Talks to the app only through the props below.
 */
export type SavePayload = { content: RichContent; plainText: string; verseIds: number[]; noteIds: string[] };
export type VerseLookup = { label: string; text: string; translation: string } | { error: string };

type Props = {
  /** Content when the editor opens. */
  initialContent: RichContent | null;
  /** A newer version saved on another device; shown if there is no unsaved typing here. */
  remote: { content: RichContent; version: string } | null;
  notes: NoteSummary[];
  dark: boolean;
  onSave: (payload: SavePayload) => Promise<void>;
  onOpenVerse: (ref: VerseRef) => Promise<void>;
  onOpenNote: (id: string) => Promise<void>;
  /** Look up verse text, e.g. "John 3:16-18". */
  getVerse: (reference: string) => Promise<VerseLookup>;
  dom?: DOMProps;
};

const SAVE_DELAY_MS = 700;

const FONTS = [
  { label: 'Default', value: '' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Times New Roman', value: '"Times New Roman", Times, serif' },
  { label: 'Palatino', value: '"Palatino Linotype", Palatino, "Book Antiqua", serif' },
  { label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
  { label: 'Verdana', value: 'Verdana, Geneva, sans-serif' },
  { label: 'Trebuchet MS', value: '"Trebuchet MS", sans-serif' },
  { label: 'Courier New', value: '"Courier New", Courier, monospace' },
  { label: '宋体 / 明體 (Chinese serif)', value: '"Songti SC", "SimSun", "PMingLiU", "Noto Serif CJK SC", serif' },
  { label: '黑体 (Chinese sans)', value: '"PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif' },
];
const SIZES = ['10', '12', '14', '16', '18', '20', '24', '28', '32', '40', '48'];
const TEXT_COLORS = ['#000000', '#5f6368', '#c0392b', '#d35400', '#b7950b', '#1e8449', '#1f618d', '#7d3c98'];
const HIGHLIGHTS = ['#fff59d', '#c8e6c9', '#bbdefb', '#f8bbd0', '#e1bee7', '#ffe0b2'];

type Panel = 'color' | 'highlight' | 'link' | 'verse' | 'note' | null;

export default function RichEditor({
  initialContent,
  remote,
  notes,
  dark,
  onSave,
  onOpenVerse,
  onOpenNote,
  getVerse,
}: Props) {
  const dirty = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The editor's callbacks are created once; keep them pointed at the latest onSave.
  const onSaveRef = useRef(onSave);
  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);
  const [panel, setPanel] = useState<Panel>(null);
  const [linkPopup, setLinkPopup] = useState<{ ref: VerseRef; label: string; x: number; y: number } | null>(null);

  const notesMap = useMemo(() => new Map(notes.map((n) => [n.id, n])), [notes]);
  useEffect(() => {
    noteLookup.clear();
    for (const n of notes) noteLookup.set(n.id, n);
  }, [notes]);

  const save = (editor: Editor) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = null;
    if (!dirty.current) return;
    dirty.current = false;
    const plainText = editor.getText({ blockSeparator: '\n' });
    const noteIds: string[] = [];
    editor.state.doc.descendants((node) => {
      if (node.type.name === 'noteCard' && node.attrs.noteId) noteIds.push(node.attrs.noteId as string);
    });
    void onSaveRef.current({
      content: editor.getJSON() as RichContent,
      plainText,
      verseIds: verseIdsIn(plainText),
      noteIds: [...new Set(noteIds)],
    });
  };

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: { openOnClick: false, autolink: true, defaultProtocol: 'https' },
      }),
      TextStyleKit,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({
        placeholder: 'Start writing… Type a reference like John 3:16 and it becomes a link.',
      }),
      CharacterCount,
      VerseLinks,
      NoteCard,
    ],
    content: initialContent ?? '',
    immediatelyRender: true,
    onUpdate: ({ editor: e }) => {
      dirty.current = true;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => save(e), SAVE_DELAY_MS);
    },
    onBlur: ({ editor: e }) => save(e),
  });

  // Save anything pending when the editor closes.
  useEffect(() => {
    return () => {
      if (editor && dirty.current) save(editor);
    };
  }, [editor]);

  // Another device saved a newer version: show it unless there is unsaved typing here.
  const remoteVersion = remote?.version;
  useEffect(() => {
    if (!editor || !remote || dirty.current) return;
    editor.commands.setContent(remote.content, { emitUpdate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, remoteVersion]);

  // Clicking an underlined reference shows a small "Open" button next to it.
  const onClick = (e: React.MouseEvent) => {
    const el = (e.target as HTMLElement).closest('.ProseMirror .verse-link') as HTMLElement | null;
    if (!el?.dataset.ref) return setLinkPopup(null);
    const [book, chapter, verse] = el.dataset.ref.split(':').map(Number);
    const rect = el.getBoundingClientRect();
    setLinkPopup({ ref: { book, chapter, verse }, label: el.dataset.label ?? '', x: rect.left, y: rect.bottom + 4 });
  };

  if (!editor) return null;

  return (
    <NoteCardContext.Provider
      value={{ notes: notesMap, openVerse: (r) => void onOpenVerse(r), openNote: (id) => void onOpenNote(id) }}>
      <div className={`rte-root${dark ? ' dark' : ''}`}>
        <Toolbar editor={editor} panel={panel} setPanel={setPanel} />
        {panel && (
          <ToolPanel
            panel={panel}
            editor={editor}
            notes={notes}
            close={() => setPanel(null)}
            getVerse={getVerse}
          />
        )}
        <div className="rte-scroll" onClick={onClick} onScroll={() => setLinkPopup(null)}>
          <div className="rte-page">
            <EditorContent editor={editor} />
          </div>
        </div>
        <StatusBar editor={editor} />
        {linkPopup && (
          <div className="verse-popup" style={{ left: linkPopup.x, top: linkPopup.y }}>
            <button
              type="button"
              onClick={() => {
                void onOpenVerse(linkPopup.ref);
                setLinkPopup(null);
              }}>
              Open {linkPopup.label} ↗
            </button>
          </div>
        )}
      </div>
    </NoteCardContext.Provider>
  );
}

// ------------------------------------------------------------------ toolbar

function Toolbar({ editor, panel, setPanel }: { editor: Editor; panel: Panel; setPanel: (p: Panel) => void }) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      strike: e.isActive('strike'),
      bullet: e.isActive('bulletList'),
      ordered: e.isActive('orderedList'),
      quote: e.isActive('blockquote'),
      link: e.isActive('link'),
      block: e.isActive('heading', { level: 1 })
        ? 'h1'
        : e.isActive('heading', { level: 2 })
          ? 'h2'
          : e.isActive('heading', { level: 3 })
            ? 'h3'
            : 'p',
      align: (['center', 'right', 'justify'] as const).find((a) => e.isActive({ textAlign: a })) ?? 'left',
      font: (e.getAttributes('textStyle').fontFamily as string | undefined) ?? '',
      size: ((e.getAttributes('textStyle').fontSize as string | undefined) ?? '').replace('px', ''),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });
  const chain = () => editor.chain().focus();
  const toggle = (p: Panel) => setPanel(panel === p ? null : p);

  return (
    <div className="rte-toolbar" role="toolbar" aria-label="Formatting">
      <Group>
        <Btn label="Undo" icon="↶" disabled={!s.canUndo} onClick={() => chain().undo().run()} />
        <Btn label="Redo" icon="↷" disabled={!s.canRedo} onClick={() => chain().redo().run()} />
      </Group>
      <Group>
        <select
          aria-label="Paragraph style"
          value={s.block}
          onChange={(e) => {
            const v = e.target.value;
            if (v === 'p') chain().setParagraph().run();
            else chain().setHeading({ level: Number(v[1]) as 1 | 2 | 3 }).run();
          }}>
          <option value="p">Normal text</option>
          <option value="h1">Title</option>
          <option value="h2">Heading</option>
          <option value="h3">Subheading</option>
        </select>
        <select
          aria-label="Font"
          value={FONTS.some((f) => f.value === s.font) ? s.font : ''}
          onChange={(e) => (e.target.value ? chain().setFontFamily(e.target.value).run() : chain().unsetFontFamily().run())}>
          {FONTS.map((f) => (
            <option key={f.label} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
        <select
          aria-label="Font size"
          value={s.size}
          onChange={(e) => (e.target.value ? chain().setFontSize(`${e.target.value}px`).run() : chain().unsetFontSize().run())}>
          <option value="">Size</option>
          {SIZES.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </Group>
      <Group>
        <Btn label="Bold" icon={<b>B</b>} active={s.bold} onClick={() => chain().toggleBold().run()} />
        <Btn label="Italic" icon={<i>I</i>} active={s.italic} onClick={() => chain().toggleItalic().run()} />
        <Btn label="Underline" icon={<u>U</u>} active={s.underline} onClick={() => chain().toggleUnderline().run()} />
        <Btn label="Strikethrough" icon={<s>S</s>} active={s.strike} onClick={() => chain().toggleStrike().run()} />
        <Btn label="Text color" icon={<span className="color-a">A</span>} active={panel === 'color'} onClick={() => toggle('color')} />
        <Btn label="Highlight" icon={<span className="hl-icon">✎</span>} active={panel === 'highlight'} onClick={() => toggle('highlight')} />
      </Group>
      <Group>
        <Btn label="Align left" icon="⯇" active={s.align === 'left'} onClick={() => chain().setTextAlign('left').run()} />
        <Btn label="Center" icon="≡" active={s.align === 'center'} onClick={() => chain().setTextAlign('center').run()} />
        <Btn label="Align right" icon="⯈" active={s.align === 'right'} onClick={() => chain().setTextAlign('right').run()} />
        <Btn label="Justify" icon="☰" active={s.align === 'justify'} onClick={() => chain().setTextAlign('justify').run()} />
      </Group>
      <Group>
        <Btn label="Bulleted list" icon="•≡" active={s.bullet} onClick={() => chain().toggleBulletList().run()} />
        <Btn label="Numbered list" icon="1≡" active={s.ordered} onClick={() => chain().toggleOrderedList().run()} />
        <Btn label="Quote" icon="❝" active={s.quote} onClick={() => chain().toggleBlockquote().run()} />
        <Btn label="Divider line" icon="―" onClick={() => chain().setHorizontalRule().run()} />
        <Btn label="Link" icon="🔗" active={s.link || panel === 'link'} onClick={() => toggle('link')} />
        <Btn label="Clear formatting" icon="⌫" onClick={() => chain().unsetAllMarks().clearNodes().run()} />
      </Group>
      <Group>
        <button type="button" className={`rte-wide${panel === 'verse' ? ' on' : ''}`} onClick={() => toggle('verse')}>
          + Verse
        </button>
        <button type="button" className={`rte-wide${panel === 'note' ? ' on' : ''}`} onClick={() => toggle('note')}>
          + Note
        </button>
      </Group>
    </div>
  );
}

function Group({ children }: { children: React.ReactNode }) {
  return <div className="rte-group">{children}</div>;
}

function Btn({
  label,
  icon,
  active,
  disabled,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      className={active ? 'on' : undefined}
      // Keep the text selection when clicking toolbar buttons.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}>
      {icon}
    </button>
  );
}

// ------------------------------------------------------------------ panels

function ToolPanel({
  panel,
  editor,
  notes,
  close,
  getVerse,
}: {
  panel: Exclude<Panel, null>;
  editor: Editor;
  notes: NoteSummary[];
  close: () => void;
  getVerse: Props['getVerse'];
}) {
  const chain = () => editor.chain().focus();

  if (panel === 'color' || panel === 'highlight') {
    const colors = panel === 'color' ? TEXT_COLORS : HIGHLIGHTS;
    return (
      <div className="rte-panel">
        <span className="rte-panel-label">{panel === 'color' ? 'Text color' : 'Highlight'}</span>
        {colors.map((c) => (
          <button
            key={c}
            type="button"
            className="swatch"
            style={{ background: c }}
            aria-label={c}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              if (panel === 'color') chain().setColor(c).run();
              else chain().setHighlight({ color: c }).run();
              close();
            }}
          />
        ))}
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            if (panel === 'color') chain().unsetColor().run();
            else chain().unsetHighlight().run();
            close();
          }}>
          None
        </button>
      </div>
    );
  }
  if (panel === 'link') return <LinkPanel editor={editor} close={close} />;
  if (panel === 'verse') return <VersePanel editor={editor} close={close} getVerse={getVerse} />;
  return <NotePanel editor={editor} notes={notes} close={close} />;
}

function LinkPanel({ editor, close }: { editor: Editor; close: () => void }) {
  const [url, setUrl] = useState((editor.getAttributes('link').href as string | undefined) ?? '');
  const apply = () => {
    const chain = editor.chain().focus().extendMarkRange('link');
    if (url.trim()) chain.setLink({ href: url.trim() }).run();
    else chain.unsetLink().run();
    close();
  };
  return (
    <form className="rte-panel" onSubmit={(e) => (e.preventDefault(), apply())}>
      <span className="rte-panel-label">Web link</span>
      <input autoFocus value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
      <button type="submit">Apply</button>
      <button type="button" onClick={close}>
        Cancel
      </button>
    </form>
  );
}

/** Insert a verse (or range) as a quote: "John 3:16 (KJV) “For God so loved…”". */
function VersePanel({ editor, close, getVerse }: { editor: Editor; close: () => void; getVerse: Props['getVerse'] }) {
  const [ref, setRef] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const insert = async () => {
    setBusy(true);
    setError(null);
    const result = await getVerse(ref);
    setBusy(false);
    if ('error' in result) return setError(result.error);
    editor
      .chain()
      .focus()
      .insertContent([
        {
          type: 'blockquote',
          content: [
            {
              type: 'paragraph',
              content: [
                { type: 'text', marks: [{ type: 'bold' }], text: `${result.label} (${result.translation})` },
                { type: 'text', text: ` “${result.text}”` },
              ],
            },
          ],
        },
        { type: 'paragraph' },
      ])
      .run();
    close();
  };
  return (
    <form className="rte-panel" onSubmit={(e) => (e.preventDefault(), void insert())}>
      <span className="rte-panel-label">Insert verse</span>
      <input autoFocus value={ref} onChange={(e) => setRef(e.target.value)} placeholder="e.g. John 3:16-18" />
      <button type="submit" disabled={busy || !ref.trim()}>
        {busy ? '…' : 'Insert'}
      </button>
      <button type="button" onClick={close}>
        Cancel
      </button>
      {error && <span className="rte-error">{error}</span>}
    </form>
  );
}

function NotePanel({ editor, notes, close }: { editor: Editor; notes: NoteSummary[]; close: () => void }) {
  const [q, setQ] = useState('');
  const list = notes
    .filter((n) => !q || `${n.title}\n${n.body}`.toLowerCase().includes(q.toLowerCase()))
    .slice(0, 50);
  return (
    <div className="rte-panel rte-panel-col">
      <div className="rte-panel-row">
        <span className="rte-panel-label">Insert a note</span>
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your notes" />
        <button type="button" onClick={close}>
          Cancel
        </button>
      </div>
      {list.length === 0 ? (
        <span className="rte-muted">{notes.length ? 'No notes match.' : 'You have no notes yet (Notes tab).'}</span>
      ) : (
        <div className="rte-note-list">
          {list.map((n) => (
            <button
              key={n.id}
              type="button"
              className="rte-note-item"
              onClick={() => {
                editor
                  .chain()
                  .focus()
                  .insertContent([{ type: 'noteCard', attrs: { noteId: n.id } }, { type: 'paragraph' }])
                  .run();
                close();
              }}>
              <strong>{n.title || 'Untitled note'}</strong>
              <span>{n.body.slice(0, 120)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBar({ editor }: { editor: Editor }) {
  const words = useEditorState({ editor, selector: ({ editor: e }) => e.storage.characterCount.words() as number });
  return <div className="rte-status">{words} words</div>;
}
