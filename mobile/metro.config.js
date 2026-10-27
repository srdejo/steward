// Metro con el dominio compartido de ../packages/domain (design D1 de presupuesto-hogar-ui): se compila desde su
// codigo fuente, igual que en la PWA. watchFolders deja que Metro vea archivos fuera de la carpeta del proyecto.
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const dominio = path.resolve(__dirname, '../packages/domain');

config.watchFolders = [...(config.watchFolders ?? []), dominio];
config.resolver.extraNodeModules = { ...(config.resolver.extraNodeModules ?? {}), '@steward/domain': path.join(dominio, 'src') };
// Las dependencias de la app (react, etc.) se resuelven siempre desde mobile/node_modules.
config.resolver.nodeModulesPaths = [path.resolve(__dirname, 'node_modules')];

module.exports = config;
