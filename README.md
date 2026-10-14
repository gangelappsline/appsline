# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Espacio de trabajo de proyectos

- `/admin/projects`: resumen del portafolio plegable y tarjetas compactas o ampliadas.
- `/admin/projects/:id`: información del proyecto y filtros plegables, tarjetas con
  detalles individuales y **Modo enfoque** para ocultar la barra lateral en escritorio.
- El buscador, el conteo de resultados y la acción para limpiar filtros permanecen
  disponibles aunque se oculten los filtros avanzados. En móvil, el tablero se
  desplaza horizontalmente sin ensanchar toda la página.
- Las preferencias generales se guardan en el navegador con el prefijo
  `appsline.display.`. Expandir una tarjeta individual es temporal; el control global
  aplica la misma densidad a todas las tarjetas. No se modifican datos del proyecto.

### Pruebas del panel

```bash
npm ci
npx playwright install --with-deps chromium
npm run test:e2e
```

Las pruebas usan datos ficticios e interceptan las peticiones de la API, sin requerir
una cuenta real. Cubren preferencias, teclado, filtros ocultos, enfoque, tarjetas,
arrastre de tareas, apertura del detalle y del formulario, estados vacíos/error y
anchos de 375, 768, 1280 y 1920 px. Playwright inicia Vite si no está ya ejecutándose.
Puede usarse `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` para indicar un Chromium instalado
localmente y `CAPTURE_WORKSPACE=1` para guardar capturas en `test-results/` (ignorado).
