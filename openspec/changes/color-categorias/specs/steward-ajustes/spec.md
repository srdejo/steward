## MODIFIED Requirements

### Requirement: Categorías
Ajustes SHALL listar las categorías (Diezmo, Gastos fijos, Tarjetas y cuotas, Variables, Créditos y las propias del hogar), cada una con su color, con "Editar" en cada una, y "+ Nueva". Diezmo MUST aparecer primero como categoría del sistema: su "Editar" MUST permitir cambiar solo el color, nunca el nombre.

Al crear o editar una categoría, la hoja MUST mostrar una paleta fija de 10 colores: #C2603A, #8A8D85, #6B5BA8, #3F6E9E, #2C7A70, #A87A1E, #9A4F7E, #5E7D32, #55687A y #8A6446. Se elige uno tocándolo; el elegido MUST verse marcado y anunciarse como seleccionado a los lectores de pantalla. Una categoría nueva MUST empezar con #8A8D85 si no se elige otro. El color guardado MUST ser el que se ve en todas las pantallas que muestran la categoría (plan del mes, año, Hoy, cierre y Ajustes), en la PWA y en la app.

Los colores de Libreta clara MUST ser el color inicial de las categorías del sistema: Diezmo #2C7A70, Gastos fijos #C2603A, Variables #8A8D85, Tarjetas #6B5BA8 y Créditos #6B5BA8. Una categoría del sistema que conserva el color del diseño anterior MUST pasar al de Libreta clara; una a la que el hogar ya le cambió el color MUST conservarlo.

En modo conectado, las categorías MUST leerse del backend y guardarse en él, con su color. Los mensajes de "Diezmo" reservado, nombre repetido y color que no está en la paleta MUST venir de él.

#### Scenario: Nueva categoría
- **WHEN** se crea la categoría "Educación"
- **THEN** está disponible al agregar ítems al plan de un mes

#### Scenario: Categoría en modo conectado
- **WHEN** en modo conectado Daniel crea "Educación" y Esposa abre un mes en Borrador
- **THEN** Esposa puede elegir "Educación" al agregar un ítem

#### Scenario: Diezmo sin editar
- **WHEN** se abre Categorías en Ajustes y se toca "Editar" en Diezmo
- **THEN** Diezmo aparece primero, y su hoja muestra la paleta sin el campo de nombre

#### Scenario: Cambiar el color de Gastos fijos
- **WHEN** en Ajustes se edita Gastos fijos, se elige #3F6E9E y se guarda
- **THEN** Gastos fijos se ve con #3F6E9E en Ajustes, en el plan de noviembre y en Por pagar de Hoy

#### Scenario: Color de una categoría nueva
- **WHEN** se crea "Educación" eligiendo #A87A1E
- **THEN** Educación aparece en Ajustes con #A87A1E; si no se elige color, con #8A8D85

#### Scenario: El color lo ve el otro miembro
- **WHEN** en modo conectado Daniel cambia Variables a #9A4F7E
- **THEN** cuando Esposa abre Ajustes o el plan del mes, Variables se ve con #9A4F7E

#### Scenario: Color fuera de la paleta
- **WHEN** en modo conectado llega al backend un color que no está en la paleta
- **THEN** el backend lo rechaza con "Elige un color de la paleta" y la categoría conserva su color

#### Scenario: Colores del diseño anterior
- **WHEN** un hogar tiene Gastos fijos con #E2551B (el color del diseño anterior) y Variables con #9A4F7E (elegido por el hogar)
- **THEN** tras la actualización, Gastos fijos se ve con #C2603A y Variables sigue con #9A4F7E
