package co.com.srdejo.steward.domain.model;

import java.util.Set;

/**
 * La configuracion de avisos de una persona (spec steward-avisos, "Avisos · Configurar"; design D6 de avisos-pagos). Los
 * tipos son los de {@link Aviso.Tipo} mas {@code ACTIVIDAD} ("Lo que marque {otro miembro}").
 */
public record PreferenciasAviso(Set<String> tiposApagados, boolean correo, boolean noMolestar) {

    public static final Set<String> TIPOS = Set.of("PAGO", "TARJETA", "CUOTA", "INGRESO", "PLAN", "CUADRAR", "ACTIVIDAD");
    /** Para quien nunca abrio Configurar: todo activo, correo y no molestar. */
    public static final PreferenciasAviso DEFECTO = new PreferenciasAviso(Set.of(), true, true);

    public PreferenciasAviso {
        tiposApagados = tiposApagados == null ? Set.of() : Set.copyOf(tiposApagados);
    }

    public boolean activo(String tipo) {
        return !tiposApagados.contains(tipo);
    }
}
