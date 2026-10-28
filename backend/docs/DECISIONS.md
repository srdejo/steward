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
