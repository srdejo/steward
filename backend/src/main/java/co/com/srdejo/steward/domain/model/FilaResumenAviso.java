package co.com.srdejo.steward.domain.model;

/** Una fila del resumen semanal por correo: "28 oct · Nu · Mercado · $320.000" (spec steward-avisos, "Resumen por correo"). */
public record FilaResumenAviso(String fecha, String nombre, String detalle, long monto, boolean vencido) {
}
