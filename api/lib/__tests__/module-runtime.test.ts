import { readdir, readFile } from "node:fs/promises";
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

  it("uses explicit JavaScript extensions for API runtime imports", async () => {
    const apiFiles = await collectApiFiles(join(process.cwd(), "api"));
    const offenders = [];

    for (const filePath of apiFiles) {
      const source = await readFile(filePath, "utf8");
      const importSpecifiers = Array.from(
        source.matchAll(
          /\bfrom\s+["'](\.{1,2}\/[^"']+)["']|import\(\s*["'](\.{1,2}\/[^"']+)["']\s*\)/g,
        ),
      ).map((match) => match[1] || match[2]);

      for (const specifier of importSpecifiers) {
        if (!specifier.endsWith(".js")) offenders.push(`${filePath}: ${specifier}`);
      }
    }

    expect(offenders).toEqual([]);
  });
});

async function collectApiFiles(directoryPath: string): Promise<string[]> {
  const entries = await readdir(directoryPath, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = join(directoryPath, entry.name);
      if (entry.isDirectory()) return collectApiFiles(entryPath);
      return entry.isFile() && entry.name.endsWith(".ts") ? [entryPath] : [];
    }),
  );

  return files.flat();
}
