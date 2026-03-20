import type { CodingAgentSession } from "@elizaos/app-core/api";

/** Status dot color classes for coding-agent activity. */
const STATUS_DOT: Record<string, string> = {
  active: "bg-ok",
  tool_running: "bg-accent",
  blocked: "bg-warn",
  error: "bg-danger",
};

const PULSE_STATUSES = new Set(["active", "tool_running"]);

/** Derive activity text for sessions hydrated from the server (no lastActivity yet). */
function deriveActivity(s: CodingAgentSession): string {
  if (s.status === "tool_running" && s.toolDescription) {
    return `Running ${s.toolDescription}`.slice(0, 60);
  }
  if (s.status === "blocked") return "Waiting for input";
  if (s.status === "error") return "Error";
  return "Running";
}

interface AgentActivityBoxProps {
  sessions: CodingAgentSession[];
  /** Called when the user clicks a session row. */
  onSessionClick?: (sessionId: string) => void;
}

export function AgentActivityBox({
  sessions,
  onSessionClick,
}: AgentActivityBoxProps) {
  if (!sessions || sessions.length === 0) return null;

  return (
    <div className="border-t border-border px-3 py-1.5 space-y-0.5 z-[1]">
      {sessions.map((s) => (
        <button
          key={s.sessionId}
          type="button"
          onClick={() => onSessionClick?.(s.sessionId)}
          className="flex items-center gap-1.5 min-w-0 w-full text-left cursor-pointer hover:bg-bg-hover rounded px-1 -mx-1 transition-colors"
        >
          <span
            className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${
              STATUS_DOT[s.status] ?? "bg-muted"
            }${PULSE_STATUSES.has(s.status) ? " animate-pulse" : ""}`}
          />
          <span className="text-[11px] font-medium text-txt max-w-[120px] truncate shrink-0">
            {s.label}
          </span>
          <span className="text-[11px] text-muted truncate min-w-0">
            {s.lastActivity ?? deriveActivity(s)}
          </span>
          <svg
            className="ml-auto w-3 h-3 text-muted shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 15l-6-6-6 6" />
          </svg>
        </button>
      ))}
    </div>
  );
}
