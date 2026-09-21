import {useEffect, useRef, useState, type ReactNode} from 'react';
import useBaseUrl from '@docusaurus/useBaseUrl';

import styles from './Blueprint.module.css';

type Props = {
  /** Snippet id: the file is static/bp/unreal-sdk/<src>.txt, pasted from the Unreal editor. */
  src: string;
  /** Canvas height in pixels. */
  height?: number;
  /** Caption shown beside the buttons. */
  title?: string;
};

/** The part of a Klee node control the fit reads: its top-left corner and its size. */
type Node2D = {position: {x: number; y: number}; size: {x: number; y: number}};

type Status =
  | {state: 'loading'}
  | {state: 'ready'; text: string}
  | {state: 'error'; message: string};

/**
 * Renders Unreal Blueprint clipboard text as an interactive node graph. The renderer
 * (vendored Klee, canvas based) is loaded on the client only, after the snippet has been
 * fetched, so nothing here touches `window` during the static build.
 */
export default function Blueprint({src, height = 360, title}: Props): ReactNode {
  const url = useBaseUrl(`/bp/unreal-sdk/${src}.txt`);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<Status>({state: 'loading'});
  const [copied, setCopied] = useState<'idle' | 'copied' | 'failed'>('idle');

  useEffect(() => {
    let cancelled = false;
    let observer: ResizeObserver | undefined;
    setStatus({state: 'loading'});

    (async () => {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`${res.status} ${res.statusText} for ${url}`);
      }
      const text = await res.text();
      // A host that answers every path with the app shell returns HTML with status 200;
      // refuse anything that is not clipboard text rather than draw an empty graph.
      if (!text.includes('Begin Object')) {
        throw new Error(`${url} is not a Blueprint export (no "Begin Object" in it)`);
      }
      const klee = await import('@vendor/klee');
      const canvas = canvasRef.current;
      if (cancelled || !canvas) {
        return;
      }
      const graph = klee.init(canvas);
      const wrap = canvas.parentElement as HTMLElement;

      // Klee has no zoom: it draws at 1:1 and centres the graph, so a snippet wider than
      // the frame is cut off. Fit it by laying the canvas out 1/k larger and scaling it
      // down with CSS, which keeps the drawing crisp. The bounds come from the scene's
      // node controls, laid out by the first display.
      const fit = () => {
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.transform = '';
        graph.display(text);
        const nodes =
          (graph as unknown as {app?: {scene?: {nodes?: Node2D[]}}}).app?.scene?.nodes ?? [];
        if (nodes.length === 0 || wrap.clientWidth === 0) {
          return;
        }
        const minX = Math.min(...nodes.map((n) => n.position.x));
        const minY = Math.min(...nodes.map((n) => n.position.y));
        const maxX = Math.max(...nodes.map((n) => n.position.x + n.size.x));
        const maxY = Math.max(...nodes.map((n) => n.position.y + n.size.y));
        const pad = 32;
        const k = Math.min(1, (wrap.clientWidth - pad) / (maxX - minX), (wrap.clientHeight - pad) / (maxY - minY));
        if (k > 0.98) {
          return;
        }
        // Below half size the labels stop being readable; leave the rest to panning.
        const scale = Math.max(k, 0.5);
        canvas.style.width = `${100 / scale}%`;
        canvas.style.height = `${100 / scale}%`;
        canvas.style.transformOrigin = '0 0';
        canvas.style.transform = `scale(${scale})`;
        graph.display(text);
      };
      fit();
      // The renderer instance, for the Playwright check that compares rendered node titles with
      // the titles the Unreal editor wrote beside the export.
      (canvas as unknown as {__klee?: unknown}).__klee = graph;
      setStatus({state: 'ready', text});

      // A canvas laid out at zero width (a hidden tab, a collapsed pane) keeps a graph
      // pushed off to one side, so refit on any width change of the frame.
      let shownAt = wrap.clientWidth;
      observer = new ResizeObserver(() => {
        const width = wrap.clientWidth;
        if (width === 0 || Math.abs(width - shownAt) < 2) {
          return;
        }
        shownAt = width;
        fit();
      });
      observer.observe(wrap);
    })().catch((err: unknown) => {
      if (cancelled) {
        return;
      }
      setStatus({state: 'error', message: err instanceof Error ? err.message : String(err)});
    });

    return () => {
      cancelled = true;
      observer?.disconnect();
    };
  }, [url]);

  const copy = async () => {
    if (status.state !== 'ready') {
      return;
    }
    try {
      await navigator.clipboard.writeText(status.text);
      setCopied('copied');
    } catch {
      // Clipboard access needs a secure context and a user gesture; the download link
      // beside the button is the fallback when a browser refuses.
      setCopied('failed');
    }
    window.setTimeout(() => setCopied('idle'), 1500);
  };

  const copyLabel = {idle: 'Copy nodes', copied: 'Copied', failed: 'Copy failed'}[copied];

  return (
    <figure className={styles.frame}>
      <div className={styles.canvasWrap} style={{height}}>
        <canvas ref={canvasRef} className={styles.canvas} tabIndex={0} aria-label={title ?? src} />
        {status.state === 'loading' && <div className={styles.overlay}>Loading Blueprint...</div>}
        {status.state === 'error' && (
          <div className={styles.overlay} role="alert">
            Could not load this Blueprint snippet: {status.message}
          </div>
        )}
      </div>
      <figcaption className={styles.caption}>
        <span className={styles.title}>{title ?? src}</span>
        <span className={styles.actions}>
          <button
            type="button"
            className="button button--sm button--secondary"
            onClick={copy}
            disabled={status.state !== 'ready'}>
            {copyLabel}
          </button>
          <a className={styles.download} href={url} download={`${src}.txt`}>
            Download .txt
          </a>
        </span>
      </figcaption>
    </figure>
  );
}
