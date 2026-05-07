import type { LinkedAccountConfig } from "@elizaos/shared";
import { describe, expect, it, vi } from "vitest";

vi.mock("@elizaos/core", () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

const { AccountPool } = await import("./account-pool.js");

function account(
  providerId: LinkedAccountConfig["providerId"],
  overrides: Partial<LinkedAccountConfig> = {},
): LinkedAccountConfig {
  return {
    id: "duplicate-id",
    providerId,
    label: `${providerId} account`,
    source: "oauth",
    enabled: true,
    priority: 0,
    createdAt: 1,
    health: "ok",
    ...overrides,
  };
}

describe("AccountPool provider-scoped account ids", () => {
  it("resolves duplicate account ids by provider when requested", () => {
    const anthropic = account("anthropic-subscription");
    const codex = account("openai-codex");
    const pool = new AccountPool({
      readAccounts: () => ({
        "anthropic-subscription:duplicate-id": anthropic,
        "openai-codex:duplicate-id": codex,
      }),
      writeAccount: vi.fn(),
    });

    expect(pool.get("duplicate-id", "openai-codex")).toBe(codex);
    expect(pool.get("duplicate-id", "anthropic-subscription")).toBe(anthropic);
  });

  it("marks only the scoped provider account when ids collide", async () => {
    const anthropic = account("anthropic-subscription");
    const codex = account("openai-codex");
    const writes: LinkedAccountConfig[] = [];
    const pool = new AccountPool({
      readAccounts: () => ({
        "anthropic-subscription:duplicate-id": anthropic,
        "openai-codex:duplicate-id": codex,
      }),
      writeAccount: async (next) => {
        writes.push(next);
      },
    });

    await pool.markInvalid("duplicate-id", "bad token", "openai-codex");

    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({
      id: "duplicate-id",
      providerId: "openai-codex",
      health: "invalid",
      healthDetail: { lastError: "bad token" },
    });
  });

  it("refreshes usage on the scoped provider account when ids collide", async () => {
    const anthropic = account("anthropic-subscription");
    const codex = account("openai-codex", { organizationId: "org-codex" });
    const writes: LinkedAccountConfig[] = [];
    const fetchImpl = vi.fn(async () => {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          rate_limit: {
            primary_window: {
              used_percent: 17,
              reset_at: 1_900_000_000,
            },
          },
        }),
      } as Response;
    });
    const pool = new AccountPool({
      readAccounts: () => ({
        "anthropic-subscription:duplicate-id": anthropic,
        "openai-codex:duplicate-id": codex,
      }),
      writeAccount: async (next) => {
        writes.push(next);
      },
    });

    await pool.refreshUsage("duplicate-id", "token", {
      fetch: fetchImpl,
      providerId: "openai-codex",
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://chatgpt.com/backend-api/wham/usage",
      expect.objectContaining({
        headers: expect.objectContaining({
          "ChatGPT-Account-Id": "org-codex",
        }),
      }),
    );
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({
      id: "duplicate-id",
      providerId: "openai-codex",
      health: "ok",
      usage: { sessionPct: 17 },
    });
  });
});
