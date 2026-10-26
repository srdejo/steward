// Punto de entrada de @steward/domain. Las pantallas importan modelo, formato, reglas (sus vistas y
// tipos) y puertos. El adaptador de prueba se importa aparte (`@steward/domain/demo`) y solo desde la
// configuracion de cada app, nunca desde una pantalla.
export * from './model';
export * from './format';
export * from './rules';
export * from './ports';
