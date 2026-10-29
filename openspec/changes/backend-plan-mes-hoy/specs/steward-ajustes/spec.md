## MODIFIED Requirements

### Requirement: Categorías
Ajustes SHALL listar las categorías (Gastos fijos, Tarjetas y cuotas, Variables, Créditos), con "Editar" en cada una y "+ Nueva". El Diezmo MUST NOT aparecer como categoría editable.

En modo conectado, las categorías MUST leerse del backend y guardarse en él, y los mensajes de "Diezmo" reservado y nombre repetido MUST venir de él.

#### Scenario: Nueva categoría
- **WHEN** se crea la categoría "Educación"
- **THEN** está disponible al agregar ítems al plan de un mes

#### Scenario: Categoría en modo conectado
- **WHEN** en modo conectado Daniel crea "Educación" y Esposa abre un mes en Borrador
- **THEN** Esposa puede elegir "Educación" al agregar un ítem
