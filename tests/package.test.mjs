import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url)));

// npx runs the bin through a symlink in node_modules/.bin, and on Windows
// through a .cmd shim, so it must be the node entry point itself, not a
// shell wrapper that looks up files relative to its own path.
test("bin points at the built node entry point", () => {
  assert.equal(pkg.bin["timelog-mcp"], "dist/index.js");
});

test("bin target is executable with a node shebang", () => {
  const url = new URL(`../${pkg.bin["timelog-mcp"]}`, import.meta.url);
  assert.ok(statSync(url).mode & 0o111, "bin target is not executable");
  assert.match(readFileSync(url, "utf8"), /^#!\/usr\/bin\/env node\n/);
});
