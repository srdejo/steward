# Spec Delta

## MODIFIED Requirements

### Requirement: Modo demo con datos de prueba
La UI SHALL funcionar en uno de dos modos, elegido en la configuración del build.

**Modo demo** (sin backend):
- usa un adaptador de prueba en memoria, cargado con los datos de ejemplo del handoff: Salario Daniel bruto $7.000.000 / neto $6.288.000, diezmo 10 % del bruto, cuentas Davivienda, Nu, Efectivo y Ahorros Esposa, y un crédito de libre inversión de $14.250.000;
- las acciones MUST cambiar ese estado, y las pantallas MUST reflejarlo al instante;
- el estado SHALL persistir en el dispositivo entre recargas;
- en Ajustes, "Restablecer datos de prueba" MUST volver a los datos iniciales, y "Probar desde cero" MUST dejar un hogar vacío sin configurar, para recorrer el acceso y el onboarding.

**Modo conectado:**
- la sesión, el hogar, sus miembros y las invitaciones MUST venir del backend;
- los módulos que aún no tienen backend (ingresos y diezmo, plan, movimientos, cuentas y cierre) SHALL seguir con el adaptador de prueba, guardado en el dispositivo;
- "Restablecer datos de prueba" MUST afectar solo a esos módulos, y "Probar desde cero" MUST NOT mostrarse.

En los dos modos, toda pantalla con sesión MUST mostrar un aviso discreto de "Datos de prueba" mientras algún módulo use el adaptador de prueba.

#### Scenario: Persistencia
- **WHEN** se registra un gasto y se recarga la página
- **THEN** el gasto sigue en Hoy

#### Scenario: Restablecer
- **WHEN** en Ajustes se elige "Restablecer datos de prueba" y se confirma
- **THEN** Hoy vuelve a mostrar "Te queda libre $3.436.000"

#### Scenario: Modo conectado
- **WHEN** en modo conectado un miembro abre Ajustes
- **THEN** ve el hogar y los miembros del backend, el aviso "Datos de prueba" sigue visible y no aparece "Probar desde cero"
