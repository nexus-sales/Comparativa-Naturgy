# Naturgy Pro — Comparativa Canarias (Vite + React + Express + PostgreSQL)

Admin único, autocontenida: sin Supabase ni ningún servicio externo. El
frontend (Vite/React) habla con una API propia (`server/`, Express) que lee y
escribe directamente en Postgres.

## Stack

- **Frontend**: Vite 8 + React 19 + TypeScript, SPA.
- **Backend**: Express (`server/index.js`) — sirve la API bajo `/api/*` y, en
  producción, también los estáticos del build de Vite (un único proceso/puerto).
- **Base de datos**: PostgreSQL propio, esquema en `db/init.sql` (sin RLS,
  sin tabla de usuarios — un solo admin).
- **Auth**: contraseña única vía `ADMIN_PASSWORD`, cookie de sesión firmada
  con HMAC-SHA256, rate limiting de login por IP.

## Variables de entorno

Copia `.env.example` a `.env` y rellena:

```
DATABASE_URL      # postgres://user:pass@host:5432/db
DATABASE_SSL      # vacío (por defecto, sin TLS) | "require" | "strict"
ADMIN_PASSWORD    # contraseña de acceso a la app
SESSION_SECRET    # cadena aleatoria larga para firmar la cookie de sesión
PORT              # opcional, por defecto 3000
```

## Desarrollo

```
npm install
psql "$DATABASE_URL" -f db/init.sql   # una vez, para crear el esquema
npm run dev:full                       # vite + servidor API en paralelo
```

`npm run dev` (solo frontend) y `npm run dev:server` (solo API) también
existen por separado si prefieres dos terminales — Vite hace proxy de
`/api` hacia `http://localhost:3000` en desarrollo.

## Producción / Dokploy

- `npm run build` compila el frontend a `dist/`; `npm start` arranca
  `server/index.js`, que sirve la API y esos estáticos en el mismo proceso.
- `nixpacks.toml` fija Node 22.
- **Las migraciones no viajan con el despliegue**: tras el primer deploy hay
  que aplicar `db/init.sql` a mano contra la base de datos del servicio.
- El catálogo de tarifas (`tariffs`) no lleva datos de partida — se rellena
  a mano o con el importador de Excel/JSON del panel Admin.

---

## Historial de versiones

### v2.0.0 — Agosto 2026 · Migración a servidor propio (fin de Supabase)

- Sustituido Supabase (Auth + PostgREST) por un backend Express propio
  (`server/`) sobre PostgreSQL, desplegado en VPS propio vía Dokploy/Nixpacks.
- Auth multiusuario con roles/aprobación → **admin único** con contraseña
  vía `ADMIN_PASSWORD`, cookie de sesión firmada y rate limiting de login.
  Eliminados: registro público, confirmación por email, reset de contraseña
  por email, panel de gestión de usuarios en Admin.
- Esquema nuevo en `db/init.sql`: `segments`, `tariffs`, `client_comparisons`,
  `notices` — sin RLS ni tabla `profiles`. `client_comparisons.user_id` y
  `notices.created_by` eliminados (no aplica con un solo usuario). Tablas
  vacías al desplegar: no se migró histórico de Supabase.
- Datos del comercial (nombre/teléfono/email para PDF/Excel) ya no viven en
  una tabla `profiles`: se guardan en `localStorage` (pestaña Usuario).
- `src/lib/supabase.ts` → `src/lib/api.ts`; todos los componentes que
  llamaban al cliente de Supabase ahora hablan con la API propia.
- Compresión gzip añadida en el servidor (`compression`) — sin ella el
  bundle principal (~1,1MB) se servía sin comprimir y tardaba ~80s en cargar.

---

### v1.2.0 — Junio 2026 · Calculadora de Comisiones integrada

Nueva sección **Comisiones** disponible para todos los usuarios autenticados. Integra la herramienta de seguimiento de ventas previamente disponible como app independiente.

#### Pestaña Comisiones (`src/components/commissions/CommissionsView.tsx`)

**🏢 Pyme**
- Datos del cliente: nombre/razón social, CUPS, tarifa contratada, fecha de venta.
- Consumo anual directo o desglose mes a mes (12 inputs).
- Cálculo de comisión para 6 planes (Fijo/Variable × ONE/Luz/Supra) según tabla vigente desde 01/02/2026.
- Tres tramos de cálculo: plana (≤10.000 kWh), fórmula por MWh (10.001–400.000 kWh), tabla fija (>400.000 kWh). N/C para consumos >1.000.000 kWh.
- Selección del plan con un clic → añadir directamente a Mis Ventas.

**🏠 Residencial**
- Selector de producto: Luz / Gas / Dual / Servicios.
- Comisiones base editables (persistidas en `localStorage`).
- Tramos de Rappel (4 tramos activables) y Adoc (3 tramos con referencia) configurables.
- Comisión total = base + rappel activo.

**📋 Mis Ventas**
- Sub-tabs Pyme / Residencial con selector de mes de cobro.
- Fecha de activación editable por cliente; mes de cobro = activación + 1 mes (cálculo automático).
- KPIs: nº clientes, total comisiones, media por cliente.
- Exportación PDF (ventana de impresión nativa, sin dependencias extra).
- Exportación Excel con hoja oculta `DATOS_SISTEMA` para backup/restore completo.
- Botones `Guardar copia` / `Abrir copia` para migrar datos entre dispositivos.

#### Arquitectura

- `src/utils/commissionCalc.ts` — lógica de cálculo y tipos TypeScript (tablas de tramos, helpers de fecha/mes, defaults de Rappel/Adoc).
- Todos los datos persisten en `localStorage` (`naturgy_ventas`, `naturgy_ventas_res`, `naturgy_res_com`, `naturgy_res_rappel`, `naturgy_res_adoc2`). Sin tablas nuevas en Supabase.
- Lazy load con `React.lazy()` + `Suspense`: el chunk de Comisiones (~470 kB gzip ~150 kB) solo se descarga al abrir la pestaña por primera vez.
- Dependencia añadida: `xlsx` (SheetJS) para lectura de backup Excel.

---

### v1.1.1 — Junio 2026 · Dashboard como pantalla principal

#### Nueva pestaña "Inicio" (DashboardView)

- `src/components/dashboard/DashboardView.tsx` — nuevo componente, sustituye al Comparador como pantalla de inicio tras el login.
- Tab **Inicio** añadido al nav (icono `Home`); orden: Inicio → Comercial → Usuario → Historial → Avisos → Comisiones → Admin.
- El banner de perfil incompleto se muestra también en el Dashboard.

#### KPIs y gráficas

- **Fila 1** — métricas globales del mes: ofertas, ahorro total, ahorro medio, comerciales activos (admin) / mis ofertas hoy (comercial).
- **Fila 2** — desglose por segmento: Residencial, PYME 2.0TD, PYME 3.0TD, PYME 6.1TD con top tarifa más ofertada.
- Gráficas con **Recharts 3.8.1**: línea de tendencia 6 meses, barras horizontales por comercial (admin), barras verticales por sector (comercial).
- Widget de avisos activos y actividad reciente (últimas 5 comparativas).
- Sin cambios en Supabase — reutiliza las mismas tablas (`client_comparisons`, `profiles`, `notices`).

---

### v1.1.0 — Junio 2026 · Energía reactiva, importador PYME y fixes

#### Energía reactiva (3.0TD / 6.1TD)
- Campo `reactiva` en `SegCliente` y `CalcResult`; incluida en base imponible del Impuesto Eléctrico.
- UI: inputs P1–P6 kVArh + €/kVArh visible en segmentos de 6 periodos.
- PDF y Excel actualizados con bloque de reactiva.
- Historial: `SegCliente` reconstruido incluye `reactiva` y `reactivaRate`.

#### Importador de tarifas PYME
- Botón "Importar Excel PYME" en panel admin.
- Acepta `NC-Productos-Captacion-PYMES-*.xlsx` (hoja `JUN26_3_VP`) o JSON de referencia.
- Detecta automáticamente tipo (`uni`/`tri`/`tri6`/`hex`) y segmento. Upsert por nombre + segmento.
- Nuevo tipo `tri6`: 3 periodos energía + 6 periodos potencia (pyme30/pyme61).

#### Fixes y mejoras
- `fmtEur` trunca a 3 decimales sin redondeo (`Math.trunc`).
- `NoticesView`: `try/catch/finally` evita pantalla de carga infinita ante fallos de red.
- `AdminView`: auditoría de tipos en historial, cast `CalculationData` correcto.
- ESLint: regla `@typescript-eslint/no-unused-vars` configurada con `argsIgnorePattern: "^_"`.

---

### v1.0.0 — Mayo 2026 · Refactorización Arquitectural Completa

- Reset completo de Supabase: esquema único y definitivo, 13 migraciones anteriores eliminadas.
- RLS corregida: `is_user_admin()` con `SECURITY DEFINER` elimina recursión infinita.
- Store Zustand (`useAppStore`) con `load()`, `refresh()`, `reset()` y cache TTL 30 min.
- Eliminados todos los tipos `any`: `src/types/index.ts` con interfaces `Profile`, `Segment`, `Tariff`, `ClientComparison`, `CalculationData`.
- Historial con soft delete, re-generación PDF desde snapshot JSON y vista admin global.
- Build 0 errores TypeScript + ESLint.
