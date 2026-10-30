## MODIFIED Requirements

### Requirement: Fidelidad al diseño
Cada pantalla SHALL reproducir el layout, los textos y los tokens de su artboard en `design/*.dc.html`: fondo #FAFAF7, superficie #FFFFFF, bordes #E7E6E1/#EFEEEA, texto #1B1C1A/#5F625C, acento #2E4A3B y los colores de categoría y de estado del handoff. Inter MUST usarse para la UI y JetBrains Mono para los montos. Las sombras MUST NOT usarse. Toda zona tocable MUST medir al menos 44 × 44 px, aunque su forma visible sea menor.

#### Scenario: Comparación con el artboard
- **WHEN** se compara Hoy a 390 px con `Main.dc.html`
- **THEN** coinciden el orden de las secciones, los textos, los colores y las tipografías, y los montos usan la fuente monoespaciada

#### Scenario: Botón pequeño
- **WHEN** se inspecciona el botón "Recibí" de un ingreso por recibir (más bajo que 44 px en el diseño)
- **THEN** su zona tocable mide al menos 44 px de alto

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
  - los ingresos fijos y las reglas de diezmo;
  - las categorías, los planes de los meses con todas sus opciones, y lo registrado (ingresos recibidos, pagos, gastos, aportes, las entregas de diezmo registradas antes de que el diezmo pasara al plan, ajustes de cuadre, transferencias y abonos);
  - las cuentas, con su cuadre y su saldo estimado, y los créditos;
  - los cierres de mes;
  - el plan anual y los aportes proyectados.
- Ningún módulo usa ya el adaptador de prueba: los datos de ejemplo MUST NOT verse en modo conectado, y las cifras se calculan con las mismas reglas del dominio sobre lo real.
- "Restablecer datos de prueba" y "Probar desde cero" MUST NOT mostrarse.

En los dos modos, toda pantalla con sesión MUST mostrar un aviso discreto de "Datos de prueba" mientras algún módulo use el adaptador de prueba.

#### Scenario: Persistencia
- **WHEN** se registra un gasto y se recarga la página
- **THEN** el gasto sigue en Hoy

#### Scenario: Restablecer
- **WHEN** en Ajustes se elige "Restablecer datos de prueba" y se confirma
- **THEN** Hoy vuelve a mostrar "Te queda libre $3.436.000"

#### Scenario: Modo conectado
- **WHEN** en modo conectado un miembro abre Ajustes
- **THEN** ve el hogar y los miembros del backend, sin el aviso "Datos de prueba" ni la sección de datos de prueba

#### Scenario: Restablecer en modo conectado
- **WHEN** en modo conectado un miembro abre Ajustes
- **THEN** no aparece "Restablecer datos de prueba", porque no hay datos de prueba que restablecer
