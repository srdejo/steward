## ADDED Requirements

### Requirement: Nueva opción y su mes base en la web
En la web, el plan del año SHALL ofrecer "+ Nueva opción desde un mes base" al lado de "+ Duplicar Opción X". Una ventana pide la fuente: los meses con plan (del más reciente al más antiguo, con su estado y sus gastos; por defecto el mes en curso), "Solo fijos e ingresos" o "Desde cero". "Crear la Opción X" crea la opción y abre su mes base.

El mes base de una opción (`/planear/anual/{año}/base?opcion={letra}`) SHALL mostrar:
- **Encabezado:** el año, la opción y "Copiado de {mes}".
- **Gastos:** los del mes base por categoría, cada uno con su detalle, su día, el monto de cada mes editable en la celda (Enter o al salir del campo guarda) y "Quitar". Cada categoría lleva su total y "+ Agregar a {categoría}", que abre la hoja de gasto. Un crédito que termina en el año lleva "Termina {mes}".
- **Al lado:**
  - lo que entra cada mes (ingresos fijos y aportes proyectados), lo que sale, el diezmo y lo que queda libre al mes;
  - el total aproximado del año, que descuenta las cuotas de los créditos que terminan;
  - los pasos que siguen.
- **"Copiar otro mes":** reemplaza el mes base, con confirmación.
- **"Usar este mes en los 12 meses":** llena la opción y vuelve al año con esa opción elegida.

"Cambiar mes base" SHALL verse en el año siempre, también con los meses ya creados, y abrir el mes base de la opción elegida (si no tiene, lo crea copiando el mes base guardado o el mes en curso). Con menos de 1024 px, el mes base se ve en una columna. La app no tiene esta pantalla.

En modo conectado, todo MUST guardarse en el backend.

#### Scenario: Crear la Opción C desde el mes en curso
- **WHEN** a 1280 px, en el año 2027 con las opciones A y B, se toca "+ Nueva opción desde un mes base" y "Crear la Opción C" sin cambiar la fuente
- **THEN** se abre el mes base de la Opción C, "Copiado de noviembre 2026", con los gastos de noviembre por categoría

#### Scenario: Ajustar y usar
- **WHEN** en el mes base de la Opción C se escribe $300.000 en Transporte y se toca "Usar este mes en los 12 meses"
- **THEN** se vuelve al año con la Opción C elegida, y su fila Variables muestra $300.000 más Apoyo familiar en cada mes

#### Scenario: Cambiar mes base con los meses creados
- **WHEN** el año 2027 ya creó sus meses
- **THEN** sigue viendo "Cambiar mes base"
