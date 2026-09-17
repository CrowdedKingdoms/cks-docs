// `require.context` is a webpack extension of `require` that bundles every file a folder
// matches, which CppSnippet.tsx uses to inline the extracted C++ snippets at build time.
// @types/node declares `require` without it, so this augments the same `NodeJS.Require`.
declare namespace NodeJS {
  interface Require {
    context(
      directory: string,
      useSubdirectories?: boolean,
      regExp?: RegExp,
    ): {
      (id: string): unknown;
      keys(): string[];
    };
  }
}
