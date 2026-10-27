import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, render, screen, waitFor } from '@testing-library/react-native';
import { formatCop } from '@steward/domain';
import { Text } from 'react-native';

import { crearPuertosDemo, DatosProvider, useConsulta } from '@/data/puertos';
import { AHORA, OCT, puertosDePrueba } from './demo';

function Libre() {
  const r = useConsulta(['resumen', OCT], (p) => p.movimientos.resumenMes(OCT));
  return <Text testID="libre">{r.data ? formatCop(r.data.libre) : '…'}</Text>;
}

describe('capa de datos (design D2)', () => {
  it('la consulta se actualiza sola despues de una escritura', async () => {
    const p = puertosDePrueba();
    await p.sesion.iniciar('GOOGLE');
    render(
      <DatosProvider puertos={p}>
        <Libre />
      </DatosProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('libre')).toHaveTextContent('$3.436.000'));
    await act(() => p.movimientos.registrarGasto({ monto: 85_000, itemId: null, nota: '', usuarioId: 'u-daniel', origen: { tipo: 'NINGUNO' }, ref: OCT }));
    await waitFor(() => expect(screen.getByTestId('libre')).toHaveTextContent('$3.351.000'));
  });

  it('guarda en steward-demo/v1 y nunca toca los datos de la v1', async () => {
    const v1 = JSON.stringify({ meses: ['datos de la v1'] });
    await AsyncStorage.setItem('@steward/budget_v3', v1);
    const p = crearPuertosDemo(AHORA);
    await p.sesion.iniciar('GOOGLE');
    await p.movimientos.registrarGasto({ monto: 85_000, itemId: null, nota: '', usuarioId: 'u-daniel', origen: { tipo: 'NINGUNO' }, ref: OCT });
    await p.demo!.restablecer();
    await p.demo!.probarDesdeCero();
    expect(await AsyncStorage.getItem('@steward/budget_v3')).toBe(v1);
    expect(await AsyncStorage.getItem('steward-demo/v1')).not.toBeNull();
    expect([...(await AsyncStorage.getAllKeys())].sort()).toEqual(['@steward/budget_v3', 'steward-demo/session', 'steward-demo/v1']);
  });
});
