import {test, expect} from '@playwright/test';

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

test('renders the graph and copies the clipboard text', async ({page, request}) => {
  const expected = await (await request.get(`${baseURL}/bp/unreal-sdk/${snippet}.txt`)).text();
  expect(expected).toContain('Begin Object');

  await page.goto('/unreal-sdk-blueprint-spike');
  const figure = page.locator('figure', {has: page.locator(`canvas[aria-label*="${snippet}"]`)}).first();
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

const ALL_SNIPPETS = ['qs-login', 'qs-entity', 'qs-event', 'qs-model-read', 'identity-policies'];

test('every node renders with the title the editor shows', async ({page, request}) => {
  await page.goto('/unreal-sdk-blueprint-spike');
  const mismatches: string[] = [];
  for (const id of ALL_SNIPPETS) {
    const res = await request.get(`${baseURL}/bp/unreal-sdk/${id}.titles.json`);
    expect(res.ok(), `${id}.titles.json is published`).toBeTruthy();
    const expected = (await res.json()) as EditorTitle[];
    const canvas = page.locator(`canvas[aria-label="${id}"]`);
    await expect(canvas).toHaveCount(1);
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
  expect(mismatches, mismatches.join('\n')).toEqual([]);
});
