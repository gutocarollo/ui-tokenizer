import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

import {
  generateVisualRoutes,
  VISUAL_REGISTRY_OUTPUT_FILES,
} from "../gen-visual-routes.mjs";

/**
 * Materializa o registry que uma captura vai consumir sem deixar arquivos
 * gerados na worktree do alvo.
 *
 * O preparador e o único caminho comum a before/after. Gerar aqui elimina a
 * assimetria em que BEFORE via a policy/fixture atual e AFTER lia um
 * scenarios.json versionado antigo. Os bytes preexistentes são restaurados em
 * finally, inclusive quando a preparação recusa a corrida; o Playwright recebe
 * uma cópia imutável do network-fixtures dentro do staging da própria captura.
 */
export async function withMaterializedEvidenceRegistry({
  frontendRoot,
  stagingRoot,
  consume,
  generate = generateVisualRoutes,
}) {
  if (typeof consume !== "function") {
    throw new TypeError("withMaterializedEvidenceRegistry requires consume()");
  }
  const registryRoot = path.join(frontendRoot, "tests", "visual");
  const snapshots = new Map(
    VISUAL_REGISTRY_OUTPUT_FILES.map((name) => {
      const file = path.join(registryRoot, name);
      return [file, existsSync(file) ? readFileSync(file) : null];
    })
  );
  try {
    const generated = await generate({
      frontendRoot,
      outDir: registryRoot,
    });
    const networkFixturePath = path.join(registryRoot, "network-fixtures.json");
    if (!existsSync(networkFixturePath)) {
      throw new Error(
        `visual registry did not materialize network-fixtures.json: ${networkFixturePath}`
      );
    }
    mkdirSync(stagingRoot, { recursive: true });
    const stagedNetworkFixturePath = path.join(
      stagingRoot,
      "network-fixtures.json"
    );
    copyFileSync(networkFixturePath, stagedNetworkFixturePath);
    return await consume({
      generated,
      registryRoot,
      stagedNetworkFixturePath,
    });
  } finally {
    for (const [file, bytes] of snapshots) {
      if (bytes === null) {
        if (existsSync(file)) unlinkSync(file);
      } else {
        writeFileSync(file, bytes);
      }
    }
  }
}
