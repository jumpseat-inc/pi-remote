// Vendored from @earendil-works/pi-coding-agent, dist/core/extensions/types.d.ts
// (ExtensionAPI.on overload set, the 36 literal event names; no string-generic
// overload). Provenance per FLLWUP-9; re-diff this list on SDK upgrades.
export type PiSDKOnEvent =
  | "project_trust" | "resources_discover"
  | "session_start" | "session_info_changed" | "session_before_switch"
  | "session_before_fork" | "session_before_compact" | "session_compact"
  | "session_compact_failed" | "session_shutdown" | "session_before_tree"
  | "session_tree" | "context" | "before_provider_request"
  | "before_provider_headers" | "after_provider_response" | "before_agent_start"
  | "agent_start" | "agent_end" | "agent_settled"
  | "ui_prompt_start" | "ui_prompt_end" | "turn_start" | "turn_end"
  | "message_start" | "message_update" | "message_end"
  | "tool_execution_start" | "tool_execution_update" | "tool_execution_end"
  | "model_select" | "thinking_level_select"
  | "tool_call" | "tool_result" | "user_bash" | "input";

/**
 * FLLWUP-11 — minimal structural vendor of the installed SDK's ExtensionContext
 * (dist/core/extensions/types.d.ts ~line 210) and ExtensionUIContext (~69).
 * Provenance + re-diff on SDK upgrades per R-TYPE-1. Only members pi-remote
 * consumes are declared; the real context carries more.
 */
export interface PiExtensionContext {
  /** UI methods for user interaction (ExtensionUIContext). */
  ui: {
    /** Real signature: setStatus(key: string, text: string | undefined): void */
    setStatus(key: string, text: string | undefined): void;
    /** Real signature: input(title: string, placeholder?: string): Promise<string | undefined> */
    input(title: string, placeholder?: string): Promise<string | undefined>;
  };
  /** Current run mode: "tui" | "rpc" | "json" | "print". */
  mode: string;
  /** Current working directory. */
  cwd: string;
  /** Read-only session manager (real: ReadonlySessionManager). */
  sessionManager: {
    getSessionId(): string;
    getBranch(fromId?: string): unknown[];
  };
  /** Whether the agent is idle (not streaming). */
  isIdle(): boolean;
}

/**
 * FLLWUP-11 — the real ExtensionHandler return shape:
 * `(event, ctx) => Promise<R | void> | R | void` with `R = undefined`
 * (dist/core/extensions/types.d.ts line 974). Handlers may be sync or async
 * and may return a result value; pi-remote's handlers return void, which is
 * assignable to this union.
 */
export type PiExtensionHandler<E, R = undefined> = (
  event: E,
  ctx: PiExtensionContext,
) => Promise<R | void> | R | void;

/** Handler shape for pi SDK events as pi-remote subscribes them. Payloads stay
 * unknown by design: handlers validate fields manually (FLLWUP-5 S-O2
 * discipline) and never trust SDK payload shapes. Structurally assignable to
 * `PiExtensionHandler<unknown>` (the real `(event, ctx) =>
 * Promise<R|void>|R|void` union): the real host passes (event, ctx) and
 * ignores a void return. */
export type PiEventHandler = (event: unknown, ctx: unknown) => void | Promise<void>;

/** pi-remote's own subscription seam. "ui.confirm" is synthetic and
 * fixture-only: the installed SDK has no such event (FLLWUP-5 probe 8);
 * FLLWUP-8 folds it into the ui_prompt_start raise path. */
export type DepsOnEvent = PiSDKOnEvent | "ui.confirm";

/** Type-only negative probe (FLLWUP-9). Never call this function.
 * If `DepsOnEvent`/`PiSDKOnEvent` is ever widened back to `string`, tsc
 * reports TS2578 (unused '@ts-expect-error' directive) and the gate fails. */
export function fllwup9TypeProbe(deps: { on: (event: DepsOnEvent, handler: PiEventHandler) => void }): void {
  const s: string = "agent_start";
  // @ts-expect-error over-broad string event must be rejected by the vendored union
  deps.on(s, () => {});
}
