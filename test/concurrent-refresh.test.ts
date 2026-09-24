/**
 * FLLWUP-92 — concurrent refresh single-flight protection.
 *
 * Tests that multiple concurrent rearm() calls during a tight retry loop
 * do NOT present the same refresh token multiple times to the relay,
 * which would trigger the relay's replay detector and revoke the token family.
 */
import { describe, expect, test } from "bun:test";
import { createRemoteController, type RemoteControllerDeps } from "../index";
import { loginEnglishFor } from "../src/login";

const LIVE_SENTENCE = loginEnglishFor("status.live");

describe("FLLWUP-92 concurrent refresh single-flight", () => {
  test("multiple concurrent rearm() calls → only ONE refresh token presentation to /oauth/token", async () => {
    const fs = await import("node:fs");
    const mkdir = await import("node:fs/promises");
    await mkdir.mkdir("/tmp/pi-remote-f92-test/pi-remote", { recursive: true });
    
    // Start with an expired access token so rearm() will refresh
    const expiredTokenExpiry = Date.now() - 1000; // 1 second ago
    fs.writeFileSync(
      "/tmp/pi-remote-f92-test/pi-remote/credentials.json",
      JSON.stringify({
        serverUrl: "https://cp.example.com",
        accessToken: "at-old",
        refreshToken: "rt-old",
        tokenExpiry: expiredTokenExpiry,
      })
    );

    const setStatus: (string | undefined)[] = [];
    const commandHandlers: Record<string, () => void | Promise<void>> = {};
    const eventHandlers: Record<string, Array<(...a: unknown[]) => void>> = {};
    
    // Track refresh token presentations
    const refreshTokensPresentedToRelay: string[] = [];
    let refreshCount = 0;
    
    // Fake fetch that simulates relay behavior
    const fetchImpl = ((url: string, init?: RequestInit) => {
      // Discovery
      if (url.includes("/.well-known/oauth-authorization-server")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              authorization_endpoint: "https://cp.example.com/auth",
              token_endpoint: "https://cp.example.com/oauth/token",
            }),
            { status: 200 }
          )
        );
      }
      
      // Token refresh
      if (url.includes("/oauth/token") && init?.method === "POST") {
        const body = init.body as string;
        const params = new URLSearchParams(body);
        const presentedToken = params.get("refresh_token");
        if (presentedToken) {
          refreshTokensPresentedToRelay.push(presentedToken);
        }
        refreshCount++;
        
        // Simulate token rotation: return a new pair
        return Promise.resolve(
          new Response(
            JSON.stringify({
              access_token: `at-new-${refreshCount}`,
              refresh_token: `rt-new-${refreshCount}`,
              expires_in: 900,
            }),
            { status: 200 }
          )
        );
      }
      
      // Tunnel creation - intentionally fail to force multiple rearm attempts
      if (url.includes("/tunnels") && init?.method === "POST") {
        if (refreshCount < 3) {
          // Force multiple rearm attempts by failing the first 2 tunnel creations
          return Promise.resolve(new Response("unavailable", { status: 503 }));
        }
        // Third time succeeds
        return Promise.resolve(
          new Response(
            JSON.stringify({
              tunnelId: "T-final",
              url: "ws://localhost:9999/final",
              tokenTtl: 60,
            }),
            { status: 200 }
          )
        );
      }
      
      return Promise.resolve(new Response("{}", { status: 200 }));
    }) as typeof fetch;

    const deps: RemoteControllerDeps = {
      configDir: "/tmp/pi-remote-f92-test",
      serverUrl: "https://cp.example.com",
      sessionName: "s",
      cwd: "/",
      hostMetadata: { piVersion: "1", platform: "linux", arch: "x64" },
      sessionId: () => "sess",
      setStatus: (s) => setStatus.push(s),
      print: () => {},
      sendUserMessage: async () => {},
      isStreaming: () => false,
      resolvePendingPrompt: () => false,
      readActiveBranch: async () => [],
      inputPrompt: async () => undefined,
      fetch: fetchImpl,
      WebSocket: globalThis.WebSocket as typeof WebSocket,
      now: () => Date.now(),
      sleep: async (ms) => new Promise((r) => setTimeout(r, Math.min(ms, 10))), // speed up test
      rng: () => 0,
      newId: () => "test-id",
      ERROR_DIAL_THRESHOLD: 10,
      command: (name, handler) => {
        commandHandlers[name] = () => handler(name);
      },
      on: (event, handler) => {
        (eventHandlers[event] ??= []).push(handler as (...a: unknown[]) => void);
      },
    };

    const ctrl = createRemoteController(deps);
    await commandHandlers.rc?.();

    // Wait for multiple rearm attempts (the test will timeout if single-flight fails)
    await new Promise((r) => setTimeout(r, 500));

    // CRITICAL ASSERTION: Despite multiple rearm() calls (due to 503 failures),
    // only ONE refresh token should have been presented to the relay.
    // The single-flight protection means:
    // - First rearm() does the refresh with rt-old
    // - Concurrent rearm() calls wait for that refresh to complete
    // - They all use the newly-refreshed credential (rt-new-1)
    // - No second presentation of rt-old occurs (would trigger replay detector)
    expect(refreshTokensPresentedToRelay.length).toBe(1);
    expect(refreshTokensPresentedToRelay[0]).toBe("rt-old");
    
    // The credential file should have the rotated token
    const savedCred = JSON.parse(
      fs.readFileSync("/tmp/pi-remote-f92-test/pi-remote/credentials.json", "utf8")
    );
    expect(savedCred.refreshToken).toBe("rt-new-1");
    expect(savedCred.accessToken).toBe("at-new-1");
  });

  test("concurrent refresh during tight retry loop → token family NOT revoked", async () => {
    const fs = await import("node:fs");
    const mkdir = await import("node:fs/promises");
    await mkdir.mkdir("/tmp/pi-remote-f92-retry/pi-remote", { recursive: true });
    
    // Start with an expired access token
    const expiredTokenExpiry = Date.now() - 1000;
    fs.writeFileSync(
      "/tmp/pi-remote-f92-retry/pi-remote/credentials.json",
      JSON.stringify({
        serverUrl: "https://cp.example.com",
        accessToken: "at-expired",
        refreshToken: "rt-live",
        tokenExpiry: expiredTokenExpiry,
      })
    );

    const setStatus: (string | undefined)[] = [];
    const commandHandlers: Record<string, () => void | Promise<void>> = {};
    const eventHandlers: Record<string, Array<(...a: unknown[]) => void>> = {};
    
    let refreshCallCount = 0;
    const refreshTokensSeen: string[] = [];
    let simulatedReplayDetected = false;
    
    const fetchImpl = ((url: string, init?: RequestInit) => {
      if (url.includes("/.well-known/oauth-authorization-server")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              authorization_endpoint: "https://cp.example.com/auth",
              token_endpoint: "https://cp.example.com/oauth/token",
            }),
            { status: 200 }
          )
        );
      }
      
      if (url.includes("/oauth/token") && init?.method === "POST") {
        const body = init.body as string;
        const params = new URLSearchParams(body);
        const presentedToken = params.get("refresh_token");
        
        if (presentedToken) {
          refreshTokensSeen.push(presentedToken);
          
          // Simulate relay's replay detection: if the same token is presented
          // after it was rotated (appears in refreshTokensSeen more than once),
          // the relay would revoke the family (return 401 invalid_token)
          if (refreshCallCount > 0 && presentedToken === "rt-live") {
            simulatedReplayDetected = true;
            return Promise.resolve(
              new Response(
                JSON.stringify({ error: "invalid_token" }),
                { status: 401 }
              )
            );
          }
        }
        
        refreshCallCount++;
        
        // First refresh succeeds with rotation
        return Promise.resolve(
          new Response(
            JSON.stringify({
              access_token: `at-rotated-${refreshCallCount}`,
              refresh_token: `rt-rotated-${refreshCallCount}`,
              expires_in: 900,
            }),
            { status: 200 }
          )
        );
      }
      
      // Tunnel creation fails first few times to force rearm loop
      if (url.includes("/tunnels") && init?.method === "POST") {
        if (refreshCallCount < 2) {
          return Promise.resolve(new Response("unavailable", { status: 503 }));
        }
        return Promise.resolve(
          new Response(
            JSON.stringify({
              tunnelId: "T-ok",
              url: "ws://localhost:9999/ok",
              tokenTtl: 60,
            }),
            { status: 200 }
          )
        );
      }
      
      return Promise.resolve(new Response("{}", { status: 200 }));
    }) as typeof fetch;

    const deps: RemoteControllerDeps = {
      configDir: "/tmp/pi-remote-f92-retry",
      serverUrl: "https://cp.example.com",
      sessionName: "s",
      cwd: "/",
      hostMetadata: { piVersion: "1", platform: "linux", arch: "x64" },
      sessionId: () => "sess",
      setStatus: (s) => setStatus.push(s),
      print: () => {},
      sendUserMessage: async () => {},
      isStreaming: () => false,
      resolvePendingPrompt: () => false,
      readActiveBranch: async () => [],
      inputPrompt: async () => undefined,
      fetch: fetchImpl,
      WebSocket: globalThis.WebSocket as typeof WebSocket,
      now: () => Date.now(),
      sleep: async (ms) => new Promise((r) => setTimeout(r, Math.min(ms, 5))),
      rng: () => 0,
      newId: () => "test-id",
      ERROR_DIAL_THRESHOLD: 10,
      command: (name, handler) => {
        commandHandlers[name] = () => handler(name);
      },
      on: (event, handler) => {
        (eventHandlers[event] ??= []).push(handler as (...a: unknown[]) => void);
      },
    };

    const ctrl = createRemoteController(deps);
    await commandHandlers.rc?.();
    
    await new Promise((r) => setTimeout(r, 500));
    
    // CRITICAL: The relay's simulated replay detector should NOT fire
    // because the single-flight protection prevents concurrent refresh
    // token presentations
    expect(simulatedReplayDetected).toBe(false);
    expect(refreshCallCount).toBe(1); // Only one actual refresh occurred
    expect(refreshTokensSeen.filter((t) => t === "rt-live").length).toBe(1);
  });
});
