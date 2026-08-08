import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function within(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== "..");
}

function entriesFor(root, absolute, relative = "") {
  const stat = lstatSync(absolute);
  if (stat.isSymbolicLink()) {
    throw new Error(`Process toolchain path contains a symlink: ${relative || "."}`);
  }
  if (stat.isFile()) {
    return [{ path: relative || path.basename(absolute), sha256: sha256(readFileSync(absolute)) }];
  }
  if (!stat.isDirectory()) {
    throw new Error(`Unsupported process toolchain path: ${relative || absolute}`);
  }
  return readdirSync(absolute, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name))
    .flatMap((entry) => {
      const childRelative = relative
        ? path.posix.join(relative, entry.name)
        : entry.name;
      return entriesFor(root, path.join(absolute, entry.name), childRelative);
    });
}

/** Hashes bytes plus relative names for one immutable process source path. */
export function fingerprintProcessPath(processRoot, relativePath) {
  if (typeof relativePath !== "string" || !relativePath || path.isAbsolute(relativePath)) {
    throw new Error(`Invalid process toolchain path: ${relativePath}`);
  }
  const root = path.resolve(processRoot);
  const absolute = path.resolve(root, relativePath);
  if (!within(root, absolute)) {
    throw new Error(`Process toolchain path escapes the process root: ${relativePath}`);
  }
  if (!existsSync(absolute)) {
    throw new Error(`Process toolchain path is missing: ${relativePath}`);
  }
  return sha256(JSON.stringify(entriesFor(root, absolute)));
}

