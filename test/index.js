const run = require('../src/index')
const config = require('./icon.config')
const fs = require('fs-extra')
const path = require('path')

fs.removeSync(path.join(__dirname, 'dist'))
run(config)