import type { RichContent } from '@/sync/types';

/** Starting points for a new document. */
const h = (level: number, text: string): RichContent => ({ type: 'heading', attrs: { level }, content: [{ type: 'text', text }] });
const p = (text = ''): RichContent => (text ? { type: 'paragraph', content: [{ type: 'text', text }] } : { type: 'paragraph' });
const bullets = (...items: string[]): RichContent => ({
  type: 'bulletList',
  content: items.map((t) => ({ type: 'listItem', content: [p(t)] })),
});

export const TEMPLATES: { id: string; name: string; description: string; title: string; content: RichContent | null }[] = [
  { id: 'blank', name: 'Blank document', description: 'Start from an empty page', title: '', content: null },
  {
    id: 'sermon',
    name: 'Sermon outline',
    description: 'Text, big idea, points, application',
    title: 'Sermon: ',
    content: {
      type: 'doc',
      content: [
        h(1, 'Sermon title'),
        p('Main text: (type a reference, e.g. Romans 8:28-30, or use + Verse)'),
        h(2, 'Big idea'),
        p('One sentence that sums up the message.'),
        h(2, 'Introduction'),
        p(),
        h(2, '1. First point'),
        p('Supporting verses:'),
        h(2, '2. Second point'),
        p(),
        h(2, '3. Third point'),
        p(),
        h(2, 'Application'),
        bullets('What should we believe?', 'What should we do?'),
        h(2, 'Closing / prayer'),
        p(),
      ],
    },
  },
  {
    id: 'study',
    name: 'Topic study guide',
    description: 'Key passages, word study, questions',
    title: 'Study: ',
    content: {
      type: 'doc',
      content: [
        h(1, 'Topic'),
        p('What I want to understand:'),
        h(2, 'Key passages'),
        bullets('', ''),
        h(2, 'Word study'),
        p('Important Hebrew/Greek words (see the Original tab):'),
        h(2, 'What other passages say'),
        p(),
        h(2, 'Questions for discussion'),
        { type: 'orderedList', content: [1, 2, 3].map(() => ({ type: 'listItem', content: [p()] })) },
        h(2, 'Summary'),
        p(),
      ],
    },
  },
];
