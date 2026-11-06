import JSZip from "jszip";
import { DatabaseSync } from "node:sqlite";
import { createHash, randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
  renameSync,
} from "node:fs";
import { join, dirname, relative } from "node:path";
import { tmpdir } from "node:os";
const hash = (b) => createHash("sha256").update(b).digest("hex");
function walk(root) {
  return readdirSync(root, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? walk(join(root, e.name))
      : e.isFile()
        ? [join(root, e.name)]
        : [],
  );
}
export async function createBackup(store) {
  const temp = mkdtempSync(join(tmpdir(), "ceicom-"));
  try {
    const copy = join(temp, "academico.sqlite");
    store.db.prepare("VACUUM INTO ?").run(copy);
    const zip = new JSZip(),
      manifest = {};
    const add = (name, bytes) => {
      zip.file(name, bytes);
      manifest[name] = hash(bytes);
    };
    add("datos/academico.sqlite", readFileSync(copy));
    for (const p of walk(join(store.root, "Informes")))
      add(relative(store.root, p).split("\\").join("/"), readFileSync(p));
    zip.file("manifest.json", JSON.stringify({ version: 1, files: manifest }));
    return await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
    });
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}
export async function validateBackup(buffer) {
  const zip = await JSZip.loadAsync(buffer, { checkCRC32: true });
  const manifestFile = zip.file("manifest.json");
  if (!manifestFile) throw new Error("Respaldo sin manifiesto CEICOM.");
  const manifest = JSON.parse(await manifestFile.async("string"));
  if (manifest.version !== 1 || !manifest.files?.["datos/academico.sqlite"])
    throw new Error("Versión de respaldo incompatible.");
  const actual = Object.values(zip.files)
    .filter((f) => !f.dir)
    .map((f) => f.name);
  if (
    actual.length !== Object.keys(manifest.files).length + 1 ||
    actual.some(
      (n) => n !== "manifest.json" && !Object.hasOwn(manifest.files, n),
    )
  )
    throw new Error("Respaldo incompleto.");
  const files = new Map();
  let total = 0;
  for (const [name, expected] of Object.entries(manifest.files)) {
    if (
      name.includes("..") ||
      name.includes("\\") ||
      name.includes(":") ||
      name.startsWith("/") ||
      !(
        name === "datos/academico.sqlite" ||
        /^Informes\/\d{4}\/\d{2}\/[^/]+\.(pdf|xlsx)$/.test(name)
      )
    )
      throw new Error("Ruta de respaldo inválida.");
    const f = zip.file(name);
    if (!f || f.unsafeOriginalName !== name)
      throw new Error("Archivo de respaldo inválido.");
    if (f._data.uncompressedSize > 100 * 1024 * 1024)
      throw new Error("Respaldo demasiado grande.");
    const bytes = await f.async("nodebuffer");
    total += bytes.length;
    if (total > 128 * 1024 * 1024 || hash(bytes) !== expected)
      throw new Error("Respaldo alterado o demasiado grande.");
    files.set(name, bytes);
  }
  const temp = mkdtempSync(join(tmpdir(), "ceicom-check-"));
  let db;
  try {
    const path = join(temp, "academico.sqlite");
    writeFileSync(path, files.get("datos/academico.sqlite"));
    db = new DatabaseSync(path, { readOnly: true });
    if (
      db.prepare("PRAGMA integrity_check").get().integrity_check !== "ok" ||
      db.prepare("PRAGMA foreign_key_check").all().length
    )
      throw new Error("SQLite dañada.");
    for (const table of [
      "students",
      "courses",
      "enrollments",
      "grades",
      "reports",
      "report_items",
      "settings",
      "audit_log",
    ])
      db.prepare(`SELECT * FROM ${table} LIMIT 1`).all();
    const cfg = JSON.parse(
      db.prepare("SELECT value FROM settings WHERE id=1").get().value,
    );
    if (!cfg.institucion) throw new Error("Configuración incompatible.");
    db.prepare(
      "SELECT enrollment_id,valor,periodo,report_id FROM grades LIMIT 1",
    ).all();
    db.prepare(
      "SELECT snapshot,confirmado_at,version FROM reports LIMIT 1",
    ).all();
  } finally {
    db?.close();
    rmSync(temp, { recursive: true, force: true });
  }
  return files;
}
export async function restoreBackup(store, buffer, confirmed) {
  if (confirmed !== true)
    throw new Error("Confirme expresamente la restauración.");
  const files = await validateBackup(buffer);
  const previous = await createBackup(store);
  const recoveryDir = join(store.root, "RespaldosPrevios");
  mkdirSync(recoveryDir, { recursive: true });
  const recovery = join(recoveryDir, `antes_restaurar_${randomUUID()}.zip`);
  writeFileSync(recovery, previous);
  const stage = mkdtempSync(join(store.root, ".restaurar-"));
  for (const [name, bytes] of files) {
    const p = join(stage, name);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, bytes);
  }
  mkdirSync(join(stage, "Informes"), { recursive: true });
  const reports = join(store.root, "Informes"),
    oldDB = join(stage, "original.sqlite"),
    oldReports = join(stage, "originales");
  store.close();
  try {
    renameSync(store.path, oldDB);
    renameSync(reports, oldReports);
    renameSync(join(stage, "datos/academico.sqlite"), store.path);
    renameSync(join(stage, "Informes"), reports);
  } catch (e) {
    if (existsSync(oldDB)) {
      rmSync(store.path, { force: true });
      renameSync(oldDB, store.path);
    }
    if (existsSync(oldReports)) {
      rmSync(reports, { recursive: true, force: true });
      renameSync(oldReports, reports);
    }
    throw e;
  } finally {
    store.open();
    rmSync(stage, { recursive: true, force: true });
  }
  return { recovery: relative(store.root, recovery) };
}
