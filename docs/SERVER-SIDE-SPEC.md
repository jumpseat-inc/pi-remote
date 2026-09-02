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
