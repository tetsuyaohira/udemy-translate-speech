const CopyPlugin = require('copy-webpack-plugin')

module.exports = {
  entry: {
    content: './src/content.js',
    background: './src/background.js',
    'action/popup': './src/action/popup.js',
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        {
          from: '.',
          to: '../dist',
          context: 'public',
        },
        { from: 'src/action/popup.html', to: 'action' },
        { from: 'src/action/popup.css', to: 'action' },
      ],
    }),
  ],
}
