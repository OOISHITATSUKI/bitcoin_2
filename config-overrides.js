const webpack = require('webpack');

module.exports = function override(config, env) {
  // ソースマップの設定
  if (env === 'development') {
    config.devtool = 'source-map';
  }

  // Webpackの設定をカスタマイズ
  config.resolve.fallback = {
    ...config.resolve.fallback,
    "crypto": require.resolve("crypto-browserify"),
    "stream": require.resolve("stream-browserify"),
    "assert": require.resolve("assert"),
    "http": require.resolve("stream-http"),
    "https": require.resolve("https-browserify"),
    "os": require.resolve("os-browserify"),
    "url": require.resolve("url"),
    "buffer": require.resolve("buffer"),
    "process": require.resolve("process/browser")
  };

  // 必要なプラグインを追加
  config.plugins.push(
    new webpack.ProvidePlugin({
      process: 'process/browser',
      Buffer: ['buffer', 'Buffer']
    }),
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
      'process.env.DEBUG': JSON.stringify(process.env.DEBUG || '*')
    })
  );

  return config;
}; 