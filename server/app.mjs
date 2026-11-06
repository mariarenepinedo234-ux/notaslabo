import express from "express";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync, existsSync } from "node:fs";
import { Store } from "./store.mjs";
import { exportReport } from "./exports.mjs";
import { createBackup, restoreBackup } from "./backup.mjs";
const project = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export function createApp({
  root = process.env.CEICOM_HOME || project,
  defaultDemo = false,
} = {}) {
  const app = express(),
    store = new Store(root);
  let demoStore;
  let queue = Promise.resolve();
  const serial = (fn) => {
    const job = queue.then(fn);
    queue = job.catch(() => {});
    return job;
  };
  app.disable("x-powered-by");
  app.use("/api", (req, res, next) => {
    const host = req.get("host") || "";
    if (!/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host))
      return res
        .status(403)
        .json({ error: "Use el servidor local de CEICOM." });
    const origin = req.get("origin");
    if (origin && origin !== `http://${host}`)
      return res.status(403).json({ error: "Origen no permitido." });
    if (
      !["GET", "HEAD"].includes(req.method) &&
      req.get("x-ceicom-request") !== "1"
    )
      return res.status(403).json({ error: "Solicitud no permitida." });
    const demo =
      req.get("x-ceicom-demo") === "1" ||
      (defaultDemo && req.get("x-ceicom-demo") !== "0");
    if (demo && !demoStore) {
      demoStore = new Store(join(root, "demo"));
      demoStore.demo();
    }
    req.store = demo ? demoStore : store;
    req.demo = demo;
    next();
  });
  app.use(express.json({ limit: "3mb" }));
  const route = (method, path, handler, locked = false) =>
    app[method](path, async (req, res, next) => {
      try {
        const value = locked
          ? await serial(() => handler(req, res))
          : await handler(req, res);
        if (!res.headersSent) res.json(value);
      } catch (e) {
        next(e);
      }
    });
  route("get", "/api/state", (req) => ({
    ...req.store.state(),
    demo: req.demo,
  }));
  route("post", "/api/students", (req) => req.store.student(req.body), true);
  route(
    "put",
    "/api/students/:id",
    (req) => req.store.student(req.body, req.params.id),
    true,
  );
  route("post", "/api/courses", (req) => req.store.course(req.body), true);
  route(
    "put",
    "/api/courses/:id",
    (req) => req.store.course(req.body, req.params.id),
    true,
  );
  route("post", "/api/enrollments", (req) => req.store.enroll(req.body), true);
  route(
    "put",
    "/api/enrollments/:id",
    (req) => req.store.enrollmentState(req.params.id, req.body),
    true,
  );
  route("post", "/api/grades", (req) => req.store.grade(req.body), true);
  route(
    "put",
    "/api/settings",
    (req) => req.store.saveSettings(req.body),
    true,
  );
  route("get", "/api/pending", (req) =>
    req.store.pending(
      req.query.category,
      req.query.period,
      req.query.shift || "",
    ),
  );
  route("post", "/api/reports", (req) => req.store.draft(req.body), true);
  route("get", "/api/reports/:id", (req) => req.store.report(req.params.id));
  const archive = async (store, report) => {
    try {
      await exportReport(store, report.id, "pdf");
      await exportReport(store, report.id, "xlsx");
      return { report };
    } catch (e) {
      return {
        report,
        warning: `La entrega quedó registrada. Reintente la exportación desde Historial: ${e.message}`,
      };
    }
  };
  route(
    "post",
    "/api/reports/:id/confirm",
    (req) => archive(req.store, req.store.confirm(req.params.id, req.body)),
    true,
  );
  route(
    "post",
    "/api/reports/:id/rectify",
    (req) => archive(req.store, req.store.rectify(req.params.id, req.body)),
    true,
  );
  route(
    "get",
    "/api/reports/:id/export/:format",
    async (req, res) => {
      const path = await exportReport(
        req.store,
        req.params.id,
        req.params.format,
      );
      await new Promise((resolve, reject) =>
        res.download(path, (error) => (error ? reject(error) : resolve())),
      );
    },
    true,
  );
  route(
    "get",
    "/api/backup",
    async (req, res) => {
      const buffer = await createBackup(req.store);
      res
        .attachment(
          `CEICOM_${req.demo ? "DEMO_" : ""}respaldo_${new Date().toISOString().replaceAll(":", "-")}.zip`,
        )
        .type("application/zip")
        .send(buffer);
    },
    true,
  );
  app.post(
    "/api/restore",
    express.raw({ type: "application/zip", limit: "64mb" }),
    async (req, res, next) => {
      try {
        const result = await serial(() =>
          restoreBackup(
            req.store,
            req.body,
            req.get("x-ceicom-confirm") === "true",
          ),
        );
        res.json(result);
      } catch (e) {
        next(e);
      }
    },
  );
  app.use("/api", (req, res) =>
    res.status(404).json({ error: "Recurso no encontrado." }),
  );
  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    const message = err.code?.startsWith("SQLITE_CONSTRAINT")
      ? "Los datos no son válidos o ya existe un registro duplicado."
      : err.message;
    res
      .status(err.status || 400)
      .json({ error: message || "No se pudo completar la operación." });
  });
  app.locals.close = () => {
    store.close();
    demoStore?.close();
  };
  return app;
}
