# Decisiones del backend

Registro de decisiones técnicas del backend de steward. Las del cambio OpenSpec `backend-acceso-hogar` están en su `design.md`; aquí va lo que se confirmó al implementarlo.

## 2026-10-28 — Java 25 y GraalVM CE 25 para la imagen nativa

**Contexto.** El arquetipo del workspace es Java 26, pero hasta hoy GraalVM no tiene versión para JDK 26. Spring Boot 4.1 documenta las imágenes nativas con GraalVM 25 o superior.

**Decisión.** El toolchain del backend es **Java 25** (LTS), el plan alternativo previsto en el design (D2). El bytecode corre igual en la JVM 26 de `local-java`.

| Uso | Imagen | Detalle |
|---|---|---|
| Compilar (etapa *build* de `Dockerfile.native`) | `ghcr.io/graalvm/native-image-community:25.0.2` | `sha256:0d936f32bb8acb5bc60c41b33e05f064d7a6aaf36b726538296c54949bd4a3c0`; GraalVM CE 25.0.2+10.1, Oracle Linux 10.1, glibc 2.39 |
| Ejecutar (etapa *runtime*) | `debian:trixie-slim` | `sha256:89c1ea91e897f0fe0a3731595330bc45b8bdef4047464a07116f891a94054b31`; Debian 13, como el VPS |

**VPS (`nolost-vps`, medido el 2026-10-28).** Debian GNU/Linux 13 (trixie), glibc 2.41, x86_64. Es Debian, no Ubuntu como suponía el design.

**Por qué funciona:**
- El binario se compila contra glibc 2.39, que es menor o igual que la 2.41 del VPS y de `debian:trixie-slim`. Un binario enlazado con una glibc más vieja corre en una más nueva; al revés, no.
- La imagen de ejecución es la misma distribución y versión que el VPS, así que lo que corre en `local-deploy -Native` corre allá.

**Revisar** cuando salga GraalVM para JDK 26 o posterior: subir el toolchain y las dos imágenes juntas, y volver a pasar los tests de contrato contra el binario.

## 2026-10-28 — El día a día en JVM; nativo solo para desplegar

**Contexto.** La primera compilación nativa en el PC de desarrollo (16 GB) dejó el sistema sin memoria y tumbó Docker Desktop dos veces.

**Decisión.** El backend se desarrolla, se prueba y se publica en local en JVM. La compilación nativa (`scripts/native-build.ps1`, con `-J-Xmx5g`) se hace solo para desplegar al VPS, con nada más pesado abierto. La red de seguridad es `gradlew aotTest`: la batería de contrato con la app en **modo AOT de Spring** en la JVM, la misma preparación que usa la imagen nativa. Corre con `gradlew check`.

## 2026-10-28 — Sin `@Profile` en los beans

**Contexto.** La preparación AOT (`processAot`) congela al compilar las condiciones de los beans (`@Profile`, `@ConditionalOn…`). Con `@Profile("contract")` o `@Profile("dev")` en los beans, el binario quedaría con la elección del momento de compilar, sin importar el perfil con el que arranque.

**Decisión.** Lo que cambia entre entornos se decide con **propiedades en tiempo de ejecución** dentro de un solo bean:
- `steward.mail.modo`: `contact` (por defecto) o `log` (perfiles `dev` y `contract`);
- `steward.security.google-test-public-key`: si tiene valor (solo `contract`), Google se valida con una llave RSA de prueba.

Los archivos `application-<perfil>.yml` sí se leen al arrancar, también en AOT y en nativo. `aotTest` lo comprueba: arranca en AOT con el perfil `contract`.

**Lección del test runner.** En modo AOT Spring busca el inicializador generado de la clase *main*; al levantar la app desde un test hay que indicarla con `SpringApplicationBuilder.main(StewardApplication.class)`.

## 2026-10-29 — Binario nativo medido: dentro del presupuesto del VPS

**Medición** (`produccion-steward` D3). GraalVM CE 25.0.2+10.1, Spring Boot 4.1, Netty 4.2.19. Contenedor de `native-build.ps1 -Run` con los límites del VPS (`--cpus=1 --memory=160m`), perfil `contract`, base `steward_test`:

| | Medido | Presupuesto |
|---|---|---|
| Arranque (`Started StewardApplication`) | 0,93 s con base vacía de tablas nuevas; 0,23-0,28 s con la base ya migrada | menos de 2 s |
| Memoria en reposo tras un login y `GET /api/hogar` (cgroup, lo que cuenta `MemoryMax`) | 39 MB (`RssAnon` 35 MB) | menos de 120 MB |
| Pico con los 155 tests de contrato como carga | 48 MB (`memory.peak`), sin OOM | `MemoryMax=160M` |
| Binario | 152 MB; imagen de ejecución 87 MB | — |
| Compilar en el PC | 3 min 24 s de `native-image`, 4-5 min en total; pico de 5,1 GB | — |

`VmRSS` dice unos 125 MB, pero 90 MB son páginas del propio binario mapeadas desde disco (`RssFile`): el kernel las comparte y las descarta si hace falta, y no las carga el cgroup. La cifra que compite con las demás apps es la anónima.

**Contrato contra el binario:** 155 de 155.

**Lo que pidió el modo nativo:**
- `-H:+SharedArenaSupport` en `build.gradle`. Netty 4.2 en Java 25 libera sus buffers directos con `Arena.ofShared`, que GraalVM trae apagado; sin la opción, al liberar un bloque lanza `UnsupportedFeatureError` y corta la conexión (fallaban `/api/finanzas` y las peticiones simultáneas). Ni la JVM ni `aotTest` lo detectan: solo el binario.
- `NativeHints` registra `contract-google-test-public.pem`. Los recursos que la app lee por ruta solo entran al binario si se registran. Las migraciones de Flyway las registra Spring Boot: el aviso `Unable to scan location: /db/migration (unsupported protocol: resource)` es ruido, y una base vacía queda con las 7 migraciones.

**Lección.** Compilar con Docker sin otros contenedores encendidos: con `local-java`, `local-recaudo-ocr` y los demás arriba, la VM de WSL (8 GB) se quedó sin memoria y Docker se cayó a mitad de la compilación.
