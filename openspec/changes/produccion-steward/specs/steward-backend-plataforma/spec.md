## ADDED Requirements

### Requirement: Binario nativo medido
Antes de encenderlo, el binario nativo SHALL pasar la batería completa de tests de contrato corriendo como binario, y MUST cumplir el presupuesto de `optimizar-recursos-plataforma-comun` con los límites del VPS (1 CPU, 160 MB): menos de 120 MB de RSS en reposo, tras un login y un `GET /api/hogar`, y menos de 2 s de arranque. Las cifras medidas SHALL quedar en `backend/docs/DECISIONS.md`, y la memoria real en el VPS, en `infra/PORTS.md`.

#### Scenario: Contrato contra el binario
- **WHEN** los tests de contrato corren contra el binario levantado con `native-build.ps1 -Run -Profile contract`
- **THEN** todos pasan

#### Scenario: Dentro del presupuesto
- **WHEN** el binario corre con 1 CPU y 160 MB, después de un login y un `GET /api/hogar`
- **THEN** su RSS queda por debajo de 120 MB y arrancó en menos de 2 s

## MODIFIED Requirements

### Requirement: Publicación local con la web
`local-deploy.ps1 -Project steward` SHALL publicar en `http://steward.test` la PWA y la API en el mismo origen: `/api/` y `/actuator/health` van al backend (en la JVM) y el resto, a la PWA. En el VPS, la PWA y la API también van en el mismo origen, `https://steward.srdejo.com.co`.

#### Scenario: Mismo origen
- **WHEN** después de `local-deploy.ps1 -Project steward` se abre `http://steward.test/actuator/health`
- **THEN** responde `{"status":"UP"}`, y `http://steward.test/` sirve la PWA

### Requirement: Despliegue nativo al VPS preparado
El backend SHALL estar encendido en el VPS como binario nativo, sin JDK, detrás de `https://steward.srdejo.com.co` y con el acceso de desarrollo apagado. El despliegue tiene que:
- conservar en el VPS la versión anterior;
- comprobar la salud por loopback después de reiniciar;
- volver solo a la versión anterior si no responde UP, sin publicar la web nueva;
- limitar la memoria del servicio a 160 MB.

Una versión con migraciones MUST respaldar la base antes de desplegar. La página "Próximamente" deja de publicarse.

#### Scenario: Backend reservado
- **WHEN** después de `deploy.ps1 -Projects steward` se abre `https://steward.srdejo.com.co/actuator/health`
- **THEN** responde `{"status":"UP"}`, y `https://steward.srdejo.com.co/` sirve la PWA en modo conectado

#### Scenario: Versión nueva que no arranca
- **WHEN**, con el backend encendido, se despliega un binario que no responde UP en 30 s
- **THEN** el servicio vuelve a la versión anterior, que responde UP, el deploy termina en error y la web publicada no cambia

#### Scenario: Sin acceso de desarrollo en producción
- **WHEN** se llama `POST https://steward.srdejo.com.co/api/auth/dev`
- **THEN** no hay acceso de desarrollo: solo se entra con Google
