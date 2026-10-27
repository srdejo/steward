// Config de proyecto (no .babelrc) para que Jest tambien transforme el dominio compartido de ../packages/domain.
module.exports = function (api) {
  api.cache(true);
  return { presets: ['babel-preset-expo'] };
};
