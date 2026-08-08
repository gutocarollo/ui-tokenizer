import path from "node:path";

/**
 * Resolve a fonte única de artefatos para uma geração imutável do laço.
 * A âncora usa `artifacts/`; cada fingerprint posterior ganha diretório próprio.
 */
export function generationArtifactsDir({
  runRoot,
  configuredSourceFingerprint,
  activeSourceFingerprint,
}) {
  if (!runRoot || !configuredSourceFingerprint || !activeSourceFingerprint) {
    throw new Error("generationArtifactsDir exige runRoot e os dois fingerprints");
  }
  const artifacts = path.join(runRoot, "artifacts");
  return activeSourceFingerprint === configuredSourceFingerprint
    ? artifacts
    : path.join(artifacts, "generations", activeSourceFingerprint);
}
