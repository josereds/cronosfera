# Cronosfera

> Marketplace colombiano de relojes originales seleccionados por su diseño, precisión y carácter.

Prototipo HTML/CSS/JS de producto completo — estático, sin backend, pero con la arquitectura de datos simulada lista para conectar a uno real. Estética editorial inspirada en relojería suiza: grafito profundo, marfil, gris acero y bronce envejecido como acento. Tipografía Cormorant Garamond + Inter + JetBrains Mono.

**Demo en producción:** https://cronosfera-five.vercel.app

---

## Stack

- HTML5 estático (sin framework, sin build step)
- CSS con `oklch()` para tokens de color
- JavaScript modular (sin bundler, módulos sueltos)
- Video MP4 auto-play en hero (`prefers-reduced-motion` respeta)
- OG image generado desde `og-image.html` (composición SVG → screenshot)

## Páginas

| Archivo            | Función                                                         |
| ------------------ | -------------------------------------------------------------- |
| `index.html`       | Landing — hero con video exploded-view, marca, oferta          |
| `catalogo.html`    | Catálogo con filtros (marca, movimiento, precio, género)       |
| `producto.html`    | Ficha de producto (Aurora 39 · Acero) — specs, garantía, CTA   |
| `mayorista.html`   | Programa mayorista — tarifas por volumen, onboarding           |
| `subastas.html`    | Subastas de relojes coleccionables con contador en vivo        |
| `login.html`       | Autenticación cliente / mayorista                              |
| `admin.html`       | Panel administrativo — pedidos, inventario, KPIs, mayoristas   |
| `og-image.html`    | Composición 1200×630 para OG/Twitter card                      |

## Módulos JS

| Archivo             | Rol                                                            |
| ------------------- | ------------------------------------------------------------- |
| `cronos-ui.js`      | Utilidades de UI compartidas                                  |
| `cronos-ui.css`     | Sistema visual compartido (tokens, componentes)               |
| `cronos-store.js`   | Estado de carrito / catálogo (datos simulados)                |
| `cronos-auth.js`    | Lógica de autenticación (preparada para backend)              |
| `cronos-auction.js` | Motor de subastas (timer, pujas, estado)                      |
| `cronos-admin.js`   | Panel admin — gráficos, tablas, sparklines, linterna de stock |

## Córralo local

No requiere build. Cualquier servidor estático sirve:

```bash
# opción 1: Python
python -m http.server 8000

# opción 2: Vercel CLI
vercel dev

# opción 3: simplemente abrir index.html en el navegador
```

## Deploy

El proyecto está desplegado en Vercel. Configuración en `vercel.json`:

- `cleanUrls: true` — URLs sin extensión (`/catalogo` en vez de `/catalogo.html`)
- Cache `immutable` (1 año) para `.mp4`, imágenes y fuentes
- `must-revalidate` para HTML

```bash
vercel --prod
```

## Restricciones de marca (importantes)

- **No afirmar** que Cronosfera es distribuidor oficial de ninguna marca sin confirmación.
- **No inventar** duraciones de garantía, tiempos de envío ni políticas específicas — son campos editables en el admin.
- **No presentar** testimonios ficticios como opiniones verificadas.
- Precios visibles en COP, marcados como **datos de demostración** hasta que se conecte el backend.
- **Nunca** almacenar datos completos de tarjetas en el frontend.
- Control de acceso y validación de precios mayoristas deben reimplementarse en el servidor antes de producción.

## Estructura preparada para backend

El código está organizado para que cuando se conecte un backend real (recomendado: API REST o GraphQL con Wompi/Mercado Pago/PayU para Colombia), la migración sea directa:

- Datos simulados en `cronos-store.js` están aislados y etiquetados.
- Auth en `cronos-auth.js` valida tokens pero no los emite — preparada para recibir JWT de un servicio real.
- Carrito y precios mayoristas tienen ganchos claros para validación server-side.

## Roadmap

- [ ] Backend real (auth, pagos, inventario)
- [ ] Integración Wompi / Mercado Pago Colombia
- [ ] CMS para contenido editorial del blog
- [ ] App móvil (iOS/Android) con React Native
- [ ] Sistema de autenticación con OTP

---

Hecho con criterio editorial. — © Cronosfera
