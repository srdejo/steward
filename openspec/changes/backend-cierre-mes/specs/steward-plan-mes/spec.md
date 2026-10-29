## ADDED Requirements

### Requirement: Cerrar el mes
Un miembro SHALL poder cerrar un mes del hogar ("Cerrar {mes}") enviando la foto del cierre que calcula el dominio compartido (`vistaCierre`):
- las filas plan vs. real (nombre, plan o vacío, real);
- "Sin registrar";
- el sobrante;
- el reparto: lo que va a ahorro y lo que pasa al mes siguiente;
- el orden del último movimiento del mes con que se calculó la foto.

El backend MUST validar:
- **El mes:** es el mes en curso o uno anterior. Un mes futuro MUST responder 400 `DATOS_INVALIDOS`.
- **El reparto:** los dos montos son de cero en adelante y suman exactamente el sobrante, o cero si no sobró. Si no, MUST responder 400 `REPARTO_INVALIDO`.
- **"Sin registrar":** es la suma de los ajustes de cuadre del mes. Si no, MUST responder 409 `CIERRE_DESACTUALIZADO`.
- **Lo registrado:** ningún movimiento del mes es posterior al orden que trae la foto. Si lo hay, MUST responder 409 `CIERRE_DESACTUALIZADO` con el mensaje "Alguien registró algo en {mes}; revisa el cierre otra vez".
- **Una sola vez:** un mes ya cerrado MUST responder 409 `MES_CERRADO`, aunque dos personas cierren a la vez.

Al cerrar:
- se guardan la foto, quién cerró y la fecha;
- si el mes tiene plan, su estado pasa a Cerrado;
- el mes queda en solo lectura.

Cerrar no se deshace.

#### Scenario: Cerrar octubre
- **WHEN** octubre terminó con $3.166.000 y Daniel lo cierra con $2.000.000 a ahorro y $1.166.000 a noviembre
- **THEN** octubre queda Cerrado con ese reparto, a nombre de Daniel, y Esposa lo ve así al leer las finanzas

#### Scenario: Reparto que no suma
- **WHEN** el sobrante es $3.166.000 y el reparto es $2.000.000 y $1.000.000
- **THEN** responde 400 `REPARTO_INVALIDO` y octubre sigue abierto

#### Scenario: Alguien registró algo mientras tanto
- **WHEN** Daniel calculó el cierre y antes de cerrar Esposa registra un gasto en octubre
- **THEN** responde 409 `CIERRE_DESACTUALIZADO` y octubre sigue abierto

#### Scenario: Mes futuro
- **WHEN** hoy es 29 oct y se intenta cerrar noviembre
- **THEN** responde 400 `DATOS_INVALIDOS`

#### Scenario: Cerrar dos veces
- **WHEN** octubre ya está cerrado y se intenta cerrar otra vez
- **THEN** responde 409 `MES_CERRADO` y el cierre guardado no cambia

## MODIFIED Requirements

### Requirement: Usar la opción y estados del mes
"Usar opción" SHALL dejar esa opción como la que se ejecuta en el mes. El estado del mes sigue al dominio:
- un mes en Borrador con opción elegida pasa a Activo cuando llega su mes, sin que nadie lo cambie;
- un mes Cerrado (el plan en Cerrado, o el mes con su cierre guardado aunque no tenga plan) MUST NOT admitir cambios en su plan, crear su plan ni registros de pagos, gastos o aportes, y responde 409 `MES_CERRADO`.

En esta etapa solo existe la Opción A: duplicar opciones llega con la Etapa 7.

#### Scenario: Usar la Opción A de noviembre
- **WHEN** hoy es 28 oct y se usa la Opción A de noviembre
- **THEN** noviembre sigue en Borrador con la Opción A elegida, y el 1 de noviembre se lee como Activo

#### Scenario: Mes cerrado
- **WHEN** septiembre está Cerrado y se intenta agregarle un ítem
- **THEN** responde 409 `MES_CERRADO`

#### Scenario: Mes cerrado sin plan
- **WHEN** agosto no tenía plan, se cerró, y se intenta crear su plan
- **THEN** responde 409 `MES_CERRADO`
