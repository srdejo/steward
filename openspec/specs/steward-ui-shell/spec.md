# steward-ui-shell Specification

## Purpose

Define la base común de la UI de Presupuesto Hogar en la PWA y en la app: navegación, layout móvil y web, tokens visuales, formato de montos y el modo demo con datos de prueba.

## Requirements

### Requirement: Navegación principal
La UI SHALL tener tres destinos principales: **Hoy**, **Planear** y **Cuentas**. Con un ancho menor a 1024 px MUST mostrarse como barra inferior; desde 1024 px, como menú lateral con los mismos destinos. Ajustes MUST abrirse desde los avatares del hogar en Hoy y no ser un destino de la barra. Al abrir la app con sesión, SHALL mostrarse siempre Hoy del mes en curso.

#### Scenario: Móvil
- **WHEN** la PWA se abre a 390 px de ancho con sesión iniciada
- **THEN** se ve Hoy del mes en curso y una barra inferior con Hoy (activo), Planear y Cuentas

#### Scenario: Web
- **WHEN** la PWA se abre a 1280 px de ancho
- **THEN** los mismos tres destinos aparecen en un menú lateral y no hay barra inferior

#### Scenario: Ajustes desde los avatares
- **WHEN** en Hoy se toca el grupo de avatares "D E"
- **THEN** se abre Ajustes del hogar, con "‹ Hoy" para volver

### Requirement: Fidelidad al diseño
Cada pantalla SHALL reproducir el layout, los textos y los tokens de su artboard en `design/*.dc.html`: fondo #FAFAF7, superficie #FFFFFF, bordes #E7E6E1/#EFEEEA, texto #1B1C1A/#5F625C, acento #2E4A3B y los colores de categoría y de estado del handoff. Inter MUST usarse para la UI y JetBrains Mono para los montos. Las sombras MUST NOT usarse. Toda zona tocable MUST medir al menos 44 × 44 px, aunque su forma visible sea menor.

#### Scenario: Comparación con el artboard
- **WHEN** se compara Hoy a 390 px con `Main.dc.html`
- **THEN** coinciden el orden de las secciones, los textos, los colores y las tipografías, y los montos usan la fuente monoespaciada

#### Scenario: Botón pequeño
- **WHEN** se inspecciona el botón "Entregado" de la tarjeta de diezmo (30 px de alto en el diseño)
- **THEN** su zona tocable mide al menos 44 px de alto

### Requirement: Montos en pesos colombianos
Todo monto SHALL mostrarse en COP sin decimales, con punto de miles y signo `$` (`$1.500.000`); los negativos con el signo menos tipográfico (`−$12.000`). Los campos de monto MUST formatear mientras se escribe y aceptar solo dígitos.

#### Scenario: Formato al escribir
- **WHEN** en + Aporte se escribe `2538000`
- **THEN** el campo muestra `$2.538.000` y el valor guardado es 2538000

### Requirement: Modo demo con datos de prueba
Mientras no haya backend, la UI SHALL funcionar con un adaptador de prueba en memoria, cargado con los datos de ejemplo del handoff (Salario Daniel bruto $7.000.000 / neto $6.288.000, diezmo 10 % del bruto, cuentas Davivienda, Nu, Efectivo y Ahorros Esposa, crédito de libre inversión de $14.250.000). Las acciones MUST cambiar ese estado y las pantallas MUST reflejarlo al instante. El estado SHALL persistir en el dispositivo entre recargas. En Ajustes, "Restablecer datos de prueba" MUST volver a los datos iniciales, y "Probar desde cero" MUST dejar un hogar vacío sin configurar para recorrer el acceso y el onboarding. Toda pantalla con sesión MUST mostrar un aviso discreto de "Datos de prueba".

#### Scenario: Persistencia
- **WHEN** se registra un gasto y se recarga la página
- **THEN** el gasto sigue en Hoy

#### Scenario: Restablecer
- **WHEN** en Ajustes se elige "Restablecer datos de prueba" y se confirma
- **THEN** Hoy vuelve a mostrar "Te queda libre $3.436.000"

### Requirement: Datos detrás de puertos
Las pantallas MUST obtener y modificar los datos solo a través de puertos de datos (interfaces por módulo del handoff: hogar, ingresos, plan, movimientos, cuentas, cierre). El adaptador de prueba SHALL ser una implementación intercambiable de esos puertos: reemplazarlo por uno HTTP MUST NOT requerir cambios en las pantallas.

#### Scenario: Cambio de adaptador
- **WHEN** se registra en la configuración un adaptador distinto que cumple los mismos puertos
- **THEN** las pantallas compilan y funcionan sin modificar sus archivos
