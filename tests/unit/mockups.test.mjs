import test from "node:test";
import assert from "node:assert/strict";

/**
 * Mockups de pantallas (`src/utils/mockups.js`).
 *
 * Se protege el contrato que viaja dentro de `diagrams.data`: dispositivos,
 * elementos configurables, tipos de nodo, conectores desde un botón y los
 * comentarios de revisión del equipo.
 */
import {
  DEVICES,
  DEVICE_GROUPS,
  WIDGETS,
  WIDGET_GROUPS,
  deviceMeta,
  makeComment,
  makeScreenNode,
  makeWidget,
  mockupStats,
  normalizeComment,
  normalizeComments,
  normalizeScreen,
  normalizeWidget,
  normalizeWidgets,
  screenContentSize,
  screenInsets,
  screenLinks,
  screenSize,
  widgetAnchor,
  widgetHandleId,
  SCREEN_SHAPE,
  SCREEN_TYPE,
} from "../../src/utils/mockups.js";
import {
  TEMPLATES,
  createDiagram,
  diagramStats,
  inspectDiagramPayload,
  makeEdge,
  normalizeDiagram,
  repairDiagramPayload,
  serializeDiagram,
} from "../../src/utils/diagrams.js";
import { edgeAnchor, routeDiagramEdges } from "../../src/utils/diagramGeometry.js";

test("el catálogo de dispositivos es coherente y tiene alias", () => {
  const keys = DEVICES.map((device) => device.key);
  assert.equal(new Set(keys).size, keys.length);
  DEVICES.forEach((device) => {
    assert.ok(device.width > 100 && device.height > 100, `${device.key} debe tener tamaño`);
    assert.ok(DEVICE_GROUPS.some((group) => group.key === device.group), `${device.key} sin grupo`);
    assert.ok(Number.isFinite(screenInsets(device).top));
  });
  assert.equal(deviceMeta("iPhone 15 Pro").key, "iphone-15-pro");
  assert.equal(deviceMeta("android").key, "pixel-8");
  assert.equal(deviceMeta("tablet").key, "ipad");
  assert.equal(deviceMeta("escritorio").key, "desktop");
  assert.equal(deviceMeta("desconocido").key, DEVICES[0].key);
  assert.deepEqual(screenSize("iphone-se"), { width: 375, height: 667 });

  // El área útil descuenta el marco y la barra del navegador.
  const web = screenContentSize("desktop");
  assert.equal(web.width, 1440);
  assert.ok(web.height < 900);
});

test("los elementos tienen estilos por defecto válidos y todos los grupos existen", () => {
  WIDGETS.forEach((widget) => {
    assert.ok(WIDGET_GROUPS.some((group) => group.key === widget.group), `${widget.key} sin grupo`);
    assert.ok(widget.w > 0 && widget.h > 0);
  });
  const button = makeWidget("boton", { x: 10.4, y: 20.6 });
  assert.equal(button.type, "button");
  assert.equal(button.x, 10);
  assert.equal(button.y, 21);
  assert.equal(button.style.fill, "#0060fc");
  assert.equal(button.style.fontWeight, 700);

  // Alias y tipos desconocidos caen a un elemento conocido, sin romper el lienzo.
  assert.equal(normalizeWidget({ type: "switch" }).type, "toggle");
  assert.equal(normalizeWidget({ type: "inventado" }).type, "text");
  assert.equal(normalizeWidget(null), null);
});

test("normaliza elementos guardados con datos incompletos o inválidos", () => {
  const widget = normalizeWidget({
    id: "w1",
    type: "button",
    position: { x: "20", y: 30 },
    width: "400",
    style: { fill: "javascript:alert(1)", fontSize: 900, radius: -20, align: "weird" },
    props: { href: "https://appsline.com.mx" },
  });
  assert.equal(widget.x, 20);
  assert.equal(widget.w, 400);
  assert.equal(widget.style.fill, "#0060fc", "un color inválido cae al del tipo");
  assert.equal(widget.style.fontSize, 200, "el tamaño se limita");
  assert.equal(widget.style.radius, 0);
  assert.equal(widget.style.align, "center");
  assert.equal(widget.props.href, "https://appsline.com.mx");
  assert.equal(normalizeWidgets("nada").length, 0);
});

test("una pantalla conserva dispositivo, fondo, elementos y tamaño al serializar", () => {
  const node = makeScreenNode("pixel-8", { x: 100, y: 50 }, {
    data: {
      label: "Checkout",
      background: "gradient-blue",
      start: true,
      widgets: [
        makeWidget("heading", { x: 16, y: 80 }, { text: "Pagar" }),
        makeWidget("button", { x: 16, y: 400 }, { text: "Confirmar" }),
      ],
    },
  });
  assert.equal(node.type, SCREEN_TYPE);
  assert.equal(node.data.shape, SCREEN_SHAPE);
  assert.equal(node.width, 412);
  assert.equal(node.height, 915);
  assert.equal(node.data.background, "linear-gradient(160deg,#0b1220 0%,#1d4ed8 100%)");
  assert.equal(node.data.widgets.length, 2);

  const diagram = normalizeDiagram({
    name: "Mockup",
    data: { version: 1, nodes: [node], edges: [], settings: {}, comments: [] },
  });
  const payload = serializeDiagram(diagram);
  const reloaded = normalizeDiagram(JSON.parse(JSON.stringify(payload)));
  assert.equal(reloaded.data.nodes[0].type, SCREEN_TYPE);
  assert.equal(reloaded.data.nodes[0].data.device, "pixel-8");
  assert.equal(reloaded.data.nodes[0].data.start, true);
  assert.deepEqual(
    reloaded.data.nodes[0].data.widgets.map((widget) => [widget.type, widget.text]),
    [["heading", "Pagar"], ["button", "Confirmar"]],
  );
});

test("una pantalla sin datos sigue siendo un nodo válido con su dispositivo", () => {
  const node = normalizeDiagram({
    data: { nodes: [{ id: "x", type: "screen", position: { x: 0, y: 0 }, data: {} }], edges: [] },
  }).data.nodes[0];
  assert.equal(node.type, SCREEN_TYPE);
  assert.equal(node.data.shape, SCREEN_SHAPE);
  assert.equal(node.width, DEVICES[0].width);
  assert.deepEqual(node.data.widgets, []);
});

test("las flechas que salen de un elemento conservan su conector", () => {
  const screen = makeScreenNode("iphone-15-pro", { x: 0, y: 0 }, {
    id: "scr",
    data: { widgets: [makeWidget("button", { x: 20, y: 300 }, { id: "btn" })] },
  });
  const target = makeScreenNode("iphone-15-pro", { x: 600, y: 0 }, { id: "scr2" });
  const edges = [makeEdge("scr", "scr2", { sourceHandle: widgetHandleId("btn"), targetHandle: "left" })];
  const routed = routeDiagramEdges([screen, target], edges);
  assert.equal(routed[0].sourceHandle, "w:btn");
  assert.equal(routed[0].targetHandle, "left");

  // Un conector antiguo e inválido sí se recalcula por geometría.
  const legacy = routeDiagramEdges([screen, target], [makeEdge("scr", "scr2", { sourceHandle: "bad" })]);
  assert.equal(legacy[0].sourceHandle, "right");

  const inset = screenInsets("iphone-15-pro");
  const button = screen.data.widgets[0];
  const anchor = edgeAnchor(screen, "w:btn");
  assert.equal(anchor.x, screen.position.x + inset.left + 20 + button.w);
  assert.equal(anchor.y, screen.position.y + inset.top + 300 + button.h / 2);
  assert.deepEqual(widgetAnchor(screen, "btn"), { x: inset.left + 20 + button.w, y: inset.top + 300 + button.h / 2 });
});

test("normalizeScreen tolera datos de otra integración", () => {
  const screen = normalizeScreen({
    deviceKey: "ipad",
    backgroundColor: "linear-gradient(180deg,#111827,#1f2937)",
    elements: [{ kind: "title", x: 10, y: 10 }, { kind: "img", x: 0, y: 0 }],
  });
  assert.equal(screen.device, "ipad");
  assert.match(screen.background, /^linear-gradient/);
  assert.deepEqual(screen.widgets.map((widget) => widget.type), ["heading", "image"]);
  assert.equal(screen.statusBar, true);
  assert.equal(normalizeScreen({ background: "url(javascript:)" }).background, "#ffffff");
});

test("los comentarios se normalizan y se guardan con el diagrama", () => {
  const comment = makeComment({
    text: "  Falta el estado vacío  ",
    author: { id: 7, name: "Ana Pérez" },
    nodeId: "scr",
    widgetId: "btn",
  });
  assert.equal(comment.author.name, "Ana Pérez");
  assert.equal(comment.resolved, false);
  const legacy = normalizeComment({ body: "Revisar contraste", author: "Luis", nodeId: "n1", status: "resolved" });
  assert.equal(legacy.text, "Revisar contraste");
  assert.equal(legacy.author.name, "Luis");
  assert.equal(legacy.resolved, true);
  assert.equal(normalizeComment({ text: "   " }), null);
  assert.equal(normalizeComments([legacy, null, { text: 5 }]).length, 1);

  const diagram = createDiagram({ template: "mockup-app" });
  diagram.data.comments = [comment, legacy];
  const reloaded = normalizeDiagram(JSON.parse(JSON.stringify(serializeDiagram(diagram))));
  assert.equal(reloaded.data.comments.length, 2);
  assert.equal(reloaded.data.comments[0].text, "Falta el estado vacío");
  assert.equal(reloaded.data.comments[1].node_id, "n1");
});

test("las plantillas de mockup traen pantallas conectadas y son válidas", () => {
  const mockups = TEMPLATES.filter((template) => template.key.startsWith("mockup-"));
  assert.ok(mockups.length >= 2);
  mockups.forEach((template) => {
    const built = template.build();
    assert.ok(built.nodes.length >= 2, `${template.key} necesita pantallas`);
    built.nodes.forEach((node) => {
      assert.equal(node.type, SCREEN_TYPE, `${template.key}: nodo ${node.id}`);
      assert.equal(node.data.shape, SCREEN_SHAPE);
      assert.ok(node.data.device);
    });
    const ids = new Set(built.nodes.map((node) => node.id));
    built.edges.forEach((edge) => {
      assert.ok(ids.has(edge.source) && ids.has(edge.target), `${template.key}: conexión huérfana`);
    });
    // Se puede guardar y volver a leer sin perder pantallas ni conexiones.
    const diagram = normalizeDiagram({
      name: template.label,
      data: { version: 1, nodes: built.nodes, edges: built.edges, settings: {} },
    });
    const reloaded = normalizeDiagram(JSON.parse(JSON.stringify(serializeDiagram(diagram))));
    assert.equal(reloaded.data.nodes.length, built.nodes.length);
    assert.equal(reloaded.data.edges.length, built.edges.length);
    assert.equal(reloaded.data.edges.filter((edge) => String(edge.sourceHandle).startsWith("w:")).length,
      built.edges.filter((edge) => String(edge.sourceHandle).startsWith("w:")).length);
  });
});

test("el resumen y la navegación del prototipo usan las conexiones reales", () => {
  const login = makeScreenNode("iphone-15-pro", { x: 0, y: 0 }, {
    id: "login",
    data: { label: "Acceso", start: true, widgets: [makeWidget("button", { x: 10, y: 200 }, { id: "entrar", text: "Entrar" })] },
  });
  const home = makeScreenNode("iphone-15-pro", { x: 500, y: 0 }, { id: "home", data: { label: "Inicio" } });
  const edges = [
    makeEdge("login", "home", { sourceHandle: "w:entrar", data: { label: "Entrar" } }),
    makeEdge("home", "login", { sourceHandle: "left", targetHandle: "right", data: { label: "Salir" } }),
  ];
  const links = screenLinks([login, home], edges, "login");
  assert.equal(links.length, 1);
  assert.equal(links[0].targetId, "home");
  assert.equal(links[0].originWidgetId, "entrar");
  assert.equal(links[0].label, "Entrar");

  const stats = mockupStats([login, home], [{ id: "c1", resolved: false }, { id: "c2", resolved: true }]);
  assert.deepEqual(stats, { screens: 2, widgets: 1, comments: 2, openComments: 1, hasMockups: true });
  assert.equal(diagramStats({ data: { nodes: [login, home], edges } }).screens, 2);
});

test("los estados de selección no se guardan en el diagrama", () => {
  const node = makeScreenNode("iphone-15-pro", { x: 0, y: 0 }, { id: "s", data: { selected: true, widgets: [] } });
  const payload = serializeDiagram(normalizeDiagram({ data: { nodes: [{ ...node, selected: true }], edges: [] } }));
  assert.equal(payload.data.nodes[0].selected, undefined);
  assert.equal(payload.data.nodes[0].data.selected, undefined);
});

test("la integridad detecta una pantalla podada y la restaura desde la copia local", () => {
  const screen = makeScreenNode("iphone-15-pro", { x: 0, y: 0 }, {
    id: "scr",
    data: { device: "iphone-15-pro", widgets: [makeWidget("button", { x: 10, y: 10 }, { id: "btn", text: "Entrar" })] },
  });
  const payload = serializeDiagram(normalizeDiagram({ data: { nodes: [screen], edges: [] } }));

  // Lo que deja una API con reglas anidadas: se queda solo con label.
  const pruned = {
    id: 1,
    data: {
      nodes: [{ id: "scr", type: "screen", position: { x: 0, y: 0 }, data: { label: "Inicio" } }],
      edges: [],
      settings: {},
    },
  };
  const report = inspectDiagramPayload(pruned);
  assert.equal(report.ok, false);
  assert.ok(report.missing.includes("data.nodes[].data.widgets"));
  assert.ok(report.missing.includes("data.nodes[].data.device"));

  const repaired = repairDiagramPayload(pruned, payload);
  assert.equal(repaired.data.nodes[0].data.widgets.length, 1);
  assert.equal(repaired.data.nodes[0].data.widgets[0].text, "Entrar");
  assert.equal(repaired.data.nodes[0].data.device, "iphone-15-pro");
});
