const CopyPlugin = require('copy-webpack-plugin')

module.exports = {
  entry: {
    content: './src/content.ts',
    background: './src/background.ts',
    'action/popup': './src/action/popup.ts',
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.js'],
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
