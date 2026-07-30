import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import {
  fingerprintsForCandidates,
  parseCandidateSyntax,
  schemaCandidate,
  splitClassCandidates,
} from "../lib/tailwind-normalizer.mjs";

test("bracket-aware splitting preserves order and arbitrary values", () => {
  assert.deepEqual(
    splitClassCandidates(
      "gap-2 px-2 bg-[url(http://example.test/a:b)] [&::-webkit-scrollbar]:hidden mb-3"
    ),
    {
      tokens: [
        "gap-2",
        "px-2",
        "bg-[url(http://example.test/a:b)]",
        "[&::-webkit-scrollbar]:hidden",
        "mb-3",
      ],
      invalidReason: null,
    }
  );
  assert.deepEqual(
    splitClassCandidates("content-['hello world'] flex").tokens,
    ["content-['hello world']", "flex"]
  );
});

test("candidate parser retains variants, important, negative, and modifier", () => {
  assert.deepEqual(parseCandidateSyntax("group-data-[active=true]:-mt-2/3!"), {
    raw: "group-data-[active=true]:-mt-2/3!",
    variants: ["group-data-[active=true]"],
    important: true,
    negative: true,
    utilityRoot: "mt",
    value: "2",
    modifier: "3",
    canonicalCandidate: "group-data-[active=true]:-mt-2/3!",
    status: "valid",
    invalidReason: null,
  });
  assert.equal(parseCandidateSyntax("after:content-[").status, "invalid");
});

function evidence(raw, css = `.${raw}{x:y}`) {
  return {
    candidate: {
      ...parseCandidateSyntax(raw),
      canonicalCandidate: raw,
      status: "valid",
    },
    css,
    evidenceStatus: "tailwind-compiled",
  };
}

test("parallel fingerprints distinguish order, multiset, and set", () => {
  const context = { component: "Fixture" };
  const firstTokens = ["gap-2", "px-2", "mb-3"];
  const secondTokens = ["px-2", "gap-2", "mb-3"];
  const first = fingerprintsForCandidates({
    rawClassName: firstTokens.join(" "),
    rawTokens: firstTokens,
    evidence: firstTokens.map((raw) => evidence(raw)),
    context,
  });
  const second = fingerprintsForCandidates({
    rawClassName: secondTokens.join(" "),
    rawTokens: secondTokens,
    evidence: secondTokens.map((raw) => evidence(raw)),
    context,
  });
  assert.notEqual(first.rawOrderHash, second.rawOrderHash);
  assert.equal(
    first.canonicalMultisetFingerprint,
    second.canonicalMultisetFingerprint
  );
  assert.equal(first.canonicalSetFingerprint, second.canonicalSetFingerprint);

  const duplicate = fingerprintsForCandidates({
    rawClassName: "p-2 p-2",
    rawTokens: ["p-2", "p-2"],
    evidence: [evidence("p-2"), evidence("p-2")],
    context,
  });
  const single = fingerprintsForCandidates({
    rawClassName: "p-2",
    rawTokens: ["p-2"],
    evidence: [evidence("p-2")],
    context,
  });
  assert.notEqual(
    duplicate.canonicalMultisetFingerprint,
    single.canonicalMultisetFingerprint
  );
  assert.equal(
    duplicate.canonicalSetFingerprint,
    single.canonicalSetFingerprint
  );
});

test("fingerprints are provenance-bound and durable variants remain schema-valid", () => {
  const rawTokens = ["p-2"];
  const first = fingerprintsForCandidates({
    rawClassName: "p-2",
    rawTokens,
    evidence: [evidence("p-2")],
    context: {},
    provenance: { normalizerVersion: "one" },
  });
  const second = fingerprintsForCandidates({
    rawClassName: "p-2",
    rawTokens,
    evidence: [evidence("p-2")],
    context: {},
    provenance: { normalizerVersion: "two" },
  });
  assert.notEqual(
    first.canonicalSetFingerprint,
    second.canonicalSetFingerprint
  );
  const repeated = parseCandidateSyntax("hover:hover:bg-red-500");
  assert.equal(repeated.canonicalCandidate, "hover:hover:bg-red-500");
  assert.deepEqual(schemaCandidate(repeated).variants, ["hover"]);
});

test(
  "target compiler distinguishes Tailwind, plain CSS, and unresolved candidates",
  { skip: !process.env.TOKENIZE_TEST_ROOT },
  () => {
    // Tailwind's loader retains native resources under node:test on Node 26.
    // Run the compiler proof in a child process so test completion remains
    // deterministic while still resolving the compiler from the target root.
    const moduleUrl = new URL("../lib/tailwind-normalizer.mjs", import.meta.url)
      .href;
    const script = `
      const { createTargetNormalizer, fingerprintsForCandidates } = await import(${JSON.stringify(moduleUrl)});
      const normalizer = await createTargetNormalizer({ root: process.env.TOKENIZE_TEST_ROOT });
      const candidates = ["p-2", "group", "font-['Plus Jakarta Sans']", "github-dark", "tokenizer-no-such-utility"];
      const fingerprint = (tokens) => {
        const evidence = tokens.map((candidate) => normalizer.compilerEvidence(candidate));
        return fingerprintsForCandidates({
          rawClassName: tokens.join(" "),
          rawTokens: tokens,
          evidence,
          context: {},
          provenance: normalizer.provenance,
          compiledRecipeProjection: normalizer.compilerProjection(evidence),
        }).compiledCssFingerprint;
      };
      process.stdout.write(JSON.stringify({
        available: normalizer.available,
        unavailableReason: normalizer.unavailableReason,
        statuses: Object.fromEntries(candidates.map((candidate) => [
          candidate,
          normalizer.compilerEvidence(candidate).evidenceStatus,
        ])),
        compilerEquivalence: {
          paddingComposite: fingerprint(["p-2", "px-1"]) === fingerprint(["py-2", "px-1"]),
          physicalVsLogical: fingerprint(["pl-2", "pr-2"]) === fingerprint(["px-2"]),
        },
      }));
    `;
    const result = spawnSync(
      process.execPath,
      ["--input-type=module", "--eval", script],
      {
        encoding: "utf8",
        env: process.env,
        timeout: 60_000,
      }
    );
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    const proof = JSON.parse(result.stdout);
    assert.equal(proof.available, true, proof.unavailableReason);
    assert.deepEqual(proof.statuses, {
      "p-2": "tailwind-compiled",
      group: "tailwind-marker",
      "font-['Plus Jakarta Sans']": "tailwind-compiled",
      "github-dark": "plain-css",
      "tokenizer-no-such-utility": "unresolved",
    });
    assert.equal(proof.compilerEquivalence.paddingComposite, true);
    assert.equal(proof.compilerEquivalence.physicalVsLogical, false);
  }
);
