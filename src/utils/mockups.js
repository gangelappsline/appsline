import { normalizeDiagramImage } from "./diagramMedia.js";

/**
 * Mockups de pantallas (web, iOS, Android, tablet).
 *
 * Un mockup vive dentro del mismo diagrama que los flujos: cada pantalla es un
 * nodo de React Flow (`type: "screen"`) y las flechas que ya existen en el
 * editor conectan pantallas entre sí o un botón concreto de una pantalla con la
 * siguiente. Así el equipo valida el flujo completo sin salir del diagrama.
 *
 * Modelo serializado (contrato en `docs/API-MOCKUPS.md`):
 *
 * {
 *   "id": "n_...", "type": "screen",
 *   "position": { "x": 120, "y": 80 },
 *   "width": 393, "height": 852,
 *   "data": {
 *     "shape": "screen",
 *     "label": "Inicio de sesión",
 *     "device": "iphone-15-pro",
 *     "background": "linear-gradient(...)",
 *     "statusBar": true,
 *     "start": true,
 *     "widgets": [
 *       { "id": "w_...", "type": "heading", "x": 24, "y": 120, "w": 345, "h": 36,
 *         "text": "Bienvenido", "style": { ... }, "props": { ... } }
 *     ],
 *     "style": { "fill": "#ffffff", "stroke": "#94a3b8", ... }
 *   }
 * }
 *
 * Nada de esto necesita tablas nuevas: viaja en `diagrams.data` y la API lo
 * guarda y lo devuelve tal cual. Los comentarios del equipo viven en
 * `data.comments` (ver §6 de la documentación) con opción de tabla propia.
 *
 * Cubierto por `tests/unit/mockups.test.mjs`.
 */

export const MOCKUP_VERSION = 1;
/** Forma del nodo de pantalla dentro del catálogo de formas. */
export const SCREEN_SHAPE = "screen";
/** Tipo de nodo de React Flow para las pantallas. */
export const SCREEN_TYPE = "screen";
/** Prefijo de los conectores que salen de un elemento de la pantalla. */
export const WIDGET_HANDLE_PREFIX = "w:";

/* ------------------------------------------------------------------ */
/* Dispositivos                                                        */
/* ------------------------------------------------------------------ */

/**
 * Marcos disponibles. `width`/`height` son el tamaño REAL del área de pantalla
 * (no la resolución del dispositivo): así los elementos se colocan en píxeles
 * de diseño, igual que en Figma.
 */
export const DEVICES = [
  {
    key: "iphone-15-pro", label: "iPhone 15 Pro", platform: "ios", group: "ios",
    width: 393, height: 852, radius: 54, bezel: 10,
    notch: "island", statusBar: true, homeIndicator: true,
    safeArea: { top: 59, bottom: 34, left: 0, right: 0 },
  },
  {
    key: "iphone-15", label: "iPhone 15 / 14", platform: "ios", group: "ios",
    width: 390, height: 844, radius: 48, bezel: 10,
    notch: "island", statusBar: true, homeIndicator: true,
    safeArea: { top: 59, bottom: 34, left: 0, right: 0 },
  },
  {
    key: "iphone-se", label: "iPhone SE", platform: "ios", group: "ios",
    width: 375, height: 667, radius: 22, bezel: 12,
    notch: "classic", statusBar: true, homeIndicator: false,
    safeArea: { top: 20, bottom: 0, left: 0, right: 0 },
  },
  {
    key: "pixel-8", label: "Pixel 8", platform: "android", group: "android",
    width: 412, height: 915, radius: 40, bezel: 9,
    notch: "punch", statusBar: true, homeIndicator: false, navBar: true,
    safeArea: { top: 32, bottom: 24, left: 0, right: 0 },
  },
  {
    key: "galaxy-s24", label: "Galaxy S24", platform: "android", group: "android",
    width: 360, height: 780, radius: 34, bezel: 9,
    notch: "punch", statusBar: true, homeIndicator: false, navBar: true,
    safeArea: { top: 28, bottom: 24, left: 0, right: 0 },
  },
  {
    key: "android-compact", label: "Android compacto", platform: "android", group: "android",
    width: 360, height: 640, radius: 18, bezel: 8,
    notch: "none", statusBar: true, homeIndicator: false, navBar: true,
    safeArea: { top: 24, bottom: 20, left: 0, right: 0 },
  },
  {
    key: "ipad", label: "iPad 11\"", platform: "ipados", group: "tablet",
    width: 834, height: 1194, radius: 26, bezel: 14,
    notch: "none", statusBar: true, homeIndicator: true,
    safeArea: { top: 24, bottom: 20, left: 0, right: 0 },
  },
  {
    key: "android-tablet", label: "Tablet Android", platform: "android", group: "tablet",
    width: 800, height: 1280, radius: 20, bezel: 12,
    notch: "none", statusBar: true, homeIndicator: false, navBar: true,
    safeArea: { top: 24, bottom: 20, left: 0, right: 0 },
  },
  {
    key: "desktop", label: "Escritorio 1440", platform: "web", group: "web",
    width: 1440, height: 900, radius: 12, bezel: 0,
    notch: "browser", statusBar: false, homeIndicator: false, browserBar: true,
    safeArea: { top: 0, bottom: 0, left: 0, right: 0 },
  },
  {
    key: "laptop", label: "Laptop 1280", platform: "web", group: "web",
    width: 1280, height: 800, radius: 12, bezel: 0,
    notch: "browser", statusBar: false, homeIndicator: false, browserBar: true,
    safeArea: { top: 0, bottom: 0, left: 0, right: 0 },
  },
  {
    key: "web-mobile", label: "Web móvil 390", platform: "web", group: "web",
    width: 390, height: 844, radius: 24, bezel: 0,
    notch: "browser", statusBar: false, homeIndicator: false, browserBar: true,
    safeArea: { top: 0, bottom: 0, left: 0, right: 0 },
  },
  {
    key: "custom", label: "Personalizado", platform: "custom", group: "custom",
    width: 390, height: 844, radius: 20, bezel: 0,
    notch: "none", statusBar: false, homeIndicator: false,
    safeArea: { top: 0, bottom: 0, left: 0, right: 0 },
  },
];

export const DEVICE_GROUPS = [
  { key: "ios", label: "iPhone" },
  { key: "android", label: "Android" },
  { key: "tablet", label: "Tablet" },
  { key: "web", label: "Web" },
  { key: "custom", label: "Libre" },
];

export const DEVICE_ALIASES = {
  iphone: "iphone-15-pro", ios: "iphone-15-pro", apple: "iphone-15-pro",
  "iphone-15-pro-max": "iphone-15-pro", "iphone-14": "iphone-15", "iphone-13": "iphone-15",
  android: "pixel-8", pixel: "pixel-8", samsung: "galaxy-s24", galaxy: "galaxy-s24",
  ipad: "ipad", tablet: "ipad", "tablet-android": "android-tablet",
  web: "desktop", desktop: "desktop", escritorio: "desktop", laptop: "laptop",
  browser: "desktop", "web-mobile": "web-mobile", movil: "iphone-15-pro",
  mobile: "iphone-15-pro", telefono: "iphone-15-pro", phone: "iphone-15-pro",
  custom: "custom", personalizado: "custom",
};

const DEVICE_FALLBACK = DEVICES[0];

/** Nombre normalizado para buscar dispositivos por alias. */
const keyName = (value) =>
  String(value)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s_/]+/g, "-");

/** Dispositivo por clave, alias o etiqueta; nunca devuelve `undefined`. */
export const deviceMeta = (value) => {
  const key = keyName(value);
  if (!key) return DEVICE_FALLBACK;
  return (
    DEVICES.find((device) => device.key === key) ||
    DEVICES.find((device) => device.label.toLowerCase() === String(value).toLowerCase()) ||
    DEVICES.find((device) => device.key === DEVICE_ALIASES[key]) ||
    DEVICE_FALLBACK
  );
};

/** Tamaño del área de pantalla (sin marco). */
export const screenSize = (device) => {
  const meta = deviceMeta(typeof device === "object" && device ? device.key : device);
  return { width: meta.width, height: meta.height };
};

/* ------------------------------------------------------------------ */
/* Fondos de pantalla                                                  */
/* ------------------------------------------------------------------ */

export const SCREEN_BACKGROUNDS = [
  { key: "white", label: "Blanco", value: "#ffffff" },
  { key: "light", label: "Gris claro", value: "#f1f5f9" },
  { key: "brand", label: "Azul Appsline", value: "#0060fc" },
  { key: "dark", label: "Oscuro", value: "#0f172a" },
  { key: "gradient-blue", label: "Degradado azul", value: "linear-gradient(160deg,#0b1220 0%,#1d4ed8 100%)" },
  { key: "gradient-violet", label: "Degradado violeta", value: "linear-gradient(160deg,#4c1d95 0%,#7c3aed 55%,#db2777 100%)" },
  { key: "gradient-mint", label: "Degradado menta", value: "linear-gradient(160deg,#ecfeff 0%,#a7f3d0 100%)" },
  { key: "gradient-sunset", label: "Degradado atardecer", value: "linear-gradient(160deg,#fef3c7 0%,#fb923c 60%,#db2777 100%)" },
];

export const DEFAULT_SCREEN_BACKGROUND = "#ffffff";

/** Acepta clave de la paleta, color CSS o degradado; lo demás cae al blanco. */
export const normalizeScreenBackground = (value) => {
  if (typeof value !== "string" || !value.trim()) return DEFAULT_SCREEN_BACKGROUND;
  const text = value.trim();
  const preset = SCREEN_BACKGROUNDS.find((item) => item.key === text || item.value === text);
  if (preset) return preset.value;
  if (/^#[0-9a-f]{3,8}$/i.test(text)) return text;
  if (/^(linear|radial|conic)-gradient\([^;{}"'<>]*\)$/i.test(text)) return text;
  if (/^rgba?\([0-9.,\s%]+\)$/i.test(text)) return text;
  return DEFAULT_SCREEN_BACKGROUND;
};

/* ------------------------------------------------------------------ */
/* Elementos de la pantalla                                            */
/* ------------------------------------------------------------------ */

const BASE_WIDGET_STYLE = {
  fill: "#ffffff",
  textColor: "#0f172a",
  borderColor: "#cbd5e1",
  borderWidth: 0,
  radius: 12,
  fontSize: 15,
  fontWeight: 500,
  fontStyle: "normal",
  align: "left",
  valign: "middle",
  padding: 12,
  opacity: 1,
  shadow: false,
  underline: false,
  letterSpacing: 0,
  lineHeight: 1.35,
  icon: "",
  iconSize: 20,
  imageFit: "cover",
  rotate: 0,
};

export const BASE_STYLE = BASE_WIDGET_STYLE;

/** Paleta de la pantalla: se aplica a los elementos elegidos. */
export const WIDGET_COLORS = [
  { key: "brand", label: "Azul", fill: "#0060fc", textColor: "#ffffff", borderColor: "#0060fc" },
  { key: "ink", label: "Tinta", fill: "#0f172a", textColor: "#ffffff", borderColor: "#0f172a" },
  { key: "white", label: "Blanco", fill: "#ffffff", textColor: "#0f172a", borderColor: "#cbd5e1" },
  { key: "muted", label: "Gris", fill: "#f1f5f9", textColor: "#0f172a", borderColor: "#e2e8f0" },
  { key: "green", label: "Verde", fill: "#16a34a", textColor: "#ffffff", borderColor: "#16a34a" },
  { key: "red", label: "Rojo", fill: "#dc2626", textColor: "#ffffff", borderColor: "#dc2626" },
  { key: "amber", label: "Ámbar", fill: "#f59e0b", textColor: "#1f2937", borderColor: "#f59e0b" },
  { key: "violet", label: "Violeta", fill: "#7c3aed", textColor: "#ffffff", borderColor: "#7c3aed" },
  { key: "clear", label: "Transparente", fill: "transparent", textColor: "#0f172a", borderColor: "transparent" },
];

/**
 * Catálogo de elementos. `w`/`h` y `style` son el punto de partida; todo se
 * puede cambiar después desde el panel de propiedades.
 */
export const WIDGETS = [
  // Texto
  { key: "heading", label: "Título", group: "text", hint: "Encabezado de la pantalla", w: 300, h: 38, text: "Título de la pantalla", style: { fontSize: 26, fontWeight: 700, align: "left", padding: 0, fill: "transparent" } },
  { key: "text", label: "Texto", group: "text", hint: "Párrafo o texto de apoyo", w: 300, h: 44, text: "Texto de apoyo para explicar la pantalla.", style: { fontSize: 15, fontWeight: 400, align: "left", padding: 0, fill: "transparent", textColor: "#475569" } },
  { key: "link", label: "Enlace", group: "text", hint: "Enlace de texto", w: 220, h: 24, text: "¿Olvidaste tu contraseña?", style: { fontSize: 14, fontWeight: 600, align: "left", padding: 0, fill: "transparent", textColor: "#0060fc", underline: true } },
  { key: "badge", label: "Etiqueta", group: "text", hint: "Chip de estado", w: 96, h: 26, text: "Nuevo", style: { fontSize: 12, fontWeight: 700, align: "center", fill: "#eaf3ff", textColor: "#0060fc", radius: 999, padding: 4 } },
  { key: "rating", label: "Valoración", group: "text", hint: "Estrellas de calificación", w: 132, h: 24, text: "", props: { value: 4 } },

  // Formulario
  { key: "input", label: "Campo de texto", group: "form", hint: "Entrada de una línea", w: 320, h: 48, text: "", style: { fill: "#ffffff", borderWidth: 1, borderColor: "#cbd5e1", radius: 12, padding: 14, fontSize: 15, fontWeight: 400, textColor: "#94a3b8" }, props: { placeholder: "Correo electrónico", value: "" } },
  { key: "textarea", label: "Área de texto", group: "form", hint: "Entrada de varias líneas", w: 320, h: 96, text: "", style: { fill: "#ffffff", borderWidth: 1, borderColor: "#cbd5e1", radius: 12, padding: 14, fontSize: 15, fontWeight: 400, textColor: "#94a3b8" }, props: { placeholder: "Cuéntanos más…" } },
  { key: "search", label: "Buscador", group: "form", hint: "Campo con lupa", w: 320, h: 44, text: "", style: { fill: "#f1f5f9", borderWidth: 0, radius: 999, padding: 14, fontSize: 15, fontWeight: 400, textColor: "#64748b", icon: "search", iconSize: 18 }, props: { placeholder: "Buscar" } },
  { key: "select", label: "Selector", group: "form", hint: "Lista desplegable", w: 320, h: 48, text: "Selecciona una opción", style: { fill: "#ffffff", borderWidth: 1, borderColor: "#cbd5e1", radius: 12, padding: 14, fontSize: 15, fontWeight: 500, textColor: "#0f172a" } },
  { key: "checkbox", label: "Casilla", group: "form", hint: "Selección múltiple", w: 260, h: 24, text: "Acepto los términos", style: { fill: "transparent", fontSize: 14, fontWeight: 500, align: "left", padding: 0 }, props: { checked: true } },
  { key: "radio", label: "Opción", group: "form", hint: "Selección única", w: 260, h: 24, text: "Opción seleccionada", style: { fill: "transparent", fontSize: 14, fontWeight: 500, align: "left", padding: 0 }, props: { checked: true } },
  { key: "toggle", label: "Interruptor", group: "form", hint: "Activar / desactivar", w: 280, h: 30, text: "Notificaciones", style: { fill: "transparent", fontSize: 14, fontWeight: 500, align: "left", padding: 0 }, props: { checked: true } },
  { key: "slider", label: "Deslizador", group: "form", hint: "Rango de valor", w: 300, h: 32, text: "", style: { fill: "transparent", padding: 0 }, props: { value: 60 } },

  // Acciones
  { key: "button", label: "Botón", group: "action", hint: "Acción principal", w: 320, h: 50, text: "Continuar", style: { fill: "#0060fc", textColor: "#ffffff", borderColor: "#0060fc", radius: 14, fontSize: 16, fontWeight: 700, align: "center", padding: 10, shadow: true } },
  { key: "button-secondary", label: "Botón secundario", group: "action", hint: "Acción alternativa", w: 320, h: 50, text: "Cancelar", style: { fill: "#ffffff", textColor: "#0f172a", borderColor: "#cbd5e1", borderWidth: 1, radius: 14, fontSize: 16, fontWeight: 600, align: "center", padding: 10 } },
  { key: "icon-button", label: "Botón de icono", group: "action", hint: "Acción compacta", w: 44, h: 44, text: "", style: { fill: "#f1f5f9", borderColor: "#e2e8f0", radius: 999, align: "center", padding: 0, icon: "settings", iconSize: 20 } },
  { key: "fab", label: "Botón flotante", group: "action", hint: "Acción principal flotante", w: 56, h: 56, text: "", style: { fill: "#0060fc", textColor: "#ffffff", radius: 999, align: "center", padding: 0, icon: "plus", iconSize: 26, shadow: true } },

  // Contenido
  { key: "image", label: "Imagen", group: "content", hint: "Imagen propia dentro de la pantalla", w: 320, h: 180, text: "", style: { fill: "#f1f5f9", borderColor: "#e2e8f0", borderWidth: 1, radius: 14, padding: 0 } },
  { key: "avatar", label: "Avatar", group: "content", hint: "Foto o iniciales", w: 56, h: 56, text: "AL", style: { fill: "#eaf3ff", textColor: "#0060fc", radius: 999, fontSize: 18, fontWeight: 700, align: "center", padding: 0 } },
  { key: "icon", label: "Icono", group: "content", hint: "Icono de la biblioteca", w: 40, h: 40, text: "", style: { fill: "transparent", align: "center", padding: 0, icon: "star", iconSize: 28, textColor: "#0060fc" } },
  { key: "video", label: "Video", group: "content", hint: "Reproductor", w: 320, h: 180, text: "", style: { fill: "#0f172a", radius: 14, padding: 0 } },
  { key: "card", label: "Tarjeta", group: "content", hint: "Contenedor con sombra", w: 330, h: 150, text: "Título de la tarjeta", style: { fill: "#ffffff", borderColor: "#e2e8f0", borderWidth: 1, radius: 18, fontSize: 17, fontWeight: 700, align: "left", valign: "top", padding: 18, shadow: true } },
  { key: "list", label: "Lista", group: "content", hint: "Filas de elementos", w: 330, h: 180, text: "Elemento uno\nElemento dos\nElemento tres", style: { fill: "#ffffff", borderColor: "#e2e8f0", borderWidth: 1, radius: 16, fontSize: 15, fontWeight: 500, align: "left", valign: "top", padding: 0 } },
  { key: "table", label: "Tabla", group: "content", hint: "Filas y columnas", w: 360, h: 160, text: "Nombre | Estado\nAna | Activo\nLuis | Pendiente", style: { fill: "#ffffff", borderColor: "#e2e8f0", borderWidth: 1, radius: 12, fontSize: 13, fontWeight: 500, align: "left", valign: "top", padding: 10 } },
  { key: "chart", label: "Gráfica", group: "content", hint: "Barras de ejemplo", w: 330, h: 170, text: "Ventas por mes", style: { fill: "#ffffff", borderColor: "#e2e8f0", borderWidth: 1, radius: 16, fontSize: 13, fontWeight: 700, align: "left", valign: "top", padding: 14 }, props: { values: [40, 65, 52, 78, 61] } },
  { key: "progress", label: "Progreso", group: "content", hint: "Barra de avance", w: 300, h: 10, text: "", style: { fill: "#e2e8f0", radius: 999, padding: 0, textColor: "#0060fc" }, props: { value: 65 } },
  { key: "map", label: "Mapa", group: "content", hint: "Marcador de ubicación", w: 330, h: 200, text: "", style: { fill: "#e8f0e6", borderColor: "#d5e3d1", borderWidth: 1, radius: 16, padding: 0 } },
  { key: "gallery", label: "Galería", group: "content", hint: "Cuadrícula de imágenes", w: 330, h: 220, text: "", style: { fill: "#f1f5f9", radius: 14, padding: 6 }, props: { columns: 3 } },

  // Estructura
  { key: "appbar", label: "Barra superior", group: "layout", hint: "Encabezado con título", w: 393, h: 56, text: "Inicio", style: { fill: "#ffffff", borderColor: "#e2e8f0", borderWidth: 0, radius: 0, fontSize: 17, fontWeight: 700, align: "left", padding: 16, shadow: true } },
  { key: "tabbar", label: "Barra inferior", group: "layout", hint: "Navegación principal", w: 393, h: 76, text: "Inicio | Buscar | Favoritos | Perfil", style: { fill: "#ffffff", borderColor: "#e2e8f0", borderWidth: 0, radius: 0, fontSize: 11, fontWeight: 600, align: "center", padding: 6, shadow: true } },
  { key: "divider", label: "Divisor", group: "layout", hint: "Línea de separación", w: 330, h: 1, text: "", style: { fill: "#e2e8f0", padding: 0, radius: 0 } },
  { key: "modal", label: "Diálogo", group: "layout", hint: "Ventana sobre la pantalla", w: 320, h: 220, text: "¿Deseas continuar?", style: { fill: "#ffffff", borderColor: "#e2e8f0", borderWidth: 0, radius: 20, fontSize: 17, fontWeight: 700, align: "center", valign: "top", padding: 24, shadow: true } },
  { key: "keyboard", label: "Teclado", group: "layout", hint: "Teclado en pantalla", w: 393, h: 260, text: "", style: { fill: "#e5e7eb", radius: 0, padding: 8 } },
  { key: "browser-bar", label: "Barra del navegador", group: "layout", hint: "URL y controles", w: 1280, h: 52, text: "app.appsline.com.mx", style: { fill: "#f1f5f9", borderColor: "#e2e8f0", borderWidth: 0, radius: 0, fontSize: 13, fontWeight: 500, align: "center", padding: 12 } },
];

export const WIDGET_GROUPS = [
  { key: "text", label: "Texto" },
  { key: "form", label: "Formulario" },
  { key: "action", label: "Acciones" },
  { key: "content", label: "Contenido" },
  { key: "layout", label: "Estructura" },
];

export const WIDGET_ALIASES = {
  title: "heading", titulo: "heading", header: "heading", h1: "heading", h2: "heading",
  paragraph: "text", body: "text", label: "text", texto: "text", parrafo: "text",
  anchor: "link", enlace: "link", url: "link",
  chip: "badge", tag: "badge", etiqueta: "badge", status: "badge", estado: "badge",
  stars: "rating", estrellas: "rating", valoracion: "rating",
  field: "input", input_text: "input", textfield: "input", campo: "input", entrada: "input",
  textarea_field: "textarea", area: "textarea", multiline: "textarea",
  searchbar: "search", buscador: "search", busqueda: "search", search_bar: "search",
  dropdown: "select", combobox: "select", selector: "select",
  checkbox: "checkbox", casilla: "checkbox", check: "checkbox",
  radio: "radio", opcion: "radio",
  switch: "toggle", interruptor: "toggle",
  range: "slider", deslizador: "slider",
  btn: "button", boton: "button", cta: "button", primary_button: "button",
  secondary_button: "button-secondary", outline_button: "button-secondary", "button-outline": "button-secondary",
  icon_button: "icon-button", iconbutton: "icon-button",
  floating: "fab", floating_button: "fab", fab_button: "fab",
  img: "image", picture: "image", photo: "image", imagen: "image",
  profile: "avatar", photo_round: "avatar", avatar: "avatar",
  icono: "icon", glyph: "icon",
  player: "video", video_player: "video", reproductor: "video",
  card: "card", tarjeta: "card", panel: "card",
  list: "list", lista: "list", listview: "list", list_view: "list",
  grid: "table", tabla: "table", datatable: "table",
  graph: "chart", grafica: "chart", chart_bar: "chart", bars: "chart",
  bar: "progress", progressbar: "progress", progreso: "progress",
  maps: "map", mapa: "map", location: "map",
  photos: "gallery", grid_images: "gallery", galeria: "gallery",
  navbar: "appbar", app_bar: "appbar", toolbar: "appbar", barra_superior: "appbar",
  bottom_nav: "tabbar", tabbar: "tabbar", tabs: "tabbar", barra_inferior: "tabbar",
  separator: "divider", hr: "divider", divisor: "divider",
  dialog: "modal", sheet: "modal", dialogo: "modal",
  teclado: "keyboard", browser_bar: "browser-bar", browserbar: "browser-bar",
};

/** Elemento del catálogo (siempre uno; cae a «texto»). */
export const widgetMeta = (key) => {
  const name = typeof key === "string" ? key.trim().toLowerCase() : "";
  const direct = WIDGETS.find((widget) => widget.key === name);
  if (direct) return direct;
  const alias = WIDGET_ALIASES[name] || WIDGET_ALIASES[name.replace(/\s+/g, "_")];
  return WIDGETS.find((widget) => widget.key === alias) || WIDGETS[1];
};

/* ------------------------------------------------------------------ */
/* Constructores                                                       */
/* ------------------------------------------------------------------ */

let widgetCounter = 0;
export const newWidgetId = () => {
  widgetCounter += 1;
  return `w_${Date.now().toString(36)}${widgetCounter.toString(36)}${Math.random().toString(36).slice(2, 5)}`;
};

const num = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const color = (value, fallback) => {
  if (typeof value !== "string") return fallback;
  const text = value.trim();
  if (!text) return fallback;
  if (text === "transparent") return "transparent";
  if (/^#[0-9a-f]{3,8}$/i.test(text)) return text;
  if (/^rgba?\([0-9.,\s%]+\)$/i.test(text)) return text;
  return fallback;
};

/** Estilo de un elemento, tolerante a valores raros guardados por integraciones. */
export const normalizeWidgetStyle = (style = {}, meta = widgetMeta("text")) => {
  const raw = style && typeof style === "object" ? style : {};
  const fallback = { ...BASE_WIDGET_STYLE, ...(meta.style || {}) };
  const align = ["left", "center", "right"].includes(raw.align) ? raw.align : fallback.align;
  const valign = ["top", "middle", "bottom"].includes(raw.valign) ? raw.valign : fallback.valign;
  return {
    fill: color(raw.fill, fallback.fill),
    textColor: color(raw.textColor, fallback.textColor),
    borderColor: color(raw.borderColor, fallback.borderColor),
    borderWidth: clamp(num(raw.borderWidth, fallback.borderWidth), 0, 20),
    radius: clamp(num(raw.radius, fallback.radius), 0, 999),
    fontSize: clamp(num(raw.fontSize, fallback.fontSize), 6, 200),
    fontWeight: clamp(Math.round(num(raw.fontWeight, fallback.fontWeight) / 100) * 100, 100, 900),
    fontStyle: raw.fontStyle === "italic" ? "italic" : "normal",
    align,
    valign,
    padding: clamp(num(raw.padding, fallback.padding), 0, 80),
    opacity: clamp(num(raw.opacity, fallback.opacity), 0, 1),
    shadow: raw.shadow === true,
    underline: raw.underline === true,
    letterSpacing: clamp(num(raw.letterSpacing, fallback.letterSpacing), -5, 20),
    lineHeight: clamp(num(raw.lineHeight, fallback.lineHeight), 0.8, 3),
    icon: typeof raw.icon === "string" ? raw.icon.slice(0, 60) : "",
    iconSize: clamp(num(raw.iconSize, fallback.iconSize), 8, 200),
    imageFit: raw.imageFit === "contain" ? "contain" : "cover",
    rotate: clamp(num(raw.rotate, 0), -180, 180),
  };
};

const normalizeWidgetProps = (props = {}) => {
  const raw = props && typeof props === "object" ? props : {};
  const out = {};
  if (typeof raw.placeholder === "string") out.placeholder = raw.placeholder.slice(0, 300);
  if (typeof raw.value === "string") out.value = raw.value.slice(0, 500);
  if (typeof raw.checked === "boolean") out.checked = raw.checked;
  if (typeof raw.href === "string") out.href = raw.href.slice(0, 2000);
  if (Array.isArray(raw.values)) {
    out.values = raw.values.slice(0, 40).map((value) => clamp(num(value, 0), 0, 100));
  } else if (Number.isFinite(Number(raw.value)) && raw.value !== "") {
    out.value = clamp(num(raw.value, 0), 0, 100);
  }
  if (raw.value !== undefined && raw.value !== null && typeof raw.value !== "string") {
    out.value = clamp(num(raw.value, 0), 0, 100);
  }
  if (raw.columns !== undefined) out.columns = clamp(Math.round(num(raw.columns, 3)), 1, 6);
  return out;
};

/** Crea un elemento con el estilo por defecto de su tipo. */
export const makeWidget = (type, position = { x: 0, y: 0 }, overrides = {}) => {
  const meta = widgetMeta(type);
  const { style: styleOverrides = {}, props: propsOverrides = {}, ...rest } = overrides;
  return {
    id: rest.id || newWidgetId(),
    type: meta.key,
    x: Math.round(num(position.x, 0)),
    y: Math.round(num(position.y, 0)),
    w: Math.max(4, Math.round(num(rest.w, meta.w))),
    h: Math.max(1, Math.round(num(rest.h, meta.h))),
    text: typeof rest.text === "string" ? rest.text : meta.text || "",
    style: normalizeWidgetStyle({ ...(meta.style || {}), ...styleOverrides }, meta),
    props: normalizeWidgetProps({ ...(meta.props || {}), ...propsOverrides }),
    locked: rest.locked === true,
  };
};

/** Normaliza un elemento venido de la API / importación / copia antigua. */
export const normalizeWidget = (raw) => {
  if (!raw || typeof raw !== "object") return null;
  const meta = widgetMeta(raw.type || raw.kind || raw.element);
  const style = normalizeWidgetStyle(raw.style, meta);
  const image = normalizeDiagramImage(raw.props?.image || raw.image);
  const props = normalizeWidgetProps(raw.props || {});
  if (image) props.image = image;
  const widget = {
    id: String(raw.id || newWidgetId()),
    type: meta.key,
    x: Math.round(num(raw.x ?? raw.position?.x, 0)),
    y: Math.round(num(raw.y ?? raw.position?.y, 0)),
    w: Math.max(4, Math.round(num(raw.w ?? raw.width, meta.w))),
    h: Math.max(1, Math.round(num(raw.h ?? raw.height, meta.h))),
    text: typeof raw.text === "string" ? raw.text : typeof raw.label === "string" ? raw.label : meta.text || "",
    style,
    props,
    locked: raw.locked === true,
  };
  return widget;
};

export const normalizeWidgets = (list) =>
  (Array.isArray(list) ? list : []).map(normalizeWidget).filter(Boolean).slice(0, 400);

/** Datos de una pantalla, completos y tolerantes. */
export const normalizeScreen = (data = {}) => {
  const device = deviceMeta(data.device || data.deviceKey || data.platform);
  const background = normalizeScreenBackground(data.background || data.backgroundColor);
  const image = normalizeDiagramImage(data.backgroundImage);
  return {
    device: device.key,
    widgets: normalizeWidgets(data.widgets || data.elements || data.items),
    background,
    ...(image ? { backgroundImage: image } : {}),
    statusBar: data.statusBar !== false,
    start: data.start === true,
  };
};

let screenCounter = 0;

/**
 * Nodo de pantalla listo para React Flow.
 * `overrides.data` se mezcla con los datos de la pantalla.
 */
export const makeScreenNode = (deviceKey = "iphone-15-pro", position = { x: 0, y: 0 }, overrides = {}) => {
  const device = deviceMeta(deviceKey);
  screenCounter += 1;
  const { data: dataOverrides = {}, ...rest } = overrides;
  const normalized = normalizeScreen({ device: device.key, ...dataOverrides });
  return {
    id: rest.id || `n_scr${Date.now().toString(36)}${screenCounter}${Math.random().toString(36).slice(2, 5)}`,
    type: SCREEN_TYPE,
    position: { x: Math.round(num(position.x, 0)), y: Math.round(num(position.y, 0)) },
    width: Math.max(80, Math.round(num(rest.width, device.width))),
    height: Math.max(80, Math.round(num(rest.height, device.height))),
    data: {
      label: dataOverrides.label || rest.label || device.label,
      shape: SCREEN_SHAPE,
      description: dataOverrides.description || "",
      link: dataOverrides.link || "",
      locked: dataOverrides.locked === true,
      ...normalized,
      style: {
        fill: "#ffffff",
        stroke: "#94a3b8",
        textColor: "#0f172a",
        fontSize: 13,
        radius: 0,
        strokeWidth: 1,
        opacity: 1,
        shadow: true,
        ...(dataOverrides.style || {}),
      },
    },
  };
};

/* ------------------------------------------------------------------ */
/* Geometría de los elementos                                          */
/* ------------------------------------------------------------------ */

/** Mueve/redimensiona con topes para que el elemento no se pierda. */
export const clampWidgetBox = (widget, size = { width: 393, height: 852 }) => {
  const w = clamp(Math.round(num(widget.w, 40)), 4, Math.max(4, size.width * 2));
  const h = clamp(Math.round(num(widget.h, 16)), 1, Math.max(1, size.height * 2));
  return {
    ...widget,
    w,
    h,
    x: Math.round(clamp(num(widget.x, 0), -size.width, size.width * 2)),
    y: Math.round(clamp(num(widget.y, 0), -size.height, size.height * 2)),
  };
};

/** Id del conector que se dibuja sobre un elemento de la pantalla. */
export const widgetHandleId = (widgetId) => `${WIDGET_HANDLE_PREFIX}${widgetId}`;

/** `true` cuando el conector pertenece a un elemento (no a un lado del nodo). */
export const isWidgetHandle = (handle) => typeof handle === "string" && handle.startsWith(WIDGET_HANDLE_PREFIX);

export const widgetIdFromHandle = (handle) => (isWidgetHandle(handle) ? handle.slice(WIDGET_HANDLE_PREFIX.length) : null);

export const BROWSER_BAR_HEIGHT = 44;

/** Marco interior del nodo: el área útil donde viven los elementos. */
export const screenInsets = (deviceOrKey) => {
  const device = deviceMeta(
    typeof deviceOrKey === "object" && deviceOrKey ? deviceOrKey.key : deviceOrKey,
  );
  const bezel = device.bezel || 0;
  return {
    top: bezel + (device.browserBar ? BROWSER_BAR_HEIGHT : 0),
    left: bezel,
    right: bezel,
    bottom: bezel,
  };
};

/** Coordenadas relativas al área útil de la pantalla. */
export const screenContentSize = (deviceOrKey) => {
  const device = deviceMeta(
    typeof deviceOrKey === "object" && deviceOrKey ? deviceOrKey.key : deviceOrKey,
  );
  const inset = screenInsets(device);
  return {
    width: Math.max(1, device.width - inset.left - inset.right),
    height: Math.max(1, device.height - inset.top - inset.bottom),
  };
};

/** Posición de un elemento dentro del nodo (incluye el marco del dispositivo). */
export const widgetAnchor = (screenNode, widgetId, side = "right") => {
  const device = deviceMeta(screenNode?.data?.device);
  const inset = screenInsets(device);
  const widget = (screenNode?.data?.widgets || []).find((item) => item.id === widgetId);
  const width = screenNode?.width || device.width;
  const height = screenNode?.height || device.height;
  if (!widget) return { x: width / 2, y: height / 2 };
  const px = inset.left + widget.x;
  const py = inset.top + widget.y;
  if (side === "left") return { x: px, y: py + widget.h / 2 };
  if (side === "top") return { x: px + widget.w / 2, y: py };
  if (side === "bottom") return { x: px + widget.w / 2, y: py + widget.h };
  return { x: px + widget.w, y: py + widget.h / 2 };
};

/** Elementos que salen de una pantalla y hacia dónde, para el prototipo. */
export const screenLinks = (nodes, edges, nodeId) => {
  const byId = new Map((nodes || []).map((node) => [node.id, node]));
  return (edges || [])
    .filter((edge) => edge.source === nodeId && edge.target !== nodeId)
    .map((edge) => {
      const target = byId.get(edge.target);
      if (!target) return null;
      const originWidgetId = widgetIdFromHandle(edge.sourceHandle);
      const widget = originWidgetId
        ? byId.get(nodeId)?.data?.widgets?.find((item) => item.id === originWidgetId)
        : null;
      return {
        edgeId: edge.id,
        targetId: target.id,
        targetLabel: target.data?.label || "Pantalla",
        targetType: target.type,
        originWidgetId,
        label: edge.data?.label || widget?.text || "",
      };
    })
    .filter(Boolean);
};

/* ------------------------------------------------------------------ */
/* Comentarios del equipo                                              */
/* ------------------------------------------------------------------ */

export const COMMENT_STATUSES = [
  { key: "open", label: "Abierto" },
  { key: "resolved", label: "Resuelto" },
];

let commentCounter = 0;
export const newCommentId = () => {
  commentCounter += 1;
  return `c_${Date.now().toString(36)}${commentCounter.toString(36)}${Math.random().toString(36).slice(2, 5)}`;
};

/**
 * Comentario de revisión sobre el diagrama.
 * Vive en `data.comments` y se guarda junto con el diagrama (sin tablas nuevas).
 */
export const makeComment = (
  { text, author = null, nodeId = null, widgetId = null, parentId = null, resolved = false, createdAt = null } = {},
) => ({
  id: newCommentId(),
  text: String(text || "").trim().slice(0, 4000),
  author: author
    ? {
        id: author.id ?? null,
        name: String(author.name || author.email || "Equipo").slice(0, 120),
      }
    : { id: null, name: "Tú" },
  node_id: nodeId ?? null,
  widget_id: widgetId ?? null,
  parent_id: parentId ?? null,
  resolved: resolved === true,
  created_at: createdAt || new Date().toISOString(),
});

export const normalizeComment = (raw) => {
  if (!raw || typeof raw !== "object") return null;
  const text = typeof raw.text === "string" ? raw.text : typeof raw.body === "string" ? raw.body : "";
  if (!text.trim()) return null;
  const author = raw.author && typeof raw.author === "object" ? raw.author : null;
  const name = author?.name || (typeof raw.author === "string" ? raw.author : "") || raw.author_name || "Equipo";
  return {
    id: String(raw.id || newCommentId()),
    text: text.slice(0, 4000),
    author: {
      id: raw.user_id ?? author?.id ?? null,
      name: String(name).slice(0, 120),
    },
    node_id: raw.node_id ?? raw.nodeId ?? null,
    widget_id: raw.widget_id ?? raw.widgetId ?? null,
    parent_id: raw.parent_id ?? raw.parentId ?? null,
    resolved: raw.resolved === true || raw.status === "resolved",
    created_at: typeof raw.created_at === "string" ? raw.created_at : new Date().toISOString(),
  };
};

export const normalizeComments = (list) =>
  (Array.isArray(list) ? list : []).map(normalizeComment).filter(Boolean).slice(0, 2000);

/** Resumen para tarjetas y encabezados. */
export const mockupStats = (nodes = [], comments = []) => {
  const screens = (nodes || []).filter((node) => node?.type === SCREEN_TYPE || node?.data?.shape === SCREEN_SHAPE);
  const widgets = screens.reduce((sum, node) => sum + (node.data?.widgets?.length || 0), 0);
  const open = (comments || []).filter((comment) => !comment.resolved).length;
  return {
    screens: screens.length,
    widgets,
    comments: (comments || []).length,
    openComments: open,
    hasMockups: screens.length > 0,
  };
};
