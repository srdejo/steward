## ADDED Requirements

### Requirement: Pagar en línea desde Hoy
En Por pagar, un ítem con enlace de pago SHALL mostrar "Pagar ↗", que abre el enlace fuera de Steward (otra pestaña en la PWA, el navegador en la app) sin marcar el pago. Marcar pago de un ítem con datos de pago SHALL mostrar el enlace y el código con un botón "Copiar" que lo deja en el portapapeles y confirma "Código copiado". Los ítems sin datos de pago MUST verse como antes. Ya pagado no muestra "Pagar ↗".

#### Scenario: Pagar Internet en línea
- **WHEN** Internet está en Por pagar con enlace y código, y se toca "Pagar ↗"
- **THEN** se abre el portal de pago, e Internet sigue en Por pagar hasta que se marque pagado

#### Scenario: Copiar el código
- **WHEN** se abre Marcar pago de Agua, que tiene el código `987`, y se toca "Copiar"
- **THEN** `987` queda en el portapapeles y se ve "Código copiado"

#### Scenario: Un gasto sin datos
- **WHEN** Mercado no tiene datos de pago
- **THEN** su fila en Por pagar y su Marcar pago se ven como antes
