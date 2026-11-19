## 1. Reglas de los avisos

- [ ] 1.1 Backend: `AvisosUseCase.proximos(hogar, hoy, dias)` con los tipos y las exclusiones de "Qué se avisa" (fijos, tarjetas pago y corte, cuotas, ingresos, plan del mes, cuadrar). Usa el último día del mes para los días 29–31. Pruebas unitarias con los casos del canvas al 26 oct.
- [x] 1.2 Dominio: la misma regla en TS (`proximosAvisos`) para el modo demo y un `AvisosPort` con la implementación demo y la conectada, con pruebas sobre los mismos casos (design D1).

## 2. Backend: datos, API y envío

- [ ] 2.1 V18: `dispositivo_aviso`, `preferencia_aviso` y `aviso_enviado` (con su restricción única), y su `MigracionV18Test`.
- [ ] 2.2 Endpoints `/api/avisos`:
  - dispositivos (POST y DELETE);
  - preferencias (GET y PUT, con los valores por defecto de D6);
  - `proximos`;
  - `prueba`;
  - `accion`, con el identificador firmado de D5.

  Agregarlos a la superficie pública del contrato y escribir pruebas de contrato, incluidas la de identificador alterado y la de vencido.
- [ ] 2.3 Envío:
  - `EnvioPushPort` con el cliente de Expo (envío y recibos; un token inválido quita el dispositivo);
  - el cliente Web Push con VAPID y `aes128gcm`, solo con el JDK y probado con los vectores de RFC 8291 (design D3 y D4);
  - el correo semanal por `contact`.
- [ ] 2.4 Programador cada 15 minutos (`America/Bogota`) con los momentos LUNES (pagos de la semana), ANTES (día anterior), DIA (mismo día sin pagar) y POSPUESTO, sin aviso de vencido, el agrupado por persona, no molestar, la tabla de enviados y `steward.avisos.habilitados`; y el resumen del lunes a las 7:30 (design D2).
- [ ] 2.5 Avisos de lo que marca el otro miembro, enviados al registrar un pago o un aporte (design D7).
- [ ] 2.6 `gradlew check` con el contrato en AOT y las pistas de la imagen nativa si hacen falta; README del backend con las variables nuevas.

## 3. PWA

- [x] 3.1 Ruta `/avisos` con Próximos y Configurar.
  - Pantallas: artboards "Avisos (web)" y "Avisos · próximos y configurar" a 390 px.
  - Marcar pagado abre Marcar pago.
  - Las filas que no son pagos llevan a su pantalla.
- [x] 3.2 La campana con su insignia en Hoy (móvil) y en la barra superior (web), y la fila "Avisos" en Ajustes.
- [ ] 3.3 Web Push (design D9):
  - `SwPush`, con registro y baja de la suscripción al cerrar sesión;
  - el service worker con las acciones y el clic;
  - el texto de iPhone sin instalar;
  - el botón "Probar".
- [ ] 3.4 Pruebas de los escenarios de Próximos, Configurar y la campana, y `ng build`.

## 4. App

- [ ] 4.1 Leer la documentación de Expo SDK 57. Instalar `expo-notifications` con:
  - la categoría `pago` y sus acciones;
  - el permiso al activar;
  - el registro y la baja del token;
  - el manejo del toque y de las acciones con `/api/avisos/accion`.

  Configurar la capacidad de push en `app.json` y EAS (design D8).
- [ ] 4.2 La pantalla Avisos (Próximos y Configurar) y la campana en Hoy, con pruebas.

## 5. Entrega

- [ ] 5.1 Daniel genera las claves VAPID y `AVISOS_SECRET` en el VPS (y `EXPO_ACCESS_TOKEN` si hace falta), sin que se lean desde aquí.
- [ ] 5.2 Con confirmación de Daniel: PR, respaldo, despliegue del backend (V18) y de la PWA.
- [ ] 5.3 Con confirmación de Daniel: la versión nueva de la app, con push, a TestFlight.
- [ ] 5.4 Prueba real con Daniel y su esposa:
  - un aviso de prueba en cada dispositivo;
  - "Ya lo pagué" desde el iPhone;
  - el correo del lunes;
  - revisión visual de Avisos a 390 px, a 1280 px y en la app.
