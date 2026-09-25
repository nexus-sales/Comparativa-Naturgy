import type {
  VentaPyme, VentaRes, ResComisiones, RappelTramo, AdocTramo,
} from "./commissionCalc";

/**
 * Valida la copia de seguridad antes de meterla en el estado (y de ahí en
 * localStorage).
 *
 * El archivo lo puede haber preparado cualquiera: los tipos de TypeScript no
 * existen en tiempo de ejecución. Sin esto, un `kwh` de texto llegaba tal cual
 * al HTML del PDF —`toLocaleString` de una cadena devuelve la propia cadena—
 * y se ejecutaba en una ventana con el origen de la app, con la cookie del
 * administrador. Y como se guardaba en localStorage, en cada exportación.
 *
 * Todo o nada: si una sola parte no es válida no se importa ninguna, para no
 * dejar una mezcla de datos viejos y nuevos.
 */

type Obj = Record<string, unknown>;

const esObj = (x: unknown): x is Obj => typeof x === "object" && x !== null && !Array.isArray(x);
const esNum = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
const esTexto = (x: unknown): x is string => typeof x === "string";
const esBool = (x: unknown): x is boolean => typeof x === "boolean";
const esTextoONulo = (x: unknown) => x === null || esTexto(x);
// El id nace de Date.now(); se acepta también texto para no rechazar copias
// antiguas o editadas a mano, porque nunca se pinta en el HTML.
const esId = (x: unknown) => esNum(x) || esTexto(x);

function ventaPyme(v: unknown): v is VentaPyme {
  return esObj(v)
    && esId(v.id)
    && esTexto(v.nombre) && esTexto(v.cups) && esTexto(v.tarifa)
    && esNum(v.kwh) && esNum(v.comision)
    && (v.planTipo === "fijo" || v.planTipo === "variable")
    && (v.planPlan === "one" || v.planPlan === "luz" || v.planPlan === "supra")
    && esTexto(v.planLabel)
    && esTexto(v.fechaVenta) && esTexto(v.fechaActivacion)
    && esTextoONulo(v.mesCobro)
    && esTexto(v.metodo);
}

function ventaRes(v: unknown): v is VentaRes {
  return esObj(v)
    && esId(v.id)
    && esTexto(v.nombre) && esTexto(v.cups)
    && (v.producto === "luz" || v.producto === "gas" || v.producto === "dual" || v.producto === "servicios")
    && esNum(v.comisionBase) && esNum(v.rappel) && esNum(v.comision)
    && esTexto(v.fechaVenta) && esTexto(v.fechaActivacion)
    && esTextoONulo(v.mesCobro);
}

function resComisiones(v: unknown): v is ResComisiones {
  return esObj(v) && esNum(v.luz) && esNum(v.gas) && esNum(v.dual) && esNum(v.servicios);
}

function rappelTramo(v: unknown): v is RappelTramo {
  return esObj(v) && esId(v.id) && esTexto(v.label) && esNum(v.valor) && esBool(v.activo);
}

function adocTramo(v: unknown): v is AdocTramo {
  return esObj(v) && esId(v.id) && esTexto(v.label) && esTexto(v.ref) && esNum(v.valor) && esBool(v.activo);
}

const lista = <T,>(x: unknown, valido: (v: unknown) => v is T): x is T[] =>
  Array.isArray(x) && x.every(valido);

export type BackupValido = {
  ventas?: VentaPyme[];
  ventasRes?: VentaRes[];
  resComisiones?: ResComisiones;
  resRappelTramos?: RappelTramo[];
  resAdocTramos?: AdocTramo[];
};

/** Devuelve el backup ya tipado, o lanza con el nombre de la parte que falla. */
export function validarBackup(data: unknown): BackupValido {
  if (!esObj(data)) throw new Error("La copia de seguridad no tiene el formato esperado.");

  const partes: [keyof BackupValido, (x: unknown) => boolean][] = [
    ["ventas", (x) => lista(x, ventaPyme)],
    ["ventasRes", (x) => lista(x, ventaRes)],
    ["resComisiones", resComisiones],
    ["resRappelTramos", (x) => lista(x, rappelTramo)],
    ["resAdocTramos", (x) => lista(x, adocTramo)],
  ];

  for (const [clave, valido] of partes) {
    // null o ausente = parte que no viene, como antes (el import las saltaba).
    if (data[clave] != null && !valido(data[clave])) {
      throw new Error(`La copia de seguridad tiene datos no válidos en "${clave}".`);
    }
  }
  return data as BackupValido;
}
