package co.com.srdejo.steward.domain.usecase;

import co.com.srdejo.steward.domain.api.IAvisosServicePort;
import co.com.srdejo.steward.domain.exception.DomainException;
import co.com.srdejo.steward.domain.model.Aviso;
import co.com.srdejo.steward.domain.model.DispositivoAviso;
import co.com.srdejo.steward.domain.model.FilaResumenAviso;
import co.com.srdejo.steward.domain.model.Finanzas;
import co.com.srdejo.steward.domain.model.MensajeAviso;
import co.com.srdejo.steward.domain.model.Miembro;
import co.com.srdejo.steward.domain.model.Movimiento;
import co.com.srdejo.steward.domain.model.PlanMes;
import co.com.srdejo.steward.domain.model.PreferenciasAviso;
import co.com.srdejo.steward.domain.spi.IActividadPort;
import co.com.srdejo.steward.domain.spi.IAvisoPersistencePort;
import co.com.srdejo.steward.domain.spi.IClockPort;
import co.com.srdejo.steward.domain.spi.IComoUsuarioPort;
import co.com.srdejo.steward.domain.spi.ICurrentUserPort;
import co.com.srdejo.steward.domain.spi.IEnvioPushPort;
import co.com.srdejo.steward.domain.spi.IHogarPersistencePort;
import co.com.srdejo.steward.domain.spi.IMailPort;
import co.com.srdejo.steward.domain.usecase.CalculoAvisos.Momento;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;

/**
 * Avisos de pagos (spec steward-avisos; avisos-pagos). La lista sale de {@link CalculoAvisos} sobre las finanzas del
 * hogar. El programador corre cada 15 minutos y envia, desde las 8:00, lo que toca hoy a cada persona (el lunes de la
 * semana, el dia anterior y el mismo dia sin pagar), en un solo aviso, sin repetir (tabla aviso_enviado); el lunes a las
 * 7:30 manda el resumen por correo. Lo que marca un miembro le llega al otro al momento, o al terminar su no molestar.
 */
public class AvisosUseCase implements IAvisosServicePort, IActividadPort {

    static final LocalTime HORA_PUSH = LocalTime.of(8, 0);
    static final LocalTime HORA_CORREO = LocalTime.of(7, 30);
    static final LocalTime FIN_NO_MOLESTAR = LocalTime.of(7, 0);
    static final LocalTime INICIO_NO_MOLESTAR = LocalTime.of(21, 0);

    private final IHogarPersistencePort hogares;
    private final IAvisoPersistencePort avisos;
    private final FinanzasUseCase finanzas;
    private final IEnvioPushPort push;
    private final IMailPort correo;
    private final ICurrentUserPort usuarioActual;
    private final IComoUsuarioPort comoUsuario;
    private final IClockPort clock;
    private final FirmaAviso firma;
    private final ZoneId zona;
    private final String urlAvisos;

    public AvisosUseCase(IHogarPersistencePort hogares, IAvisoPersistencePort avisos, FinanzasUseCase finanzas, IEnvioPushPort push,
                         IMailPort correo, ICurrentUserPort usuarioActual, IComoUsuarioPort comoUsuario, IClockPort clock,
                         FirmaAviso firma, String zona, String urlPublica) {
        this.hogares = hogares;
        this.avisos = avisos;
        this.finanzas = finanzas;
        this.push = push;
        this.correo = correo;
        this.usuarioActual = usuarioActual;
        this.comoUsuario = comoUsuario;
        this.clock = clock;
        this.firma = firma;
        this.zona = ZoneId.of(zona == null ? "America/Bogota" : zona);
        this.urlAvisos = (urlPublica == null ? "" : urlPublica.replaceAll("/$", "")) + "/avisos";
    }

    // --- API --------------------------------------------------------------------------------------------------------

    @Override
    public Mono<List<Aviso>> proximos() {
        return finanzas.leer().map(f -> CalculoAvisos.proximos(f, clock.hoy()));
    }

    @Override
    public Mono<PreferenciasAviso> preferencias() {
        return usuarioActual.usuarioId().flatMap(avisos::preferencias);
    }

    @Override
    public Mono<PreferenciasAviso> guardarPreferencias(PreferenciasAviso p) {
        return Mono.fromCallable(() -> {
            if (p == null || !PreferenciasAviso.TIPOS.containsAll(p.tiposApagados())) {
                throw DomainException.datosInvalidos("Ese tipo de aviso no existe");
            }
            return p;
        }).flatMap(valida -> usuarioActual.usuarioId().flatMap(u -> avisos.guardarPreferencias(u, valida).thenReturn(valida)));
    }

    @Override
    public Mono<Void> registrarDispositivo(DispositivoAviso.Tipo tipo, String token, String p256dh, String auth) {
        return Mono.fromCallable(() -> {
            if (tipo == null || token == null || token.isBlank() || token.length() > 1000) {
                throw DomainException.datosInvalidos("Falta el dispositivo");
            }
            if (tipo == DispositivoAviso.Tipo.EXPO && !(token.startsWith("ExponentPushToken[") || token.startsWith("ExpoPushToken["))) {
                throw DomainException.datosInvalidos("Ese no es un token de Expo");
            }
            if (tipo == DispositivoAviso.Tipo.WEB && (!token.startsWith("https://") || p256dh == null || auth == null)) {
                throw DomainException.datosInvalidos("La suscripción del navegador está incompleta");
            }
            return tipo;
        }).flatMap(t -> usuarioActual.usuarioId().flatMap(u -> avisos.guardarDispositivo(new DispositivoAviso(UUID.randomUUID(), u, t, token.strip(),
                t == DispositivoAviso.Tipo.WEB ? p256dh : null, t == DispositivoAviso.Tipo.WEB ? auth : null))));
    }

    @Override
    public Mono<Void> quitarDispositivo(String token) {
        return usuarioActual.usuarioId().flatMap(u -> avisos.quitarDispositivo(u, token == null ? "" : token));
    }

    @Override
    public Mono<Void> probar() {
        MensajeAviso prueba = new MensajeAviso("Presupuesto Hogar", "Así te van a llegar los avisos de tus pagos.", null, Map.of("destino", "avisos"));
        return usuarioActual.usuarioId().flatMap(u -> avisos.dispositivos(u).collectList().flatMap(lista -> lista.isEmpty()
                ? Mono.error(DomainException.datosInvalidos("Activa las notificaciones en este dispositivo"))
                : enviarA(lista, prueba)));
    }

    @Override
    public String claveWeb() {
        return push.clavePublicaWeb();
    }

    @Override
    public Mono<Void> accion(String token, String que) {
        LocalDate hoy = clock.hoy();
        FirmaAviso.Accion a = firma.verificar(token, hoy).orElse(null);
        if (a == null || !("PAGADO".equals(que) || "MANANA".equals(que))) {
            return Mono.error(DomainException.noEncontrado("AVISO_NO_ENCONTRADO", "Ese aviso ya no existe"));
        }
        if ("MANANA".equals(que)) {
            return avisos.posponer(a.usuarioId(), a.clave(), hoy.plusDays(1));
        }
        if (a.itemId() == null) return Mono.empty();
        // Con el valor del plan, sin cuenta y a nombre de quien toca la accion; si ya estaba pagado, nada (design D5).
        return finanzas.leerHogar(a.hogarId())
                .flatMap(f -> Mono.justOrEmpty(itemDe(f, a)))
                .flatMap(item -> comoUsuario.como(a.usuarioId(), finanzas.pagar(item.id(), item.monto(), a.usuarioId(), "NINGUNO", null, a.mes())))
                .onErrorResume(DomainException.class, ex -> "YA_PAGADO".equals(ex.codigo()) ? Mono.empty() : Mono.error(ex))
                .then();
    }

    private static PlanMes.ItemPlan itemDe(Finanzas f, FirmaAviso.Accion a) {
        return f.planes().stream().filter(p -> p.ref().equals(a.mes()) && p.principal() != null)
                .flatMap(p -> p.principal().items().stream()).filter(i -> i.id().equals(a.itemId())).findFirst().orElse(null);
    }

    // --- Programador ------------------------------------------------------------------------------------------------

    @Override
    public Mono<Void> correr() {
        LocalTime hora = clock.ahora().atZone(zona).toLocalTime();
        LocalDate hoy = clock.hoy();
        return hogares.todos().concatMap(h -> correrHogar(h, hoy, hora)
                .onErrorResume(ex -> Mono.empty())).then();
    }

    private Mono<Void> correrHogar(UUID hogarId, LocalDate hoy, LocalTime hora) {
        return finanzas.leerHogar(hogarId).flatMap(f -> hogares.miembros(hogarId).collectList().flatMap(miembros -> {
            List<Aviso> lista = CalculoAvisos.proximos(f, hoy);
            return Flux.fromIterable(miembros).concatMap(m -> avisos.preferencias(m.usuario().id()).flatMap(p -> {
                Mono<Void> diario = !hora.isBefore(HORA_PUSH) && !(p.noMolestar() && !hora.isBefore(INICIO_NO_MOLESTAR))
                        ? pushDelDia(hogarId, m, p, lista, hoy) : Mono.empty();
                Mono<Void> resumen = hoy.getDayOfWeek() == DayOfWeek.MONDAY && !hora.isBefore(HORA_CORREO) && p.correo()
                        ? resumenSemanal(m, p, lista, hoy) : Mono.empty();
                Mono<Void> actividad = !(p.noMolestar() && enNoMolestar(hora)) ? actividadPendiente(f, miembros, m, hoy) : Mono.empty();
                return diario.then(resumen).then(actividad);
            })).then();
        }));
    }

    static boolean enNoMolestar(LocalTime hora) {
        return !hora.isBefore(INICIO_NO_MOLESTAR) || hora.isBefore(FIN_NO_MOLESTAR);
    }

    /** Lo que toca hoy a una persona, mas lo pospuesto para hoy, en un solo aviso. */
    private Mono<Void> pushDelDia(UUID hogarId, Miembro m, PreferenciasAviso p, List<Aviso> lista, LocalDate hoy) {
        UUID u = m.usuario().id();
        List<Mono<Map.Entry<Aviso, Momento>>> reservas = new ArrayList<>();
        for (Aviso a : lista) {
            if (!p.activo(a.tipo().name()) || a.grupo() == Aviso.Grupo.VENCIDO) continue;
            Set<Momento> momentos = CalculoAvisos.momentosDeHoy(a.fecha(), hoy);
            // Cuadrar es "para no olvidar": solo en el aviso del lunes.
            if (a.tipo() == Aviso.Tipo.CUADRAR) momentos = hoy.getDayOfWeek() == DayOfWeek.MONDAY ? Set.of(Momento.LUNES) : Set.of();
            for (Momento mo : momentos) {
                reservas.add(avisos.reservar(u, a.clave(), mo.name(), hoy).filter(Boolean::booleanValue).map(ok -> Map.entry(a, mo)));
            }
        }
        Map<String, Aviso> porClave = new LinkedHashMap<>();
        lista.forEach(a -> porClave.put(a.clave(), a));
        Mono<List<Aviso>> pospuestos = avisos.pospuestos(u, hoy).filter(porClave::containsKey)
                .concatMap(c -> avisos.marcarPospuestoEnviado(u, c, hoy).thenReturn(porClave.get(c))).collectList();
        return Flux.concat(reservas).collectList().zipWith(pospuestos).flatMap(t -> {
            Map<String, Aviso> enviar = new LinkedHashMap<>();
            boolean lunes = t.getT1().stream().anyMatch(e -> e.getValue() == Momento.LUNES);
            t.getT1().forEach(e -> enviar.put(e.getKey().clave(), e.getKey()));
            t.getT2().forEach(a -> enviar.put(a.clave(), a));
            if (enviar.isEmpty()) return Mono.empty();
            MensajeAviso mensaje = mensaje(hogarId, u, List.copyOf(enviar.values()), lunes, hoy);
            return avisos.dispositivos(u).collectList().flatMap(d -> enviarA(d, mensaje));
        });
    }

    /** Uno solo con sus acciones si es un pago; varios en uno, con el conteo y la suma (spec "Cuándo se avisa"). */
    MensajeAviso mensaje(UUID hogarId, UUID usuarioId, List<Aviso> lista, boolean lunes, LocalDate hoy) {
        List<Aviso> soloPagos = lista.stream().filter(x -> x.pago() != null).toList();
        if (!lunes && (lista.size() == 1 || soloPagos.size() == 1)) {
            // Un solo pago (con o sin otros avisos que no son pagos): con sus acciones, y los otros nombrados.
            Aviso a = soloPagos.isEmpty() ? lista.getFirst() : soloPagos.getFirst();
            List<String> otros = lista.stream().filter(x -> x != a).map(Aviso::nombre).toList();
            String cuerpo = a.detalle() + (a.monto() == null ? "" : " · " + cop(a.monto())) + (otros.isEmpty() ? "" : " · También: " + String.join(", ", otros));
            if (a.pago() == null || !firma.configurada()) return new MensajeAviso(a.nombre(), cuerpo, null, Map.of("destino", "avisos"));
            String token = firma.firmar(new FirmaAviso.Accion(usuarioId, hogarId, a.pago().itemId(), a.pago().ref(), a.clave(), hoy.plusDays(FirmaAviso.DIAS_VALIDO)));
            return new MensajeAviso(a.nombre(), cuerpo, "pago", Map.of("destino", "avisos", "accion", token));
        }
        List<Aviso> pagos = lista.stream().filter(a -> a.monto() != null && a.pago() != null).toList();
        long total = pagos.stream().mapToLong(Aviso::monto).sum();
        String cuando = lunes ? "Esta semana" : "Hoy";
        String titulo = pagos.isEmpty() ? lista.size() + " avisos" : cuando + ": " + pagos.size() + (pagos.size() == 1 ? " pago · " : " pagos · ") + cop(total);
        String nombres = String.join(", ", lista.stream().map(Aviso::nombre).toList());
        return new MensajeAviso(titulo, nombres, null, Map.of("destino", "avisos"));
    }

    private Mono<Void> enviarA(List<DispositivoAviso> dispositivos, MensajeAviso mensaje) {
        return Flux.fromIterable(dispositivos)
                .concatMap(d -> push.enviar(d, mensaje).onErrorReturn(false)
                        .flatMap(invalido -> invalido ? avisos.quitarToken(d.token()) : Mono.empty()))
                .then();
    }

    /** El lunes 7:30: los pagos de la semana y lo vencido, si hay algo (spec "Resumen por correo"). */
    private Mono<Void> resumenSemanal(Miembro m, PreferenciasAviso p, List<Aviso> lista, LocalDate hoy) {
        LocalDate domingo = hoy.with(TemporalAdjusters.nextOrSame(DayOfWeek.SUNDAY));
        List<Aviso> semana = lista.stream().filter(a -> a.pago() != null && a.monto() != null && p.activo(a.tipo().name())
                && (a.grupo() == Aviso.Grupo.VENCIDO || !a.fecha().isAfter(domingo))).toList();
        if (semana.isEmpty() || m.usuario().email() == null) return Mono.empty();
        List<FilaResumenAviso> filas = semana.stream().map(a -> new FilaResumenAviso(Formato.fechaCorta(a.fecha()), a.nombre(), a.detalle(),
                a.monto(), a.grupo() == Aviso.Grupo.VENCIDO)).toList();
        long total = semana.stream().mapToLong(Aviso::monto).sum();
        String nombre = m.usuario().nombre() == null ? "" : m.usuario().nombre().split(" ")[0];
        return avisos.reservar(m.usuario().id(), "CORREO:" + hoy, "CORREO", hoy).filter(Boolean::booleanValue)
                .flatMap(ok -> correo.enviarResumenAvisos(m.usuario().email(), nombre, filas, total, urlAvisos).onErrorResume(ex -> Mono.empty()));
    }

    // --- Lo que marca el otro miembro (design D7) -------------------------------------------------------------------

    /** Llamado por Finanzas al registrar un pago o un aporte; se envia aparte, sin demorar la respuesta. */
    @Override
    public void registrado(Movimiento mov) {
        if (mov.tipo() != Movimiento.Tipo.PAGO && mov.tipo() != Movimiento.Tipo.GASTO && mov.tipo() != Movimiento.Tipo.APORTE) return;
        if (mov.tipo() == Movimiento.Tipo.GASTO && mov.itemId() == null) return;
        LocalTime hora = clock.ahora().atZone(zona).toLocalTime();
        LocalDate hoy = clock.hoy();
        finanzas.leerHogar(mov.hogarId()).flatMap(f -> hogares.miembros(mov.hogarId()).collectList().flatMap(miembros ->
                        Flux.fromIterable(miembros).filter(m -> !m.usuario().id().equals(mov.creadoPor()))
                                .concatMap(m -> avisos.preferencias(m.usuario().id()).flatMap(p -> {
                                    if (!p.activo("ACTIVIDAD")) return Mono.empty();
                                    String clave = "ACTIVIDAD:" + mov.id();
                                    // En su no molestar, le llega al terminar (spec "No molestar").
                                    if (p.noMolestar() && enNoMolestar(hora)) {
                                        return avisos.posponer(m.usuario().id(), clave, hora.isBefore(FIN_NO_MOLESTAR) ? hoy : hoy.plusDays(1));
                                    }
                                    return avisos.reservar(m.usuario().id(), clave, "ACTIVIDAD", hoy).filter(Boolean::booleanValue)
                                            .flatMap(ok -> avisos.dispositivos(m.usuario().id()).collectList()
                                                    .flatMap(d -> enviarA(d, mensajeActividad(f, miembros, mov))));
                                })).then()))
                .subscribeOn(Schedulers.boundedElastic())
                .onErrorResume(ex -> Mono.empty())
                .subscribe();
    }

    /** Las actividades pospuestas por no molestar que ya pueden salir. */
    private Mono<Void> actividadPendiente(Finanzas f, List<Miembro> miembros, Miembro m, LocalDate hoy) {
        UUID u = m.usuario().id();
        Map<String, Movimiento> porClave = new LinkedHashMap<>();
        f.movimientos().forEach(x -> porClave.put("ACTIVIDAD:" + x.id(), x));
        return avisos.pospuestos(u, hoy).filter(c -> c.startsWith("ACTIVIDAD:"))
                .concatMap(c -> avisos.marcarPospuestoEnviado(u, c, hoy).then(Mono.justOrEmpty(porClave.get(c))))
                .concatMap(mov -> avisos.dispositivos(u).collectList().flatMap(d -> enviarA(d, mensajeActividad(f, miembros, mov))))
                .then();
    }

    /** "Esposa pagó Recibo Luz · $38.000 desde su cuenta · cuenta como aporte", "Esposa registró un aporte · $500.000". */
    static MensajeAviso mensajeActividad(Finanzas f, List<Miembro> miembros, Movimiento mov) {
        Function<UUID, String> nombre = id -> miembros.stream().filter(x -> x.usuario().id().equals(id)).findFirst()
                .map(x -> x.usuario().nombre().split(" ")[0]).orElse("Alguien");
        String quien = nombre.apply(mov.usuarioId());
        if (mov.tipo() == Movimiento.Tipo.APORTE) {
            return new MensajeAviso(quien + " registró un aporte", cop(mov.monto()), null, Map.of("destino", "hoy"));
        }
        String item = f.planes().stream().filter(p -> p.ref().equals(mov.ref()))
                .flatMap(p -> p.escenarios().stream()).flatMap(e -> e.items().stream())
                .filter(i -> i.id().equals(mov.itemId())).map(PlanMes.ItemPlan::nombre).findFirst().orElse("un pago");
        String cuerpo = cop(mov.monto()) + (mov.origen() == Movimiento.Origen.EXTERNA ? " desde su cuenta · cuenta como aporte" : "");
        return new MensajeAviso(quien + " pagó " + item, cuerpo, null, Map.of("destino", "hoy"));
    }

    static String cop(long valor) {
        return "$" + String.format(java.util.Locale.ROOT, "%,d", valor).replace(',', '.');
    }
}
