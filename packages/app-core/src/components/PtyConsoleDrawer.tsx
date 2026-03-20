import { useCallback, useState } from "react";
import type { CodingAgentSession } from "../api";
import "../styles/xterm.css";
import { PtyTerminalPane } from "./PtyTerminalPane";

/** Status dot color classes — mirrors AgentActivityBox. */
const STATUS_DOT: Record<string, string> = {
  active: "bg-ok",
  tool_running: "bg-accent",
  blocked: "bg-warn",
  error: "bg-danger",
};

const PULSE_STATUSES = new Set(["active", "tool_running"]);

interface PtyConsoleDrawerProps {
  /** The session to show initially (clicked from AgentActivityBox). */
  activeSessionId: string;
  /** All live coding-agent sessions. */
  sessions: CodingAgentSession[];
  /** Close the drawer. */
  onClose: () => void;
}

export function PtyConsoleDrawer({
  activeSessionId,
  sessions,
  onClose,
}: PtyConsoleDrawerProps) {
  const [selectedId, setSelectedId] = useState(activeSessionId);

  // If the selected session disappeared, fall back to first available
  const resolvedId =
    sessions.find((s) => s.sessionId === selectedId)?.sessionId ??
    sessions[0]?.sessionId;

  const handleTabClick = useCallback((id: string) => {
    setSelectedId(id);
  }, []);

  if (!sessions.length) return null;

  return (
    <div
      className="border-t border-border bg-bg flex flex-col"
      style={{ height: "40vh", minHeight: 180, maxHeight: "60vh" }}
    >
      {/* ── Tab bar ───────────────────────────────────────────────── */}
      <div className="flex items-center gap-0 border-b border-border px-2 shrink-0">
        {sessions.map((s) => {
          const isActive = s.sessionId === resolvedId;
          return (
            <button
              key={s.sessionId}
              type="button"
              onClick={() => handleTabClick(s.sessionId)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-[12px] border-b-2 transition-colors cursor-pointer ${
                isActive
                  ? "border-accent text-txt"
                  : "border-transparent text-muted hover:text-txt"
              }`}
            >
              <span
                className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${
                  STATUS_DOT[s.status] ?? "bg-muted"
                }${PULSE_STATUSES.has(s.status) ? " animate-pulse" : ""}`}
              />
              <span className="truncate max-w-[100px]">{s.label}</span>
            </button>
          );
        })}

        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="ml-auto p-1 text-muted hover:text-txt transition-colors cursor-pointer"
          aria-label="Close console"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M7 13l5 5 5-5M7 6l5 5 5-5" />
          </svg>
        </button>
      </div>

      {/* ── Terminal panes ────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-hidden bg-black/30">
        {sessions.map((s) => (
          <PtyTerminalPane
            key={s.sessionId}
            sessionId={s.sessionId}
            visible={s.sessionId === resolvedId}
          />
        ))}
      </div>
    </div>
  );
}
