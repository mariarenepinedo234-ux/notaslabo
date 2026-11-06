import { test, expect } from "@playwright/test";
test("flujo real: registrar, inscribir a dos cursos, calificar, cerrar solo uno y recuperar historial", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Todo listo para enseñar." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Estudiantes", exact: true }).click();
  await page
    .getByRole("button", { name: "Nuevo estudiante", exact: true })
    .click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nombres *", { exact: true }).fill("Ana");
  await dialog
    .getByLabel("Apellidos *", { exact: true })
    .fill("Prueba ficticia");
  await dialog.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page
    .getByRole("button", { name: "Inscripciones", exact: true })
    .click();
  for (const course of ["Illustrator", "Photoshop"]) {
    await page
      .getByRole("button", { name: "Nueva inscripción", exact: true })
      .click();
    dialog = page.getByRole("dialog");
    await dialog
      .getByLabel("Estudiante *", { exact: true })
      .selectOption({ label: "Ana Prueba ficticia · #1" });
    await dialog
      .getByLabel("Curso individual *", { exact: true })
      .selectOption({ label: `${course} · Diseño Gráfico` });
    await dialog.getByRole("button", { name: "Guardar", exact: true }).click();
    await expect(dialog).not.toBeVisible();
  }
  await page
    .getByRole("button", { name: "Calificaciones", exact: true })
    .click();
  for (const [course, score] of [
    ["Illustrator", "90"],
    ["Photoshop", "0"],
  ]) {
    const row = page.getByRole("row").filter({ hasText: course });
    await row
      .getByRole("button", { name: "Registrar nota", exact: true })
      .click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Nota final (0–100) *").fill(score);
    await dialog.getByLabel("Mes académico de la nota *").fill("2026-10");
    await dialog
      .getByRole("button", { name: "Guardar nota pendiente" })
      .click();
    await expect(dialog).not.toBeVisible();
  }
  await page.getByRole("button", { name: /^Informes/ }).click();
  await page.getByLabel("Mes académico del informe").fill("2026-11");
  await page.getByRole("button", { name: "Consultar pendientes" }).click();
  await expect(
    page.getByRole("heading", { name: "2 notas pendientes" }),
  ).toBeVisible();
  await page
    .getByRole("checkbox", { name: "Incluir Ana Prueba ficticia Illustrator" })
    .check();
  await page.getByRole("button", { name: "Vista previa (1)" }).click();
  dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("button", { name: "Confirmar entrega y cerrar informe" }),
  ).toBeDisabled();
  await dialog
    .getByLabel("Responsable de la entrega *")
    .fill("Docente de prueba");
  await dialog.getByLabel("Fecha real de entrega *").fill("2026-11-04");
  const downloadPromise = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Excel editable" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain(".xlsx");
  await dialog
    .getByRole("checkbox", { name: /Confirmo que YA ENTREGUÉ/ })
    .check();
  await dialog
    .getByRole("button", { name: "Confirmar entrega y cerrar informe" })
    .click();
  await expect(
    dialog.getByText("Instantánea protegida.", { exact: false }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Cerrar", exact: true }).click();
  await page.getByLabel("Mes académico del informe").fill("2026-12");
  await page.getByRole("button", { name: "Consultar pendientes" }).click();
  await expect(
    page.getByRole("heading", { name: "1 notas pendientes" }),
  ).toBeVisible();
  await expect(
    page.getByRole("row").filter({ hasText: "Photoshop" }),
  ).toBeVisible();
  await expect(
    page.getByRole("row").filter({ hasText: "Illustrator" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Historial", exact: true }).click();
  await page.getByRole("button", { name: "Abrir informe" }).click();
  dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("row").filter({ hasText: "Illustrator" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("demostración aislada y diseño móvil sin desbordamiento", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Probar con datos ficticios" })
    .click();
  await expect(
    page.getByText(
      "Modo demostración · Todos los datos de este espacio son ficticios.",
    ),
  ).toBeVisible();
  await expect(
    page.getByText("Juan (FICTICIO) Ejemplo", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Volver a mis datos" }).click();
  await expect(
    page.getByText("Juan (FICTICIO) Ejemplo", { exact: true }),
  ).toHaveCount(0);
});

test("vista previa agrupa al estudiante y abre el PDF carta sin presentar notas", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Probar con datos ficticios" })
    .click();
  await page.getByRole("button", { name: /^Informes/ }).click();
  await page.getByLabel("Mes académico del informe").fill("2026-11");
  await page.getByRole("button", { name: "Consultar pendientes" }).click();
  await page
    .getByRole("checkbox", { name: "Seleccionar todas las notas" })
    .check();
  await page.getByRole("button", { name: "Vista previa (2)" }).click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("row").filter({ hasText: "Juan (FICTICIO) Ejemplo" }),
  ).toHaveCount(1);
  await expect(
    dialog.getByRole("columnheader", { name: "Illustrator", exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("columnheader", { name: "Photoshop", exact: true }),
  ).toBeVisible();
  const row = dialog
    .getByRole("row")
    .filter({ hasText: "Juan (FICTICIO) Ejemplo" });
  await expect(
    row.getByRole("cell", { name: "85", exact: true }),
  ).toBeVisible();
  await expect(row.getByRole("cell", { name: "0", exact: true })).toBeVisible();
  const popupPromise = page.waitForEvent("popup");
  const responsePromise = page.waitForResponse((response) =>
    response.url().includes("/export/pdf"),
  );
  await dialog.getByRole("button", { name: "Abrir PDF para imprimir" }).click();
  const popup = await popupPromise;
  expect((await responsePromise).ok()).toBe(true);
  await expect.poll(() => popup.url()).toMatch(/^blob:/);
  await popup.close();
  await expect(
    dialog.getByRole("button", { name: "Confirmar entrega y cerrar informe" }),
  ).toBeDisabled();
});
