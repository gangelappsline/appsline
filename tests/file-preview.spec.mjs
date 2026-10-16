import { test, expect } from "@playwright/test";
import JSZip from "jszip";
import { Document, Packer, Paragraph } from "docx";

/**
 * Previsualización de archivos del proyecto (pestaña Archivos):
 * iconos por tipo (Word/Excel/PowerPoint/PDF...) y vista previa en el
 * navegador de TXT, CSV, DOCX, XLSX y PPTX sin salir del panel.
 *
 * Los archivos de prueba se generan aquí mismo (un .docx real con el paquete
 * `docx`, un .xlsx y un .pptx armados como ZIP) y se sirven interceptando la
 * red: no se usa ninguna cuenta ni dato real.
 */

const project = {
  id: 1,
  name: "Portal de clientes",
  description: "Un espacio para colaborar con nuestros clientes.",
  status: "active",
  client_name: "Cliente de prueba",
  budget: 45000,
  end_date: "2026-11-20",
};
const user = { id: 1, name: "Ana García", email: "ana@example.test" };
const tasks = [
  { id: 11, title: "Diseñar navegación", description: "Definir la estructura.", status: "pending", priority: "high" },
];

const buildXlsx = async () => {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/></Types>`);
  zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
  zip.file("xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Presupuesto" sheetId="1" r:id="rId1"/></sheets></workbook>`);
  zip.file("xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>`);
  zip.file("xl/sharedStrings.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="3" uniqueCount="3"><si><t>Concepto</t></si><si><t>Importe</t></si><si><t>Diseño</t></si></sst>`);
  zip.file("xl/worksheets/sheet1.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row><row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2"><v>45000</v></c></row></sheetData></worksheet>`);
  return zip.generateAsync({ type: "nodebuffer" });
};

const buildPptx = async () => {
  const zip = new JSZip();
  const slide = (text) =>
    `<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>${text}</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>`;
  zip.file("ppt/slides/slide1.xml", slide("Portada del proyecto"));
  zip.file("ppt/slides/slide2.xml", slide("Segunda diapositiva"));
  return zip.generateAsync({ type: "nodebuffer" });
};

const fileBodies = {
  "notas.txt": {
    type: "text/plain",
    body: Buffer.from("Notas de la reunión\n- Revisar el alcance con el cliente.\n- Enviar la propuesta el viernes."),
  },
  "datos.csv": {
    type: "text/csv",
    body: Buffer.from("Nombre,Importe\nDiseño,45000\nDesarrollo,60000"),
  },
};

const apiFiles = [
  { id: 1, name: "contrato.docx", url: "/files/contrato.docx", size: 12000, created_at: "2026-10-01T10:00:00Z" },
  { id: 2, name: "presupuesto.xlsx", url: "/files/presupuesto.xlsx", size: 9000, created_at: "2026-10-02T10:00:00Z" },
  { id: 3, name: "presentacion.pptx", url: "/files/presentacion.pptx", size: 15000, created_at: "2026-10-03T10:00:00Z" },
  { id: 4, name: "notas.txt", url: "/files/notas.txt", size: 120, created_at: "2026-10-04T10:00:00Z" },
  { id: 5, name: "datos.csv", url: "/files/datos.csv", size: 60, created_at: "2026-10-05T10:00:00Z" },
];

test.beforeAll(async () => {
  fileBodies["contrato.docx"] = {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    body: await Packer.toBuffer(
      new Document({
        sections: [
          {
            children: [
              new Paragraph("Contrato de prestación de servicios"),
              new Paragraph("Las partes acuerdan el alcance del proyecto Portal de clientes."),
            ],
          },
        ],
      })
    ),
  };
  fileBodies["presupuesto.xlsx"] = {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    body: await buildXlsx(),
  };
  fileBodies["presentacion.pptx"] = {
    type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    body: await buildPptx(),
  };
});

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("user_token", "local-e2e-fixture");
    localStorage.setItem("user", JSON.stringify({ id: 1, name: "Ana García" }));
  });
  await page.route("**/*", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path.startsWith("/files/")) {
      const fixture = fileBodies[decodeURIComponent(path.split("/").pop())];
      if (fixture) return route.fulfill({ body: fixture.body, contentType: fixture.type });
      return route.fulfill({ status: 404, body: "no encontrado" });
    }
    if (!["xhr", "fetch"].includes(request.resourceType())) return route.continue();
    let data = [];
    if (path.endsWith("/projects")) data = [project];
    else if (path.endsWith("/projects/1")) data = project;
    else if (path.endsWith("/users")) data = [user];
    else if (path.endsWith("/projects/1/tasks")) data = tasks;
    else if (path.endsWith("/projects/1/files")) data = apiFiles;
    await route.fulfill({ json: { data } });
  });
  await page.goto("/admin/projects/1");
  await page.getByRole("tab", { name: /Archivos/ }).click();
  await expect(page.getByText("contrato.docx")).toBeVisible();
});

const openPreview = async (page, fileName) => {
  const card = page.getByRole("article").filter({ hasText: fileName });
  await card.getByRole("button", { name: "Previsualizar" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  return dialog;
};

test("cada tipo de archivo muestra su icono y extensión, no un icono gris", async ({ page }) => {
  const card = page.getByRole("article").filter({ hasText: "presupuesto.xlsx" });
  await expect(card.getByText(".xlsx", { exact: true })).toBeVisible();
  await expect(card.getByText("Hoja de cálculo")).toBeVisible();
  await expect(
    page.getByRole("article").filter({ hasText: "contrato.docx" }).getByText(".docx", { exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole("article").filter({ hasText: "presentacion.pptx" }).getByText(".pptx", { exact: true })
  ).toBeVisible();
});

test("previsualiza TXT y CSV dentro del panel", async ({ page }) => {
  const txtDialog = await openPreview(page, "notas.txt");
  await expect(txtDialog.getByText(/Revisar el alcance con el cliente/)).toBeVisible();
  await txtDialog.getByRole("button", { name: "Cerrar" }).click();

  const csvDialog = await openPreview(page, "datos.csv");
  await expect(csvDialog.getByRole("cell", { name: "Desarrollo" })).toBeVisible();
  await expect(csvDialog.getByRole("cell", { name: "60,000" })).toBeVisible();
});

test("previsualiza un DOCX convertido en el navegador", async ({ page }) => {
  const dialog = await openPreview(page, "contrato.docx");
  await expect(dialog.getByText("Contrato de prestación de servicios")).toBeVisible();
  await expect(dialog.getByText(/Las partes acuerdan el alcance/)).toBeVisible();
});

test("previsualiza un XLSX por hojas como tabla", async ({ page }) => {
  const dialog = await openPreview(page, "presupuesto.xlsx");
  await expect(dialog.getByRole("columnheader", { name: "Concepto" })).toBeVisible();
  await expect(dialog.getByRole("cell", { name: "Diseño" })).toBeVisible();
  await expect(dialog.getByRole("cell", { name: "45,000" })).toBeVisible();
});

test("previsualiza un PPTX por diapositivas", async ({ page }) => {
  const dialog = await openPreview(page, "presentacion.pptx");
  await expect(dialog.getByText("Portada del proyecto")).toBeVisible();
  await expect(dialog.getByText("Segunda diapositiva")).toBeVisible();
  await expect(dialog.getByText(/Vista simplificada/)).toBeVisible();
});
