import { mergeAttributes, Node, NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from '@tiptap/react';
import { createContext, useContext } from 'react';

import { findRefs } from '@/bible/find-refs';
import type { VerseRef } from '@/bible/verse-id';

/** The short form of a note that the editor needs. */
export type NoteSummary = { id: string; title: string; body: string };

type NoteCardContextValue = {
  notes: Map<string, NoteSummary>;
  openVerse: (ref: VerseRef) => void;
  openNote: (id: string) => void;
};
export const NoteCardContext = createContext<NoteCardContextValue>({
  notes: new Map(),
  openVerse: () => {},
  openNote: () => {},
});

/** Latest notes, for the plain-text version of the document (search, verse markers). */
export const noteLookup = new Map<string, NoteSummary>();

/**
 * A note placed inside a document, shown as a card. It always shows the
 * note's current text (edit the note and every document showing it updates),
 * and its verse references are clickable.
 */
export const NoteCard = Node.create({
  name: 'noteCard',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return { noteId: { default: null } };
  },
  parseHTML() {
    return [{ tag: 'div[data-note-card]', getAttrs: (el) => ({ noteId: (el as HTMLElement).dataset.noteId }) }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes({ 'data-note-card': '', 'data-note-id': HTMLAttributes.noteId })];
  },
  renderText({ node }) {
    const note = noteLookup.get(node.attrs.noteId as string);
    return note ? `[Note: ${note.title}]\n${note.body}` : '[Note]';
  },
  addNodeView() {
    return ReactNodeViewRenderer(NoteCardView);
  },
});

function NoteCardView({ node, selected, deleteNode }: ReactNodeViewProps) {
  const { notes, openVerse, openNote } = useContext(NoteCardContext);
  const noteId = node.attrs.noteId as string;
  const note = notes.get(noteId);

  return (
    <NodeViewWrapper className={`note-card${selected ? ' selected' : ''}`} data-drag-handle contentEditable={false}>
      <div className="note-card-head">
        <span className="note-card-badge">📝 Note</span>
        <button type="button" className="note-card-title" onClick={() => note && openNote(noteId)}>
          {note ? note.title || 'Untitled note' : 'This note was deleted'}
        </button>
        <button type="button" className="note-card-remove" title="Remove from document" onClick={deleteNode}>
          ✕
        </button>
      </div>
      {note && <LinkedBody text={note.body} onOpenVerse={openVerse} />}
    </NodeViewWrapper>
  );
}

function LinkedBody({ text, onOpenVerse }: { text: string; onOpenVerse: (ref: VerseRef) => void }) {
  const parts: React.ReactNode[] = [];
  let at = 0;
  for (const r of findRefs(text)) {
    if (r.start > at) parts.push(text.slice(at, r.start));
    parts.push(
      <span key={r.start} className="verse-link" role="link" onClick={() => onOpenVerse(r.ref)}>
        {r.text}
      </span>,
    );
    at = r.end;
  }
  parts.push(text.slice(at));
  return <div className="note-card-body">{parts}</div>;
}
