## ADDED Requirements

### Requirement: Ajustes en escritorio
Desde 1024 px de ancho, Ajustes SHALL mostrar el título "Ajustes" y sus secciones como tarjetas en una cuadrícula de dos columnas (una sola si no caben), con el mismo contenido y las mismas reglas que en móvil:
- **Hogar:** el nombre, los miembros y las invitaciones pendientes, y un campo "Invitar por correo" con "Invitar" en la misma tarjeta;
- **Mis ingresos y diezmo:** la regla de diezmo y una tabla de ingresos con Bruto y Entra, "Editar" por fila, "Aportes variables" y "+ Agregar ingreso fijo";
- **Categorías:** cada una con su color y "Editar", y "+ Nueva";
- **Seguridad y privacidad**, si está disponible.

Las acciones de cuenta (cerrar sesión, empezar de nuevo, eliminar mi cuenta, política de privacidad, salir del hogar) y los datos de prueba MUST seguir disponibles debajo de la cuadrícula. El enlace "‹ Ejecución" MUST NOT verse en escritorio, porque Ajustes ya está en el menú lateral.

#### Scenario: Invitar desde la tarjeta del hogar
- **WHEN** a 1280 px se escribe "ana@correo.com" en "Invitar por correo" y se toca "Invitar"
- **THEN** se envía la invitación, aparece como pendiente en la tarjeta Hogar y el campo queda vacío

#### Scenario: Ingresos en tabla
- **WHEN** a 1280 px se abre Ajustes con los datos de prueba
- **THEN** la tarjeta "Mis ingresos y diezmo" muestra Salario con su bruto y lo que entra, y "Editar" abre la misma hoja que en móvil
