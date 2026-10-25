import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const git = (...args) =>
  execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
const files = git('ls-files', '-z').split('\0').filter(Boolean).map(path => ({
  path,
  sha256: createHash('sha256').update(readFileSync(resolve(root, path))).digest('hex'),
}));
const manifest = {
  version: readFileSync(resolve(root, "VERSION"), "utf8").trim(),
  commit: git("rev-parse", "HEAD"),
  dirty: Boolean(
    git("status", "--porcelain", "--untracked-files=normal")
      .split("\n")
      .filter((x) => x && !x.includes("submission-manifest.json")).length,
  ),
  note: "File hashes identify the exact working copy. Commit identifies the base when dirty=true. Regenerate after the submission commit.",
  files: files.sort((a, b) => a.path.localeCompare(b.path)),
};
writeFileSync(
  resolve(root, "submission-manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
);
console.log(
  `Submission ${manifest.version}, commit ${manifest.commit}, dirty=${manifest.dirty}, ${files.length} files`,
);
