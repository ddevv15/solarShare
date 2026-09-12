import { afterEach, describe, expect, it, vi } from "vitest";

const validateWebConfigAtStartup = vi.hoisted(() => vi.fn());

vi.mock("@/lib/config/web", () => ({ validateWebConfigAtStartup }));

import { register } from "./instrumentation";

afterEach(() => {
  vi.unstubAllEnvs();
  validateWebConfigAtStartup.mockReset();
});

describe("register", () => {
  it("validates web configuration during Node.js startup", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");

    await register();

    expect(validateWebConfigAtStartup).toHaveBeenCalledOnce();
  });

  it("does not load Node.js configuration in the edge runtime", async () => {
    vi.stubEnv("NEXT_RUNTIME", "edge");

    await register();

    expect(validateWebConfigAtStartup).not.toHaveBeenCalled();
  });
});
