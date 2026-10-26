import { ChangeDetectionStrategy, Component } from '@angular/core';

// Pendiente: se construye en su grupo de tareas de presupuesto-hogar-ui.
@Component({
  selector: 'app-invitacion-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<h1 class="p-6 text-xl font-bold">Invitación</h1>',
})
export class InvitacionPage {}
