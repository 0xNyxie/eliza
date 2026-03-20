import { useEffect, useRef } from "react";
import { client } from "../api";

/**
 * Renders a single xterm.js terminal for a PTY session.
 * On mount: loads xterm lazily, hydrates buffered output, subscribes to live data.
 * On unmount: unsubscribes and disposes.
 */
export function PtyTerminalPane({
  sessionId,
  visible,
}: {
  sessionId: string;
  visible: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<{ dispose: () => void } | null>(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;

    let disposed = false;
    let unsub: (() => void) | undefined;

    (async () => {
      // Lazy-load xterm to keep bundle size down when unused
      const [{ Terminal }, { FitAddon }] = await Promise.all([
        import("@xterm/xterm"),
        import("@xterm/addon-fit"),
      ]);

      if (disposed || !containerRef.current) return;

      const term = new Terminal({
        disableStdin: true,
        fontSize: 12,
        fontFamily: "var(--font-mono, monospace)",
        convertEol: true,
        scrollback: 5000,
        theme: {
          background: "transparent",
          foreground: "#e4e4e7",
          cursor: "transparent",
        },
      });

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(containerRef.current);

      // Delay fit to let the container settle
      requestAnimationFrame(() => {
        if (!disposed) fitAddon.fit();
      });

      termRef.current = {
        dispose: () => {
          term.dispose();
        },
      };

      // Hydrate with buffered output
      try {
        const buf = await client.getPtyBufferedOutput(sessionId);
        if (!disposed && buf) {
          term.write(buf);
        }
      } catch {
        // ignore — session may have ended
      }

      // Subscribe to live output
      client.subscribePtyOutput(sessionId);
      unsub = client.onWsEvent("pty-output", (data) => {
        if (data.sessionId === sessionId && typeof data.data === "string") {
          term.write(data.data);
        }
      });

      // Handle resize
      const ro = new ResizeObserver(() => {
        if (!disposed) {
          fitAddon.fit();
          client.resizePty(sessionId, term.cols, term.rows);
        }
      });
      ro.observe(containerRef.current);

      // Augment dispose to include cleanup
      const prevDispose = termRef.current.dispose;
      termRef.current.dispose = () => {
        ro.disconnect();
        prevDispose();
      };
    })();

    return () => {
      disposed = true;
      unsub?.();
      client.unsubscribePtyOutput(sessionId);
      termRef.current?.dispose();
      termRef.current = null;
      mountedRef.current = false;
    };
  }, [sessionId]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full"
      style={{
        display: visible ? "block" : "none",
        background: "transparent",
      }}
    />
  );
}
