/**
 * FLLWUP-4 — the localization seam: the Bahasa Indonesia message overlay, a
 * module-level locale, and the three-valued fallback resolver.
 *
 * This module is deliberately below both `tunnel.ts` and `login.ts` in the
 * import graph: it imports nothing from the repo, so there is no cycle. The
 * resolver takes the English table as a parameter — English stays
 * single-sourced in `tunnel.ts`/`login.ts`.
 *
 * COVERAGE BOUNDARY (product-owner ruling OJ2 — announced at the surface):
 * `indonesianCopy` covers exactly the 22 keys consumed by `englishFor`
 * (tunnel.ts) and `loginEnglishFor` (login.ts): the 6 `tunnelReasonCopy`
 * user-line keys, the 7 `status.*` footer rows, the 3 transport-side
 * `tunnel.error.*` rows, and the 6 command-output rows (`rc.unenrolled`,
 * `rc.serverUrlRequired`, `rc.dialingInProgress`, `rc.offLifecycle`,
 * `shutdown.closed`, `rc:login.refusal`).
 *
 * Remaining English under every locale, by design (missing keys fall back to
 * the English default, never crash):
 * - the 28 login-flow rows (`login.attended.*`, `login.headless.*`,
 *   `login.failure.*`, `login.cancelled`, `login.alreadyRunning`,
 *   `login.replacementPrompt`),
 * - the keyless constants `ALREADY_LIVE_COPY` and
 *   `ACL_ENFORCEMENT_FAILED_NOTICE` (ruled verbatim by prior rulings; they
 *   change only through their own cards),
 * - the keyless `inputPrompt` literal at `index.ts:542`.
 *
 * Locale sourcing (ruling OJ3, applied at the entry point in `index.ts`):
 * `PI_REMOTE_LOCALE` env → `piRemote.locale` setting → fail-open `"en"`.
 * `setLocale` normalizes anything not exactly `"id"` to `"en"`.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CopyLocale = "en" | "id";

// ---------------------------------------------------------------------------
// The Bahasa Indonesia overlay — exactly the 22 settled keys, all non-empty.
// ---------------------------------------------------------------------------

export const indonesianCopy: Partial<Record<string, string>> = {
  // tunnelReasonCopy user-line keys (tunnel.ts)
  "tunnel.error.unauthenticated":
    "Enrollment kedaluwarsa atau dicabut — jalankan /rc:login",
  "tunnel.error.forbidden":
    "Host ini tidak memiliki scope pi-remote:host — jalankan /rc:login untuk consent ulang; jika scope tetap belum diberikan, minta admin control-plane untuk memberikannya",
  "tunnel.error.unreachable":
    "Control plane tidak dapat dijangkau di `<serverUrl>` — periksa jaringan Anda dan coba lagi",
  "tunnel.error.serverError":
    "Control plane mengembalikan server error — coba lagi",
  "tunnel.error.teardownFailed":
    "Gagal memberi tahu control plane tentang penutupan tunnel",
  "tunnel.error.invalidResponse":
    "Control plane mengembalikan respons tunnel yang tidak valid",
  // status.* footer rows (login.ts FOOTER_ROWS)
  "status.off": "Mati",
  "status.notEnrolled": "Belum ter-enrollment — jalankan /rc:login",
  "status.authorizing": "Otorisasi dengan control plane…",
  "status.dialing": "Menyambungkan tunnel remote…",
  "status.resyncing": "Menyinkronkan ulang dengan sesi remote…",
  "status.live": "Live — sesi remote terhubung",
  "status.error": "Error",
  // transport-side tunnel.error.* rows (login.ts FOOTER_ROWS)
  "tunnel.error.relayUnreachable":
    "Tidak dapat menjangkau relay — tunnel sedang menyambung ulang",
  "tunnel.error.protocolViolation":
    "Relay melanggar protokol — tunnel sedang menyambung ulang",
  "tunnel.error.urlExpired": "URL tunnel kedaluwarsa — jalankan /rc untuk dial ulang",
  // command-output rows (login.ts FOOTER_ROWS)
  "rc.unenrolled": "Kredensial enrollment tidak ditemukan — jalankan /rc:login",
  "rc.serverUrlRequired": "URL control-plane belum dikonfigurasi — jalankan /rc:login",
  "rc.dialingInProgress": "Proses dial tunnel sedang berjalan — tunggu hingga selesai",
  "rc.offLifecycle": "Tunnel remote ditutup",
  "shutdown.closed": "Tunnel remote ditutup",
  "rc:login.refusal": "tutup tunnel dulu dengan /rc:off",
};

// ---------------------------------------------------------------------------
// Locale (module-level mutable, set once at entry-point load —
// `loginEndpointRequestLog` precedent) and the resolver.
// ---------------------------------------------------------------------------

let locale: CopyLocale = "en";

/** Normalize any raw locale value: only the exact string "id" selects id. */
export function setLocale(raw: unknown): void {
  locale = raw === "id" ? "id" : "en";
}

export function getLocale(): CopyLocale {
  return locale;
}

/**
 * Three-valued fallback: under id locale, an id-table hit wins; otherwise the
 * English default from the passed table; otherwise the raw key is echoed
 * (today's unknown-key behavior, unchanged). English never crashes on a
 * missing key — partial coverage is safe by construction.
 */
export function resolveCopy(
  key: string,
  englishTable: Record<string, string>
): string {
  if (locale === "id") {
    const id = indonesianCopy[key];
    if (id !== undefined) return id;
  }
  return englishTable[key] ?? key;
}

/**
 * Replace `<name>` placeholders in a resolved line with the given values
 * (same semantics as login.ts's `render`). A sub whose value is `undefined`
 * is skipped, so the placeholder survives when no value is available.
 */
export function renderCopy(
  line: string,
  subs: Record<string, string | undefined>
): string {
  let out = line;
  for (const [k, v] of Object.entries(subs)) {
    if (v !== undefined) out = out.replaceAll(`<${k}>`, v);
  }
  return out;
}
