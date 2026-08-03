export function selectBuildCheckScripts(packageJson) {
  const scripts = packageJson?.scripts ?? {};
  if (!scripts["tokens:build"]) {
    throw new Error("package.json must define tokens:build before BUILT");
  }
  const selected = ["tokens:build"];
  if (scripts.build) selected.push("build");
  else if (scripts.typecheck) selected.push("typecheck");
  else if (scripts.check) selected.push("check");
  return selected;
}
