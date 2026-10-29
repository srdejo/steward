## MODIFIED Requirements

### Requirement: Modo demo con datos de prueba
La UI SHALL funcionar en uno de dos modos, elegido en la configuración del build.

**Modo demo** (sin backend):
- usa un adaptador de prueba en memoria, cargado con los datos de ejemplo del handoff: Salario Daniel bruto $7.000.000 / neto $6.288.000, diezmo 10 % del bruto, cuentas Davivienda, Nu, Efectivo y Ahorros Esposa, y un crédito de libre inversión de $14.250.000;
- las acciones MUST cambiar ese estado, y las pantallas MUST reflejarlo al instante;
- el estado SHALL persistir en el dispositivo entre recargas;
- en Ajustes, "Restablecer datos de prueba" MUST volver a los datos iniciales, y "Probar desde cero" MUST dejar un hogar vacío sin configurar, para recorrer el acceso y el onboarding.

**Modo conectado:**
- MUST venir del backend:
  - la sesión, el hogar, sus miembros y las invitaciones;
  - los ingresos fijos, las reglas de diezmo y "Diezmo en Hoy";
  - las categorías, los planes de los meses con su Opción A, y lo registrado (ingresos recibidos, pagos, gastos, aportes y diezmos entregados);
  - las cuentas (sin cuadre ni saldo estimado propios todavía).
- Los módulos que aún no tienen backend SHALL seguir con el adaptador de prueba, guardado en el dispositivo: créditos, plan anual y cierre.
- Las pantallas MUST mostrar los datos reales junto a los de prueba, con las cifras calculadas por las mismas reglas. Los planes, los movimientos y las categorías de prueba MUST NOT mezclarse con los reales: en modo conectado solo se ven los reales.
- "Restablecer datos de prueba" MUST afectar solo a los módulos de prueba, y "Probar desde cero" MUST NOT mostrarse.

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

#### Scenario: Restablecer en modo conectado
- **WHEN** en modo conectado se restablecen los datos de prueba
- **THEN** los ingresos fijos, la regla de diezmo, las cuentas, los planes y lo registrado siguen iguales
