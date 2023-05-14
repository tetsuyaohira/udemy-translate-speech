const CopyPlugin = require('copy-webpack-plugin')

module.exports = {
  entry: {
    content: './src/content.js',
    background: './src/background.js',
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        {
          from: '.',
          to: '../dist',
          context: 'public',
        },
      ],
    }),
  ],
}
