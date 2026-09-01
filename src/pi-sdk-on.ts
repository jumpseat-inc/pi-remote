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

/** Handler shape for pi SDK events. Payloads stay unknown by design:
 * handlers validate fields manually (FLLWUP-5 S-O2 discipline) and never
 * trust SDK payload shapes. */
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
