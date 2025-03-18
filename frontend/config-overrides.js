const webpack = require('webpack');

module.exports = function override(config) {
  // Polyfills for Node.js core modules
  config.resolve.fallback = {
    ...config.resolve.fallback,
    "crypto": require.resolve("crypto-browserify"),
    "stream": require.resolve("stream-browserify"),
    "buffer": require.resolve("buffer"),
    "process": require.resolve("process/browser"),
    "zlib": require.resolve("browserify-zlib"),
    "path": require.resolve("path-browserify"),
    "http": require.resolve("stream-http"),
    "https": require.resolve("https-browserify"),
    "fs": false,
    "os": require.resolve("os-browserify/browser"),
    "vm": require.resolve("vm-browserify")
  };

  // Additional required plugins
  config.plugins = [
    ...config.plugins,
    new webpack.ProvidePlugin({
      process: 'process/browser',
      Buffer: ['buffer', 'Buffer'],
    }),
  ];

  // Enable source maps in development
  if (config.mode === 'development') {
    config.devtool = 'source-map';
  }

  return config;
};