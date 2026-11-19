package co.com.srdejo.steward.infrastructure.out.mail;

import co.com.srdejo.steward.domain.model.FilaResumenAviso;
import org.springframework.web.util.HtmlUtils;

import java.util.List;
import java.util.Locale;

/**
 * Los correos con el sistema Libreta clara de la app (rediseno-libreta-clara): fondo #F6F5F1, tarjeta blanca de 16 px,
 * acento #1F4D3B, titulos en Space Grotesk (con Inter y las del sistema de respaldo) y montos con cifras tabulares.
 * Tablas y estilos en linea, para que Gmail, Outlook y Apple Mail los muestren igual; sin imagenes salvo el logo.
 */
final class PlantillaCorreo {

    static final String FONDO = "#F6F5F1";
    static final String TEXTO = "#1A1D1A";
    static final String MEDIO = "#4A4E48";
    static final String SECUNDARIO = "#63675F";
    static final String ACENTO = "#1F4D3B";
    static final String DIVISOR = "#F0EEE9";
    static final String NEGATIVO = "#B3261E";
    static final String NEGATIVO_SUAVE = "#FBE9E7";
    private static final String SANS = "Inter,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
    private static final String TITULAR = "'Space Grotesk',Inter,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

    private PlantillaCorreo() {
    }

    static String e(String valor) {
        return valor == null ? "" : HtmlUtils.htmlEscape(valor, "UTF-8");
    }

    /** {@code $2.195.000}, como formatCop del dominio. */
    static String cop(long valor) {
        String n = String.format(Locale.ROOT, "%,d", Math.abs(valor)).replace(',', '.');
        return (valor < 0 ? "−$" : "$") + n;
    }

    /** El boton principal de la app: verde acento, texto blanco, radio 12. */
    static String boton(String texto, String enlace) {
        return "<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"margin:8px 0 4px\"><tr>"
                + "<td style=\"border-radius:12px;background:" + ACENTO + "\">"
                + "<a href=\"" + e(enlace) + "\" style=\"display:inline-block;padding:14px 22px;font:600 15px " + SANS
                + ";color:#FFFFFF;text-decoration:none;border-radius:12px\">" + e(texto) + "</a></td></tr></table>";
    }

    /**
     * El marco de todos los correos: el logo y "Presupuesto Hogar" arriba, el titular, el contenido en la tarjeta blanca y
     * una nota al pie. {@code preencabezado}: lo que muestra la bandeja antes de abrirlo.
     */
    static String marco(String logo, String preencabezado, String titular, String contenido, String pie) {
        return "<!doctype html><html lang=\"es\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">"
                + "<meta name=\"color-scheme\" content=\"light\"><title>" + e(titular) + "</title></head>"
                + "<body style=\"margin:0;padding:0;background:" + FONDO + "\">"
                + "<div style=\"display:none;max-height:0;overflow:hidden;opacity:0\">" + e(preencabezado) + "</div>"
                + "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"background:" + FONDO + "\"><tr><td align=\"center\" style=\"padding:28px 16px\">"
                + "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"max-width:520px\">"
                // Logo y nombre, como la barra de la app.
                + "<tr><td style=\"padding:0 4px 18px\"><table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\"><tr>"
                + "<td style=\"width:36px\"><img src=\"" + e(logo) + "\" width=\"36\" height=\"36\" alt=\"\" style=\"display:block;border:0;border-radius:10px\"></td>"
                + "<td style=\"padding-left:10px;font:700 15px " + SANS + ";color:" + TEXTO + "\">Presupuesto Hogar</td></tr></table></td></tr>"
                // Tarjeta.
                + "<tr><td style=\"background:#FFFFFF;border-radius:16px;padding:24px 22px\">"
                + "<h1 style=\"margin:0 0 12px;font:700 24px/1.2 " + TITULAR + ";letter-spacing:-0.01em;color:" + TEXTO + "\">" + e(titular) + "</h1>"
                + contenido
                + "</td></tr>"
                + "<tr><td style=\"padding:16px 6px 0;font:400 12px/1.5 " + SANS + ";color:" + SECUNDARIO + "\">" + pie + "</td></tr>"
                + "</table></td></tr></table></body></html>";
    }

    static String parrafo(String html) {
        return "<p style=\"margin:0 0 14px;font:400 15px/1.5 " + SANS + ";color:" + MEDIO + "\">" + html + "</p>";
    }

    /** La lista del resumen: bloque de fecha, nombre y detalle, y el valor a la derecha; lo vencido en rojo. */
    static String filas(List<FilaResumenAviso> filas, long total) {
        StringBuilder s = new StringBuilder("<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"margin:4px 0 16px\">");
        boolean primera = true;
        for (FilaResumenAviso f : filas) {
            String borde = primera ? "" : "border-top:1px solid " + DIVISOR + ";";
            String fondoBloque = f.vencido() ? NEGATIVO_SUAVE : "#FBF1DC";
            String colorBloque = f.vencido() ? "#8C1D18" : "#8A5200";
            String[] partes = f.fecha().split(" ");
            s.append("<tr>")
                    .append("<td style=\"").append(borde).append("padding:10px 10px 10px 0;width:44px\">")
                    .append("<div style=\"width:40px;border-radius:11px;background:").append(fondoBloque).append(";color:").append(colorBloque)
                    .append(";text-align:center;padding:6px 0;font:700 14px/1 ").append(SANS).append("\">").append(e(partes[0]))
                    .append("<div style=\"font:400 10px/1.2 ").append(SANS).append("\">").append(e(partes.length > 1 ? partes[1] : "")).append("</div></div></td>")
                    .append("<td style=\"").append(borde).append("padding:10px 0;font:500 14px/1.35 ").append(SANS).append(";color:").append(TEXTO).append("\">")
                    .append(e(f.nombre()))
                    .append("<div style=\"font:").append(f.vencido() ? "600" : "400").append(" 12px/1.4 ").append(SANS).append(";color:")
                    .append(f.vencido() ? NEGATIVO : SECUNDARIO).append("\">").append(e(f.detalle())).append("</div></td>")
                    .append("<td align=\"right\" style=\"").append(borde).append("padding:10px 0 10px 10px;white-space:nowrap;font:600 14px ").append(SANS)
                    .append(";font-variant-numeric:tabular-nums;color:").append(TEXTO).append("\">").append(cop(f.monto())).append("</td>")
                    .append("</tr>");
            primera = false;
        }
        s.append("<tr><td colspan=\"2\" style=\"border-top:1px solid ").append(DIVISOR).append(";padding:12px 0 0;font:600 14px ").append(SANS)
                .append(";color:").append(MEDIO).append("\">Total</td>")
                .append("<td align=\"right\" style=\"border-top:1px solid ").append(DIVISOR).append(";padding:12px 0 0;font:700 18px ").append(TITULAR)
                .append(";font-variant-numeric:tabular-nums;color:").append(ACENTO).append("\">").append(cop(total)).append("</td></tr></table>");
        return s.toString();
    }
}
