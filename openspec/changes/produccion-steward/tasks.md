# Tasks

## 1. Binario nativo

- [x] 1.1 Desde `develop`, crear la rama `feature/produccion-steward`. Avisar a Daniel que la compilación usa de 4 a 8 GB de RAM y compilar con `scripts/native-build.ps1` (D1, paso 1). Verificar: el binario existe y arranca con `-Run -SkipBuild`.
- [x] 1.2 Contrato contra el binario (D2): `native-build.ps1 -Run -SkipBuild -Profile contract -DbName steward_test` y `gradlew test --tests "co.com.srdejo.steward.contract.*" -Dcontract.baseUrl=http://localhost:18099`. Si algo falla por reflexión, agregar el *hint* y volver a compilar. Verificar: todos pasan.
- [x] 1.3 Medición (D3): RSS en reposo tras un login y un `GET /api/hogar`, y tiempo de arranque, con 1 CPU y 160 MB. Anotar en `backend/docs/DECISIONS.md`. Verificar: menos de 120 MB y menos de 2 s; si no, pausar y decidir con Daniel. Commit.

## 2. Encender en el VPS (cada paso con la confirmación de Daniel)

- [x] 2.1 Dejar en `docs/DEPLOYMENT.md` los pasos de Google (D4) y pedírselos a Daniel. Verificar: el origen `https://steward.srdejo.com.co` está autorizado en el cliente de beauty (lo confirma Daniel).
- [x] 2.2 Con confirmación: subir la unit, el vhost y `setup-vps.sh` y que Daniel corra el sudo, y completar el `.env` del VPS. Verificar: `systemctl cat steward` muestra la unit nativa y `.env` tiene las variables de la tabla.
- [ ] 2.3 Con confirmación: `BackendEnabled = $true` en `infra/deploy.ps1` (commit en el workspace), `systemctl enable steward` y `deploy.ps1 -Projects steward`. Verificar: `https://steward.srdejo.com.co/actuator/health` → `{"status":"UP"}`, la PWA en modo conectado, y `POST /api/auth/dev` sin acceso.
- [ ] 2.4 Medir en el VPS con `infra/vps/resources/measure.sh` y anotar la memoria real en `infra/PORTS.md` (8099 desplegado). Verificar: dentro del presupuesto. Commit en el workspace.

## 3. Uso real

- [ ] 3.1 Daniel y su esposa entran con Google desde sus teléfonos, instalan la PWA, crean el hogar (o uno se une por invitación) y registran algo en el mes. Verificar: el criterio de cierre de la Etapa 9, que confirma Daniel.

## 4. Ramas y cierre

- [ ] 4.1 Con confirmación: tag `v1.0.2` en `main`, rama `release/1.0.x` desde ese tag y PR de `develop` a `main` (D5). Actualizar `AGENTS.md` y `DEPLOYMENT.md` (la v1 sale de `release/1.0.x`). Verificar: el PR no tiene conflictos, y `release/1.0.x` tiene `mobile/app.json` en 1.0.2.
- [ ] 4.2 `docs/ROADMAP.md`: la Etapa 9 en producción, y una Etapa 10 nueva con passkeys, biometría al abrir y "Ocultar montos". Verificar: `openspec validate produccion-steward --strict` sin errores. Commit.
