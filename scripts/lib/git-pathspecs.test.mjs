import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { applicationRelativePathspecs } from "./git-pathspecs.mjs";

test("monorepo app paths stay relative to git -C applicationRoot", () => {
  const repo = path.join(path.sep, "work", "repo");
  const app = path.join(repo, "frontend");
  assert.deepEqual(
    applicationRelativePathspecs(app, [
      path.join(app, "app/page.tsx"),
      path.join(app, "tokens/color.tokens.json"),
    ]),
    ["app/page.tsx", "tokens/color.tokens.json"]
  );
});

test("application-relative pathspecs reject files outside the app", () => {
  assert.throws(
    () => applicationRelativePathspecs("/work/repo/frontend", ["/work/repo/package.json"]),
    /escapes application root/
  );
});
