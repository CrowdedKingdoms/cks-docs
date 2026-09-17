import type {ReactNode} from 'react';
import CodeBlock from '@theme/CodeBlock';

type Props = {
  /** Snippet id: the file is static/snippets/unreal-sdk/<id>.cpp, extracted from compiled SDK code. */
  id: string;
  /** Optional title shown above the code. */
  title?: string;
};

// Every snippet file is inlined at build time, so the code is part of the static HTML and a
// missing file is a build-time fact rather than a fetch that fails on a reader's machine.
const snippets = require.context('!!raw-loader!@site/static/snippets/unreal-sdk/', false, /\.cpp$/);

function load(id: string): string | undefined {
  const key = `./${id}.cpp`;
  if (!snippets.keys().includes(key)) {
    return undefined;
  }
  const mod = snippets(key) as string | {default: string};
  return typeof mod === 'string' ? mod : mod.default;
}

/** Renders a compiled C++ documentation snippet as a code block. */
export default function CppSnippet({id, title}: Props): ReactNode {
  const code = load(id);
  if (code === undefined) {
    return (
      <div className="alert alert--danger" role="alert">
        Missing C++ snippet: <code>{id}</code> (expected static/snippets/unreal-sdk/{id}.cpp)
      </div>
    );
  }
  return (
    <CodeBlock language="cpp" title={title}>
      {code.replace(/\r\n/g, '\n').trimEnd()}
    </CodeBlock>
  );
}
