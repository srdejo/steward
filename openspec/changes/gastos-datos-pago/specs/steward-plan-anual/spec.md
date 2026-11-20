## ADDED Requirements

### Requirement: Datos de pago en el mes base
Los gastos del mes base de una opción del plan anual SHALL poder tener los mismos datos de pago opcionales que un ítem del plan del mes, con la misma validación. Al replicar un mes en el mes base, sus gastos MUST traer sus datos de pago. Al crear los meses desde el plan anual, cada ítem MUST traer los datos de pago del gasto del que sale.

#### Scenario: Los meses del año traen los datos de pago
- **WHEN** el mes base de la Opción A de 2027 tiene "Internet" con enlace y código, y se crean los meses desde esa opción
- **THEN** Internet de cada mes creado tiene ese enlace y ese código

#### Scenario: Replicar un mes con datos de pago
- **WHEN** el mes base se copia de noviembre de 2026, donde Agua tiene código `987`
- **THEN** Agua del mes base tiene el código `987`
