## MODIFIED Requirements

### Requirement: Navegación principal
La UI SHALL tener cuatro destinos principales, con estos nombres visibles: **Hoy** (la pantalla Hoy), **Planear**, **Cuentas** y **Ajustes**, y un botón para agregar. Las rutas `/hoy` y `/planear` MUST NOT cambiar.

Con un ancho menor a 1024 px, la navegación MUST mostrarse como barra inferior de cinco espacios: Hoy, Planear, un botón central **+** (spec `steward-hoy`, "Agregar desde un solo botón"), Cuentas y Ajustes. Desde 1024 px MUST mostrarse como menú lateral con el nombre del hogar, los cuatro destinos y el botón **Agregar**; no hay barra inferior.

Los avatares del hogar en Hoy MUST seguir abriendo Ajustes. Al abrir la app con sesión, SHALL mostrarse siempre Hoy del mes en curso.

#### Scenario: Móvil
- **WHEN** la PWA se abre a 390 px de ancho con sesión iniciada
- **THEN** se ve Hoy del mes en curso y una barra inferior con Hoy (activo), Planear, el botón +, Cuentas y Ajustes

#### Scenario: Web
- **WHEN** la PWA se abre a 1280 px de ancho
- **THEN** el menú lateral muestra el nombre del hogar, Hoy, Planear, Cuentas, Ajustes y el botón Agregar, y no hay barra inferior

#### Scenario: Ajustes desde el menú lateral
- **WHEN** a 1280 px se toca Ajustes en el menú lateral
- **THEN** se abre Ajustes y queda marcado como destino activo

#### Scenario: Ajustes desde la barra inferior
- **WHEN** a 390 px se toca Ajustes en la barra inferior
- **THEN** se abre Ajustes y queda marcado como destino activo

#### Scenario: Ajustes desde los avatares
- **WHEN** en Hoy se toca el grupo de avatares "D E"
- **THEN** se abre Ajustes del hogar

#### Scenario: Los nombres nuevos
- **WHEN** se abre la app con sesión
- **THEN** la navegación muestra Hoy, Planear, Cuentas y Ajustes, y un enlace guardado a `/hoy` sigue abriendo Hoy

#### Scenario: La app
- **WHEN** la app de iPhone se abre con sesión
- **THEN** su barra inferior tiene los mismos cinco espacios que la PWA a 390 px

### Requirement: Fidelidad al diseño
Cada pantalla SHALL reproducir el layout, los textos y los tokens de su artboard en el canvas "Presupuesto Hogar · Rediseño" (sistema **Libreta clara**). Los tokens son:
- fondo #F6F5F1 y superficie #FFFFFF, sin bordes alrededor de las tarjetas;
- tinta #1A1D1A y tinta suave #63675F;
- acción #1F4D3B, entra #2F7A4F, atención #8A5200 y vencido #B3261E.

Cada categoría MUST tener el mismo color en todas las pantallas: Ingresos #2F7A4F, Gastos fijos #C2603A, Variables #8A8D85, Créditos y tarjetas #6B5BA8, Ahorro #3F6E9E y Diezmo #2C7A70.

Tipografía:
- Inter MUST usarse para la UI y para los montos, con cifras tabulares;
- Space Grotesk MUST usarse para los títulos de pantalla y la cifra principal;
- JetBrains Mono MUST NOT usarse.

El acento MUST marcar solo lo que se toca o lo principal; los colores de estado MUST aparecer solo cuando algo pide atención. Las sombras MUST NOT usarse. Toda zona tocable MUST medir al menos 44 × 44 px, aunque su forma visible sea menor.

#### Scenario: Comparación con el artboard
- **WHEN** se compara Hoy a 390 px con el artboard "Hoy" del canvas
- **THEN** coinciden el orden de las secciones, los textos, los colores y las tipografías, y los montos usan Inter con cifras tabulares

#### Scenario: La cifra principal
- **WHEN** se abre Hoy
- **THEN** "Te queda libre en {mes}" usa Space Grotesk y es la cifra más grande de la pantalla

#### Scenario: Botón pequeño
- **WHEN** se inspecciona el botón "Recibí" de un ingreso por recibir (más bajo que 44 px en el diseño)
- **THEN** su zona tocable mide al menos 44 px de alto

#### Scenario: Color de categoría
- **WHEN** se ve la categoría Gastos fijos en Hoy, en el plan del mes y en Ajustes
- **THEN** las tres usan el color #C2603A
