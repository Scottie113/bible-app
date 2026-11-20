import { Extension } from '@tiptap/react';
import type { Node as PMNode } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

import { findRefs, refLabel } from '@/bible/find-refs';

/**
 * Underlines every Bible reference typed in the document (John 3:16,
 * Rom 8:28-30, Ps 23…) as a link, like in Notes. The text stays normal text
 * (you can bold it, delete it, etc.); the link is just a decoration on top.
 * Clicking is handled by the editor (see rich-editor.tsx).
 */
const key = new PluginKey<DecorationSet>('verseLinks');

function build(doc: PMNode): DecorationSet {
  const decorations: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    // One character per position: text as-is, other inline nodes as a placeholder.
    const text = node.textBetween(0, node.content.size, '\n', '￼');
    for (const r of findRefs(text)) {
      decorations.push(
        Decoration.inline(pos + 1 + r.start, pos + 1 + r.end, {
          class: 'verse-link',
          'data-ref': `${r.ref.book}:${r.ref.chapter}:${r.ref.verse}`,
          'data-label': refLabel(r),
        }),
      );
    }
    return false;
  });
  return DecorationSet.create(doc, decorations);
}

export const VerseLinks = Extension.create({
  name: 'verseLinks',
  addProseMirrorPlugins() {
    return [
      new Plugin<DecorationSet>({
        key,
        state: {
          init: (_, { doc }) => build(doc),
          apply: (tr, old) => (tr.docChanged ? build(tr.doc) : old),
        },
        props: {
          decorations(state) {
            return key.getState(state);
          },
        },
      }),
    ];
  },
});
