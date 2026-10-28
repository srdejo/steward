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
