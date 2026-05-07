import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LinkedAccountConfig } from "../contracts/service-routing.js";

const pool = {
  get: vi.fn(),
  upsert: vi.fn(async () => {}),
  list: vi.fn(() => []),
  deleteMetadata: vi.fn(async () => {}),
  refreshUsage: vi.fn(async () => {}),
};

vi.mock("@elizaos/core", () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock("../contracts/service-routing.js", () => ({
  isLinkedAccountProviderId: (providerId: string) =>
    [
      "anthropic-subscription",
      "openai-codex",
      "anthropic-api",
      "openai-api",
      "deepseek-api",
      "zai-api",
      "moonshot-api",
    ].includes(providerId),
}));

vi.mock("@elizaos/app-core/account-pool", () => ({
  getDefaultAccountPool: () => pool,
}));

const { _resetAccountsRoutesPoolCache, handleAccountsRoutes } = await import(
  "./accounts-routes.js"
);

function makeAccount(
  providerId: LinkedAccountConfig["providerId"],
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
  };
}

describe("accounts routes provider-scoped account ids", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetAccountsRoutesPoolCache();
  });

  it("patches the account matching both route providerId and accountId", async () => {
    const codex = makeAccount("openai-codex");
    pool.get.mockImplementation((accountId, providerId) => {
      if (accountId === "duplicate-id" && providerId === "openai-codex") {
        return codex;
      }
      return null;
    });
    const responses: unknown[] = [];

    const handled = await handleAccountsRoutes({
      req: {} as never,
      res: {} as never,
      method: "PATCH",
      pathname: "/api/accounts/openai-codex/duplicate-id",
      state: { config: {} },
      saveConfig: vi.fn(),
      readJsonBody: vi.fn(async () => ({ enabled: false })),
      json: vi.fn((_res, body) => {
        responses.push(body);
      }),
      error: vi.fn(),
    });

    expect(handled).toBe(true);
    expect(pool.get).toHaveBeenCalledWith("duplicate-id", "openai-codex");
    expect(pool.upsert).toHaveBeenCalledWith({
      ...codex,
      enabled: false,
    });
    expect(responses[0]).toMatchObject({
      id: "duplicate-id",
      providerId: "openai-codex",
      enabled: false,
    });
  });
});
