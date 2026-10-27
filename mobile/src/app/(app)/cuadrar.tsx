import { formatFechaCorta, formatNumero, sumar, type FiltroTitular, type Id, type VistaCuenta } from '@steward/domain';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { useAccion, useConsulta } from '@/data/puertos';
import { Aviso, Boton, colors, Encabezado, fonts, Monto, MontoInput, Pantalla, Texto, volverA } from '@/ui';
import { FiltroTitular as Filtro } from '@/components/filtro-titular';

/**
 * Cuadrar.dc.html: un campo por cuenta con lo que dice el banco. La diferencia contra el estimado se guarda sola
 * como ajuste ("Gastos sin registrar"), sin pedir explicacion. Las cuentas en blanco no cambian.
 */
export default function Cuadrar() {
  const [filtro, setFiltro] = useState<FiltroTitular>('TODAS');
  const cuentas = useConsulta(['cuentas', filtro], (p) => p.cuentas.cuentas(filtro));
  const todas = useConsulta(['cuentas', 'TODAS'], (p) => p.cuentas.cuentas());
  const accion = useAccion();
  const [saldos, setSaldos] = useState<Record<Id, number | null>>({});

  const diferencia = (c: VistaCuenta) => {
    const banco = saldos[c.cuenta.id];
    return banco === undefined || banco === null ? null : c.saldo - banco;
  };
  const sinRegistrar = sumar((todas.data?.cuentas ?? []).map((c) => diferencia(c) ?? 0));
  const total = todas.data?.cuentas.length ?? 0;

  async function guardar() {
    const lista = Object.entries(saldos).filter((e): e is [Id, number] => e[1] !== null).map(([cuentaId, saldoBanco]) => ({ cuentaId, saldoBanco }));
    if (await accion.ejecutar((p) => p.cuentas.cuadrar(lista))) volverA('/cuentas');
  }

  return (
    <Pantalla>
      <Encabezado titulo="Cuadrar cuentas" volver="/cuentas" volverTexto="Cuentas">
        <Texto v="pequeno">Hogar · {total} {total === 1 ? 'cuenta' : 'cuentas'}</Texto>
      </Encabezado>
      <Texto style={{ fontSize: 14, lineHeight: 20, color: colors.secundario, marginTop: -12 }}>Escribe lo que dice cada banco. La diferencia se guarda sola, sin explicarla.</Texto>
      <Filtro valor={filtro} onCambio={setFiltro} />
      {(cuentas.data?.cuentas ?? []).map((c) => {
        const d = diferencia(c);
        return (
          <View key={c.cuenta.id} testID={`cuadrar-${c.cuenta.nombre}`} style={{ gap: 10, padding: 14, borderRadius: 14, backgroundColor: colors.superficie, borderWidth: 1, borderStyle: c.aviso ? 'dashed' : 'solid', borderColor: c.aviso ? '#D9D8D2' : colors.borde }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <View style={{ flexShrink: 1, gap: 2 }}>
                <Texto style={{ fontFamily: fonts.semibold }}>{c.cuenta.nombre}</Texto>
                {c.aviso ? (
                  <Texto v="detalle" style={{ color: colors.aviso }}>Sin cuadrar desde el {formatFechaCorta(c.cuenta.fechaCuadre)}</Texto>
                ) : (
                  <Texto v="detalle">{c.titular} · app estima ≈ <Monto valor={c.saldo} style={{ fontSize: 12, color: colors.secundario }} /></Texto>
                )}
              </View>
              {d === null ? (
                c.aviso ? <Boton tipo="enlace" titulo="Omitir" onPress={() => setSaldos((s) => ({ ...s, [c.cuenta.id]: null }))} /> : null
              ) : d === 0 ? (
                <Texto style={{ fontSize: 13, fontFamily: fonts.semibold, color: colors.positivo }}>Cuadra</Texto>
              ) : (
                <Monto valor={-d} signo siempreVisible style={{ fontSize: 13, color: d > 0 ? colors.negativo : colors.positivo }} />
              )}
            </View>
            <MontoInput etiqueta={`${c.cuenta.nombre.toLowerCase() === 'efectivo' ? 'Hay en la billetera' : 'Banco dice'} · ${c.cuenta.nombre}`} placeholder={`≈ ${formatNumero(c.saldo)}`}
              valor={saldos[c.cuenta.id] ?? null} onCambio={(v) => setSaldos((s) => ({ ...s, [c.cuenta.id]: v }))} />
          </View>
        );
      })}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
        <Texto style={{ fontSize: 14, color: colors.textoSuave }}>Gastos sin registrar</Texto>
        <Monto testID="sin-registrar" valor={sinRegistrar} siempreVisible style={{ fontSize: 15, fontFamily: fonts.monoSemibold }} />
      </View>
      <Aviso texto={accion.error} />
      <Boton titulo="Guardar saldos" deshabilitado={!Object.values(saldos).some((v) => v !== null) || accion.ocupado} onPress={guardar} />
    </Pantalla>
  );
}
