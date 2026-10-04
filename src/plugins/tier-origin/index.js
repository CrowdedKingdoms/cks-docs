// Points the text files the site serves (static/llms.txt, the Unreal SDK helpers) at the site
// that serves them.
//
// They are committed with the production origin so that all three branches carry the same
// bytes. A dev or test build rewrites that origin to its own in the copies it emits: those sites
// serve pages production does not have yet (the ck-exec section is on dev only), so an agent
// that reads a tier's index has to stay on that tier.
const fs = require('node:fs');
const path = require('node:path');

const SERVED_TEXT = new Set(['.txt', '.md']);

function* servedTextFiles(dir) {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* servedTextFiles(full);
    else if (SERVED_TEXT.has(path.extname(entry.name))) yield full;
  }
}

module.exports = function tierOriginPlugin(context, options) {
  const from = options.prodUrl.replace(/\/+$/, '');
  const to = context.siteConfig.url.replace(/\/+$/, '');
  const origin = new RegExp(`${from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w.-])`, 'g');
  return {
    name: 'tier-origin',
    async postBuild({outDir}) {
      if (from === to) return;
      if (!fs.existsSync(path.join(outDir, 'llms.txt'))) {
        throw new Error(`[tier-origin] ${outDir}/llms.txt is missing, so this site serves no agent index`);
      }
      const rewritten = [];
      for (const file of servedTextFiles(outDir)) {
        const text = fs.readFileSync(file, 'utf8');
        const next = text.replace(origin, to);
        if (next === text) continue;
        fs.writeFileSync(file, next);
        rewritten.push(path.relative(outDir, file));
      }
      console.log(`[tier-origin] ${from} -> ${to} in ${rewritten.length} file(s): ${rewritten.join(', ')}`);
    },
  };
};
