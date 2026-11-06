import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";
import { createApp } from "../server/app.mjs";
async function setup(t) {
  const root = mkdtempSync(join(tmpdir(), "ceicom-http-"));
  const app = createApp({ root });
  const server = createServer(app);
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
    app.locals.close();
    rmSync(root, { recursive: true, force: true });
  });
  const request = (path, body, { demo = false, ...options } = {}) =>
    fetch(base + path, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CEICOM-Request": "1",
        "X-CEICOM-Demo": demo ? "1" : "0",
        ...options.headers,
      },
      ...options,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  return { base, request };
}
test("API: demo ficticia aislada de producción; CRUD, nota, preview, cierre y exportaciones", async (t) => {
  const { request } = await setup(t);
  assert.equal((await (await request("/api/state")).json()).students.length, 0);
  let state = await (
    await request("/api/state", undefined, { demo: true })
  ).json();
  assert.equal(state.students.length, 2);
  const note = state.enrollments.find((r) => r.curso === "Illustrator");
  const draft = await (
    await request(
      "/api/reports",
      {
        categoria: "Diseño Gráfico",
        periodo: "2026-11",
        grade_ids: [note.grade_id],
      },
      { demo: true },
    )
  ).json();
  assert.equal(draft.estado, "borrador");
  const pdf = await request(`/api/reports/${draft.id}/export/pdf`, undefined, {
    demo: true,
  });
  assert.equal(pdf.status, 200);
  assert.equal(
    Buffer.from(await pdf.arrayBuffer())
      .subarray(0, 5)
      .toString(),
    "%PDF-",
  );
  let pending = await (
    await request(
      "/api/pending?category=Dise%C3%B1o%20Gr%C3%A1fico&period=2026-12",
      undefined,
      { demo: true },
    )
  ).json();
  assert.equal(pending.length, 2);
  const failed = await request(
    `/api/reports/${draft.id}/confirm`,
    { responsable: "Docente", fecha_presentacion: "2026-11-04" },
    { demo: true },
  );
  assert.equal(failed.status, 400);
  const closed = await (
    await request(
      `/api/reports/${draft.id}/confirm`,
      {
        confirmed: true,
        responsable: "Docente",
        fecha_presentacion: "2026-11-04",
      },
      { demo: true },
    )
  ).json();
  assert.equal(closed.report.estado, "presentado");
  assert.equal(closed.warning, undefined);
  pending = await (
    await request(
      "/api/pending?category=Dise%C3%B1o%20Gr%C3%A1fico&period=2026-12",
      undefined,
      { demo: true },
    )
  ).json();
  assert.deepEqual(
    pending.map((r) => r.curso),
    ["Photoshop"],
  );
  assert.equal((await (await request("/api/state")).json()).reports.length, 0);
  const backup = await request("/api/backup", undefined, { demo: true });
  assert.equal(backup.headers.get("content-type"), "application/zip");
  assert.ok((await backup.arrayBuffer()).byteLength > 1000);
});
test("API: bloquea escrituras de otros orígenes y solicitudes sin cabecera local", async (t) => {
  const { base, request } = await setup(t);
  const foreign = await fetch(base + "/api/students", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://ajeno.example",
      "X-CEICOM-Request": "1",
    },
    body: JSON.stringify({ nombres: "A", apellidos: "B" }),
  });
  assert.equal(foreign.status, 403);
  const basic = await fetch(base + "/api/students", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  assert.equal(basic.status, 403);
  const invalid = await request("/api/students", {
    nombres: "",
    apellidos: "B",
  });
  assert.equal(invalid.status, 400);
  const valid = await request("/api/students", {
    nombres: "Ana",
    apellidos: "Prueba",
  });
  assert.equal(valid.status, 200);
  assert.equal((await valid.json()).nombres, "Ana");
});
