// Type surface of the vendored Klee renderer as this site uses it. The real module is
// vendor/klee/src/klee.ts, reached through the `@vendor/klee` alias set by
// src/plugins/klee-vendor; that folder is excluded from `tsc`, so this declaration is
// what the typecheck sees.
declare module '@vendor/klee' {
  export class Klee {
    display(blueprintText: string): void;
    readonly value: string;
  }
  export function init(canvas: HTMLCanvasElement): Klee;
  export function get(canvas: HTMLCanvasElement): Klee | undefined;
}
