import MDXComponents from '@theme-original/MDXComponents';
import Blueprint from '@site/src/components/Blueprint';
import CppSnippet from '@site/src/components/CppSnippet';
import SurfaceTable from '@site/src/components/SurfaceTable';

// Components available in every .md/.mdx page without an import line.
export default {
  ...MDXComponents,
  Blueprint,
  CppSnippet,
  SurfaceTable,
};
