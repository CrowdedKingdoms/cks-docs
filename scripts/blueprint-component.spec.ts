import {test, expect, type Page} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

// Checks the Blueprint component against a served site: the graph draws, and Copy nodes puts the
// exact clipboard text a reader pastes into Unreal on the clipboard. The clipboard part is why this
// is a Playwright test rather than a unit test: it needs a real browser with the permission granted.
//
//   CKS_DOCS_TIER=dev npx docusaurus serve --build --port 3112 --no-open
//   BLUEPRINT_BASE_URL=http://localhost:3112 npx playwright test blueprint-component.spec.ts --project=chromium-clipboard
//
// The project uses the machine's Edge or Chrome through Playwright's channel option, so nothing has to
// be downloaded to run it.

const baseURL = process.env.BLUEPRINT_BASE_URL ?? 'http://localhost:3112';
const snippet = process.env.BLUEPRINT_SNIPPET ?? 'qs-model-read';

test.use({
  baseURL,
  permissions: ['clipboard-read', 'clipboard-write'],
});

// The graphs under test are the ones the docs actually embed: every <Blueprint src="..."> under
// docs-unreal-sdk, each visited at its own page URL. A page's URL is its folder plus its frontmatter
// slug (or file name), under the plugin's /unreal-sdk route base.
const DOCS_DIR = path.join(__dirname, '..', 'docs-unreal-sdk');
const ROUTE_BASE = '/unreal-sdk';

function listMarkdown(dir: string): string[] {
  return fs.readdirSync(dir, {withFileTypes: true}).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return listMarkdown(full);
    return /\.mdx?$/.test(entry.name) ? [full] : [];
  });
}

function pageUrl(file: string): string {
  const text = fs.readFileSync(file, 'utf8');
  const slugMatch = text.match(/^slug:\s*(\S+)\s*$/m);
  const slug = slugMatch?.[1] ?? path.basename(file).replace(/\.mdx?$/, '');
  if (slug.startsWith('/')) return `${ROUTE_BASE}${slug}`;
  const folder = path.relative(DOCS_DIR, path.dirname(file)).split(path.sep).filter(Boolean).join('/');
  return folder ? `${ROUTE_BASE}/${folder}/${slug}` : `${ROUTE_BASE}/${slug}`;
}

// page URL -> snippet ids embedded on it, in document order.
const PAGE_SNIPPETS = new Map<string, string[]>();
for (const file of listMarkdown(DOCS_DIR)) {
  const ids = [...fs.readFileSync(file, 'utf8').matchAll(/<Blueprint\s[^>]*?\bsrc="([a-z0-9-]+)"/g)].map((m) => m[1]);
  if (ids.length) PAGE_SNIPPETS.set(pageUrl(file), ids);
}
const ALL_SNIPPETS = [...new Set([...PAGE_SNIPPETS.values()].flat())];
const pageOf = (id: string) => [...PAGE_SNIPPETS.entries()].find(([, ids]) => ids.includes(id))?.[0];

// A page labels the canvas with its caption, not the snippet id, so the figure is found through its
// download link, the one place the id is stable in the markup.
const figureFor = (page: Page, id: string) =>
  page.locator('figure', {has: page.locator(`a[href$="/bp/unreal-sdk/${id}.txt"]`)}).first();

// Pages keep their graphs on the Blueprint side of a C++/Blueprint tab pair, hidden until picked.
async function showBlueprintTabs(page: Page): Promise<void> {
  // The page renders client side after load; a figure's download link is in the DOM even while hidden.
  await page.locator('a[href*="/bp/unreal-sdk/"]').first().waitFor({state: 'attached'});
  const tabs = page.getByRole('tab', {name: 'Blueprint'});
  const count = await tabs.count();
  for (let i = 0; i < count; i++) {
    const tab = tabs.nth(i);
    if ((await tab.getAttribute('aria-selected')) === 'true') continue;
    await tab.click();
  }
}

test('the docs embed at least one Blueprint graph', () => {
  expect(ALL_SNIPPETS.length).toBeGreaterThan(0);
  console.log(`discovered ${ALL_SNIPPETS.length} graphs on ${PAGE_SNIPPETS.size} pages`);
});

test('renders the graph and copies the clipboard text', async ({page, request}) => {
  const url = pageOf(snippet);
  expect(url, `${snippet} is embedded by a page under docs-unreal-sdk`).toBeTruthy();
  const expected = await (await request.get(`${baseURL}/bp/unreal-sdk/${snippet}.txt`)).text();
  expect(expected).toContain('Begin Object');

  await page.goto(url!);
  await showBlueprintTabs(page);
  const figure = figureFor(page, snippet);
  await expect(figure).toBeVisible();
  await figure.scrollIntoViewIfNeeded();
  // Located structurally, not by name: the label changes to "Copied" and a name filter would lose it.
  const button = figure.locator('button');
  await expect(button).toHaveText('Copy nodes');
  await expect(button).toBeEnabled();

  // Something was drawn: the canvas is not a single flat colour once the graph is on it.
  const painted = await figure.locator('canvas').evaluate((c: HTMLCanvasElement) => {
    const ctx = c.getContext('2d');
    if (!ctx) return 0;
    const data = ctx.getImageData(0, 0, c.width, c.height).data;
    const seen = new Set<number>();
    for (let i = 0; i < data.length; i += 4 * 97) {
      seen.add((data[i] << 16) | (data[i + 1] << 8) | data[i + 2]);
      if (seen.size > 8) break;
    }
    return seen.size;
  });
  expect(painted).toBeGreaterThan(8);

  await button.click();
  await expect(button).toHaveText('Copied');
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toBe(expected);
});

// Every rendered node must carry the title the Unreal editor gave it. The editor writes
// <snippet>.titles.json beside each export (name, class, FullTitle, and the Crowdy subtitle a
// replicated custom event shows), so this compares two independent sources: what the editor
// draws and what the renderer drew.
type EditorTitle = {name: string; class: string; title: string; title_drawn?: boolean; crowdy_subtitle?: string};
type RenderedNode = {name: string; title: string; subTitles: string[]};

test('every node renders with the title the editor shows', async ({page, request}) => {
  test.setTimeout(120_000 + 20_000 * PAGE_SNIPPETS.size);
  const mismatches: string[] = [];
  let checked = 0;
  for (const [url, ids] of PAGE_SNIPPETS) {
    await page.goto(url);
    await showBlueprintTabs(page);
    for (const id of ids) {
      const res = await request.get(`${baseURL}/bp/unreal-sdk/${id}.titles.json`);
      expect(res.ok(), `${id}.titles.json is published`).toBeTruthy();
      const expected = (await res.json()) as EditorTitle[];
      const canvas = figureFor(page, id).locator('canvas');
      await expect(canvas, `${id} on ${url}`).toBeVisible();
      await canvas.scrollIntoViewIfNeeded();
      await expect.poll(async () => canvas.evaluate((c) => Boolean((c as {__klee?: unknown}).__klee))).toBe(true);
      // Read the header labels the canvas actually draws, not the node data: a title set after the
      // label was built changes the data and leaves the drawing stale.
      const rendered = (await canvas.evaluate((c) => {
        type Label = {text?: string};
        type Panel = {children?: Label[]};
        type Control = {node: {name: string; title: string; subTitles?: {text: string}[]}; header?: {titlePanel?: Panel}};
        const scene = (c as unknown as {__klee: {app: {scene: {nodes: Control[]}}}}).__klee.app.scene;
        return scene.nodes.map((n) => {
          const labels = (n.header?.titlePanel?.children ?? []).map((l) => l.text ?? '');
          return labels.length
            ? {name: n.node.name, title: labels[0], subTitles: labels.slice(1)}
            : {name: n.node.name, title: n.node.title, subTitles: (n.node.subTitles ?? []).map((s) => s.text)};
        });
      })) as RenderedNode[];
      checked += 1;
      for (const want of expected) {
        if (want.class.endsWith("EdGraphNode_Comment")) continue;
        const got = rendered.find((n) => n.name === want.name);
        if (!got) { mismatches.push(`${id}: ${want.name} not rendered`); continue; }
        const [wantTitle, ...wantRest] = want.title.split('\n');
        if (want.title_drawn === false) continue;
        if (got.title !== wantTitle) mismatches.push(`${id}: ${want.name} title "${got.title}" != editor "${wantTitle}"`);
        for (const line of wantRest) {
          if (!got.subTitles.includes(line)) mismatches.push(`${id}: ${want.name} missing subtitle "${line}" (has ${JSON.stringify(got.subTitles)})`);
        }
        if (want.crowdy_subtitle) {
          for (const line of want.crowdy_subtitle.split('\n')) {
            if (!got.subTitles.includes(line)) mismatches.push(`${id}: ${want.name} missing Crowdy subtitle "${line}" (has ${JSON.stringify(got.subTitles)})`);
          }
        }
      }
    }
  }
  console.log(`checked ${checked} embedded graphs (${ALL_SNIPPETS.length} distinct) on ${PAGE_SNIPPETS.size} pages`);
  expect(mismatches, mismatches.join('\n')).toEqual([]);
});
