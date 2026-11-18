## Why

Hoy el hogar solo se entera de un pago que vence si abre la app. El canvas del rediseño (https://claude.ai/artifact/3L586EunT3GFHHFHsPKG42, artboards "Notificación en el celular", "Avisos · próximos y configurar" y "Avisos (web)") propone avisar antes de cada fecha, el mismo día y cuando algo se vence, por push en el celular y en el navegador y con un resumen semanal por correo. Va después del cambio `rediseno-libreta-clara` y usa su sistema visual.

## What Changes

- **Pantalla Avisos**, en la PWA (`/avisos`) y en la app, a la que se llega por la campana de Hoy, que muestra el número de pendientes, y desde Ajustes. Tiene dos pestañas.
  - **Próximos**: lo que viene en 30 días, agrupado en Vencido, Próximos 7 días, Más adelante y Para no olvidar. Incluye:
    - pagos de fijos con día de pago;
    - pago y corte de tarjetas;
    - cuotas de créditos;
    - ingresos esperados ("¿Llegó el salario?");
    - elegir la opción del mes y cerrar el mes;
    - cuentas sin cuadrar hace más de 30 días.

    Los pagos se marcan pagados ahí mismo con las reglas de "Marcar un pago", y el resto lleva a su pantalla.
  - **Configurar**:
    - cuántos días antes avisar (1, 3, 5 o 7), además del mismo día a las 8:00 y el día siguiente si no se marcó;
    - un interruptor por tipo de aviso (pagos y recibos, tarjetas, cuotas, ingresos esperados, plan del mes, cuadrar cuentas, lo que marque el otro miembro);
    - las notificaciones en este dispositivo, con "Probar";
    - el resumen por correo (lunes 7:30);
    - el horario de no molestar (9:00 p. m. a 7:00 a. m.).
- **Push en la app (iPhone)** con `expo-notifications` y el servicio de push de Expo (APNs).
  - Acciones "Ya lo pagué" y "Recordar mañana" en el aviso de un pago.
  - Varios avisos del mismo día llegan en uno solo.
  - Avisos de lo que el otro miembro marca.
- **Push en la PWA** con Web Push (VAPID) y el service worker de Angular. En iPhone solo llega si la PWA está en la pantalla de inicio, y la pantalla lo dice.
- **Resumen por correo** el lunes a las 7:30 (hora de Colombia) con los pagos de la semana, por la API `contact` del workspace.
- **Backend**:
  - registro de dispositivos (token de Expo o suscripción Web Push) por usuario;
  - preferencias de avisos por usuario;
  - un programador que cada día calcula lo que toca avisar y envía por cada canal, sin repetir un aviso ya enviado;
  - los endpoints para marcar pagado y posponer desde el aviso.
- **Cada persona configura sus avisos**: cada miembro recibe los avisos de todo el hogar según su propia configuración.
  - El canvas propone "A quien paga" (cada pago le llega a quien lo tiene asignado). La app no tiene hoy un responsable por pago, así que queda fuera de esta versión.
  - El aviso propio por pago ("cada pago puede tener su propio aviso desde su detalle") también queda fuera.

## Capabilities

### New Capabilities
- `steward-avisos`: qué se avisa y cuándo, la pantalla Avisos (Próximos y Configurar), la campana de Hoy, el push en la app y en la PWA, el resumen por correo y el backend que los programa y envía.

### Modified Capabilities
<!-- ninguna: la campana y el acceso desde Ajustes se definen en steward-avisos; marcar pagado reutiliza "Marcar un pago" de steward-hoy sin cambiar su regla. -->

## Impact

- **Dominio** (`packages/domain`): las fechas próximas (`proximosAvisos(estado, hoy, dias)`) para la pantalla Avisos y la campana, con las reglas de vencimiento que ya existen.
- **Backend**:
  - migración V17 con `dispositivo_aviso`, `preferencia_aviso` y `aviso_enviado`;
  - un caso de uso que calcula los avisos;
  - un programador (`@Scheduled`, zona `America/Bogota`);
  - clientes de salida para el push de Expo, para Web Push (VAPID) y para la API `contact`;
  - endpoints `/api/avisos/*`;
  - variables nuevas: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` y, si hace falta, un token de acceso de Expo.
- **PWA**: ruta `/avisos`, la campana en Hoy, la fila de Avisos en Ajustes, `SwPush` y el manejo del clic en la notificación.
- **App**:
  - `expo-notifications`, el permiso, el registro del token y las categorías con acciones;
  - la pantalla Avisos y la campana;
  - una versión nueva para TestFlight, con módulo nativo y capacidad de push en el perfil de Apple.
- **Infra**: claves VAPID en el entorno del VPS y la credencial de push de Apple en EAS.
