# Proposal

## Why

Con la Etapa 4, el plan del mes y lo que se registra en Hoy ya son reales y compartidos. Pero en Cuentas solo es real la lista:
- "Cuadrar cuentas" y "Mover dinero" avisan que llegan después;
- el saldo estimado de las cuentas reales suma solo los movimientos de los meses que lee la app, así que cambia cuando un mes sale de esa ventana;
- los créditos siguen de prueba, y pagar su cuota no baja ningún saldo real.

Esta es la Etapa 5 del ROADMAP.

Criterio de cierre: dos personas cuadran las cuentas y la diferencia queda como "Gastos sin registrar"; mueven dinero entre dos cuentas y los saldos estimados lo reflejan; agregan un crédito, su cuota aparece en el plan del mes, y pagarla en Hoy o registrar un abono baja el saldo del crédito, igual para los dos.

## What Changes

- **Backend: cuentas completas**, en la capacidad `steward-finanzas`:
  - **Saldo estimado** como en el dominio: lo que dijo el banco en el último cuadre más lo registrado después. Cada movimiento lleva un orden de registro, y cada cuenta el orden de su último cuadre.
  - **Cuadrar todas**: por cada cuenta con valor, la diferencia contra el saldo estimado queda como ajuste "Gastos sin registrar", y la cuenta queda cuadrada hoy. Las que no traen valor no cambian.
  - **Mover dinero**: una transferencia entre dos cuentas distintas del hogar.
- **Backend: créditos del hogar**, en `steward-finanzas`:
  - **"+ Agregar crédito"**: nombre, entidad, saldo, cuota, tasa efectiva mensual, día de pago y total original.
  - **Su cuota entra al plan**: al crearlo, se agrega a la Opción A del mes en curso (si tiene plan y no está cerrado) como ítem de Créditos enlazado al crédito. Al crear un mes, se copia como las demás. Si falta, se agrega, mientras el crédito tenga saldo.
  - **Pagar la cuota en Hoy** baja el saldo en la parte de capital (la cuota menos el interés del mes), como `marcarPago` del dominio.
  - **"Actualizar saldo"** y **"Registrar abono"** (abono a capital, desde una cuenta, "Su cuenta" o ninguno; no más que el saldo).
  - Los últimos pagos de cada crédito (cuotas y abonos) salen de lo registrado.
- **Dominio compartido:**
  - `agregarCredito` nuevo;
  - `crearMes` agrega la cuota de los créditos con saldo que falten en el mes, también en "Desde cero";
  - una cuota de un crédito ya pagado (saldo $0) no se copia.
- **PWA en modo conectado:**
  - Cuadrar, Mover dinero, los créditos ("+ Agregar crédito", Actualizar saldo, Registrar abono y el simulador) van contra el backend;
  - el saldo estimado usa el orden real de registro y el último cuadre de cada cuenta;
  - "Probarlo como opción" sigue avisando que llega en la Etapa 7.
- **Sigue con datos de prueba:** plan anual y cierre. El aviso "Datos de prueba" se mantiene.
- **Al conectar, los créditos de prueba desaparecen.** Un hogar sin créditos ve "Sin créditos." y los agrega desde Cuentas.
- **Migración Flyway `V5`:**
  - `credito`;
  - `cuenta` gana el orden de su último cuadre;
  - `movimiento` gana el orden de registro, los tipos AJUSTE_CUADRE, TRANSFERENCIA y ABONO_CREDITO, la cuenta destino y el crédito;
  - `item_plan` gana el crédito.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `steward-finanzas`:
  - "Cuentas básicas" crece con el saldo estimado, el cuadre y mover dinero;
  - nuevos: "Créditos del hogar" y "Abono y saldo de un crédito";
  - "Marcar un pago" baja el saldo del crédito al pagar su cuota;
  - "Finanzas del hogar en una lectura" incluye los créditos, el orden de registro y lo necesario para el saldo estimado.
- `steward-plan-mes`:
  - "Crear el plan de un mes" agrega las cuotas de los créditos;
  - "Ítems de la opción" admite el enlace con un crédito.
- `steward-cuentas`:
  - "Cuentas y créditos" se reemplaza por "Cuentas, cuadre y créditos": en modo conectado, Cuadrar, Mover dinero y los créditos van al backend;
  - "Detalle de crédito" pide el origen del abono;
  - nuevo: "Agregar crédito".
- `steward-ui-shell`: la lista de lo que sigue con el adaptador de prueba en modo conectado.

## Impact

- **`backend/`**:
  - migración `V5__cuentas_creditos.sql`;
  - modelo, puerto y adaptador de crédito;
  - `Movimiento` y `Cuenta` crecen;
  - `CuentasUseCase` nuevo, para cuadre, mover dinero y créditos;
  - `FinanzasUseCase.pagar` baja el saldo del crédito;
  - `PlanUseCase.crearPlan` agrega las cuotas;
  - contrato nuevo, también en modo AOT.
- **`packages/domain`**:
  - `agregarCredito` y el puerto `CuentasPort.agregarCredito`;
  - el cambio en `crearMes`;
  - tests.
- **`frontend/`**:
  - `PuertosConectados` conecta `cuentas` completo;
  - la superposición crece con créditos y el orden real;
  - la hoja "+ Agregar crédito" en Cuentas, también en modo demo.
- **API nueva**:
  - `POST /api/cuentas/cuadre` y `POST /api/transferencias`;
  - `POST /api/creditos`, `PUT /api/creditos/{id}/saldo` y `POST /api/creditos/{id}/abonos`.
- **Sin cambios** en `infra/`, el despliegue ni la app Expo.
