import {
  MAX_MESES_PRIMERA_CUOTA, compararMes, cuotaFija, cuotasRestantes, emDeEa, formatCop, formatMesAnio, mesDe, saldoPlan, sumarMeses,
  type Credito, type MetodoCredito,
} from '@steward/domain';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';

import { useAccion, usePuertos } from '@/data/puertos';
import { Aviso, Boton, Campo, colors, CuerpoModal, fonts, MontoInput, Segmentado, Texto } from '@/ui';

const METODOS: { valor: MetodoCredito; titulo: string; desc: string }[] = [
  { valor: 'TASA', titulo: 'Con la tasa de interés', desc: 'Calculamos interés y capital de cada cuota. Ideal para préstamos.' },
  { valor: 'PLAN', titulo: 'Con el plan de pagos', desc: 'Número de cuotas y tasa efectiva anual: la tabla, cuota a cuota. Ideal para compras a cuotas.' },
  { valor: 'MANUAL', titulo: 'Lo actualizo a mano', desc: 'Escribes el saldo cuando llegue el extracto.' },
];

function numero(texto: string): number {
  const limpio = texto.trim().replace('%', '').replace(',', '.');
  return limpio === '' ? NaN : Number(limpio);
}

/** EA equivalente a una EM, para mostrar la tasa de un plan de pagos al cambiarlo. */
function eaDeEm(em: number): string {
  return String(Math.round((Math.pow(1 + em / 100, 12) - 1) * 10_000) / 100).replace('.', ',');
}

/**
 * CreditoMetodo.dc.html: "¿Cómo baja el saldo?" (spec steward-cuentas, "Cómo baja el saldo de un crédito"), como la hoja de
 * la PWA. Sin `credito`, es "+ Crédito" y pide tambien nombre, entidad y dia de pago; con `credito`, "Cambiar".
 */
export function MetodoCredito({ credito, onCerrar }: { credito: Credito | null; onCerrar: () => void }) {
  const puertos = usePuertos();
  const accion = useAccion();
  const [metodo, setMetodo] = useState<MetodoCredito>(credito?.metodo ?? 'TASA');
  const [nombre, setNombre] = useState('');
  const [entidad, setEntidad] = useState('');
  const [diaTexto, setDiaTexto] = useState('');
  const [saldo, setSaldo] = useState<number | null>(credito?.saldo ?? null);
  const [cuota, setCuota] = useState<number | null>(credito?.cuota ?? null);
  const [totalOriginal, setTotalOriginal] = useState<number | null>(null);
  const [tasaTexto, setTasaTexto] = useState(credito ? (credito.metodo === 'PLAN' ? eaDeEm(credito.tasaEM) : String(credito.tasaEM).replace('.', ',')) : '');
  const [unidad, setUnidad] = useState<'EM' | 'EA' | null>('EM');
  const [valor, setValor] = useState<number | null>(credito?.valorFinanciado ?? null);
  const [numeroTexto, setNumeroTexto] = useState(credito?.numeroCuotas ? String(credito.numeroCuotas) : '');
  const [pagadasTexto, setPagadasTexto] = useState(credito?.metodo === 'PLAN' ? String(credito.cuotasPagadas) : '');
  // Primera cuota: meses despues del en curso (0: este mes). Una ya pasada se muestra como este mes (spec "Primera cuota de un crédito").
  const M = mesDe(puertos.hoy());
  const [primeraInicial] = useState(() => {
    const p = credito?.primeraCuota ?? null;
    return p && compararMes(p, M) > 0 ? Math.min((p.anio - M.anio) * 12 + p.mes - M.mes, MAX_MESES_PRIMERA_CUOTA) : 0;
  });
  const [primera, setPrimera] = useState(primeraInicial);

  const plan = metodo === 'PLAN';
  const t = numero(tasaTexto || '0');
  const tasaEM = !Number.isFinite(t) || t < 0 ? NaN : plan || unidad === 'EA' ? emDeEa(t) : Math.round(t * 100) / 100;
  const dia = credito ? credito.diaPago : Number(diaTexto.trim());
  const n = Number(numeroTexto.trim());
  const pagadas = Number(pagadasTexto.trim() || '0');

  let resumen = '';
  if (metodo === 'TASA') {
    if (!saldo || !cuota || Number.isNaN(tasaEM)) resumen = '¿Te dan tasa efectiva anual? Elige "Anual (EA)" y la convertimos.';
    else {
      const restantes = cuotasRestantes({ saldo, cuota, tasaEM });
      const equivale = unidad === 'EA' ? ` Equivale a ${String(tasaEM).replace('.', ',')} % EM.` : '';
      resumen = restantes === null ? `La cuota no alcanza para los intereses del mes.${equivale}` : `Con esto: ${restantes} cuotas, termina ≈ ${formatMesAnio(sumarMeses(M, primera > 0 ? primera + restantes - 1 : restantes))}.${equivale}`;
    }
  } else if (plan) {
    if (!valor || !Number.isInteger(n) || n < 1 || Number.isNaN(tasaEM)) resumen = 'Escribe el valor, el número de cuotas y la tasa (0 si es sin intereses).';
    else {
      const c = cuotaFija(valor, n, tasaEM);
      const s = saldoPlan({ valorFinanciado: valor, numeroCuotas: n, tasaEM, cuota: c }, pagadas);
      resumen = `Cuota de ${formatCop(c)} · debes ${formatCop(s)} · cuota ${Math.min(n, pagadas + 1)} de ${n}. Calculado con la tasa; corrígelo con el extracto si no coincide.`;
    }
  }

  const listo = (credito || (!!nombre.trim() && Number.isInteger(dia) && dia >= 1 && dia <= 31)) && !Number.isNaN(tasaEM)
    && (plan ? !!valor && Number.isInteger(n) && n >= 1 && pagadas >= 0 && pagadas < n : saldo !== null && !!cuota);

  const guardar = () => {
    const datos = {
      metodo, saldo: plan ? 0 : saldo!, cuota: plan ? 0 : cuota!, tasaEM: metodo === 'MANUAL' ? 0 : tasaEM,
      numeroCuotas: plan ? n : null, cuotasPagadas: plan ? pagadas : (credito?.cuotasPagadas ?? 0), valorFinanciado: plan ? valor : null,
      primeraCuota: primera > 0 ? sumarMeses(M, primera) : null,
    };
    void accion
      .ejecutar((p) => (credito ? p.cuentas.cambiarMetodo(credito.id, datos)
        : p.cuentas.agregarCredito({ ...datos, nombre, entidad, diaPago: dia, totalOriginal: plan ? 0 : (totalOriginal ?? saldo!) })))
      .then((ok) => ok && onCerrar());
  };

  return (
    <Modal visible animationType="slide" presentationStyle="formSheet" onRequestClose={onCerrar}>
      <CuerpoModal>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Texto accessibilityRole="header" style={{ fontFamily: fonts.bold, fontSize: 22 }}>{credito ? '¿Cómo baja el saldo?' : 'Nuevo crédito'}</Texto>
          <Boton tipo="enlace" titulo="Cancelar" onPress={onCerrar} />
        </View>
        {!credito && (
          <>
            <Campo etiqueta="Nombre" valor={nombre} onCambio={setNombre} placeholder="Ej: Libre inversión" />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}><Campo etiqueta="Entidad" valor={entidad} onCambio={setEntidad} placeholder="Ej: Bancolombia" /></View>
              <View style={{ flex: 1 }}><Campo etiqueta="Día de pago" teclado="number-pad" valor={diaTexto} onCambio={setDiaTexto} placeholder="15" /></View>
            </View>
          </>
        )}
        <View accessibilityRole="radiogroup" accessibilityLabel="Método" style={{ gap: 8 }}>
          {METODOS.map((m) => {
            const activo = metodo === m.valor;
            return (
              <Pressable key={m.valor} accessibilityRole="radio" accessibilityState={{ checked: activo }} onPress={() => setMetodo(m.valor)}
                style={{ flexDirection: 'row', gap: 12, padding: 14, borderRadius: 12, borderWidth: activo ? 2 : 1, borderColor: activo ? colors.acento : colors.borde, backgroundColor: activo ? colors.acentoSuave : colors.superficie }}>
                <View style={{ width: 18, height: 18, borderRadius: 9, marginTop: 2, borderWidth: activo ? 5 : 2, borderColor: activo ? colors.acento : colors.control }} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Texto style={{ fontSize: 15, fontFamily: fonts.semibold }}>{m.titulo}</Texto>
                  <Texto v="detalle">{m.desc}</Texto>
                </View>
              </Pressable>
            );
          })}
        </View>
        {metodo === 'TASA' && (
          <>
            <MontoInput etiqueta="Saldo hoy" valor={saldo} onCambio={setSaldo} />
            <MontoInput etiqueta="Cuota" valor={cuota} onCambio={setCuota} />
            {!credito && <MontoInput etiqueta="Total original" ayuda="Opcional" valor={totalOriginal} onCambio={setTotalOriginal} />}
            <Campo etiqueta="Tasa (%)" teclado="decimal-pad" valor={tasaTexto} onCambio={setTasaTexto} placeholder="1,6" />
            <Segmentado opciones={[{ valor: 'EM', etiqueta: 'Mensual (EM)' }, { valor: 'EA', etiqueta: 'Anual (EA)' }]} valor={unidad} onCambio={setUnidad} />
          </>
        )}
        {plan && (
          <>
            <MontoInput etiqueta="Valor financiado" valor={valor} onCambio={setValor} />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}><Campo etiqueta="Número de cuotas" teclado="number-pad" valor={numeroTexto} onCambio={setNumeroTexto} placeholder="12" /></View>
              <View style={{ flex: 1 }}><Campo etiqueta="Cuotas pagadas" teclado="number-pad" valor={pagadasTexto} onCambio={setPagadasTexto} placeholder="0" /></View>
            </View>
            <Campo etiqueta="Tasa efectiva anual (%)" teclado="decimal-pad" valor={tasaTexto} onCambio={setTasaTexto} placeholder="0" />
          </>
        )}
        {metodo === 'MANUAL' && (
          <>
            <MontoInput etiqueta="Saldo del último extracto" valor={saldo} onCambio={setSaldo} />
            <MontoInput etiqueta="Cuota" valor={cuota} onCambio={setCuota} />
            <Texto v="detalle">Te recordamos actualizarlo el día de pago.</Texto>
          </>
        )}
        <View style={{ gap: 8 }}>
          <Texto v="detalle" style={{ fontFamily: fonts.semibold }}>Primera cuota</Texto>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityRole="radiogroup" accessibilityLabel="Primera cuota"
            contentContainerStyle={{ gap: 8 }}>
            {Array.from({ length: MAX_MESES_PRIMERA_CUOTA + 1 }, (_, i) => {
              const activo = primera === i;
              const mes = formatMesAnio(sumarMeses(M, i));
              return (
                <Pressable key={i} testID={`primera-${i}`} accessibilityRole="radio" accessibilityState={{ checked: activo }} onPress={() => setPrimera(i)}
                  style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, borderWidth: activo ? 2 : 1, borderColor: activo ? colors.acento : colors.borde, backgroundColor: activo ? colors.acentoSuave : colors.superficie }}>
                  <Texto style={{ fontSize: 14, fontFamily: activo ? fonts.semibold : fonts.regular }}>{i === 0 ? `Este mes (${mes.toLowerCase()})` : mes}</Texto>
                </Pressable>
              );
            })}
          </ScrollView>
          {!!credito && primera !== primeraInicial && (
            <Texto testID="nota-primera" v="detalle">Los meses ya planeados no cambian; ajústalos en Planear.</Texto>
          )}
        </View>
        {!!resumen && <Texto testID="resumen-metodo" v="detalle">{resumen}</Texto>}
        <Texto v="detalle">Siempre puedes corregir con el saldo del extracto: la app ajusta desde ahí.</Texto>
        <Aviso texto={accion.error} />
        <Boton titulo={credito ? 'Guardar' : 'Agregar crédito'} deshabilitado={!listo || accion.ocupado} onPress={guardar} />
      </CuerpoModal>
    </Modal>
  );
}
