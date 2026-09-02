# Remote-Control Relay Server — Specification

**Status:** draft · **Audience:** teams implementing a conformant relay server ·
**Conformance keywords:** defined in §1.5

---

## 1. Purpose, scope, and conformance framing

### 1.1 Purpose and audience

This document specifies the server side of a remote-control system for
interactive coding-agent sessions. In this system, one machine — the **host** —
runs an active agent session and dials *out* to a network service, the
**server**. One or more **client devices** — a phone, a tablet, a laptop —
connect to the server and interact with that session remotely: they watch the
agent work and they send input to it.

The reader this document is written for is a **server implementer**: a team
building a server that a host and its client devices can use without either of
them being modified. It is *not* written for the authors of hosts or client
devices, though they may consult it to understand what the server guarantees
them.

**What conformance means here.** A server is conformant when:

1. every wire-level obligation stated with a normative keyword (§1.5) in this
   document is satisfied exactly as stated, and
2. nothing in the server's behavior violates any invariant of §1.4 — in
   particular, the server never does more with a frame than this document
   says it may.

Conformance is about observable behavior on the wire, not about internal
architecture. A conformant server may be built in any language, on any
runtime, with any storage technology (§1.5 — stack neutrality).

### 1.2 The server's single responsibility

The server has exactly one responsibility:

> **Relay standardized frames between a host and the client devices granted
> access to that host's tunnel, and operate the small control plane that
> makes such relaying possible.**

The responsibility has two parts, and the document names them consistently:

- **The data plane** — one long-lived, host-initiated WebSocket connection per
  tunnel. Over it flows a single stream of **standardized frames**, each
  wrapped in a lightweight **envelope** (sequence number, acknowledgement
  pointer, payload — specified fully in the data-plane relay section). The
  server forwards frames between the host and the granted client devices,
  caches a bounded recent window to serve fast catch-up, and does fan-out to
  multiple devices.
- **The control plane** — a small REST surface over HTTPS through which hosts
  enroll, create and delete tunnels, and through which client devices are
  registered and granted access. The control plane is where every security
  decision is made; the data plane is where none are.

**The negative invariant that guards this responsibility** — the single most
important sentence in this document:

> The server MUST NOT inspect, translate, interpret, translate-between, or
> act on the *payload* of any frame beyond what the envelope and the relay
> rules of the data-plane section require. A frame's payload is opaque bytes
> to the server. All translation between the agent session's native event
> stream and the standardized frames happens in the **host client** — the
> software running on the host — never in the server.

A server that "helpfully" converts, filters, enriches, or reformats frame
payloads is non-conformant, regardless of whether the result looks correct.
The reasons are stated in the invariants below, but the rule itself is
absolute and needs no justification to be enforced.

### 1.3 Terminology

| Term | Meaning |
| --- | --- |
| **Host** | The machine running the active agent session. Dials out to the server; never listens for inbound connections. |
| **Host client** | The software on the host that owns the agent session, translates it into standardized frames, and dials the server. |
| **Client device** | A device (browser, phone, desktop app) that connects to the server to observe and drive a host's session. |
| **Tenant** | The administrative unit of access control. Hosts, credentials, and client devices all belong to exactly one tenant. |
| **Tunnel** | One relayed session instance: a (tenant, host session) pair with its own server-assigned identifier and its own data-plane connection. |
| **Frame** | One unit of application data on the data plane. |
| **Envelope** | The small wrapper around every frame carrying sequencing and acknowledgement information. |
| **Control plane** | The HTTPS REST surface for enrollment, tunnel lifecycle, device registration, and grants. |
| **Data plane** | The per-tunnel WebSocket over which frames flow. |

### 1.4 System invariants

These invariants are **normative** and stated here completely, in this
document's own words. Every later section elaborates one or more of them; none
of them may be contradicted by any later section or by any conformant
implementation.

**INV-1 — The data plane relays; it does not compute.**
The server MUST accept and forward standardized frames opaquely. It MAY
cache a bounded recent window of frames to serve fast catch-up, and it MUST
deliver frames to every granted connected client device in the order the host
produced them. It MUST NOT transform, filter, reorder, or generate
application-level frames of its own.

**INV-2 — Translation lives in the host client, including history.**
All conversion between the agent session's native form and the standardized
frames happens in the host client. When a client device needs history older
than the server's cache, the server relays a standard *resync* request to the
host, the host client regenerates the history from its own local store and
re-sends it as ordinary frames, and the server replays or forwards what it
receives. The server MUST NOT reconstruct, synthesize, or translate session
history itself, and it MUST NOT require or retain any knowledge of the agent
session's on-disk format.

**INV-3 — Credentials carry tenancy; frames do not.**
Tenancy travels entirely in credentials, at three contract points: the host's
enrollment credential (issued by the control plane), the tunnel URL's
connection token (signed by the server at tunnel creation), and each client
device's grants (managed in the registry). Each of these binds its bearer to
exactly one tenant. The data-plane frame envelope carries **no** tenant
field: every data-plane connection is bound to exactly one (tenant, tunnel)
pair by the token it dialed with, and the server MUST scope all relaying,
caching, and fan-out state by that binding, never by anything inside the
frame envelope.

**INV-4 — The server is the enforcement point.**
Access control is decided and enforced by the server. Client-device grants
are tenant-scoped and are enforced at fan-out time: the server MUST NOT
deliver data-plane frames for a tunnel to a device whose grant does not cover
it. The host client never authenticates client devices, never sees client
device credentials, and never makes access decisions. Revocation of a device
or credential is a control-plane act that takes effect without host
cooperation.

**INV-5 — Security tokens are short-lived, single-use, and self-describing
where applicable.**
The tunnel connection token embedded in the WebSocket URL MUST be signed,
MUST expire after a short TTL, and MUST be single-use — consumed on successful
connection upgrade and rejected on replay. Where feasible, a token SHOULD be
self-describing: it carries its own claims (tenant, tunnel, expiry) so the
server can authenticate it without lookup state. Enrollment access tokens
MUST be short-lived, with refresh handled through the control plane; refresh
tokens are long-lived and revocable at the control plane.

**INV-6 — The host dials out; it never listens.**
All host connectivity is outbound. The host is a client of the control plane
(HTTPS) and a client of the data plane (WebSocket); the server never connects
to the host, and no conformant deployment requires any inbound reachability
for the host.

### 1.5 Keyword convention (normative vs. non-normative)

This document uses RFC 2119-style keywords, capitalized:

- **MUST / MUST NOT** — an absolute wire or behavioral contract. A conformant
  server satisfies every MUST exactly; violating any MUST NOT is
  non-conformance, with no exception.
- **SHOULD / SHOULD NOT** — a strong default. A conformant server MAY deviate
  only with a concrete, documented reason, and the deviation MUST NOT violate
  any MUST, MUST NOT, or invariant of §1.4.
- **MAY** — a permitted option. Choosing or not choosing it has no conformance
  consequence.

These keywords apply to **wire contracts and conformance requirements**:
message shapes, endpoint behavior, security properties, and the invariants
above. Interoperability between an independent server implementation and an
independent host or client-device implementation is decided solely by the
MUST-level contracts.

**Non-normative guidance.** Wherever this document recommends *how* to build
something — a storage shape, a state machine, a deployment topology — the
recommendation appears in a clearly marked **Guidance (non-normative)** block,
and it offers **one** recommended shape per concern, not a survey of
alternatives. Guidance is advisory: a conformant server may implement the
concern differently, provided every normative contract still holds. Runtimes
and technology choices are at most non-normative examples; nothing in this
document requires a particular language, framework, or database.

**Reading rule.** If a requirement is written with a keyword, it is a contract.
If it is in a Guidance block or introduced by "for example", it is advice.

### 1.6 Document map

The remainder of this document is produced as four sections, in this order.
Each row names the section's content and the reader path it serves.

| § | Section (by content) | What it covers | Reader path |
| --- | --- | --- | --- |
| 2 | **Enrollment and identity** | Endpoint discovery from the server's authorization metadata; both authorization grant flows — the attended browser flow with PKCE for hosts with a browser, and the headless device flow for hosts without one; token issuance and refresh; credential storage requirements on the host side. | *Implementing enrollment:* read fully before writing any token code. The discovery metadata, grant flows, and token lifetimes here are what the rest of the document assumes. |
| 3 | **Tunnel lifecycle** | Tunnel creation over the control plane; the signed, expiring, one-time WebSocket connection URL the creation response hands back; tunnel deletion; and the error taxonomy shared by clients and servers for every control-plane and connection failure. | *Implementing tunnel management:* read §2 first, then this section end to end before implementing the control-plane REST surface; the error taxonomy here is binding on both servers and clients. |
| 4 | **Data-plane relay** | The frame envelope; sequence and acknowledgement accounting; resume and resync relaying; and fan-out to multiple connected client devices. | *Implementing the relay:* read after §3, with INV-1, INV-2, and INV-3 of §1.4 in view at all times; this is the section the negative invariant of §1.2 constrains most directly. |
| 5 | **Device registry, grants, and the server-side trust model** | Client-device registration; tenant-scoped grants; the administrative grant operations that client devices never call themselves; and the closing trust summary — who holds what, and what each component can do. | *Operating and administering a deployment:* read after §4; registry and admin-surface implementers should read it fully, and it is the checklist against which a deployment's security posture is reviewed. |

### 1.7 Reference implementation

Exactly one external reference is made in this entire document, and it is
made here so that every later section inherits precisely this one:

- **Reference implementation:** <https://github.com/jumpseat-inc/pi-remote> —
  a working host-side client that speaks this protocol.

It is a **reference implementation to consult, not a dependency**. Nothing in
this document is correct only because that client behaves a certain way; the
normative contracts above and in the sections that follow stand on their own.
The repository is useful for observing one real, working realization of the
host side of these contracts — how a host client structures its outbound
connection, its envelope handling, and its enrollment — and for
interoperability testing against a known-good peer. Where this document and
that repository appear to disagree, **this document governs**.

---

## 2. Enrollment and identity

A host's identity with the server is an **enrollment credential**: an OAuth2
access token, accompanied by a refresh token, obtained from the server's
authorization server at enrollment time. This section specifies how a host
discovers the authorization server's endpoints, how it enrolls through either
of two grant flows — an attended browser flow for hosts with a browser, and a
headless device flow for hosts without one — how tokens are refreshed, and
what the resulting credentials mean.

The host acts as a **public OAuth2 client**: it holds no client secret, and a
conformant authorization server MUST NOT require one for the flows in this
section. Enrollment is how INV-3 becomes concrete: the issued access token is
bound to exactly one tenant, and every control-plane operation the host
performs afterwards is scoped by that binding, derived from the token alone.
Enrollment access tokens are short-lived (INV-5); refresh tokens are
long-lived and revocable at the control plane.

### 2.1 Authorization server discovery

All enrollment endpoints are discovered, never hardcoded. A host discovers
the authorization server by issuing:

```
GET /.well-known/oauth-authorization-server
```

against the configured control-plane origin, over HTTPS, with no
authentication. The well-known path is appended directly to the origin; a
server MUST serve the discovery document at this exact path. The response on
success is `200` with an `application/json` body shaped like RFC 8414
authorization-server metadata:

| Field | Requirement | Meaning |
| --- | --- | --- |
| `authorization_endpoint` | REQUIRED | Absolute HTTPS URL of the authorization endpoint used by the attended flow (§2.2). |
| `token_endpoint` | REQUIRED | Absolute HTTPS URL of the token endpoint, used by the attended token exchange (§2.2), the headless polling loop (§2.3), and refresh (§2.4). |
| `device_authorization_endpoint` | REQUIRED | Absolute HTTPS URL of the device authorization endpoint used to initiate the headless flow (§2.3). A host that implements only the attended flow MAY ignore this value. |
| `revocation_endpoint` | OPTIONAL | Absolute HTTPS URL of an RFC 7009 revocation endpoint. If present, a host MAY use it to revoke its refresh token on unenrollment; no flow in this document requires it. |

Every value a host uses MUST be an absolute HTTPS URL; the host uses each
value verbatim as the base of the corresponding flow. The document MAY
contain additional fields; a host MUST ignore any field it does not
recognize.

If the request fails, returns a non-200 status, or the response is missing or
empty for any REQUIRED field, discovery has failed: the origin is not a
usable enrollment authority, no enrollment flow may proceed, and the remedy
is to correct the control-plane URL or the server's deployment. A host MUST
NOT fall back to guessed endpoint paths.

> **Guidance (non-normative).** Cache the discovery document per origin for a
> short period, or for the lifetime of the enrollment, and re-fetch only when
> an enrolled host's requests begin failing — the endpoints are stable in
> practice, and discovery is on the path of every token refresh.

### 2.2 Attended flow — authorization code + PKCE

The attended flow enrolls a host that has a browser on the same machine. It
is the authorization code grant with PKCE (RFC 7636), using a loopback
redirect (RFC 8252 native-app pattern). Step by step:

1. **Prepare.** The host generates a `code_verifier` — a high-entropy random
   string of 43–128 characters from the base64url alphabet — and its
   `code_challenge` as `BASE64URL(SHA256(code_verifier))` (the `S256`
   method). It also generates an unpredictable `state` value. It binds a
   loopback HTTP listener on `127.0.0.1` with an **ephemeral** port before
   constructing the redirect URI, so the listener is already accepting when
   the browser returns; the listener lives only for the duration of the
   enrollment attempt.
2. **Open the browser.** The host opens the system browser at
   `authorization_endpoint` with the query parameters below. The request is a
   public-client request: no `client_secret` appears anywhere in the flow.
3. **User consents.** The user authenticates and approves the `pi-remote:host`
   scope request (§2.5). The authorization server redirects the browser to
   the `redirect_uri` with `code` (the authorization code) and `state`.
4. **Validate the redirect.** The host MUST verify that the returned `state`
   equals the one it sent and MUST reject the redirect — with no token
   exchange and no credential written — if it does not, or if the redirect
   arrives at any path or host other than its own loopback listener.
5. **Exchange the code.** The host exchanges the code at the `token_endpoint`
   for the token response (table below).

**Authorize request** — `GET authorization_endpoint` with query parameters:

| Parameter | Value |
| --- | --- |
| `response_type` | `code` |
| `client_id` | `pi-remote` |
| `redirect_uri` | `http://127.0.0.1:<ephemeral-port>/callback` |
| `scope` | `pi-remote:host` |
| `state` | the generated state value |
| `code_challenge_method` | `S256` |
| `code_challenge` | the derived challenge |

A conformant authorization server MUST accept loopback redirect URIs with an
arbitrary port: enrollment uses an ephemeral port each time, so the port
MUST NOT be required to be pre-registered, and redirect URI matching on
loopback URIs MUST ignore the port. The server MUST return the `state` value
unmodified in the redirect.

**Redirect response** — the authorization server redirects the browser to
the `redirect_uri` with query parameters:

| Parameter | Requirement | Meaning |
| --- | --- | --- |
| `code` | REQUIRED | The one-time authorization code, short-lived and single-use. |
| `state` | REQUIRED | The exact value sent in the authorize request. |

**Token request** — `POST token_endpoint`, body
`application/x-www-form-urlencoded`:

| Parameter | Value |
| --- | --- |
| `grant_type` | `authorization_code` |
| `code` | the authorization code from the redirect |
| `code_verifier` | the generated verifier |
| `redirect_uri` | the same redirect URI used in the authorize request |
| `client_id` | `pi-remote` |

**Token response (success)** — `200` with an `application/json` body:

| Field | Requirement | Meaning |
| --- | --- | --- |
| `access_token` | REQUIRED | The enrollment access token; its claims are specified in §2.6. |
| `token_type` | REQUIRED | `Bearer`. |
| `expires_in` | REQUIRED | Access-token lifetime in seconds. Short-lived (INV-5). |
| `refresh_token` | REQUIRED | The long-lived refresh token used by §2.4 and revocable at the control plane (INV-5). |

The tenant-scoped identity is not a separate response field: it arrives as
claims inside the access token (§2.6).

A failed exchange is answered with `400` and an RFC 6749 §5.2-shaped error
body (`{"error": "…", "error_description": "…"}`); an unknown, expired,
replayed, or already-used code, or a verifier that does not match the
challenge, is `invalid_grant`. A failed exchange issues no credential.

### 2.3 Headless flow — device authorization grant

The headless flow enrolls a host with no browser on the machine. It is the
device authorization grant (RFC 8628): the host obtains a device code and a
short user code, relays them to a second device with a browser, and polls
the token endpoint until the user completes authorization. Step by step:

1. **Initiate.** The host issues `POST device_authorization_endpoint`, body
   `application/x-www-form-urlencoded`, with parameters:

   | Parameter | Value |
   | --- | --- |
   | `client_id` | `pi-remote` |
   | `scope` | `pi-remote:host` |

2. **Device authorization response** — `200` with an `application/json`
   body:

   | Field | Requirement | Meaning |
   | --- | --- | --- |
   | `device_code` | REQUIRED | The device verification code; presented by the host at the token endpoint while polling. |
   | `user_code` | REQUIRED | The short code the user enters on the second device. |
   | `verification_uri` | REQUIRED | Absolute HTTPS URL where the user enters `user_code`. |
   | `verification_uri_complete` | OPTIONAL | Absolute HTTPS URL embedding the `user_code`, so the user can open it directly without typing. A host SHOULD relay it when present. |
   | `expires_in` | REQUIRED | Lifetime of `device_code` and `user_code` in seconds. |
   | `interval` | REQUIRED | Minimum number of seconds the host MUST wait between polling requests. |

3. **Relay to the user.** The host displays `user_code` together with
   `verification_uri` (or `verification_uri_complete` when available). The
   user opens the verification URL on any browser-equipped device, enters the
   code, authenticates, and approves the `pi-remote:host` scope request
   (§2.5) — or refuses it.
4. **Poll.** The host repeatedly issues `POST token_endpoint`, body
   `application/x-www-form-urlencoded`, waiting `interval` seconds between
   requests:

   | Parameter | Value |
   | --- | --- |
   | `grant_type` | `urn:ietf:params:oauth:grant-type:device_code` |
   | `device_code` | the device code from the response above |
   | `client_id` | `pi-remote` |

   While the user has not yet completed the step above, the token endpoint
   answers with `400` and an `application/json` body
   `{"error": "…", "error_description": "…"}` whose `error` value is one of
   the four below, exactly:

   | `error` | Meaning | Host behavior |
   | --- | --- | --- |
   | `authorization_pending` | The user has not completed authorization. | Keep polling at the unchanged interval. |
   | `slow_down` | The host is polling faster than allowed. | Increase the polling interval by 5 seconds (the RFC 8628 backing-off rule) and keep polling. |
   | `expired_token` | The device code has expired. | Terminal: the flow has failed; enrollment restarts from step 1 with a fresh device authorization. |
   | `access_denied` | The user refused the request. | Terminal: abort enrollment; no credential is issued. |

5. **Success.** Once the user approves, the next poll returns `200` with the
   same token response shape as the attended flow (§2.2): `access_token`,
   `token_type`, `expires_in`, `refresh_token` — all REQUIRED, with the same
   meanings. The tenant-scoped identity arrives as claims inside the access
   token (§2.6).

A `device_code` is single-use: after the grant succeeds, fails terminally, or
expires, further polls presenting it are rejected.

### 2.4 Token refresh

There is **no separate refresh endpoint**. An enrolled host refreshes its
access token at the `token_endpoint` discovered in §2.1, with body
`application/x-www-form-urlencoded`:

| Parameter | Value |
| --- | --- |
| `grant_type` | `refresh_token` |
| `refresh_token` | the host's current refresh token |
| `client_id` | `pi-remote` |

**Response (success)** — `200` with an `application/json` body:

| Field | Requirement | Meaning |
| --- | --- | --- |
| `access_token` | REQUIRED | The new access token, with the claims of §2.6 and the same tenant binding as before. |
| `token_type` | REQUIRED | `Bearer`. |
| `expires_in` | REQUIRED | Lifetime of the new access token in seconds. |
| `refresh_token` | OPTIONAL | Present only when the server rotated the refresh token (rule below). |

**Refresh-token rotation — the normative rule:** the server MAY rotate the
refresh token on each refresh. When it rotates, it MUST include the new
`refresh_token` in the response and MUST reject the previously issued refresh
token from that point on; exactly one refresh token is live per enrollment at
any time. When it does not rotate, it MUST NOT include a `refresh_token`
field. The host MUST replace its stored refresh token whenever the response
carries one and MUST keep the existing one when it does not. A host that
presents a rotated-out refresh token is treated per §2.7.

A refresh request presenting an invalid, expired, or revoked refresh token
MUST be answered with `401` per §2.7 — the refresh token is a credential, and
the only remedy is re-enrollment. (This deliberately overrides the generic
`invalid_grant` treatment for the refresh credential specifically: the status
code is what selects the client's remedy, and a rejected refresh token is
never recoverable by retrying.) A malformed request — missing parameters, an
unknown `grant_type` — is answered with `400` and an RFC 6749 §5.2-shaped
error body, and is recoverable by correcting the request.

### 2.5 The scope: `pi-remote:host`

Enrollment requests exactly one scope, in both flows: `pi-remote:host`.

The scope authorizes **host-side tunnel operations**: every control-plane
operation this document specifies for an enrolled host — creating tunnels,
deleting them at teardown, and obtaining the data-plane connection URL that
tunnel creation hands back (specified in §3). It authorizes nothing else: it
does not confer any client-device capability, any administrative capability,
or any access to other hosts' tunnels.

Both grant flows request the scope explicitly (`scope=pi-remote:host` in the
authorize request and in the device authorization request). The server MAY
grant it subject to its own administrative policy. A token issued without it
is a valid credential that is **insufficient** for tunnel operations: requests
presenting it are answered with `403` per §2.7, whose remedy is re-consent
(re-running enrollment so the user sees the scope request again) combined
with an administrator grant of the scope — the administrative surface that
governs scope grants belongs to the registry section (§5) and is not
specified here.

### 2.6 Access-token claims and tenant binding

Enrollment access tokens are self-describing (INV-5): they are JSON Web
Tokens — three dot-separated base64url segments — carrying the claims below.
The server validates each presented access token by verifying its signature,
checking `exp` (and `iat` where present) against its clock, and reading
`tenant_id` and `scope`.

| Claim | Requirement | Meaning |
| --- | --- | --- |
| `sub` | REQUIRED | The tenant-scoped subject: unique within the tenant named by `tenant_id`, and namespaced by that tenant identifier, so a subject string is never ambiguous across tenants. This is the host's identity within its tenant. |
| `tenant_id` | REQUIRED | The identifier of the exactly one tenant this token is bound to (INV-3). |
| `scope` | REQUIRED | The space-separated granted scopes; an enrollment token includes `pi-remote:host` (§2.5). |
| `exp` | REQUIRED | Expiry, in seconds since the epoch. Enrollment access tokens are short-lived (INV-5). |
| `iss` | SHOULD | The issuer identifier of the authorization server. |
| `iat` | SHOULD | Issue time, in seconds since the epoch. |

**Tenancy is derived from the token.** For every control-plane request
authenticated by an enrollment access token, the server MUST derive the
operating tenant solely from the token's `tenant_id` claim, and MUST NOT
accept tenant identity from any request parameter, header, or body field.
All tunnel state created, read, or deleted by the request is scoped to that
tenant. This is the enrollment-credential contract point of INV-3: the
credential carries the tenancy, so the wire protocol itself needs no tenant
field.

**Scope checking is not authentication.** A token whose signature and expiry
verify but whose `scope` lacks `pi-remote:host` is authenticated and
insufficient: such requests are answered `403` per §2.7, never `401`. Only a
token that fails signature, expiry, or issuer validation — or an absent,
malformed, or revoked credential — is `401`.

> **Guidance (non-normative).** A concrete `sub` namespacing that satisfies
> the requirement is `<tenant_id>/<account-id>`; a short-lived access token of
> five to fifteen minutes bounds the usable window of a leaked token while
> keeping the refresh cadence of §2.4 unobtrusive.

### 2.7 Error semantics: 401 and 403

Control-plane authentication failures use exactly two status codes, and they
are not interchangeable. The status code alone is the contract the host acts
on — a host MUST be able to choose its remedy from the status code without
parsing the body. The body exists for diagnostics:

```
{"error": "<code>", "error_description": "<human-readable sentence>"}
```

| Status | Meaning | `error` value | Applies to | Client-consumed remedy |
| --- | --- | --- | --- | --- |
| `401` | The credential is invalid, expired, or revoked — it does not authenticate. | `invalid_token` | Every control-plane request carrying an enrollment access token (`Authorization: Bearer …`), and a refresh request presenting a rejected refresh token (§2.4). | **Re-enrollment** — the only remedy. No retry, refresh, or re-consent recovers the credential. |
| `403` | The credential is valid but insufficient: it lacks the `pi-remote:host` scope (§2.5). | `insufficient_scope` | The same authenticated requests, when scope is the only deficiency. | **Re-consent** — re-run enrollment so the user sees the scope request again — plus an administrator grant of the scope (administrative surface in §5). |

The conformance rule, stated once and binding:

> A server that returns `401` for a scope problem, or `403` for an invalid,
> expired, or revoked credential, is **non-conformant**. The two status codes
> MUST NOT be merged, substituted for one another, or used interchangeably,
> because the client's remedy — and therefore the user's next action — is
> selected entirely by the status code.

Token-endpoint grant failures other than the refresh-credential rejection of
§2.4 — a malformed request, an unknown grant type, a bad or expired
authorization code or device code — are `400` responses with RFC 6749
§5.2-shaped bodies and are recoverable by re-running the affected flow; they
are enrollment-time failures, not credential-state changes.

### 2.8 The host-side credential

On success, either flow yields the enrollment credential the host persists
for its own use, consisting of: the control-plane server URL it enrolled
against; the access token; the refresh token; the access token's absolute
expiry time (computed from `expires_in` at issuance); and the tenant
identifier cached from the token's claims. The cached tenant identifier is
informational — the server's authorization decision always derives tenancy
from the presented token itself (§2.6), never from the stored cache.

The access token is short-lived; the refresh token is long-lived and
revocable at the control plane (INV-5) — revocation is a control-plane act
that takes effect without host cooperation (INV-4). Host-side storage is the
host's responsibility: the server-facing requirement is only that the
credential is persisted in user-private storage, not in any shared,
global, or environment-variable location, and that re-running enrollment
replaces the stored credential in full rather than merging with it.
