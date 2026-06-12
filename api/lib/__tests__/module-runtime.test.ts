import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

interface PackageJson {
  type?: string;
}

describe("Vercel API runtime", () => {
  it("declares ESM module mode for generated API functions", async () => {
    const packageJson = JSON.parse(
      await readFile(join(process.cwd(), "package.json"), "utf8"),
    ) as PackageJson;

    expect(packageJson.type).toBe("module");
  });
});
