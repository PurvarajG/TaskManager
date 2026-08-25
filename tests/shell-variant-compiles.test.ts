import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";

/**
 * Extracts the body of the FIRST `@media (min-width: <px>px)` block in a
 * compiled stylesheet, via a brace-depth scan rather than a literal
 * substring match — postcss's unminified output formats the media query
 * with a space ("min-width: 900px") while Next's minified production
 * bundle drops it ("min-width:900px"), so a test pinned to one exact
 * spelling would be fragile and prove nothing about the other.
 */
function extractMediaBlock(css: string, minWidthPx: number): string {
  const open = css.match(new RegExp(`@media\\s*\\(min-width:\\s*${minWidthPx}px\\)\\s*\\{`));
  assert.ok(open, `no @media (min-width: ${minWidthPx}px) rule found at all`);
  const start = open!.index! + open![0].length;
  let depth = 1;
  let i = start;
  while (depth > 0 && i < css.length) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}") depth--;
    i++;
  }
  return css.slice(start, i - 1);
}

/**
 * Regression test for a real incident: `@custom-variant shell (min-width:
 * 900px);` in globals.css is INVALID Tailwind v4 syntax — the parenthesised
 * shorthand takes a selector or an at-rule, not a bare media condition — and
 * it fails SILENTLY. `npm run build` still succeeds; every `shell:`/`rail:`
 * utility in components/ui/PageShell.tsx just never appears in the emitted
 * stylesheet, so PageShell's full-height frame and two-column rail grid are
 * absent at every viewport. No jsdom/DOM-level test can catch this — the
 * className string on the element is unchanged either way, since the bug is
 * entirely in what Tailwind's CSS compiler does with it. This runs the real
 * compiler (the same plugin postcss.config.mjs wires into the Next.js
 * build) against the real globals.css, and inspects the OUTPUT CSS.
 */
test("the shell: and rail: custom variants compile to real @media rules with their utilities inside", async () => {
  const root = path.join(__dirname, "..");
  const css = readFileSync(path.join(root, "app/globals.css"), "utf8");

  const result = await postcss([tailwind({ base: root })]).process(css, {
    from: path.join(root, "app/globals.css"),
  });
  const out = result.css;

  // PageShell's actual frame utilities must land INSIDE the 900px block —
  // not zero occurrences, which is exactly what the invalid syntax
  // produced: a build that "succeeds" but emits none of this.
  const shellBlock = extractMediaBlock(out, 900);
  for (const utility of [".shell\\:flex", ".shell\\:h-dvh", ".shell\\:flex-col", ".shell\\:overflow-hidden"]) {
    assert.ok(shellBlock.includes(utility), `${utility} did not compile into the 900px media block`);
  }

  // The rail grid's actual column template — the concrete fix for the
  // primary-column-narrower-than-the-rail defect — must be present with its
  // real values, inside the 1200px block.
  const railBlock = extractMediaBlock(out, 1200);
  assert.ok(
    railBlock.includes(".rail\\:grid-cols-"),
    "the .rail\\:grid-cols-[...] utility did not compile into the 1200px media block",
  );
  assert.match(
    railBlock,
    /grid-template-columns:\s*minmax\(28rem,\s*1fr\)\s*var\(--width-rail\)/,
    "the rail grid's minmax(28rem,1fr)/--width-rail column template did not compile",
  );
});
