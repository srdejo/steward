import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  claveMes,
  formatDiaLargo,

  ORDEN_GRUPO_AVISO,
  PREFERENCIAS_AVISO,
  TEXTO_CUANDO_AVISA,
  TITULO_GRUPO_AVISO,
  type Aviso,
  type GrupoAviso,
  type PreferenciasAviso,
  type TipoAvisoConfigurable,
} from '@steward/domain';

import { PushWeb } from '../../core/avisos/push-web';
import { consulta, mensajeDeError } from '../../core/datos/consulta';
import { PUERTOS } from '../../core/datos/puertos';
import { MiembrosHogar } from '../../core/layout/miembros';
import { SesionActual } from '../../core/sesion/sesion';
import { Icono } from '../../shared/components/icono';
import { Interruptor } from '../../shared/components/interruptor';
import { Monto } from '../../shared/components/monto';
import { anchoEscritorio } from '../../shared/escritorio';
import { Agregar } from '../hoy/agregar';

type Pestana = 'proximos' | 'configurar';

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** El color del bloque de fecha de cada fila (canvas MAvisos). */
function claseBloque(a: Aviso): string {
  if (a.corte) return 'text-[#4B3E85] shadow-[inset_0_0_0_2px_#B9B0DA]';
  if (a.grupo === 'VENCIDO') return 'bg-negativo-suave text-[#8C1D18]';
  if (a.tipo === 'INGRESO') return 'bg-acento-elegido text-positivo';
  if (a.tipo === 'PLAN' || a.tipo === 'CUADRAR') return 'bg-acento-elegido text-acento';
  if (a.tipo === 'TARJETA' || a.tipo === 'CUOTA') return 'bg-[#EDEAF5] text-[#4B3E85]';
  return a.grupo === 'SEMANA' ? 'bg-aviso-suave text-aviso' : 'bg-divisor text-texto-medio';
}

/**
 * Avisos (spec steward-avisos, "Avisos · Próximos" y "Avisos · Configurar"; canvas MAvisos y WAvisos): lo que viene en 30
 * dias agrupado, con marcar pagado ahi mismo, y la configuracion de quien la abre. En movil son dos pestañas
 * (`?pestana=configurar`); desde 1024 px, la lista y la configuracion lado a lado.
 */
@Component({
  selector: 'app-avisos-page',
  imports: [RouterLink, Icono, Interruptor, Monto],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': "escritorio() ? 'flex flex-col gap-5 px-8 pt-7 pb-12' : 'flex flex-col gap-4 px-4 pt-5 pb-8'" },
  template: `
    @if (escritorio()) {
      <div class="flex flex-col gap-0.5">
        <span class="text-[13px] text-secundario">{{ hoyLargo }} · lo que viene en los próximos 30 días</span>
        <h1 class="titular text-[32px] font-bold">Avisos</h1>
      </div>
    } @else {
      <header class="flex flex-col gap-1 px-1">
        <a routerLink="/hoy" class="self-start py-1 text-sm font-medium text-acento">‹ Hoy</a>
        <h1 class="titular text-[28px] font-bold">Avisos</h1>
      </header>
      <div role="tablist" aria-label="Avisos" class="grid grid-cols-2 gap-1 rounded-control bg-hueco p-1">
        @for (t of pestanas; track t.valor) {
          <button type="button" role="tab" class="h-10 rounded-[9px] text-sm" [attr.aria-selected]="pestana() === t.valor"
            [class]="pestana() === t.valor ? 'bg-superficie font-semibold' : 'font-medium'" (click)="elegir(t.valor)">{{ t.etiqueta }}</button>
        }
      </div>
    }

    <div class="flex flex-wrap items-start gap-5">
      @if (escritorio() || pestana() === 'proximos') {
        <div class="flex min-w-0 flex-[2_1_560px] flex-col gap-4" data-testid="proximos">
          @for (g of grupos(); track g.grupo) {
            <section class="flex flex-col gap-1.5" [attr.data-grupo]="g.grupo" [attr.aria-labelledby]="'grupo-' + g.grupo">
              <h2 [id]="'grupo-' + g.grupo" class="px-1 text-[13px] font-semibold" [class]="g.grupo === 'VENCIDO' ? 'text-negativo' : 'text-texto-medio'">{{ g.titulo }}</h2>
              <div class="flex flex-col divide-y divide-divisor rounded-tarjeta bg-superficie">
                @for (a of g.avisos; track a.clave) {
                  <div class="flex min-h-[60px] items-center gap-2.5 px-3 py-2.5" data-testid="aviso" [attr.data-clave]="a.clave">
                    <span class="flex size-10 shrink-0 flex-col items-center justify-center rounded-[11px]" [class]="bloque(a)" aria-hidden="true">
                      <span class="text-sm leading-none font-bold">{{ dia(a) }}</span><span class="text-[10px] leading-tight">{{ mesCorto(a) }}</span>
                    </span>
                    <span class="flex min-w-0 grow flex-col gap-0.5">
                      <span class="text-sm font-medium">{{ a.nombre }}</span>
                      <span class="text-xs" [class]="a.grupo === 'VENCIDO' ? 'font-semibold text-negativo' : 'text-secundario'">{{ a.detalle }}</span>
                    </span>
                    @if (a.monto !== null) {
                      <app-monto class="text-sm font-semibold whitespace-nowrap" [valor]="a.monto" />
                    }
                    @if (a.pago; as p) {
                      <button type="button" class="flex size-11 shrink-0 items-center justify-center rounded-full border-2 border-[#C9C6BD] bg-superficie text-acento"
                        [attr.aria-label]="'Marcar pagado ' + a.nombre" (click)="marcar(p.itemId, p.ref)">
                        <app-icono nombre="check" [tamano]="18" />
                      </button>
                    } @else if (a.destino) {
                      <button type="button" class="flex size-11 shrink-0 items-center justify-center rounded-control bg-acento-suave text-acento"
                        [attr.aria-label]="'Ir a ' + a.nombre" (click)="ir(a)">
                        <app-icono nombre="derecha" [tamano]="18" />
                      </button>
                    }
                  </div>
                }
              </div>
            </section>
          } @empty {
            @if (avisos.value()) {
              <p class="rounded-tarjeta bg-superficie p-4 text-sm text-secundario">Nada por avisar en los próximos 30 días.</p>
            }
          }
          <span class="text-center text-xs text-secundario">Lo que marques aquí también queda pagado en Hoy.</span>
        </div>
      }

      @if (escritorio() || pestana() === 'configurar') {
        <aside class="flex min-w-0 flex-[1_1_340px] flex-col gap-4" aria-label="Configurar avisos" data-testid="configurar">
          @if (escritorio()) {
            <h2 class="text-[15px] font-semibold">Configurar</h2>
          }
          <section class="flex flex-col gap-1.5 rounded-tarjeta bg-superficie px-4 py-3.5">
            <h3 class="text-[15px] font-semibold">Cuándo avisa</h3>
            <p class="text-[13px] leading-[1.45] text-texto-medio" data-testid="cuando-avisa">{{ textoCuando }}</p>
          </section>

          <section class="flex flex-col divide-y divide-divisor rounded-tarjeta bg-superficie px-4 py-1" aria-label="Qué avisar">
            @for (t of tipos(); track t.tipo) {
              <app-interruptor class="min-h-[60px] py-2" [titulo]="t.titulo" [detalle]="t.detalle" [activo]="activo(t.tipo)" (activoChange)="cambiarTipo(t.tipo, $event)" />
            }
          </section>

          <section class="flex flex-col divide-y divide-divisor rounded-tarjeta bg-superficie px-4 py-1">
            <div class="flex min-h-14 items-center gap-3 py-2" data-testid="notificaciones">
              <span class="flex min-w-0 grow flex-col">
                <span class="text-[15px] font-medium">Notificaciones en este {{ dispositivo }}</span>
                <span class="text-xs" [class]="push.estado() === 'ACTIVADAS' ? 'text-positivo' : 'text-secundario'">{{ textoPush() }}</span>
              </span>
              @switch (push.estado()) {
                @case ('ACTIVADAS') {
                  <button type="button" class="boton-secundario h-10 rounded-control px-3.5 text-sm" [disabled]="ocupado()" (click)="probar()">Probar</button>
                }
                @case ('APAGADAS') {
                  <button type="button" class="boton-primario h-10 rounded-control px-3.5 text-sm" [disabled]="ocupado()" (click)="activar()">Activar</button>
                }
              }
            </div>
            <app-interruptor class="min-h-14 py-2" titulo="Resumen por correo" detalle="Lunes 7:30 · pagos de la semana" [activo]="prefs().correo" (activoChange)="guardar({ correo: $event })" />
            <app-interruptor class="min-h-14 py-2" titulo="No molestar" detalle="Nada entre 9:00 p. m. y 7:00 a. m." [activo]="prefs().noMolestar" (activoChange)="guardar({ noMolestar: $event })" />
          </section>
          @if (mensaje()) {
            <p role="status" class="px-1 text-sm text-positivo">{{ mensaje() }}</p>
          }
          @if (error()) {
            <p role="alert" class="px-1 text-sm text-negativo">{{ error() }}</p>
          }
          @if (push.estado() === 'IPHONE_SIN_INSTALAR') {
            <p class="px-1 text-xs leading-[1.45] text-secundario" data-testid="iphone-sin-instalar">En iPhone los avisos llegan si la app está agregada a la pantalla de inicio.</p>
          }
        </aside>
      }
    </div>
  `,
})
export class AvisosPage {
  private readonly puertos = inject(PUERTOS);
  private readonly router = inject(Router);
  private readonly agregar = inject(Agregar);
  private readonly miembros = inject(MiembrosHogar);
  private readonly sesion = inject(SesionActual);
  protected readonly push = inject(PushWeb);
  protected readonly escritorio = anchoEscritorio();
  protected readonly textoCuando = TEXTO_CUANDO_AVISA;
  protected readonly hoyLargo = formatDiaLargo(this.puertos.hoy()).replace(' · ', ' ');
  protected readonly dispositivo = /iPhone|iPad|Android/.test(globalThis.navigator?.userAgent ?? '') ? 'celular' : 'navegador';
  protected readonly pestanas: { valor: Pestana; etiqueta: string }[] = [
    { valor: 'proximos', etiqueta: 'Próximos' },
    { valor: 'configurar', etiqueta: 'Configurar' },
  ];

  /** `?pestana=configurar` (la fila Avisos de Ajustes abre Configurar). */
  readonly pestanaRuta = input<string | undefined>(undefined, { alias: 'pestana' });
  protected readonly pestana = linkedSignal<Pestana>(() => (this.pestanaRuta() === 'configurar' ? 'configurar' : 'proximos'));

  protected readonly avisos = consulta(() => null, (p) => p.avisos.proximos());
  private readonly preferencias = consulta(() => null, (p) => p.avisos.preferencias());
  protected readonly prefs = computed<PreferenciasAviso>(() => this.preferencias.value() ?? PREFERENCIAS_AVISO);
  protected readonly ocupado = signal(false);
  protected readonly mensaje = signal('');
  protected readonly error = signal('');

  protected readonly grupos = computed(() => {
    const porGrupo = new Map<GrupoAviso, Aviso[]>();
    for (const a of this.avisos.value() ?? []) porGrupo.set(a.grupo, [...(porGrupo.get(a.grupo) ?? []), a]);
    return [...porGrupo.entries()]
      .sort(([a], [b]) => ORDEN_GRUPO_AVISO[a] - ORDEN_GRUPO_AVISO[b])
      .map(([grupo, avisos]) => ({ grupo, titulo: TITULO_GRUPO_AVISO[grupo], avisos }));
  });

  /** "Lo que marque Esposa": el otro miembro del hogar. */
  protected readonly tipos = computed<{ tipo: TipoAvisoConfigurable; titulo: string; detalle: string }[]>(() => {
    const yo = this.sesion.usuario()?.id;
    const otro = this.miembros.miembros().find((m) => m.usuario.id !== yo)?.usuario.nombre;
    return [
      { tipo: 'PAGO', titulo: 'Pagos y recibos', detalle: 'Gastos fijos con día de pago' },
      { tipo: 'TARJETA', titulo: 'Tarjetas', detalle: 'Fecha de pago y de corte' },
      { tipo: 'CUOTA', titulo: 'Cuotas de créditos', detalle: 'Cada cuota con su número' },
      { tipo: 'INGRESO', titulo: 'Ingresos esperados', detalle: 'Pregunta si llegó, para calcular el diezmo' },
      { tipo: 'PLAN', titulo: 'Plan del mes', detalle: 'Elegir opción y cerrar el mes' },
      { tipo: 'CUADRAR', titulo: 'Cuadrar cuentas', detalle: 'Si una lleva más de 30 días sin cuadrar' },
      ...(otro ? [{ tipo: 'ACTIVIDAD' as const, titulo: `Lo que marque ${otro}`, detalle: 'Pagos y aportes que registre' }] : []),
    ];
  });

  protected readonly textoPush = computed(() => {
    switch (this.push.estado()) {
      case 'ACTIVADAS':
        return 'Activadas';
      case 'BLOQUEADAS':
        return 'Bloqueadas en el navegador: actívalas en sus ajustes';
      case 'NO_SOPORTADO':
        return 'Este navegador no recibe notificaciones';
      case 'IPHONE_SIN_INSTALAR':
        return 'Agrega la app a la pantalla de inicio';
      default:
        return 'Apagadas';
    }
  });

  protected elegir(p: Pestana): void {
    this.pestana.set(p);
    void this.router.navigate([], { queryParams: { pestana: p === 'configurar' ? p : null }, replaceUrl: true });
  }

  protected bloque(a: Aviso): string {
    return claseBloque(a);
  }

  protected dia(a: Aviso): string {
    return String(Number(a.fecha.slice(8)));
  }

  protected mesCorto(a: Aviso): string {
    return MESES_CORTOS[Number(a.fecha.slice(5, 7)) - 1]!;
  }

  protected activo(t: TipoAvisoConfigurable): boolean {
    return !this.prefs().tiposApagados.includes(t);
  }

  /** Marcar pagado abre Marcar pago (spec steward-hoy) sobre Avisos. */
  protected marcar(itemId: string, ref: { anio: number; mes: number }): void {
    void this.agregar.abrir('pago', itemId, claveMes(ref));
  }

  protected ir(a: Aviso): void {
    const d = a.destino!;
    if (d.tipo === 'CIERRE') void this.router.navigate(['/planear', claveMes(d.ref), 'cierre']);
    else if (d.tipo === 'COMPARAR') void this.router.navigate(['/planear', claveMes(d.ref), 'comparar']);
    else if (d.tipo === 'CUENTA') void this.router.navigate(['/cuentas/cuenta', d.cuentaId]);
    else void this.router.navigate(['/hoy']);
  }

  protected cambiarTipo(t: TipoAvisoConfigurable, activo: boolean): void {
    const apagados = this.prefs().tiposApagados.filter((x) => x !== t);
    void this.guardar({ tiposApagados: activo ? apagados : [...apagados, t] });
  }

  protected async guardar(cambios: Partial<PreferenciasAviso>): Promise<void> {
    this.error.set('');
    try {
      const nuevas = { ...this.prefs(), ...cambios };
      this.preferencias.set(nuevas);
      await this.puertos.avisos.guardarPreferencias(nuevas);
    } catch (e) {
      this.error.set(mensajeDeError(e));
      this.preferencias.reload();
    }
  }

  protected async activar(): Promise<void> {
    await this.ejecutar(async () => {
      await this.push.activar();
      if (this.push.estado() === 'ACTIVADAS') this.mensaje.set('Notificaciones activadas.');
    });
  }

  protected async probar(): Promise<void> {
    await this.ejecutar(async () => {
      await this.push.probar();
      this.mensaje.set('Enviamos un aviso de prueba.');
    });
  }

  private async ejecutar(accion: () => Promise<void>): Promise<void> {
    this.ocupado.set(true);
    this.error.set('');
    this.mensaje.set('');
    try {
      await accion();
    } catch (e) {
      this.error.set(e instanceof Error && !('codigo' in e) ? e.message : mensajeDeError(e));
    } finally {
      this.ocupado.set(false);
    }
  }
}
