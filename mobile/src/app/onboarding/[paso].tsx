import { previsualizarDiezmo, type BaseDiezmo, type Id, type Invitacion, type Pesos } from '@steward/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { mensajeDeError, usePuertos } from '@/data/puertos';
import { useSesion } from '@/data/sesion';
import { Avatar, Aviso, Boton, Campo, colors, fonts, Monto, MontoInput, Pantalla, Texto } from '@/ui';

interface IngresoBorrador {
  id?: Id;
  nombre: string;
  bruto: Pesos | null;
  neto: Pesos | null;
  dia: number | null;
}

const SUGERIDAS = ['Davivienda', 'Nu', 'Efectivo'];

/**
 * Onb1–Onb5.dc.html: nombre y hogar, diezmo (opcional), ingreso fijo, cuentas (opcional) e invitar (opcional).
 * Cada "Continuar" guarda su paso en el adaptador; al terminar el hogar queda configurado y se abre Hoy.
 */
export default function Onboarding() {
  const { paso } = useLocalSearchParams<{ paso: string }>();
  const n = Math.min(5, Math.max(1, Number(paso) || 1));
  const puertos = usePuertos();
  const sesion = useSesion();
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const [nombre, setNombre] = useState(sesion.sesion?.usuario.nombre ?? '');
  const [hogar, setHogar] = useState('');
  const [diezmo, setDiezmo] = useState(true);
  const [porcentaje, setPorcentaje] = useState(10);
  const [base, setBase] = useState<BaseDiezmo>('BRUTO');
  const [ingresos, setIngresos] = useState<IngresoBorrador[]>([{ nombre: 'Salario', bruto: null, neto: null, dia: null }]);
  const [saldos, setSaldos] = useState<Record<string, Pesos | null>>({});
  const [correo, setCorreo] = useState('');
  const [invitaciones, setInvitaciones] = useState<Invitacion[]>([]);

  useEffect(() => {
    (async () => {
      const [h, regla, fijos] = await Promise.all([puertos.hogar.obtener(), puertos.ingresos.regla(), puertos.ingresos.fijos()]);
      setHogar(h.hogar.nombre);
      setInvitaciones(h.invitaciones.filter((i) => i.estado === 'PENDIENTE'));
      if (regla) {
        setDiezmo(regla.activa);
        setPorcentaje(regla.porcentaje);
        setBase(regla.base);
      }
      if (fijos.length) setIngresos(fijos.map((f) => ({ id: f.id, nombre: f.nombre, bruto: f.bruto, neto: f.neto, dia: f.diaPago })));
    })();
  }, [puertos]);

  async function guardar(accion: () => Promise<void>) {
    setGuardando(true);
    setError('');
    try {
      await accion();
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setGuardando(false);
    }
  }

  const continuar = () =>
    guardar(async () => {
      if (n === 1) {
        await puertos.hogar.actualizarPerfil(nombre);
        await puertos.hogar.nombrar(hogar);
      }
      if (n === 2) await puertos.ingresos.guardarRegla({ activa: diezmo, porcentaje: porcentaje || 10, base, aplicaAportes: diezmo });
      if (n === 3) {
        const validos = ingresos.filter((i) => i.nombre.trim() || i.neto || i.bruto);
        if (!validos.length) throw new Error('Agrega al menos un ingreso fijo');
        for (const i of validos) {
          const neto = i.neto ?? i.bruto ?? 0;
          await puertos.ingresos.guardarFijo({ id: i.id, nombre: i.nombre, bruto: i.bruto ?? neto, neto, diaPago: i.dia ?? 1, cuentaId: null });
        }
      }
      if (n === 4) {
        for (const nombreCuenta of SUGERIDAS) {
          const saldo = saldos[nombreCuenta];
          if (saldo === null || saldo === undefined) continue;
          await puertos.cuentas.agregar({ nombre: nombreCuenta, titularId: nombreCuenta === 'Efectivo' ? null : (sesion.sesion?.usuario.id ?? null), saldo });
        }
      }
      router.push(`/onboarding/${n + 1}`);
    });

  const terminar = () =>
    guardar(async () => {
      await puertos.hogar.completarOnboarding();
      await sesion.recargar();
      router.replace('/hoy');
    });

  const invitar = () =>
    guardar(async () => {
      const inv = await puertos.hogar.invitar(correo);
      setInvitaciones((l) => [...l, inv]);
      setCorreo('');
    });

  const vistaPrevia = (i: IngresoBorrador) => (i.bruto || i.neto ? previsualizarDiezmo({ activa: diezmo, porcentaje, base }, i.bruto ?? i.neto ?? 0, i.neto ?? i.bruto ?? 0) : null);

  return (
    <Pantalla demo={false} style={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: 32, gap: 24 }}>
      <View accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: 5, now: n }} style={{ flexDirection: 'row', gap: 6 }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= n ? colors.acento : colors.bordeCampo }} />
        ))}
      </View>

      {n === 1 && (
        <>
          <Encabezado antes="BIENVENIDO" titulo="¿Cómo te llamas?" texto="Lo tomamos de tu cuenta de Google. Cámbialo si quieres." />
          <Campo etiqueta="Tu nombre" valor={nombre} onCambio={setNombre} />
          <View style={{ gap: 8 }}>
            <Campo etiqueta="Nombre del hogar" valor={hogar} onCambio={setHogar} placeholder="Ej: Nuestra casa" />
            <Texto v="detalle">Es el presupuesto que vas a compartir. Puedes cambiarlo después.</Texto>
          </View>
        </>
      )}

      {n === 2 && (
        <>
          <Encabezado antes="APORTE · OPCIONAL" titulo="¿Diezmas de tus ingresos?" texto="Si lo activas, lo calculamos solo cuando entre cada ingreso. Nunca tendrás que escribirlo a mano." />
          <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', gap: 10 }}>
            {[{ v: true, t: 'Sí, diezmo', d: 'Al recibir cada ingreso' }, { v: false, t: 'No por ahora', d: 'Lo puedes activar luego' }].map((o) => (
              <Pressable key={o.t} accessibilityRole="radio" accessibilityState={{ checked: diezmo === o.v }} onPress={() => setDiezmo(o.v)}
                style={{ flex: 1, minHeight: 76, borderRadius: 14, padding: 14, gap: 4, borderWidth: diezmo === o.v ? 2 : 1, borderColor: diezmo === o.v ? colors.acento : colors.bordeCampo, backgroundColor: diezmo === o.v ? colors.acentoSuave : colors.superficie }}>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: colors.texto }}>{o.t}</Text>
                <Texto v="detalle">{o.d}</Texto>
              </Pressable>
            ))}
          </View>
          {diezmo && (
            <View style={{ gap: 16, padding: 16, borderRadius: 14, backgroundColor: colors.superficie, borderWidth: 1, borderColor: colors.borde }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Texto style={{ fontSize: 14, fontFamily: fonts.medium }}>Porcentaje</Texto>
                <TextInput accessibilityLabel="Porcentaje" keyboardType="number-pad" value={`${porcentaje}%`} onChangeText={(t) => setPorcentaje(Math.min(100, Number(t.replace(/\D/g, '')) || 0))}
                  style={{ width: 80, height: 44, borderRadius: 10, borderWidth: 1, borderColor: colors.bordeCampo, backgroundColor: colors.fondo, textAlign: 'center', fontFamily: fonts.mono, fontSize: 16, color: colors.texto }} />
              </View>
              <View style={{ gap: 8 }}>
                <Texto style={{ fontSize: 14, fontFamily: fonts.medium }}>Calcular sobre</Texto>
                <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', gap: 6, padding: 4, borderRadius: 12, backgroundColor: '#F1F0EB' }}>
                  {(['BRUTO', 'NETO'] as const).map((b) => (
                    <Pressable key={b} accessibilityRole="radio" accessibilityState={{ checked: base === b }} onPress={() => setBase(b)}
                      style={{ flex: 1, height: 40, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: base === b ? colors.superficie : 'transparent' }}>
                      <Text style={{ fontFamily: base === b ? fonts.semibold : fonts.medium, fontSize: 14, color: base === b ? colors.texto : colors.secundario }}>{b === 'BRUTO' ? 'Bruto' : 'Neto'}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>
          )}
          <Texto v="pequeno">Aplica solo a tus ingresos. Cada persona del hogar decide el suyo.</Texto>
        </>
      )}

      {n === 3 && (
        <>
          <Encabezado antes="INGRESO FIJO" titulo="Lo que entra cada mes" texto="Defínelo una vez y se repite en todos los meses del año." />
          {ingresos.map((ing, i) => {
            const editar = (cambios: Partial<IngresoBorrador>) => setIngresos((l) => l.map((x, j) => (j === i ? { ...x, ...cambios } : x)));
            const d = vistaPrevia(ing);
            return (
              <View key={i} style={{ gap: 14, padding: 16, borderRadius: 14, backgroundColor: colors.superficie, borderWidth: 1, borderColor: colors.borde }}>
                <Campo etiqueta="Nombre" valor={ing.nombre} onCambio={(t) => editar({ nombre: t })} />
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}><MontoInput etiqueta="Bruto" valor={ing.bruto} onCambio={(v) => editar({ bruto: v })} /></View>
                  <View style={{ flex: 1 }}><MontoInput etiqueta="Entra (neto)" valor={ing.neto} onCambio={(v) => editar({ neto: v })} /></View>
                </View>
                <Campo etiqueta="Día de pago" teclado="number-pad" valor={ing.dia ? String(ing.dia) : ''} placeholder="25" onCambio={(t) => editar({ dia: Math.min(31, Number(t.replace(/\D/g, '')) || 0) || null })} />
                {d !== null && (
                  <View testID="vista-previa-diezmo" style={{ flexDirection: 'row', justifyContent: 'space-between', paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.divisor }}>
                    <Texto style={{ fontSize: 13, color: colors.diezmo }}>Diezmo al recibir · {porcentaje}% del {base === 'BRUTO' ? 'bruto' : 'neto'}</Texto>
                    <Monto valor={d} siempreVisible style={{ fontSize: 13, color: colors.diezmo, fontFamily: fonts.monoSemibold }} />
                  </View>
                )}
              </View>
            );
          })}
          <Boton tipo="secundario" titulo="+ Otro ingreso fijo" onPress={() => setIngresos((l) => [...l, { nombre: '', bruto: null, neto: null, dia: null }])} style={{ borderStyle: 'dashed', height: 48, minHeight: 48 }} />
          <Texto v="pequeno">¿Contratos, negocio o ingresos que varían? No los pongas aquí: los registras con + Aporte cuando lleguen.</Texto>
        </>
      )}

      {n === 4 && (
        <>
          <Encabezado antes="CUENTAS · OPCIONAL" titulo="¿Dónde tienes el dinero?" texto="Un saldo aproximado basta. Lo cuadras cuando quieras." />
          {SUGERIDAS.map((c) => (
            <View key={c} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 }}>
              <Texto style={{ flex: 1, fontFamily: fonts.medium }}>{c}</Texto>
              <View style={{ width: 160 }}>
                <MontoInput etiqueta={`Saldo ${c}`} valor={saldos[c] ?? null} onCambio={(v) => setSaldos((s) => ({ ...s, [c]: v }))} placeholder="≈ 0" />
              </View>
            </View>
          ))}
          <Texto v="pequeno">Quien se una al hogar agrega sus propias cuentas. Ninguna es obligatoria para marcar pagos.</Texto>
        </>
      )}

      {n === 5 && (
        <>
          <Encabezado antes="HOGAR" titulo="¿Con quién compartes el presupuesto?" texto="Le llega un correo y entra con su propia cuenta. Nadie comparte contraseñas." />
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
            <View style={{ flex: 1 }}><Campo etiqueta="Correo" teclado="email-address" valor={correo} onCambio={setCorreo} placeholder="correo@ejemplo.com" /></View>
            <Boton titulo="Invitar" onPress={invitar} deshabilitado={!correo.trim() || guardando} />
          </View>
          {invitaciones.map((inv) => (
            <View key={inv.id} testID="invitacion" style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14, backgroundColor: colors.superficie, borderWidth: 1, borderColor: colors.borde }}>
              <Avatar inicial={inv.email.charAt(0).toUpperCase()} variante="suave" tamano={36} />
              <View style={{ flex: 1, gap: 2 }}>
                <Texto numberOfLines={1} style={{ fontSize: 14, fontFamily: fonts.medium }}>{inv.email}</Texto>
                <Texto v="detalle" style={{ color: colors.aviso }}>Invitación enviada · pendiente</Texto>
              </View>
              <Boton tipo="enlace" titulo="Reenviar" onPress={() => puertos.hogar.reenviar(inv.id)} />
            </View>
          ))}
          <View style={{ gap: 10, padding: 16, borderRadius: 14, backgroundColor: colors.nota }}>
            <Texto style={{ fontSize: 13, fontFamily: fonts.semibold }}>Los dos podrán</Texto>
            <Texto style={{ fontSize: 13, color: colors.textoSuave }}>Ver el mes y el año · marcar pagos · registrar aportes · crear y elegir opciones de presupuesto</Texto>
          </View>
        </>
      )}

      <Aviso texto={error} />

      <View style={{ marginTop: 'auto', gap: 4 }}>
        {n === 5 ? (
          <>
            <Boton titulo="Empezar" onPress={terminar} deshabilitado={guardando} />
            <Boton tipo="enlace" titulo="Invitar después" onPress={terminar} deshabilitado={guardando} />
          </>
        ) : (
          <>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {n > 1 && <Boton tipo="atras" titulo="Atrás" onPress={() => router.back()} style={{ width: 96 }} />}
              <Boton titulo="Continuar" onPress={continuar} deshabilitado={guardando} style={{ flex: 1 }} />
            </View>
            {n === 4 && <Boton tipo="enlace" titulo="Saltar por ahora" onPress={() => router.push('/onboarding/5')} />}
          </>
        )}
      </View>
    </Pantalla>
  );
}

function Encabezado({ antes, titulo, texto }: { antes: string; titulo: string; texto: string }): ReactNode {
  return (
    <View style={{ gap: 10 }}>
      <Text style={{ fontFamily: fonts.semibold, fontSize: 12, letterSpacing: 1.2, color: colors.acento }}>{antes}</Text>
      <Texto accessibilityRole="header" v="tituloGrande">{titulo}</Texto>
      <Texto style={{ fontSize: 15, lineHeight: 22, color: colors.secundario }}>{texto}</Texto>
    </View>
  );
}
