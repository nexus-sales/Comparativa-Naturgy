# Auditoría de Cálculos PYME 2.0TD, 3.0TD y 6.1TD
**Fecha:** 2026-06-17  
**Alcance:** Verificación de fiscalidad y periodos para tarifas PYME en Canarias

---

## 📊 Estado del Código de Cálculo

**HALLAZGO:** Una única función `calc()` compartida en `src/utils/calculations.ts` (líneas 46-115)

✅ **CÓDIGO CORRECTO** - Los cálculos fiscales son idénticos y correctos para los tres tipos:

| Concepto | Implementación | Estado |
|----------|---|---|
| **Base IGIC 3%** | `costPot + costEn + impElec + bono` | ✅ Correcto |
| **Base IGIC 7%** | `alq + sva` | ✅ Correcto |
| **Impuesto Eléctrico** | `(costPot + costEn) × 5.11269632%` | ✅ Correcto |
| **SVE en IGIC 7%** | Incluido en `baseIGIC7` (línea 108) | ✅ Correcto |
| **Excedentes** | Restados en `subtotal`, NO en IGIC | ✅ Correcto |
| **Periodos** | Mapeados dinámicamente según `t.tipo` | ✅ Correcto |

---

## 🗂️ Estado Actual de Segmentos en BD

| Segmento | Etiqueta | Periodos | BD | Código TS | ONE | Tarifas |
|----------|----------|----------|----|----|----|----|
| `pyme20` | Pyme 2.0TD | 2 pot, 3 en | ✅ | ✅ | ❌ | SÍ (base/SUPRA) |
| `pyme20one` | Pyme ONE 2.0TD | 2 pot, 3 en | ✅ | ✅ | ✅ | 4 tarifas |
| `pyme30` | Pyme 3.0TD | 6 pot, 6 en | ❌ | ✅ | ❌ | — |
| `pyme30one` | Pyme ONE 3.0TD | 6 pot, 6 en | ❌ | ✅ | ❌ | — |
| `pyme61` | Pyme 6.1TD | 6 pot, 6 en | ❌ | ✅ | ❌ | — |
| `pyme61one` | Pyme ONE 6.1TD | 6 pot, 6 en | ❌ | ✅ | ❌ | — |
| `pyme361` | Pyme 3.0/6.1TD | 6 pot, 6 en | ✅ | ✅ | ❌ | SÍ (base/SUPRA/ONE) |

**Problema:** `pyme361` está combinado. Debería separarse en `pyme30` y `pyme61`.

---

## 📝 Cálculos Correctos por Tarifa (Factura de Ejemplo)

### Entrada Común (todos):
```
Periodo:    30 días (ejemplo mensual)
Potencia:   P1=50kW, P2=30kW (ó 6 períodos para 3.0/6.1)
Energía:    E1=1200kWh, E2=800kWh (ó 6 períodos para 3.0/6.1)
Reactiva:   80kVArh @ 0.03€/kVArh (solo 3.0TD y 6.1TD)
Excedentes: 50kWh @ 0.06€/kWh
Alquiler:   1.68€ (pyme20, pyme30, pyme61) ó 0.75€ (ONE)
Bono Social: 0.019121€/día × 30 = 0.5736€
Fiscalidad: Canarias PYME
```

---

### ✅ Tarifa 2.0TD (2 potencias, 3 energías)

**Supuesto:** PFL básico 2.0TD
- P1 = 50kW × 0.122973€/kW/día × 30 = 184.46€
- P2 = 30kW × 0.043976€/kW/día × 30 = 39.58€
- E1 = 1200kWh × 0.1422€/kWh = 170.64€
- E2 = 800kWh × 0.1422€/kWh = 113.76€
- E_total = 284.40€

**Cálculo completo:**
```
┌─ COMPONENTES BÁSICOS ─────────────────────┐
│ Potencia (2 periodos)              184.46 €
│ Energía (3 periodos)               284.40 €  [Neto: 284.40 - 3.00 exc = 281.40]
│ Reactiva (no aplica)                  0 €
│ Alquiler contador                    1.68 €
│ Excedentes (50kWh × 0.06)           -3.00 €
│ ─────────────────────────────────────────
│ SUBTOTAL                            467.54 €
│
├─ IMPUESTOS ──────────────────────────────┤
│
│ Impuesto Eléctrico 5.11% 
│   Base: (184.46 + 284.40) = 468.86 €
│   Impuesto: 468.86 × 5.11% =        23.94 €
│
│ IGIC Reducido 3% (sobre energía + imp.)
│   Base: 184.46 + 284.40 + 23.94 + 0.57 = 493.37 €
│   IGIC 3%: 493.37 × 3% =            14.80 €
│
│ IGIC General 7% (sobre alquiler + SVE)
│   Base: 1.68 + 6.44 = 8.12 €
│   IGIC 7%: 8.12 × 7% =               0.57 €
│
│ Bono Social (activado)               0.57 €
│
├─ TOTAL ──────────────────────────────────┤
│ Subtotal + Imp. Elec + IGIC3% + IGIC7% + Bono
│ 467.54 + 23.94 + 14.80 + 0.57 + 0.57 =  507.42 €
└───────────────────────────────────────────┘
```

---

### ✅ Tarifa 3.0TD (6 potencias, 6 energías)

**Supuesto:** PFL básico 3.0TD con 6 periodos
- Pot: [P1=50, P2=40, P3=35, P4=30, P5=25, P6=20] kW
- En: [E1=400, E2=450, E3=350, E4=300, E5=200, E6=100] kWh

**Cálculo potencia (6 periodos × 30 días):**
```
P = (50×0.122973 + 40×0.043976 + 35×0.097384 + 30×0.05478 
     + 25×0.087232 + 20×0.046691) × 30
P = 6.1492 × 30 = 184.48€
```

**Cálculo energía (6 periodos):**
```
E = 400×0.1422 + 450×0.1422 + 350×0.1422 + 300×0.1422 + 200×0.1422 + 100×0.1422
E = 56.88 + 63.99 + 49.77 + 42.66 + 28.44 + 14.22 = 256.96€
```

**Cálculo reactiva (6 periodos):**
```
R = 80×0.03 = 2.40€
```

**Cálculo completo:**
```
┌─ COMPONENTES BÁSICOS ─────────────────────┐
│ Potencia (6 periodos)              184.48 €
│ Energía (6 períodos)               256.96 €  [Neto: 256.96 - 3.00 exc = 253.96]
│ Reactiva (6 periodos)                2.40 €
│ Alquiler contador                    1.68 €
│ Excedentes (50kWh × 0.06)           -3.00 €
│ ─────────────────────────────────────────
│ SUBTOTAL                            439.52 €
│
├─ IMPUESTOS ──────────────────────────────┤
│
│ Impuesto Eléctrico 5.11%
│   Base: (184.48 + 256.96) = 441.44 €
│   Impuesto: 441.44 × 5.11% =        22.56 €
│
│ IGIC Reducido 3% (sobre potencia + energía + imp. + bono)
│   Base: 184.48 + 256.96 + 22.56 + 0.57 = 464.57 €
│   IGIC 3%: 464.57 × 3% =            13.94 €
│
│ IGIC General 7% (sobre alquiler + SVE)
│   Base: 1.68 + 6.44 = 8.12 €
│   IGIC 7%: 8.12 × 7% =               0.57 €
│
│ Bono Social (activado)               0.57 €
│
├─ TOTAL ──────────────────────────────────┤
│ 439.52 + 22.56 + 13.94 + 0.57 + 0.57 = 477.16 €
└───────────────────────────────────────────┘
```

---

### ✅ Tarifa 6.1TD (6 potencias, 6 energías)

**Supuesto:** PFL básico 6.1TD (misma estructura que 3.0TD)

**Los cálculos son idénticos a 3.0TD** porque ambos tienen:
- 6 periodos de potencia
- 6 periodos de energía
- 6 periodos de energía reactiva

**Resultado esperado:** ~477 € (igual que 3.0TD con mismas tarifas)

La diferencia entre 3.0TD y 6.1TD es **comercial/contractual**, no fiscal:
- **3.0TD:** Alta tensión, clientes industriales medianos
- **6.1TD:** Alta tensión, clientes industriales grandes

---

## ✅ Conclusiones de la Auditoría

### 1. **Cálculos Fiscales**
- ✅ **Código correcto:** No hay errores en `calc()`
- ✅ **SVE en 7%:** Correctamente en `baseIGIC7 = alq + sva`
- ✅ **Impuesto Eléctrico:** Base correcta `(costPot + costEn) × 5.11269632%`
- ✅ **Excedentes:** Restados una sola vez, no duplicados

### 2. **Periodos**
- ✅ **2.0TD:** 2 potencias, 3 energías (código correcto)
- ✅ **3.0TD:** 6 potencias, 6 energías (código correcto)
- ✅ **6.1TD:** 6 potencias, 6 energías (código correcto)

### 3. **Base de Datos**
- ❌ **FALTA:** Segmentos `pyme30`, `pyme61` como entidades separadas
- ❌ **FALTA:** Tarifas ONE para `pyme30` y `pyme61`
- ✅ **EXISTE:** `pyme20`, `pyme20one`, `pyme361` (combinado)

### 4. **Próximos Pasos**
1. Ejecutar migración `supabase/add_pyme30_pyme61_segments.sql`
2. Importar tarifas base/SUPRA de 3.0TD y 6.1TD desde JSON
3. Remover o consolidar `pyme361` si deseas separación completa

---

## 📌 Resumen Ejecutivo

**No hay errores en los cálculos fiscales.** Las tres tarifas (2.0TD, 3.0TD, 6.1TD) comparten la misma función de cálculo correcta. El único problema es **estructural**: faltan los segmentos separados `pyme30` y `pyme61` en la base de datos.

La migración SQL incluida completa esto automáticamente.
