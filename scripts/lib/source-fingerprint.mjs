/**
 * source-fingerprint — a impressão digital da FONTE, definida uma vez só.
 *
 * POR QUE ELA MUDOU DE CASA. A medida nasceu em
 * `.claude/skills/tokenize-design-system/scripts/lib/absolute-completion.mjs`,
 * a árvore do motor de tokenização, e é ela que a âncora da corrida usa. Mas a
 * camada de evidência visual (`scripts/`) também precisa dela — e a camada de
 * evidência é COPIADA para dentro do alvo, onde roda de verdade
 * (`ui:evidence:contract` do alvo executa `scripts/lib/*.test.mjs`). Um import
 * de `scripts/` para a árvore da skill funcionaria aqui e quebraria lá.
 *
 * A alternativa — cada camada medir a fonte do seu jeito — foi o defeito
 * MEDIDO em 2026-08-01: sobre a MESMA árvore, no mesmo instante,
 *
 *   sourceFingerprint    âncora fa63…  ×  evidência a691…
 *   toolchainFingerprint âncora 884e…  ×  evidência 3742…
 *
 * Dois nomes iguais com valores diferentes não é cosmético: o contrato cruza
 * artefatos por `runId` + `sourceFingerprint`, e a divergência DESLIGA EM
 * SILÊNCIO a checagem de cenário desconhecido (guardada por
 * `knownScenarios.size > 0`) — o guard some sem emitir violação nenhuma.
 *
 * Então a implementação desce para a camada que as duas alcançam, e a árvore da
 * skill passa a importá-la daqui. A direção é segura nos dois lados: a skill só
 * roda a partir deste repositório; a camada de evidência roda aqui E no alvo,
 * e daqui para baixo não importa nada de fora.
 *
 * PROPRIEDADES QUE O ALGORITMO GARANTE, e por que cada uma existe:
 *   - ordem estável (arquivos ordenados pelo caminho relativo normalizado com
 *     "/"), senão a mesma árvore renderia hashes diferentes em FS distintos;
 *   - caminho E conteúdo entram no hash, separados por NUL, senão renomear um
 *     arquivo sem mudar bytes passaria despercebido;
 *   - link simbólico é RECUSADO, não seguido: seguir permitiria a um link
 *     apontar para fora da raiz e a impressão deixaria de descrever a aplicação;
 *   - raiz que escapa da aplicação, raiz ausente e raiz vazia viram `problems`
 *     com `fingerprint: null` — nunca um hash de conjunto vazio, que seria uma
 *     constante passando por medida.
 */
import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

function unique(values) {
  return [...new Set(values)];
}

/**
 * Contenção de caminho. Exportada porque o mesmo teste — "este caminho está
 * DENTRO daquela raiz?" — decide tanto quais arquivos entram na impressão
 * digital quanto se um arquivo de toolchain declarado escapa da aplicação.
 * Duas cópias dessa regra divergiriam exatamente onde ela importa: na fronteira.
 */
export function isWithin(parentPath, candidatePath) {
  const relative = path.relative(parentPath, candidatePath);
  return (
    relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))
  );
}

export function normalizedRelative(root, filePath) {
  return path.relative(root, filePath).split(path.sep).join("/");
}

export function collectSourceFiles(applicationRoot, sourceRoot, problems) {
  if (path.isAbsolute(sourceRoot)) {
    problems.push(`Source root must be application-relative: ${sourceRoot}`);
    return [];
  }
  const absolute = path.resolve(applicationRoot, sourceRoot);
  if (!isWithin(applicationRoot, absolute)) {
    problems.push(`Source root escapes the application root: ${sourceRoot}`);
    return [];
  }
  if (!existsSync(absolute)) {
    problems.push(`Source root does not exist: ${sourceRoot}`);
    return [];
  }

  const files = [];
  function walk(candidate) {
    const entry = lstatSync(candidate);
    if (entry.isSymbolicLink()) {
      problems.push(
        `Source fingerprint refuses symbolic links: ${normalizedRelative(
          applicationRoot,
          candidate
        )}`
      );
      return;
    }
    if (entry.isDirectory()) {
      for (const child of readdirSync(candidate).sort()) {
        walk(path.join(candidate, child));
      }
      return;
    }
    if (entry.isFile()) files.push(candidate);
  }
  walk(absolute);
  if (files.length === 0) {
    problems.push(`Source root is vacuous: ${sourceRoot}`);
  }
  return files;
}

export function fingerprintSourceRoots({ applicationRoot, sourceRoots }) {
  const root = path.resolve(applicationRoot);
  const problems = [];
  const roots = unique(sourceRoots ?? []);
  if (roots.length === 0) {
    return {
      fingerprint: null,
      files: [],
      problems: ["No source roots are configured"],
    };
  }
  const files = unique(
    roots.flatMap((sourceRoot) => collectSourceFiles(root, sourceRoot, problems))
  ).sort((left, right) =>
    normalizedRelative(root, left).localeCompare(normalizedRelative(root, right))
  );
  if (files.length === 0) {
    problems.push("The complete source file set is empty");
    return { fingerprint: null, files, problems: unique(problems) };
  }
  const hash = createHash("sha256");
  for (const filePath of files) {
    hash.update(normalizedRelative(root, filePath));
    hash.update("\0");
    hash.update(readFileSync(filePath));
    hash.update("\0");
  }
  return {
    fingerprint: hash.digest("hex"),
    files: files.map((filePath) => normalizedRelative(root, filePath)),
    problems: unique(problems),
  };
}
