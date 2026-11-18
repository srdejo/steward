## Why

Cada categoría tiene un color que se ve en el plan del mes, el año, Hoy y el cierre, pero el hogar no lo puede cambiar. Además, desde `rediseno-libreta-clara`, el dominio pinta las categorías del sistema con el color de su tipo al leerlas, así que aunque se guardara otro color, no se vería.

## What Changes

- En Ajustes, la hoja de editar una categoría trae una **paleta fija** de colores de Libreta clara; se toca un círculo para elegir. También la hoja de "+ Nueva".
- **Diezmo** también se puede editar, pero solo su color: el nombre sigue sin cambiarse. Hoy Diezmo no tiene "Editar".
- El color elegido se guarda:
  - en modo conectado, en el backend (`PATCH /api/categorias/{id}` acepta `color`; `POST /api/categorias` también);
  - en modo de prueba, en el estado guardado del dispositivo.
- El backend valida que el color sea uno de la paleta.
- Los colores de Libreta clara quedan como **color inicial**: una migración (V17) cambia los colores viejos de las categorías del sistema por los nuevos, solo si no se habían cambiado. El modo de prueba hace lo mismo al leer un estado guardado viejo.
- **BREAKING (interno):** el dominio deja de reemplazar el color de las categorías del sistema al leerlas (`colorCategoria` / `conColoresDelSistema`). El color que se ve es el guardado.
- Las categorías nuevas del backend nacen con el gris de Variables de Libreta clara (#8A8D85), como en el modo de prueba.
- PWA (móvil y web) y app.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `steward-ajustes`: "Categorías" (Diezmo con "Editar" solo para el color; elegir el color al crear o editar; guardarlo en el backend).

## Impact

- **Dominio** (`packages/domain`):
  - `rules/colores.ts`: la paleta (`PALETA_CATEGORIAS`) y el mapa de colores viejos a nuevos; `colorCategoria` deja de sobrescribir.
  - `rules/hogar.ts`: `guardarCategoria` permite a Diezmo cambiar solo el color y valida el color.
  - `conectado/superposicion.ts` y `conectado/puertos-conectados.ts`: el color del backend tal cual, y `guardarCategoria` envía el color.
  - `demo`: migra los colores viejos de un estado guardado.
  - Pruebas.
- **Backend**:
  - `PlanController`, `PlanDtos`, `PlanUseCase` y `CategoriaR2dbcAdapter`: cambiar el color;
  - `Categoria.delSistema` y `COLOR_NUEVA` con los colores de Libreta clara;
  - migración `V17__colores_libreta_clara.sql`;
  - pruebas y el contrato AOT.
- **PWA**: la hoja de categoría en `features/ajustes/ajustes-page.ts`, un componente de paleta en `shared/components`, y "Editar" en Diezmo.
- **App**: la hoja de categoría en `(tabs)/ajustes.tsx`, con la paleta en `ui/controles.tsx`.
- **Despliegue**: backend (con la migración) y PWA; la app sale en la próxima versión de TestFlight.
- **Orden de archivo:** se archiva después de `rediseno-libreta-clara`, que es el que agrega los colores de Libreta clara a la spec.
