# Spec Delta

## Purpose

Define la app Expo de `mobile/` reescrita con el diseño de Presupuesto Hogar: paridad con la PWA, el mismo dominio compartido y las restricciones para no afectar la v1 publicada.

## ADDED Requirements

### Requirement: Paridad con la PWA
La app SHALL implementar las mismas pantallas y flujos que la PWA en su layout móvil, con la misma navegación (barra inferior Hoy · Planear · Cuentas) y los mismos requisitos de `steward-ui-shell`, `steward-acceso-onboarding`, `steward-hoy`, `steward-planear`, `steward-cuentas` y `steward-ajustes`. Comparar y Plan anual MUST desplazarse en horizontal. Los cálculos y los datos de prueba MUST salir del mismo paquete de dominio que usa la PWA, de modo que un mismo registro dé las mismas cifras en las dos.

#### Scenario: Mismas cifras
- **WHEN** en la app y en la PWA, desde los datos iniciales, se marca pagada la Tarjeta Mastercard por $1.500.000 desde Davivienda
- **THEN** las dos muestran el mismo "Te queda libre", el mismo Pagado y el mismo Vs. plan

### Requirement: Persistencia propia sin tocar la v1
La app SHALL guardar los datos de prueba en el dispositivo con una clave de almacenamiento distinta de la que usa la v1. Instalada sobre la v1, MUST NOT leer, modificar ni borrar los datos locales de la v1.

#### Scenario: Instalación sobre la v1
- **WHEN** la app nueva se instala en un dispositivo con datos de la v1 y luego se reinstala la v1
- **THEN** la v1 muestra sus datos intactos

### Requirement: Sin publicación en este cambio
La app reescrita MUST NOT enviarse a App Store ni a Google Play en este cambio, y la versión de `app.json` MUST NOT subir de la publicada. Los builds SHALL hacerse solo con el perfil `development` o `preview` (distribución interna). La rama `main` del repo MUST seguir pudiendo generar la v1.

#### Scenario: Build de prueba
- **WHEN** se ejecuta `eas build --profile preview` desde la rama del cambio
- **THEN** sale un build interno, y en App Store Connect no aparece ninguna versión nueva
