// Eventos del plan anual con rango "desde ... hasta" (spec steward-plan-anual, anual-evento-rango). Hoy: 26 oct 2026.
import { describe, expect, it } from 'vitest';
import { CLAVE_ESTADO, crearAdaptadorDemo, storageEnMemoria } from '../demo';
import { crearSemilla, DANIEL } from '../demo/seed';
import type { EstadoHogar } from '../model';
import { ReglaError, agregarEvento, anualDe, crearOActualizarMeses, editarEvento, opcionDe, opciones, planDe, rangoEvento, resumenAnual } from '.';

const HOY = '2026-10-26';
const CURSO = { nombre: 'Curso', mes: 3, hasta: 6, monto: 250_000, tipo: 'GASTO' as const, usuarioId: null, categoriaId: 'cat-variables' };
const variables = (s: EstadoHogar) => resumenAnual(s, 2027)!.gastos.find((g) => g.nombre === 'Variables')!.valores;

describe('Evento con rango', () => {
  it('gasto de marzo a junio: suma en esos meses y julio no cambia', () => {
    const antes = variables(crearSemilla(HOY));
    const s = agregarEvento(crearSemilla(HOY), { anio: 2027, evento: CURSO });
    const despues = variables(s);
    expect(despues.map((v, i) => v - antes[i]!)).toEqual([0, 0, 250_000, 250_000, 250_000, 250_000, 0, 0, 0, 0, 0, 0]);
    const curso = resumenAnual(s, 2027)!.cambios.find((c) => c.evento.nombre === 'Curso')!;
    expect(rangoEvento(curso.evento)).toBe('Mar a jun');
  });

  it('un "hasta" antes del mes o después de diciembre no se acepta', () => {
    expect(() => agregarEvento(crearSemilla(HOY), { anio: 2027, evento: { ...CURSO, mes: 6, hasta: 3 } })).toThrow(ReglaError);
    expect(() => agregarEvento(crearSemilla(HOY), { anio: 2027, evento: { ...CURSO, hasta: 13 } })).toThrow(ReglaError);
  });

  it('sin "hasta": "en adelante" va a diciembre y si no, el mismo mes', () => {
    const { hasta: _, ...sinHasta } = CURSO;
    const s1 = agregarEvento(crearSemilla(HOY), { anio: 2027, evento: { ...sinHasta, enAdelante: true } });
    const s2 = agregarEvento(crearSemilla(HOY), { anio: 2027, evento: sinHasta });
    const ultimo = (s: EstadoHogar) => opcionDe(anualDe(s, 2027)!).eventos.at(-1)!;
    expect(ultimo(s1).hasta).toBe(12);
    expect(ultimo(s2).hasta).toBe(3);
    expect([rangoEvento(ultimo(s1)), rangoEvento(ultimo(s2))]).toEqual(['Mar en adelante', 'Mar']);
  });

  it('corregir el rango a agosto suma también julio y agosto', () => {
    let s = agregarEvento(crearSemilla(HOY), { anio: 2027, evento: CURSO });
    const id = opcionDe(anualDe(s, 2027)!).eventos.at(-1)!.id;
    const antes = variables(s);
    s = editarEvento(s, { anio: 2027, eventoId: id, evento: { ...CURSO, hasta: 8 } });
    expect(variables(s).map((v, i) => v - antes[i]!)).toEqual([0, 0, 0, 0, 0, 0, 250_000, 250_000, 0, 0, 0, 0]);
  });

  it('el curso en sus meses: marzo a junio lo traen y julio no', () => {
    const s = agregarEvento(crearSemilla(HOY), { anio: 2027, evento: CURSO });
    const opcionId = opcionDe(anualDe(s, 2027)!).id;
    const conMeses = crearOActualizarMeses(s, { anio: 2027, opcionId, actualizar: [], creadoPor: DANIEL, hoy: HOY });
    const tieneCurso = (mes: number) => opciones(planDe(conMeses, { anio: 2027, mes })!)[0]!.items.some((i) => i.nombre === 'Curso');
    expect([3, 4, 5, 6, 7].map(tieneCurso)).toEqual([true, true, true, true, false]);
  });

  it('el demo lee un estado guardado con solo "en adelante"', async () => {
    const storage = storageEnMemoria();
    const viejo = crearSemilla(HOY);
    for (const o of anualDe(viejo, 2027)!.opciones) {
      o.eventos = o.eventos.map(({ hasta: _, ...e }) => ({ ...e, enAdelante: e.nombre === 'Prima' })) as never;
    }
    await storage.setItem(CLAVE_ESTADO, JSON.stringify(viejo));
    const p = crearAdaptadorDemo({ storage, ahora: () => new Date(2026, 9, 26, 10, 0, 0) });
    const r = (await p.plan.anual(2027))!;
    expect(r.cambios.find((c) => c.evento.nombre === 'Prima')!.evento.hasta).toBe(12);
    expect(r.cambios.find((c) => c.evento.nombre !== 'Prima')!.evento.hasta).toBe(r.cambios.find((c) => c.evento.nombre !== 'Prima')!.evento.mes);
  });
});
