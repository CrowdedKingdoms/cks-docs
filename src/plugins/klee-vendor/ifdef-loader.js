// Drops `/// #if DEBUG_UI` ... `/// #endif` blocks from the vendored Klee source.
//
// Upstream builds with `ifdef-loader` and DEBUG_UI=false, which removes those blocks
// before TypeScript sees them. Without that step the code inside is live and paints
// debug outlines on every node. Only the one flag upstream defines is understood; any
// other condition fails the build so it cannot pass through unnoticed.
const OPEN = /^\s*\/\/\/\s*#if\s+(\S+)\s*$/;
const CLOSE = /^\s*\/\/\/\s*#endif\s*$/;

module.exports = function ifdefLoader(source) {
  const out = [];
  let dropping = false;
  for (const line of source.split('\n')) {
    const open = OPEN.exec(line);
    if (open) {
      if (open[1] !== 'DEBUG_UI') {
        throw new Error(`${this.resourcePath}: unknown ifdef condition ${open[1]}`);
      }
      dropping = true;
      continue;
    }
    if (CLOSE.test(line)) {
      dropping = false;
      continue;
    }
    if (!dropping) out.push(line);
  }
  return out.join('\n');
};
