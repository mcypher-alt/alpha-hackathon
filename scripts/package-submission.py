"""Package the committed source and its verified working-copy manifest."""
import hashlib
import json
from pathlib import Path
import sys
import zipfile

root = Path(__file__).resolve().parents[1]
manifest_path = root / "submission-manifest.json"
manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
if manifest["dirty"]:
    raise SystemExit("Commit the source and regenerate submission-manifest.json first")
output = Path(sys.argv[1]) if len(sys.argv) > 1 else root / "output" / "alpha-credit-submission-1.0.0.zip"
output.parent.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    for entry in manifest["files"]:
        source = root / entry["path"]
        if hashlib.sha256(source.read_bytes()).hexdigest() != entry["sha256"]:
            raise SystemExit(f"Source changed since manifest: {entry['path']}")
        archive.write(source, entry["path"])
    archive.write(manifest_path, "submission-manifest.json")
    archive.writestr("SUBMISSION_COMMIT.txt", manifest["commit"] + "\n")
with zipfile.ZipFile(output) as archive:
    for entry in manifest["files"]:
        assert hashlib.sha256(archive.read(entry["path"])).hexdigest() == entry["sha256"]
sha = hashlib.sha256(output.read_bytes()).hexdigest()
output.with_suffix(".sha256").write_text(f"{sha}  {output.name}\n", encoding="utf-8")
print(json.dumps({"archive": str(output), "commit": manifest["commit"], "files": len(manifest["files"]), "sha256": sha}))
