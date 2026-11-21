/**
 * Minimal reader for CrossWire SWORD "zText" Bible modules (compressed OSIS).
 *
 *   const mod = openZText('path/to/modules/texts/ztext/chiuns');
 *   mod.entries('nt')  -> array of entry texts in index order ('' for empty entries)
 *
 * File layout per testament ('ot' / 'nt'):
 *   *.bzs  block index:  [offset u32, compressed size u32, uncompressed size u32] per block
 *   *.bzv  verse index:  [block number u32, start u32, size u16] per entry
 *   *.bzz  zlib-compressed blocks
 * Entry order follows the module's versification: a module heading and
 * testament heading, then per book a book heading, per chapter a chapter
 * heading followed by the verses.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';

export function openZText(dir) {
  return {
    entries(testament) {
      const bzs = readFileSync(join(dir, `${testament}.bzs`));
      const bzv = readFileSync(join(dir, `${testament}.bzv`));
      const bzz = readFileSync(join(dir, `${testament}.bzz`));
      const blocks = new Map();
      const block = (n) => {
        if (!blocks.has(n)) {
          const off = bzs.readUInt32LE(n * 12);
          const size = bzs.readUInt32LE(n * 12 + 4);
          blocks.set(n, inflateSync(bzz.subarray(off, off + size)));
        }
        return blocks.get(n);
      };
      const out = [];
      for (let i = 0; i + 10 <= bzv.length; i += 10) {
        const b = bzv.readUInt32LE(i);
        const start = bzv.readUInt32LE(i + 4);
        const size = bzv.readUInt16LE(i + 8);
        out.push(size ? block(b).subarray(start, start + size).toString('utf8') : '');
      }
      return out;
    },
  };
}
