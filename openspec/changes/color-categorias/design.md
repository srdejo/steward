# Design

## Context

- **Datos:** cada categoría ya guarda su `color`:
  - backend: la columna `categoria.color` (V3), `CategoriaResponse.color`;
  - modo de prueba: `EstadoHogar.categorias[].color`;
  - el puerto `hogar.guardarCategoria({ id?, nombre, color?, tipo? })` ya acepta `color`.
- **Lo que falta:**
  - el backend solo renombra (`PATCH /api/categorias/{id}` recibe `NombreRequest`) y crea con `COLOR_NUEVA` (#8D8F88);
  - el adaptador conectado no envía el color;
  - las hojas de Ajustes (PWA y app) solo piden el nombre;
  - Diezmo no tiene "Editar";
  - la regla `guardarCategoria` rechaza cualquier edición de Diezmo.
- **Sobrescritura de `rediseno-libreta-clara`:** `colorCategoria` pinta las categorías del sistema con el color de su tipo al leerlas, tanto en `conectado/superposicion.ts` como en `demo/index.ts` (`conColores`). Por eso un color guardado en una categoría del sistema no se vería.
- **Colores guardados hoy:**
  - del sistema en el backend: Diezmo #0F766E, Gastos fijos #E2551B, Variables #8D8F88, Tarjetas #7C4DDB, Créditos #2E6B45 (o #7C4DDB, si V12 lo cambió y V13 no lo devolvió);
  - en el modo de prueba: Ahorro #1E5A4C (`seed.ts`);
  - las categorías propias nacen con #8D8F88.
- **Uso:** las pantallas ya pintan con el color guardado (`plan-escritorio.ts`, `mes-*`, `hoy-escritorio`, `cierre`, `ajustes`, y en la app `hoy`, `mes` y `ajustes`). Los tokens `--color-cat-*` se usan solo en Tarjetas y Créditos de Cuentas, que no son una categoría, y no cambian.

## Goals / Non-Goals

**Goals:**
- Elegir el color de cualquier categoría, Diezmo incluida, de una paleta fija, en la PWA y en la app.
- Que el color elegido sea el que se ve en todas partes y para los dos miembros.
- Que los colores de Libreta clara sean el inicial sin pisar los que el hogar ya eligió.

**Non-Goals:**
- Selector libre de color (hex).
- Colores por ítem.
- Cambiar el color de Ingresos, que no es una categoría.
- Cambiar el orden de las categorías.

## Decisions

### D1. Paleta en el dominio, validada también en el backend
- **Dominio:** `rules/colores.ts` exporta `PALETA_CATEGORIAS`, con los 10 colores en mayúsculas y en el orden de la spec, y `COLOR_NUEVA = '#8A8D85'`.
- **Backend:** `Categoria.PALETA` tiene la misma lista. `guardarCategoria`, el `POST` y el `PATCH` rechazan un color fuera de ella con `datos-invalidos` "Elige un color de la paleta". La comparación ignora mayúsculas.
- **Colores fuera de la paleta:** un color guardado antes que no está en ella se sigue mostrando. Al editar esa categoría, ningún círculo sale marcado, y si se guarda sin elegir uno, el color no cambia.
- **Alternativa descartada:** validar solo en el cliente. La rechacé porque el backend es la fuente de verdad en modo conectado, como ya pasa con el nombre repetido.

### D2. Un solo `PATCH` para nombre y color
- `PATCH /api/categorias/{id}` recibe `{ nombre?, color? }`, con al menos uno de los dos.
  - Para Diezmo, si llega `nombre`, se rechaza con el mensaje que ya existe ("La categoría Diezmo no se renombra"), salvo que sea el mismo nombre. Si solo llega `color`, se acepta.
  - `POST /api/categorias` recibe `{ nombre, color? }`.
- **Puerto de persistencia:** `ICategoriaPersistencePort` gana `actualizar(Categoria)`, o `cambiarColor` junto a `renombrar`; la idea es reutilizar el `UPDATE` del adaptador R2DBC.
- **Compatibilidad:** el DTO pasa de `NombreRequest` a `CategoriaRequest(nombre, color)`. Un cliente viejo que manda solo `nombre` sigue funcionando.
- **Dominio:** la regla `guardarCategoria` permite `{ id: diezmo, nombre: 'Diezmo', color }`. Si el nombre cambia, falla igual que antes.
- **Adaptador conectado:** manda el `PATCH` con nombre y color, o el `POST` con el color.

### D3. Migrar en lugar de sobrescribir al leer
- **Backend:** `V17__colores_libreta_clara.sql` hace un `UPDATE categoria SET color = <nuevo> WHERE sistema AND tipo = ... AND upper(color) = <viejo>` por cada par:
  - DIEZMO #0F766E → #2C7A70;
  - FIJO #E2551B → #C2603A;
  - VARIABLE #8D8F88 → #8A8D85;
  - TARJETA #7C4DDB → #6B5BA8;
  - CREDITO #2E6B45 o #7C4DDB → #6B5BA8.

  También pasa las propias que siguen en #8D8F88 a #8A8D85. `Categoria.delSistema` y `COLOR_NUEVA` usan los colores nuevos, así que los hogares nuevos nacen bien.
- **Dominio:**
  - `colorCategoria` y `conColoresDelSistema` dejan de existir;
  - `superposicion.categoria` usa `c.color` tal cual;
  - `demo/index.ts` cambia `conColores` por `migrarColores`, que aplica el mismo mapa de colores viejos y además Ahorro #1E5A4C → #3F6E9E;
  - `seed.ts` usa los colores nuevos (Ahorro #3F6E9E).
- **Esquema del modo de prueba:** `VERSION_ESQUEMA` no cambia, porque la migración es idempotente y corre en cada carga, como `conHasta`.
- **Alternativa descartada:** guardar una marca "el hogar eligió el color". Agrega un campo y una migración de esquema y no aporta nada frente a comparar contra los colores viejos, que nadie puede elegir porque no están en la paleta.

### D4. La paleta como componente
- **PWA:** `shared/components/paleta-color.ts` (`app-paleta-color`, con `[(valor)]`). Es un `radiogroup` "Color" con 10 botones `role="radio"` de 44 × 44 px, cada uno con un círculo de 28 px. El elegido se marca con un anillo `acento` y un check blanco, y su `aria-label` es el nombre del color ("Terracota", "Gris", "Morado", "Azul", "Verde azulado", "Ocre", "Ciruela", "Oliva", "Pizarra" y "Café"). Los nombres viven en el dominio, junto a la paleta.
- **App:** `PaletaColor` en `ui/controles.tsx`, con el mismo contrato (`accessibilityRole="radio"` y `accessibilityState.selected`).
- **Hoja de categoría:** en Ajustes, la hoja muestra Nombre, salvo en Diezmo, y la paleta. El botón Guardar se habilita cuando hay nombre o cuando cambió el color (en Diezmo, solo con el color).

### D5. Diezmo con "Editar"
En la lista de Ajustes (PWA móvil y web, y app), Diezmo gana "Editar" (`aria-label` "Editar color de Diezmo"). El título de su hoja es "Color de Diezmo".

## Risks / Trade-offs

- **[Otros clientes]** La app 2.2.x del App Store no sabe enviar color, pero sigue renombrando, porque el `PATCH` con solo `nombre` vale. Los colores elegidos desde la PWA los verá en cuanto lea las categorías, porque ya pinta con `c.color`. → Compatible.
- **[Colores fuera de la paleta en producción]** Categorías propias con colores sueltos se quedan como están (D1). → Se ven bien; solo cambian si alguien elige uno.
- **[Contraste]** Los 10 colores son de punto o barra, sin texto encima; todos tienen un contraste ≥ 3:1 sobre #FFFFFF y #F6F5F1. El gris #8A8D85 queda justo en 3,3:1. → Se acepta para un indicador no textual.
- **[Archivo]** La spec de `steward-ui-shell` en `rediseno-libreta-clara` dice "Cada categoría MUST tener el mismo color en todas las pantallas: …". Sigue siendo cierto como color inicial; esta spec lo precisa en `steward-ajustes`. → Se archiva después de `rediseno-libreta-clara`.
