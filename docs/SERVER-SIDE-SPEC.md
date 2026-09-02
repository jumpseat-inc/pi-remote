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
access token at the `token_endpoint` discovered in §2.1, with an
`application/json` body of exactly two fields:

| Field | Value |
| --- | --- |
| `grant_type` | `refresh_token` |
| `refresh_token` | the host's current refresh token |

Both fields are REQUIRED. The request carries no `client_id`: the client is
public, the presented refresh token itself identifies the enrollment, and a
conformant server MUST NOT require `client_id` on a refresh request.

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

---

## 3. Tunnel lifecycle

This section specifies how an enrolled host creates a tunnel, how the create
response hands back the one connection URL that tunnel will ever accept, how
the data plane consumes that URL's token at the WebSocket upgrade, how a
tunnel is deleted, and the error taxonomy that binds every failure on these
surfaces. It builds directly on §2: every request in it is made with an
enrollment access token (§2.6), authorized by the `pi-remote:host` scope
(§2.5), and answered under the error-body and 401/403 contract of §2.7.

### 3.1 Tunnel objects and lifecycle

A **tunnel** is a (tenant, host session instance) pair carrying a
server-assigned identifier, `tunnelId`: an opaque, URL-safe string, globally
unique across all tenants. A tunnel is not a configuration object and not a
session record; it exists to admit exactly one data-plane connection.

The lifecycle is normative and linear:

> *created* (the create request of §3.2 succeeds) → *live* (its single
> connection token is consumed at a successful WebSocket upgrade, §3.4) →
> *spent* (that connection has ended) or *deleted* (§3.5).

Exactly one connection token is issued per tunnel, and exactly one successful
upgrade is ever admitted per tunnel. A spent tunnel is never re-connectable:
any further connection — a reconnect, a retry, a second dial — requires a new
create request and a new token.

**"Live" is a socket state, not a record.** A tunnel is live if and only if
its host data-plane WebSocket is currently connected. The server's judgment
of liveness MUST be made on this socket state, never on the existence of a
stored tunnel row: a socket that has closed, or that fails the server's
liveness detection, MUST be treated as not live. This definition is what
makes the no-double-create rule of §3.2 implementable without deadlocking a
host that crashed and restarted: its fresh create arrives with no prior
delete on the wire (its best-effort teardown notification was lost with the
crash), and it succeeds precisely because the crashed tunnel's socket is no
longer connected.

**The connection token is self-describing in one precise sense: no lookup is
required to interpret the token's claims.** The tenant, tunnel, session,
expiry, and single-use identity are read off the verified token itself
(§3.3). Two bounded pieces of server state are nevertheless REQUIRED, and
they are not exceptions to that sentence: the set of consumed token
identifiers (`jti` values), which enforces single-use consumption (§3.4),
and the live-tunnel existence record, which rejects dials to absent or
deleted tunnels (§3.4) and answers delete requests (§3.5). Neither is
consulted to interpret a claim; each enforces a stateful rule that a signed
claim cannot express by itself.

### 3.2 Tunnel creation — `POST /tunnels`

The path is fixed: `POST /tunnels` on the configured control-plane origin
(the origin against which discovery in §2.1 was performed). Control-plane
endpoints are not discovered; only the authorization-server endpoints of
§2.1 are. The request MUST carry `Authorization: Bearer <access token>` with
an enrollment access token; the semantics of §2.6 and §2.7 govern. Tenancy
is derived solely from the token's `tenant_id` claim (§2.6): the request
carries no tenant field, and a server MUST ignore any tenant-like request
field a host sends anyway.

**Request body** — `application/json`. All four fields are REQUIRED, with
these exact wire names:

| Field | Requirement | Meaning |
| --- | --- | --- |
| `sessionId` | REQUIRED | Non-empty string; the host session's stable identifier. Treated as opaque by the server. |
| `sessionName` | REQUIRED | Non-empty string; display name; informational. |
| `cwd` | REQUIRED | Non-empty string; informational; the server MUST NOT interpret it. |
| `hostMetadata` | REQUIRED | JSON object with string keys and string values; MAY be empty; informational. |

A server MUST reject — with `400 invalid_request` — a missing or unparseable
body, a missing or wrong-typed field, or a `hostMetadata` that is not an
object. A server MUST accept all values within the following maxima and MAY
reject values beyond them with `400 invalid_request`: `sessionId` at most
128 characters, `sessionName` at most 256, `cwd` at most 1024, and
`hostMetadata` at most 32 entries with keys and values at most 256
characters. (The accept-within/reject-beyond rule is normative; these
specific maxima are guidance-grade, per §1.5.) Unknown request fields MUST
be ignored. The request carries **no TTL field**: the connection token's
lifetime is the server's choice (§3.3), and a conformant server MUST NOT
honor any TTL supplied in the body.

`sessionId`, `sessionName`, `cwd`, and `hostMetadata` are retained as tunnel
metadata and made available to the client devices granted access to the
tunnel; the server never interprets them — the same opacity the data plane
owes frame payloads (INV-1), extended to creation-time metadata.

**Response (success)** — `200` with an `application/json` body. All three
fields are REQUIRED. The status is `200`, not `201`: there is one response
shape.

| Field | Requirement | Meaning |
| --- | --- | --- |
| `tunnelId` | REQUIRED | Server-assigned tunnel identifier: opaque, globally unique, and URL-safe — unreserved URL characters only. |
| `url` | REQUIRED | The absolute `wss://` connection URL, specified in §3.3. |
| `tokenTtl` | REQUIRED | Positive integer seconds, equal to the issued token's actual validity window: the token's `exp` minus its mint time. |

**No double create.** The rule is normative on both sides, and asymmetric.

- *Host-side expectation (normative).* A host MUST NOT issue a second create
  request while a tunnel it created is live. Its correct behavior, on
  deciding it wants a connection it already has, is a local no-op plus a
  notification that a tunnel is already active — not a second create.
- *Server-side enforcement (MUST).* A server MUST reject with
  `409 tunnel_already_live` a create that would produce a second **live**
  tunnel for the same (tenant, `sessionId`) pair — live per §3.1's
  socket-state definition. A tunnel that was never connected and a tunnel
  whose connection has ended MUST NOT block a create.
- *Rationale.* Issuing a fresh tunnel on collision would let a crashed and
  restarted host fork the single ordered frame stream across two live
  sockets, violating INV-1's requirement that frames be delivered in the
  order the host produced them.
- *Deadlock freedom.* Because the key is socket state, the reachable
  collision cases self-heal: a crashed host's stale socket is no longer
  connected (or fails liveness detection), so its fresh create succeeds even
  though its teardown delete never arrived; a half-open socket is reaped by
  the same liveness detection. A host that still receives
  `409 tunnel_already_live` — for example, against a briefly stale half-open
  socket — treats it as retryable: it re-creates with backoff, per §3.6.
- *Prior tokens.* A new create for a session MAY supersede (invalidate) any
  prior connection token for that session that was never consumed. Because
  tokens are single-use and short-lived (§3.3), superseding is a
  server-internal detail: it is never observable on the wire, and no host
  behavior depends on whether the server does it.

> **Guidance (non-normative).** Reap unresponsive data-plane sockets
> promptly: an idle-timeout ping well under the connection token's TTL
> bounds the window in which a crashed host's socket still counts as live —
> and with it, the duration of `409 tunnel_already_live` collisions.

### 3.3 The signed one-time connection URL

The create response's `url` field has the shape:

```
wss://<data-plane host>/<tunnelId>?token=<token>
```

The following are normative:

- The scheme MUST be `wss`. A server MUST NOT issue a `ws://` URL.
- The token rides in exactly one query parameter, named `token`.
- The final segment of the URL path MUST equal the `tunnelId` returned in
  the same response.
- The authority (the data-plane host) MAY differ from the control-plane
  origin: a dedicated data-plane host is permitted. A host uses the URL
  verbatim; it never reconstructs a connection URL from its parts.
- The URL carries no userinfo and no fragment.

The token is a **compact JWS**: three dot-separated base64url segments,
signed with a key held by the server. Hosts never hold signing keys. Because
the token is signed, its claims are read directly off the verified token —
claim verification requires no lookup (§3.1). Claim names are snake_case,
consistent with the access-token claim table of §2.6:

| Claim | Requirement | Meaning |
| --- | --- | --- |
| `tenant_id` | REQUIRED | MUST equal the creating enrollment token's `tenant_id` — the connection-token contract point of INV-3. |
| `tunnel_id` | REQUIRED | MUST equal the final segment of the URL path. |
| `session_id` | REQUIRED | Echo of the create request's `sessionId`. |
| `exp` | REQUIRED | Expiry, in seconds since the epoch. |
| `jti` | REQUIRED | Unique per issued token; the single-use consumption identity (§3.4). |
| `iat`, `iss`, `aud` | SHOULD | Standard JWT provenance claims. |

**TTL.** The default validity window is 60 seconds (SHOULD). The normative
bounds: an issued TTL MUST be at least 5 seconds and at most 300 seconds. A
configured value outside the bounds clamps to the nearest bound — a
misconfigured value yields a workable token, not a boot failure. The
`tokenTtl` returned in the create response MUST equal the issued token's
actual validity window (`exp` minus mint time). Expiry is judged by the
**server's clock**, at the upgrade, and only there; a server MUST NOT rely
on any host clock. A host's own pre-dial expiry check is advisory — a local
convenience that avoids a doomed request, never a server-reported fact.

> **Guidance (non-normative).** Sign with an asymmetric key pair and rotate
> it, so token verification can be delegated to data-plane replicas without
> sharing the signing capability. The consumed-`jti` record need only live
> until the token's `exp` plus a small leeway; past that point, expiry
> rejection alone covers the token, and the store garbage-collects itself.

### 3.4 Token consumption at the WebSocket upgrade

The upgrade is the WebSocket opening handshake: an HTTP `GET` issued against
the connection URL of §3.3. Authentication happens strictly before the
`101` response: a server MUST NOT accept the upgrade and reject the token
afterwards — by then the capability has already been spent.

The server performs the checks below, in order, and then consumes the token
atomically. The first check is a question about the request's shape; every
later check is a question about whether the credential authenticates. That
is the `400`/`401` boundary, stated crisply: a request from which no token
can be extracted is `400 invalid_request`; a request carrying a token that
fails any authentication step is `401 invalid_token`.

1. **Extract the token.** URL-level malformation — a wrong scheme, a missing
   or duplicated `token` query parameter, a path whose final segment cannot
   be read — yields `400 invalid_request`.
2. **Verify the signature.** Failure yields `401 invalid_token`.
3. **Check expiry.** The `exp` claim is compared against the server's clock;
   an expired token yields `401 invalid_token`.
4. **Verify the bindings.** The tunnel identifier in the URL path must equal
   the token's `tunnel_id` claim, and the live-tunnel existence record must
   show the tunnel present and not deleted. A binding mismatch yields
   `401 invalid_token`; an absent or deleted tunnel yields
   `404 unknown_tunnel`.
5. **Consume the token.** The `jti` is marked consumed **atomically** before
   the `101` is sent. Two simultaneous upgrades presenting one token admit
   exactly one `101`; the other receives the replay rejection.

**The handshake's status partition is closed:** `{101, 400, 401, 404, 409,
5xx}`. A server emitting any other status on this surface is
non-conformant.

| Status | `error` | Failure |
| --- | --- | --- |
| `400` | `invalid_request` | No extractable token: the URL is malformed at the request-shape level. |
| `401` | `invalid_token` | The single code for every does-not-authenticate case: bad signature, expired, malformed token, binding mismatch. |
| `404` | `unknown_tunnel` | The token authenticates, but the tunnel is deleted or never existed. No existence leak: a dialer without a valid signature is rejected `401` before any tunnel lookup occurs. |
| `409` | `token_consumed` | Replay: the token's consumed state conflicts with the single-use rule. (`403` is pinned to exactly one meaning — insufficient scope, §2.7 — and a spent token is not that; `409` is the state-conflict status uniformly, here as in `tunnel_already_live`.) |

These statuses are diagnostic for operators. The dialing side treats any
non-`101` result as a failed handshake with one uniform remedy — create a
fresh tunnel and dial again — and does not parse handshake statuses or
response bodies. The handshake's 401/403 axis *mirrors* §2.7's (401 = does
not authenticate; 403 would mean authenticates-but-lacks-authorization), but
this is the data plane's own contract with its own codes: §2.7's
`insufficient_scope` meaning is never read onto this surface, and `403` is
not in the handshake's partition. Post-upgrade socket close codes are the
data plane's business (§4) and are out of scope here.

### 3.5 Tunnel deletion — `DELETE /tunnels/{tunnelId}`

Deletion is bearer-authenticated with the enrollment access token; tenancy
is derived from the token (§2.6). Deletion is **idempotent**.

**Success** is `204 No Content` with no body. A tunnel id that is unknown,
already deleted, or belongs to another tenant is `404` — never `403`, so no
cross-tenant existence leak exists, and a repeated delete is
indistinguishable from a first success. The not-found treatment is
`404`-only: no `410`, and no deletion tombstone. The absence of the
live-tunnel existence record **is** the `404`; discarding token state means
literal discard.

On success the server MUST do all of the following:

a. Invalidate any un-consumed connection token for that tunnel; subsequent
   upgrade attempts presenting it are rejected per §3.4's ordered checks.
b. Close the live data-plane connection, if one exists, with a normal
   WebSocket close (the close code is §4's business).
c. Release tunnel-scoped relay state: the cached recent frame window and any
   fan-out registrations for the tunnel.

No retained record of a deleted tunnel is required. Deletion is permanent:
the same session returns only via a fresh create request. The status
partition is closed: `{204, 401, 403, 404, 5xx}`.

A failed delete notification is safe to ignore. A server SHOULD expire spent
and abandoned tunnels itself, so a host that proceeds with local teardown
despite a failed notification leaves no orphan behind.

### 3.6 Error taxonomy

The error-body shape of §2.7 — `{"error": "<code>",
"error_description": "<human-readable sentence>"}` — and its never-merge
401/403 rule extend to every non-2xx response in this section, on both
surfaces. The vocabulary: `invalid_token` and `insufficient_scope` are
inherited from §2.7; this section defines `invalid_request` (`400`),
`tunnel_not_found` (`404`, delete), `unknown_tunnel` (`404`, handshake),
`tunnel_already_live` (`409`, create), `token_consumed` (`409`, handshake),
and `internal_error` (`5xx`).

**Closed status partitions (normative):**

| Surface | Partition |
| --- | --- |
| Create (`POST /tunnels`) | `{200, 400, 401, 403, 409, 5xx}` |
| Delete (`DELETE /tunnels/{tunnelId}`) | `{204, 401, 403, 404, 5xx}` |
| Handshake (§3.4) | `{101, 400, 401, 404, 409, 5xx}` |

A server emitting any other status on these surfaces is non-conformant.
`429` is in none of them: a conformant server that rate-limits maps
throttled requests onto members of the relevant partition above, and a
server that emits `429` on any of these surfaces is non-conformant.

**The two credential failure classes — never merged:**

| Status | `error` | Meaning | Remedy |
| --- | --- | --- | --- |
| `401` | `invalid_token` | The credential is invalid, expired, or revoked — it does not authenticate. | **Re-enrollment.** No retry, refresh, or re-consent recovers the credential. |
| `403` | `insufficient_scope` | The credential is valid but lacks the `pi-remote:host` scope. | **Re-consent** — re-run enrollment so the user sees the scope request — plus an administrator grant of the scope (administrative surface in §5). |

A server that returns `401` for a scope problem, or `403` for an invalid,
expired, or revoked credential, is non-conformant — §2.7's rule, restated
here and extended to this section.

**Surface disambiguation of 401.** A `401` at a control-plane tunnel endpoint
means the enrollment credential is dead — the remedy is re-enrollment. A
`401` at the data-plane handshake means the connection token is unusable —
the remedy is to re-create the tunnel. The same status, a different
credential, a different remedy: the surface disambiguates them, and each
surface individually keeps §2.7's rule that the status alone selects the
remedy.

**The failure classes a dialing side distinguishes, restated in this
document's own words:**

1. **Invalid, expired, or revoked credential** — a control-plane `401`
   (`invalid_token`): the remedy is re-enrollment.
2. **Valid credential, insufficient scope** — `403` (`insufficient_scope`):
   the remedy is re-consent plus an administrator grant.
3. **Connection-layer failure** — DNS, TCP, or TLS failure; the request
   never completes, so no HTTP status exists and no server obligation can be
   stated: the remedy is to check the network and retry.
4. **Response-shape defense** — a 2xx body deviating from §3.2's or §3.5's
   shapes is emitted only by a non-conformant server. A conformant server
   MUST NOT emit partial success: a 2xx response MUST never carry an error
   body, and a 4xx or 5xx response MUST never carry a usable tunnel.
5. **Failed delete notification** — on the delete surface, only `5xx` can
   produce it; the host reports the failure and proceeds with local teardown
   regardless, which is safe by §3.5's expiry rule.
6. **Handshake failure** — any non-`101` result in §3.4's closed set; one
   uniform remedy: re-create the tunnel and dial again.

**Coarse grouping on the host side.** The taxonomy carries an asymmetry
between the two control-plane surfaces. On create, `400`, `409`, and `5xx`
all land in one generic retryable class: correcting the request is *not* a
distinct remedy rendered for `invalid_request`, and the remedy for
`tunnel_already_live` — for a conformant host — is the same retry with
backoff. On delete, `5xx` lands in a distinct, non-blocking teardown-failure
class: the host reports the notification failure and proceeds with local
teardown, and never retries the delete.

---

## 4. Data-plane relay

This section specifies the data plane: the long-lived, host-initiated
WebSocket connection of §3.1 over which the server relays standardized frames
between the host and the granted connected client devices. It specifies the
envelope's two directional shapes, the sequence and acknowledgement accounting
that makes one ordered stream per direction possible, the resume and resync
control frames and their handshake, the ring buffer that serves fast
catch-up, fan-out to multiple devices, and the liveness and close-code rules —
the two forward references §3.4 and §3.5(b) make to this section resolve in
§4.8.

Three invariants of §1.4 govern everything below — INV-1 (the data plane
relays; it does not compute), INV-2 (translation lives in the host client,
including history), and INV-3 (credentials carry tenancy; frames do not) —
and the negative invariant of §1.2 is this section's ceiling: the server
reads the envelope, and nothing else.

### 4.1 Scope and the two streams

One long-lived, host-initiated WebSocket per tunnel (§3.1) carries the entire
data plane. Over it flow two logical streams, each with exactly one producer:

- **The downlink** — host → server → devices. The host is the single
  producer: every application frame on this stream originates at the host.
- **The host-bound stream** — devices → server → host. The server is the
  single producer: it multiplexes input from all granted connected devices
  into one ordered stream, so the host receives one total order regardless of
  how many devices produced it.

The population of *granted connected devices* is defined by the registry and
grants section (§5); this section specifies only how relay behavior interacts
with grants. Two restatements bound what follows: the server relays and never
computes (INV-1), and all conversion between the agent session's native form
and the standardized frames happens in the host client (INV-2).

### 4.2 The envelope, per direction

The envelope is a JSON object. Its key set is specified per direction, and
the two directions differ in exactly one key:

| Key | Downlink (host → server) | Host-bound (server → host) | Meaning |
| --- | --- | --- | --- |
| `v` | REQUIRED | REQUIRED | Envelope grammar version; `1` in this document (§4.4). |
| `seq` | REQUIRED | REQUIRED | The sender's sequence number on its stream (§4.3). |
| `ack` | REQUIRED | REQUIRED | The sender's acknowledgement watermark (§4.3). |
| `frame` | REQUIRED | REQUIRED | The frame slot (§4.4); `null` in an ack-only envelope. |
| `deviceId` | MUST NOT appear | OPTIONAL | Server-stamped identity of the device that produced the frame; present if and only if the frame is device-originated. |

Downlink envelopes are **exactly** `{v, seq, ack, frame}` — four keys.
Host-bound envelopes are `{v, seq, ack, frame}` plus, optionally, the one
server-stamped key `deviceId`. The key set is closed: **no other key, in
either direction, ever.** The evolution point is the envelope version `v`
(§4.4), not extra keys — a server that adds any other envelope key is
non-conformant.

Server-originated frames — the `resync` control frame of §4.5 and the
ack-only envelope of §4.3 — carry no `deviceId`.

**The `deviceId` trust rule.** The `deviceId` on host-bound envelopes is
**server-stamped from the authenticated connection identity**. The server
MUST NOT take it from any device-supplied byte — neither from a top-level
envelope key nor from inside the frame. This is a restated consequence of two
invariants already on the page: INV-4 makes the server the enforcement point
for device identity and grants, and INV-3 puts tenancy in credentials, so
device identity is never carried by frames. The host trusts the envelope
`deviceId` with no verification of its own; the server is therefore the only
possible trust anchor for it.

**Resume-frame `deviceId` precision.** A `resume` frame (§4.5) carries its
device identity *inside the frame*, and that in-frame value is the one
host-side parsing acts on for resumes. The server MUST validate the in-frame
`deviceId` of an inbound `resume` against the authenticated connection
identity, and MUST NOT serve `lastAckedSeq` bookkeeping for a device other
than the connection's own. Without this check a resume frame is a
cross-device watermark-peek vector: one device could inspect another's
catch-up state.

**Envelope opacity.** The server MUST NOT inspect `frame` beyond
discriminating the closed set of §4.4 (restated INV-1). Stamping `deviceId`
on host-bound envelopes is envelope work the relay rules themselves require —
not payload interpretation — exactly like assigning the host-bound seq.

### 4.3 Sequence and acknowledgement

**Downlink seq is host-owned.** The host's `seq` is a positive integer
starting at 1 per session instance, monotonic, never reset. The server never
reorders, renumbers, or stamps it: the downlink seq space is the host's, and
the server relays it verbatim.

**Host-bound seq is server-owned.** The server rebuilds device input into one
merged, monotonic host-bound sequence — positive integers starting at 1 per
session instance. This is what makes the host's single `ack` watermark
meaningful when two or more devices are connected: one watermark can
acknowledge exactly one stream, so the server MUST NOT preserve per-device
seq passthrough on the host-bound stream. (Per-device sequencing is internal
bookkeeping at most, never wire surface.)

**Ack.** The `ack` value is the sender's watermark: the highest inbound seq
it has processed, `0` before any. Every envelope carries the sender's
current ack — the watermark is piggybacked, and no dedicated ack frame
exists.

**Ack-only envelopes.** A sender MAY send `{v, seq, ack, frame: null}` to
advance its watermark. These are downstream-only in practice: the reference
host never emits `frame: null` — it heartbeats at the WebSocket level (§4.8)
and piggybacks its ack on its next real frame — while the server MAY emit
ack-only envelopes on the host-bound stream.

**Ack monotonicity (normative).** An ack MUST never decrease on any single
stream. A decreasing ack is a protocol violation, closed with `3400` (§4.8) —
wire-observable in both directions.

**Seq continuity across tunnels (normative).** The host's seq is bound to the
session instance, not the tunnel: a reconnect mints a new tunnel (§3.1)
while seq continues unreset. The server MUST NOT assume a tunnel's first
frame carries seq 1, and MUST NOT reset or renumber seq at tunnel boundaries.

### 4.4 The frame slot's closed set and the versioning escape hatch

The envelope's `frame` value is exactly one of:

a. an application frame (opaque to the server);
b. `null` — the ack-only envelope of §4.3;
c. `{"type": "resume", "deviceId": <string>, "lastAckedSeq": <finite number>}`;
d. `{"type": "resync", "fromSeq": <finite number>}`.

**The only-these-control-frames rule (normative).** Within envelope version
`1`, `resume` and `resync` are the only control frames a server may emit or
relay, and the frame slot admits no further types.

**`pi.resync.done` is not a control frame.** It is an ordinary application
frame — a `CUSTOM` frame named `pi.resync.done` carrying `{uptoSeq}` —
emitted host-upstream at the end of a replay. The server MUST relay it
opaquely and MUST NOT parse it (restated INV-1): fan-out needs no replay-end
signal, because the server relays whatever the host emits in host-bound
stream order, and post-replay frames follow the replayed ones naturally.

**The versioning escape hatch, named.** A server needing a new control frame
or a changed envelope MUST version the protocol — increment `v` and define
the new grammar — never improvise inside `v: 1`. A server receiving a `v` it
does not implement closes the connection as a protocol violation (`3400`,
§4.8).

### 4.5 The resume/resync handshake

- A **device** sends `resume` — `{"type": "resume", "deviceId": <string>,
  "lastAckedSeq": <finite number>}`, riding in the envelope's `frame` slot —
  to request catch-up. `lastAckedSeq` is in the **host's** seq space: the
  highest host-seq the device has processed.
- **The server answers resumes itself; it MUST NOT forward a `resume` frame
  to the host.** Direction is part of the contract, and it is
  harness-observable: a resume appearing in the server→host direction is
  checkable by any conformance harness playing the host.
- The server answers from its ring buffer (§4.7) by delivering the missed
  range of the host's stream, in host-seq order.
- **On a cache miss** the server sends `resync` — `{"type": "resync",
  "fromSeq": <finite number>}` — to the **host**. `fromSeq` SHOULD equal the
  requesting device's `lastAckedSeq + 1`; it is explicitly advisory: the host
  MAY ignore it, and the server MUST NOT assume exact-range replay. The host
  replays from its own store as ordinary application frames (INV-2) — in the
  reference, the full active branch — and the server relays the replay like
  any other downlink traffic.
- **At-least-once delivery (normative; restated consequence of INV-2).** The
  relay never guarantees exactly-once: a resume/resync path may redeliver,
  and recipients dedupe by deterministic event id. The remedy ladder is
  total: reconnect → resume → resync → full-branch replay from the host's
  authoritative store.
- **A cache miss resolves to `resync` — never to an error, a stall, or a
  fabricated frame** (normative; restated consequence of INV-2). This
  includes the empty cache of a fresh tunnel answering a post-reconnect
  resume (§4.7).
- **Revocation interaction.** If the requesting device is revoked while its
  resume is outstanding, the server cancels its catch-up; a resync already
  sent is not recalled — the host's replay fans out to the remaining granted
  devices, so it is never wasted work. Per-device bookkeeping for a revoked
  device is discarded; the stream and the other devices are unaffected.

### 4.6 Fan-out (1:N)

- The server delivers each host-produced frame to **every granted connected
  device**, in host-seq order, identically: same frames, same order, no
  per-device filtering of the stream.
- Grant enforcement happens at delivery (INV-4): a device whose grant does
  not cover the tunnel receives nothing.
- Revocation takes effect at the next delivery opportunity without host
  cooperation (INV-4): the server MUST stop delivering to a revoked device
  immediately, and SHOULD close its socket promptly (a control-plane act, §5).
- Per-device bookkeeping — last delivered seq, in-flight catch-up — is
  bookkeeping only, never protocol logic: the single producer yields one
  total order, and fan-out against it is trivially consistent.
- Uplink concurrency: input from any granted device is accepted; concurrent
  uplink frames interleave into the server's host-bound stream order.
  Arbitration between devices is out of scope for the data plane.

### 4.7 The ring buffer

**Correctness MUST NOT depend on the cache** (normative; restated consequence
of INV-2). A server with an empty or short cache MUST still deliver every
live frame and MUST resolve every miss via `resync`; the server MUST NOT
treat the cache as authoritative history.

**Capacity (SHOULD).** A server SHOULD cache a bounded recent window per
live tunnel, to serve fast catch-up without a host round-trip.

**Release.** The cache is discarded at tunnel deletion (§3.5(c)). Because
seq continues across tunnels (§4.3), a post-reconnect resume MUST be answered
with `resync` (§4.5) — never with an error.

### 4.8 Liveness and close codes

Liveness is native WebSocket ping/pong; no application-level keepalive
exists. The server MUST answer pings per the WebSocket protocol and MAY send
its own pings to reap dead sockets. (The reference host pings at 10-second
intervals — a non-normative example.)

Close codes are **diagnostic, not a contract**: the dialing side's remedy for
any close is uniform — re-arm, mint a new tunnel (§3.1), reconnect — and a
client MUST NOT be required to parse close codes. Two codes are named:

- `1000` — deliberate close, including the deletion close of §3.5(b)
  (normative on the host side; the server's deletion close uses it).
- `3400` — protocol violation (normative): a malformed envelope, an unknown
  `v`, a frame-slot value outside §4.4's set, or ack inversion — each
  wire-observable.

### 4.9 Guidance (non-normative)

**A relay never truncates or splits a frame** (normative; restated
consequence of INV-1): truncation is a payload transform. No accept-floor and
no emit-ceiling enter the wire contract in any form.

> **Guidance (non-normative).** One recommended shape per concern:
>
> 1. **Ring sizing.** A fixed-capacity, count-based ring per live tunnel —
>    for example the last 512 envelopes, oldest evicted. No unbounded growth,
>    no time-based retention to reason about.
> 2. **Connection state machine.** Host socket `dialing → live → closing →
>    closed`; per-device delivery `attached → catching-up → streaming →
>    detached`. A close moves the host socket to `closing`; a cache miss
>    moves a device to `catching-up`; a revocation moves a device to
>    `detached`.
> 3. **Backpressure.** A bounded per-device send queue; on overflow,
>    disconnect that device rather than buffering unboundedly or blocking the
>    host's stream — safe because the device's remedy ladder (§4.5) is total.
> 4. **Deployment topology.** The single-live-socket-per-tunnel rule (§3.1)
>    pins each tunnel to one server process, so the ring cache can be
>    in-process memory with no cross-replica coherence; token signing keys
>    can be shared or asymmetric per §3.3's guidance.
> 5. **Frame-size handling.** A server may bound per-message memory (a ~1 MiB
>    example number); a server refusing an oversized message closes `1009` —
>    safe because the client's remedy ladder (§4.5) is total. The normative
>    sentence above the block is the whole contract: no size bound of any
>    kind enters the wire.
