import {
  constants,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

import {
  analyzeExactCoverage,
  buildEvidenceManifest,
  canonicalJson,
  verifyEvidenceManifestFiles,
  VisualContractError,
} from "./visual-contract.mjs";

const BINDING_FIELDS = Object.freeze([
  "sourceFingerprint",
  "worktreeFingerprint",
  "toolchainFingerprint",
  "tokenSourceFingerprint",
  "generatedCssFingerprint",
  "routeRegistryFingerprint",
  "fixtureRegistryFingerprint",
]);

function readManifest(manifestPath) {
  try {
    return JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch (error) {
    throw new VisualContractError(
      `Evidence part manifest is missing or invalid: ${manifestPath}`,
      { manifestPath, cause: String(error) }
    );
  }
}

function expectedIdentity({ runId, batchId, phase, bindings }) {
  return {
    runId,
    batchId,
    phase,
    ...Object.fromEntries(
      BINDING_FIELDS.map((field) => [field, bindings?.[field] ?? null])
    ),
  };
}

function manifestIdentity(manifest) {
  return {
    runId: manifest.runId,
    batchId: manifest.batchId,
    phase: manifest.phase,
    ...Object.fromEntries(
      BINDING_FIELDS.map((field) => [field, manifest[field]])
    ),
  };
}

/**
 * Compose independently captured immutable matrix partitions into one
 * self-contained, immutable evidence directory.
 *
 * Every source manifest is schema-checked and byte-verified before copying.
 * Parts must have an identical execution identity, must not overlap, and their
 * union must exactly equal the requested full matrix. The destination becomes
 * visible only after its own manifest and copied bytes pass verification.
 */
export function composeEvidenceManifests({
  manifestPaths,
  outputDirectory,
  expectedScenarioIds,
  header,
  batchId = null,
  phase,
  bindings,
}) {
  // A identidade que as partes têm de compartilhar vem do MESMO header do
  // agregado — antes vinha de um `runId` passado à parte, que podia divergir do
  // header sem ninguém notar.
  const runId = header?.runId;
  if (!Array.isArray(manifestPaths) || manifestPaths.length < 2) {
    throw new VisualContractError(
      "Evidence composition requires at least two part manifests"
    );
  }
  if (existsSync(outputDirectory)) {
    throw new VisualContractError(
      `Immutable evidence output already exists: ${outputDirectory}`
    );
  }

  const identity = expectedIdentity({
    runId,
    batchId,
    phase,
    bindings,
  });
  const parts = manifestPaths.map((manifestPath) => {
    const absolutePath = path.resolve(manifestPath);
    const manifest = readManifest(absolutePath);
    const captures = verifyEvidenceManifestFiles(manifest, absolutePath);
    if (canonicalJson(manifestIdentity(manifest)) !== canonicalJson(identity)) {
      throw new VisualContractError(
        "Evidence part identity differs from the requested aggregate identity",
        {
          manifestPath: absolutePath,
          expected: identity,
          actual: manifestIdentity(manifest),
        }
      );
    }
    return { manifestPath: absolutePath, manifest, captures };
  });

  const producedIds = parts.flatMap(({ manifest }) =>
    manifest.producedScenarioIds.slice()
  );
  const coverage = analyzeExactCoverage({
    expectedIds: expectedScenarioIds,
    producedIds,
  });
  if (!coverage.exact) {
    throw new VisualContractError(
      "Evidence parts do not form an exact, disjoint full matrix",
      { coverage }
    );
  }

  const outputPath = path.resolve(outputDirectory);
  const parent = path.dirname(outputPath);
  mkdirSync(parent, { recursive: true });
  const stagingDirectory = mkdtempSync(
    path.join(parent, `.${path.basename(outputPath)}.staging-`)
  );
  const reservedNames = new Set();

  for (const { captures } of parts) {
    for (const capture of captures) {
      const pngName = path.basename(capture.pngPath);
      const metaName = path.basename(capture.metaPath);
      for (const fileName of [pngName, metaName]) {
        if (reservedNames.has(fileName)) {
          throw new VisualContractError(
            `Evidence part filename collision: ${fileName}`
          );
        }
        reservedNames.add(fileName);
      }
      copyFileSync(
        capture.pngPath,
        path.join(stagingDirectory, pngName),
        constants.COPYFILE_EXCL
      );
      copyFileSync(
        capture.metaPath,
        path.join(stagingDirectory, metaName),
        constants.COPYFILE_EXCL
      );
    }
  }

  const stagingManifestPath = path.join(stagingDirectory, "manifest.json");
  const aggregate = buildEvidenceManifest({
    captureDirectory: stagingDirectory,
    manifestPath: stagingManifestPath,
    expectedScenarioIds,
    header,
    batchId,
    phase,
    bindings,
  });
  writeFileSync(
    stagingManifestPath,
    `${JSON.stringify(aggregate, null, 2)}\n`,
    { flag: "wx" }
  );
  verifyEvidenceManifestFiles(aggregate, stagingManifestPath);
  renameSync(stagingDirectory, outputPath);
  return {
    manifest: aggregate,
    manifestPath: path.join(outputPath, "manifest.json"),
    outputDirectory: outputPath,
    partCount: parts.length,
  };
}
