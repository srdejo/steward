# Tasks

## 1. Dominio

- [x] 1.1 `rules/colores.ts`: `PALETA_CATEGORIAS` (los 10 colores con su nombre), `COLOR_NUEVA = '#8A8D85'` y el mapa de colores viejos a nuevos (design D1 y D3). Quitar `colorCategoria` y `conColoresDelSistema` y sus usos en `conectado/superposicion.ts` y `demo/index.ts`.
- [x] 1.2 `rules/hogar.ts`, `guardarCategoria`:
  - valida que el color esté en la paleta ("Elige un color de la paleta");
  - Diezmo puede cambiar el color, pero no el nombre;
  - una nueva sin color usa `COLOR_NUEVA`.
- [x] 1.3 Modo de prueba: `migrarColores` al cargar un estado guardado (los colores viejos del sistema y Ahorro #1E5A4C → #3F6E9E), y `seed.ts` con los colores nuevos.
- [x] 1.4 `conectado/puertos-conectados.ts`: `guardarCategoria` envía el color en el `PATCH` (nombre y color) y en el `POST`. Ajustar el cliente HTTP de la PWA y de la app si tipa el cuerpo.
- [x] 1.5 Pruebas del dominio:
  - paleta;
  - color fuera de la paleta;
  - Diezmo solo cambia el color;
  - migración de un estado con #E2551B que conserva #9A4F7E;
  - el color guardado se lee tal cual en modo conectado.

## 2. Backend

- [ ] 2.1 `Categoria`: `PALETA`, `COLOR_NUEVA = "#8A8D85"` y `delSistema` con los colores de Libreta clara.
- [ ] 2.2 `CategoriaRequest(nombre, color)` en `PlanDtos`:
  - `POST /api/categorias` acepta el color;
  - `PATCH /api/categorias/{id}` acepta nombre, color o los dos;
  - `PlanUseCase` valida la paleta y que Diezmo solo cambie el color (design D2);
  - `ICategoriaPersistencePort` y `CategoriaR2dbcAdapter` guardan el color.
- [ ] 2.3 `V17__colores_libreta_clara.sql`: los colores viejos del sistema pasan a los nuevos, y las propias en #8D8F88 a #8A8D85, sin tocar los demás (design D3). Prueba de la migración, como `MigracionV3Test`.
- [ ] 2.4 Pruebas de contrato (`PlanContratoTest`):
  - cambiar el color;
  - color inválido (400);
  - Diezmo: el color sí, el nombre no;
  - crear con color.

  Correr `gradlew check`, que incluye el contrato AOT.

## 3. PWA

- [ ] 3.1 `shared/components/paleta-color.ts`: `radiogroup` de 10 colores con su nombre accesible y el elegido marcado (design D4).
- [ ] 3.2 Ajustes, móvil y web:
  - la hoja de categoría con Nombre (salvo Diezmo) y la paleta;
  - "Editar" también en Diezmo, con la hoja "Color de Diezmo" (design D5);
  - Guardar envía nombre y color.
- [ ] 3.3 Pruebas (`ajustes` y `conectado.spec.ts`):
  - cambiar Gastos fijos a #3F6E9E y verlo en el plan del mes y en Hoy;
  - Diezmo sin campo de nombre;
  - nueva con color;
  - el cuerpo del `PATCH` y del `POST`.

## 4. App

- [ ] 4.1 `PaletaColor` en `mobile/src/ui/controles.tsx`, con `accessibilityRole="radio"` y `accessibilityState.selected`.
- [ ] 4.2 `(tabs)/ajustes.tsx`: la hoja de categoría con la paleta, "Editar" en Diezmo y Guardar con nombre y color.
- [ ] 4.3 Pruebas de la app: cambiar un color y verlo en el plan del mes; Diezmo solo cambia el color.

## 5. Entrega

- [ ] 5.1 Pruebas del dominio, la PWA (`ng build`) y la app (`tsc`); `openspec validate color-categorias --strict`.
- [ ] 5.2 Con confirmación de Daniel: PR y despliegue con copia de seguridad, backend (V17) y PWA.
- [ ] 5.3 Con confirmación de Daniel: la app en la próxima versión de TestFlight.
- [ ] 5.4 Revisión de Daniel: elegir colores en web y en la app, y verlos en el plan y en Hoy.
