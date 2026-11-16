## ADDED Requirements

### Requirement: Acceso en escritorio
Desde 1024 px de ancho, Acceso SHALL mostrarse en dos paneles:
- a la izquierda, un panel con el color de acento, la marca "Presupuesto Hogar", el titular "Planeen el mes juntos y lleven lo que de verdad pasa." y tres puntos de lo que hace la app;
- a la derecha, "Entrar", con el texto de que la primera vez se crea la cuenta y las mismas opciones y reglas de "Pantalla de acceso única" para cada modo.

Por debajo de 1024 px, Acceso MUST verse como hoy.

#### Scenario: Acceso a 1280 px en modo conectado
- **WHEN** sin sesión se abre la PWA a 1280 px en modo conectado
- **THEN** se ven los dos paneles; "Continuar con Google" inicia el login, y "Entrar con Face ID" y "Continuar con correo" están deshabilitadas con "Próximamente"
