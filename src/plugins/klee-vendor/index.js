// Wires the vendored Klee renderer (vendor/klee) into the site bundle.
//
// `@vendor/klee` resolves to the vendored TypeScript entry point, so the bundler compiles
// it with the same Babel pipeline as src/ and `tsc` never sees it (vendor/ is excluded in
// tsconfig.json; the source is not strict-clean). A `pre` loader reproduces the one build
// step upstream relies on, stripping its DEBUG_UI blocks.
const path = require('node:path');

module.exports = function kleeVendorPlugin(context) {
  const kleeRoot = path.resolve(context.siteDir, 'vendor/klee');
  return {
    name: 'klee-vendor',
    configureWebpack() {
      return {
        resolve: {
          alias: {
            '@vendor/klee': path.join(kleeRoot, 'src/klee.ts'),
          },
        },
        module: {
          rules: [
            {
              test: /\.ts$/,
              include: [kleeRoot],
              enforce: 'pre',
              use: [{loader: require.resolve('./ifdef-loader.js')}],
            },
          ],
        },
      };
    },
  };
};
