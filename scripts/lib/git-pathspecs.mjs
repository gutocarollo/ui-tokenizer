import path from "node:path";

export function applicationRelativePathspecs(applicationRoot, absoluteFiles) {
  const root = path.resolve(applicationRoot);
  return absoluteFiles.map((file) => {
    const relative = path.relative(root, path.resolve(file));
    if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new Error(`Mutation path escapes application root: ${file}`);
    }
    return relative.split(path.sep).join("/");
  });
}
