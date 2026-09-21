import {Fragment, type ReactNode} from 'react';
import Link from '@docusaurus/Link';

import subsystems from '@site/src/generated/unreal-sdk/subsystems.json';
import asyncActions from '@site/src/generated/unreal-sdk/async-actions.json';
import delegates from '@site/src/generated/unreal-sdk/delegates.json';
import cvars from '@site/src/generated/unreal-sdk/cvars.json';
import settings from '@site/src/generated/unreal-sdk/settings.json';
import metaKeys from '@site/src/generated/unreal-sdk/meta-keys.json';
import enums from '@site/src/generated/unreal-sdk/enums.json';
import logCategories from '@site/src/generated/unreal-sdk/log-categories.json';
import structs from '@site/src/generated/unreal-sdk/structs.json';
import symbolPages from '@site/src/generated/unreal-sdk/symbol-pages.json';

type Cell = string | string[] | boolean;
type Row = {id: string; editor: boolean; allowlist: string} & Record<string, Cell>;
type Column = {key: string; label: string; kind: 'code' | 'text' | 'list' | 'flag' | 'page'};
type Table = {table: string; sdk_version: string; columns: Column[]; rows: Row[]};

// The generated files under src/generated/unreal-sdk/ (scripts/build-unreal-reference.mjs),
// each a few KB; the 2.6 MB manifest they derive from is never imported by a page.
const TABLES: Record<string, Table> = {
  subsystems: subsystems as Table,
  'async-actions': asyncActions as Table,
  delegates: delegates as Table,
  cvars: cvars as Table,
  settings: settings as Table,
  'meta-keys': metaKeys as Table,
  enums: enums as Table,
  'log-categories': logCategories as Table,
  structs: structs as Table,
};

type Props = {
  /** Table name: the file src/generated/unreal-sdk/<table>.json. */
  table: string;
  /** Column key whose value groups rows under an H3 each, in row order. */
  group?: string;
  /** `column=value`: only rows whose column equals value (a list column matches any item). */
  filter?: string;
  /** Column keys to show, in this order; defaults to every column the file names. */
  columns?: string[];
  /** Hand-written text per row id, shown as a trailing column titled `notesLabel`. */
  notes?: Record<string, string>;
  notesLabel?: string;
  /** Show rows from editor-only modules, badged; hidden otherwise. */
  includeEditor?: boolean;
  /** Show rows the surface allowlist marks internal, deprecated, editor or mass, badged with the reason. */
  includeAllowlisted?: boolean;
};

const anchor = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// A note may carry `code` spans and [text](href) links; nothing else is interpreted.
function inline(text: string): ReactNode {
  const parts = text.split(/(`[^`]+`|\[[^\]]+\]\([^)]+\))/g);
  return parts.map((part, i) => {
    if (part.startsWith('`')) return <code key={i}>{part.slice(1, -1)}</code>;
    const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
    if (link) return <Link key={i} to={link[2]}>{link[1]}</Link>;
    return <Fragment key={i}>{part}</Fragment>;
  });
}

function cell(column: Column, value: Cell): ReactNode {
  if (column.kind === 'flag') return value ? 'yes' : '';
  if (column.kind === 'page') {
    const slug = value as string;
    if (!slug) return '';
    return <Link to={`${symbolPages.route_base}/${slug}`}>{slug.split('/').pop()}</Link>;
  }
  const items = Array.isArray(value) ? value : [String(value ?? '')];
  if (column.kind === 'text') return items.join(', ');
  return items.map((item, i) => (
    <Fragment key={i}>
      {i > 0 ? ', ' : null}
      <code>{item}</code>
    </Fragment>
  ));
}

function matches(row: Row, filter: string | undefined): boolean {
  if (!filter) return true;
  const eq = filter.indexOf('=');
  if (eq < 0) return true;
  const key = filter.slice(0, eq).trim();
  const want = filter.slice(eq + 1).trim();
  const have = row[key];
  if (Array.isArray(have)) return have.includes(want);
  return String(have) === want;
}

/** Renders one generated Unreal SDK reference table, optionally filtered and grouped. */
export default function SurfaceTable({
  table,
  group,
  filter,
  columns,
  notes,
  notesLabel = 'Notes',
  includeEditor = false,
  includeAllowlisted = false,
}: Props): ReactNode {
  const data = TABLES[table];
  if (!data) {
    return (
      <div className="alert alert--danger" role="alert">
        Unknown surface table: <code>{table}</code> (expected src/generated/unreal-sdk/{table}.json)
      </div>
    );
  }

  const shown = columns
    ? columns.map((key) => data.columns.find((c) => c.key === key)).filter((c): c is Column => Boolean(c))
    : data.columns;
  const cols = shown.filter((c) => c.key !== group);
  const rows = data.rows.filter(
    (r) => (includeEditor || !r.editor) && (includeAllowlisted || !r.allowlist) && matches(r, filter),
  );
  if (rows.length === 0) {
    return (
      <div className="alert alert--warning" role="alert">
        No rows in <code>{table}</code> match <code>{filter ?? '(no filter)'}</code>.
      </div>
    );
  }

  const groups = new Map<string, Row[]>();
  for (const row of rows) {
    const key = group ? String(row[group] ?? '') : '';
    const list = groups.get(key);
    if (list) list.push(row);
    else groups.set(key, [row]);
  }

  const render = (list: Row[]) => (
    <table>
      <thead>
        <tr>
          {cols.map((c) => (
            <th key={c.key}>{c.label}</th>
          ))}
          {notes ? <th>{notesLabel}</th> : null}
        </tr>
      </thead>
      <tbody>
        {list.map((row) => (
          <tr key={row.id}>
            {cols.map((c, i) => (
              <td key={c.key}>
                {cell(c, row[c.key])}
                {i === 0 && row.editor ? <> <span className="badge badge--secondary">Editor only</span></> : null}
                {i === 0 && row.allowlist ? <> <span className="badge badge--warning">{row.allowlist}</span></> : null}
              </td>
            ))}
            {notes ? <td>{inline(notes[row.id] ?? '')}</td> : null}
          </tr>
        ))}
      </tbody>
    </table>
  );

  if (!group) return render(rows);
  const groupColumn = data.columns.find((c) => c.key === group);
  return (
    <>
      {[...groups.entries()].map(([name, list]) => (
        <Fragment key={name}>
          <h3 id={`${table}-${anchor(name || 'other')}`}>
            {name && groupColumn ? cell(groupColumn, name) : 'Other'}
          </h3>
          {render(list)}
        </Fragment>
      ))}
    </>
  );
}
