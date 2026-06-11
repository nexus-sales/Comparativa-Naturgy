# Naturgy Pro — Comparativa Canarias (Vite + React + Supabase)

## Configuración de Supabase

1. Crea un proyecto en [Supabase](https://supabase.com).
2. Ejecuta el SQL de `supabase/schema_v2.sql` en el SQL Editor de tu proyecto Supabase.
3. Copia las credenciales (URL y Anon Key) en un archivo `.env` basado en `.env.example`.
4. Habilita el método de autenticación `Email/Password`.

## Desarrollo

'npm install'
'npm run dev'

## Lógica de Seguridad (RLS)

- **Comerciales**: Pueden ver todas las tarifas ('SELECT'), pero no editarlas.
- **Administradores**: Tienen permisos totales ('ALL'). Para hacer a un usuario administrador, cambia el campo 'is_admin' a 'true' en la tabla 'public.profiles' para su 'id' correspondiente.

## Mantenimiento y Correcciones Recientes

### Junio 2026 — Importador de tarifas PYME + tipo tri6 (rama `importador-pyme`)

Ampliación del modelo de datos y nuevo componente de importación masiva de las 36 tarifas de luz PYME de Naturgy.

#### Nuevo tipo de tarifa: `tri6`

| Tipo  | Periodos energía | Periodos potencia | Segmentos        |
|-------|-----------------|-------------------|------------------|
| `uni` | 1               | 2 ó 6             | pyme20, pyme30, pyme61 |
| `tri` | 3               | 2                 | pyme20           |
| `tri6`| 3               | 6                 | pyme30, pyme61   |
| `hex` | 6               | 6                 | pyme30, pyme61   |

- `tri6` añadido a `TarifaLocal.tipo` en `calculations.ts` y al mapa `nEnMap`.
- `TariffForm` corregido: el número de periodos de potencia lo decide el segmento (`pot_p`), no el tipo; eliminado el forzado a `hex` para segmentos de 6 periodos.

#### Constraints SQL necesarias (Supabase SQL Editor)

```sql
ALTER TABLE tariffs DROP CONSTRAINT IF EXISTS chk_ren_len;
ALTER TABLE tariffs DROP CONSTRAINT IF EXISTS chk_rpot_len;
ALTER TABLE tariffs DROP CONSTRAINT IF EXISTS tariffs_type_check;

ALTER TABLE tariffs ADD CONSTRAINT chk_ren_len CHECK (
  (type='uni'  AND array_length(r_en,1)=1) OR
  (type='tri'  AND array_length(r_en,1)=3) OR
  (type='tri6' AND array_length(r_en,1)=3) OR
  (type='hex'  AND array_length(r_en,1)=6)
);
ALTER TABLE tariffs ADD CONSTRAINT chk_rpot_len CHECK (array_length(r_pot,1) IN (2,6));
ALTER TABLE tariffs ADD CONSTRAINT tariffs_type_check CHECK (type IN ('uni','tri','tri6','hex'));

-- Segmento pyme361 unificado (si no existe ya pyme30/pyme61 por separado)
INSERT INTO segments (id, label, tax_model, pot_p, bono_rate, excedente_rate, tax_imp_elec, tax_igic, tax_igic_red, tax_igic_7)
SELECT 'pyme30','Pyme 3.0TD',tax_model,6,bono_rate,excedente_rate,tax_imp_elec,tax_igic,tax_igic_red,tax_igic_7
FROM segments WHERE id='pyme20' ON CONFLICT (id) DO NOTHING;

INSERT INTO segments (id, label, tax_model, pot_p, bono_rate, excedente_rate, tax_imp_elec, tax_igic, tax_igic_red, tax_igic_7)
SELECT 'pyme61','Pyme 6.1TD',tax_model,6,bono_rate,excedente_rate,tax_imp_elec,tax_igic,tax_igic_red,tax_igic_7
FROM segments WHERE id='pyme20' ON CONFLICT (id) DO NOTHING;
```

#### TariffImporter — importación masiva desde Excel o JSON

- Botón "Importar Excel PYME" en el panel admin de tarifas.
- Acepta el Excel oficial `NC-Productos-Captacion-PYMES-*.xlsx` (hoja `JUN26_3_VP`) o el archivo de referencia `Tarifas pyme 36.json`.
- Extrae las 36 tarifas (4 planes × 3 accesos × 3 variantes base/ONE/SUPRA) con detección automática de tipo y segmento.
- Muestra tabla de revisión con nombres, segmentos, tipos y precios antes de confirmar.
- Toggle "Desactivar tarifas anteriores de los mismos segmentos" (activo por defecto) para evitar duplicados: pone `is_active = false` a las tarifas viejas antes de insertar las nuevas.
- Upsert por `name + segment_id`: actualiza si existe, crea si no existe. Nunca borra.

#### Mapeo de columnas Excel (hoja JUN26_3_VP)

- Potencia: columnas C6–C11 (P1–P6), compartidas entre las 3 variantes.
- Energía base: C12–C17 (uni/tri/hex) o **C14–C16** (tri6, desplazamiento +2 confirmado).
- Energía ONE: C19–C24 (uni/tri/hex) o **C21–C23** (tri6).
- Energía SUPRA: C26–C31 (uni/tri/hex) o **C28–C30** (tri6).
- Nota: los planes Variable pyme30/pyme61 (tri6) usan fórmulas de mercado en el Excel; si las celdas devuelven error, usar `Tarifas pyme 36.json` como fuente.

### Mayo 2026 — Refactorización Arquitectural Completa (v2.0.0)

Auditoría de seguridad y calidad completa con reset de base de datos y refactorización integral del código.

#### Base de datos

- Reset completo de Supabase: esquema único y definitivo `supabase/schema_v2.sql` reemplaza 13 migraciones inconsistentes.
- Eliminados los bugs críticos de RLS: `is_admin()` renombrada a `is_user_admin()` de forma consistente (los fallos previos provocaban que las tarifas no se guardasen y que el historial desapareciese).
- FK de `client_comparisons.user_id → profiles.id` para soporte correcto del JOIN en la API de Supabase.

#### Estado global (Zustand)

- Nuevo store `src/store/useAppStore.ts` con métodos `load()`, `refresh()` y `reset()`.
- Eliminado el hack `window.refreshAppCache` (global JS inyectado al window).
- Eliminado `src/hooks/useData.ts` (reemplazado por el store).
- Cache local con TTL de 30 minutos e hidratación síncrona al inicio.

#### Seguridad

- Eliminada la constante `OWNER_ADMIN_EMAILS` con el email del admin en el bundle de cliente.
- El rol de administrador se determina exclusivamente desde `profiles.is_admin` en Supabase.

#### Calidad de código

- Eliminados todos los tipos `any`: nuevo fichero `src/types/index.ts` con interfaces `Profile`, `Segment`, `Tariff` y `ClientComparison`.
- Stale closure corregida en `useAuth.ts`: `checkAdminStatus` recibe el objeto `User` completo en lugar de cerrarse sobre el estado de React.
- Bug de doble guardado corregido en `ComparatorView`: botones GUARDAR y PDF desactivados mientras `isSaving=true`.
- Bug `hasLoaded` eliminado en `UserHistoryView`: la vista ahora puede refrescar datos; añadido botón "Actualizar".
- Corrección de todos los caracteres mal codificados en la UI (UTF-8, visible como `◆` en el navegador).
- Build limpio: 0 errores TypeScript (`tsc --noEmit` + `vite build`).

### Mayo 2026 - Corrección de errores de compilación (Build Fix)
Se han solucionado varios problemas de TypeScript que impedían el despliegue automático en Vercel:

1.  **Contexto de Autenticación**: Se integró `useAuth()` en el componente `ComparatorView` de [src/App.tsx](src/App.tsx) para resolver errores de referencia de la variable `user` durante la exportación de PDFs y el guardado de historial.
2.  **Validación de Tipos**: Se implementó un bypass seguro mediante casting en [src/App.tsx](src/App.tsx) para el campo `email` del cliente (requerido para el historial RGPD pero no definido en la interfaz base `SegCliente`).
3.  **Corrección de UI/UX**: En [src/components/auth/AuthOverlay.tsx](src/components/auth/AuthOverlay.tsx), se eliminaron atributos no válidos en elementos HTML (propiedad `variant` en botones nativos) y se especificó el tipo de botón para evitar envíos de formulario involuntarios.
4.  **Verificación de Despliegue**: Se confirmó la solución mediante un build exitoso (`npm run build`) eliminando errores `TS2552`, `TS2339` y `TS2322`.

### Mayo 2026 - Historial Avanzado y Seguridad RLS (v1.1.0)
Se ha implementado un sistema robusto de gestión de datos y seguridad:

1. **Historial de Comparativas**: Nueva vista de Historial que permite a los colaboradores ver sus cálculos pasados y a los admins supervisar toda la actividad.
2. **Re-generación de PDF**: Sistema de guardado mediante snapshots JSON que permite regenerar el documento PDF original en cualquier momento con exactitud.
3. **Borrado Lógico (Soft Delete)**: Cuando un colaborador borra una comparativa, esta desaparece de su vista pero se mantiene una copia de seguridad accesible únicamente por el Administrador.
4. **Seguridad RLS Avanzada**: Corrección de errores de recursión infinita en Supabase mediante el uso de funciones SECURITY DEFINER (is_user_admin).
5. **Gestión de Roles**: Implementación de lógica diferenciada donde los colaboradores solo acceden a lo propio mientras los administradores tienen visión global del negocio.

### Refactorización y Mejoras (Mayo 2026)
- **Modularización Completa**: Se ha desglosado el archivo App.tsx (originalmente >2100 líneas) en componentes independientes (ComparatorView, AdminView, UserHistoryView, UserProfileView) para mejorar la mantenibilidad.
- **Corrección de Bucle Infinito (Supabase RLS)**: Se implementó la función public.is_admin() con SECURITY DEFINER para romper la recursión infinita en las políticas de la tabla profiles.
- **Estabilidad del Panel Admin**: Reparada la lógica de guardado de tarifas. Ahora valida y recorta los arrays de precios (_pot, _en) según el tipo de tarifa (uni, 	ri, hex) para cumplir con las restricciones de la base de datos.
- **Accesibilidad y UI**: Se han añadido etiquetas label, id únicos y atributos ARIA en el comparador para mejorar la accesibilidad y depuración.
- **Sincronización de Cache**: Se habilitó una función global efreshAppCache para asegurar que los cambios realizados en el panel de administración se reflejen instantáneamente en las vistas de usuario.
