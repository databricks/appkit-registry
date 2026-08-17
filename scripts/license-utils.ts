import { execSync } from "node:child_process";

export type Package = {
  name: string;
  versions: string[];
  paths: string[];
  license: string;
  homepage?: string;
};

/**
 * Fetches license data for all production dependencies from pnpm.
 *
 * Unlike the AppKit monorepo (which filters to the direct dependencies of its
 * published packages), this registry is a single package, so we attribute the
 * whole production dependency tree.
 */
export function getProductionDependencyLicenses(): Package[] {
  const output = execSync("pnpm licenses list --json --production", {
    encoding: "utf8",
  });
  const licenses: Record<string, Package[]> = JSON.parse(output);

  const dependencies: Package[] = [];
  for (const [licenseName, packages] of Object.entries(licenses)) {
    for (const pkg of packages) {
      dependencies.push({ ...pkg, license: licenseName });
    }
  }

  return dependencies;
}