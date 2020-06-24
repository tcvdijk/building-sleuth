const path = require('path')

module.exports = {
  mode: 'development',
  entry: './src/index.js',
  output: {
    path: path.resolve(__dirname, './bin'),
    filename: 'app.js'
  },
  devServer: {
    proxy: {
        '/api': {
           target: {
              host: "0.0.0.0",
              protocol: 'http:',
              port: 3000
           }
         }
       }
  }
}
