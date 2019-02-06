const template = require('art-template')
const path = require('path')
const fs = require('fs-extra')
const htmlparser = require('htmlparser2')
const glob = require('glob-promise')
const svgo = require('./utils/svgo')


const defaultFormater = name => name
const formatePathMap = (it) => {
  const input = it.input
  const output = it.output
  const formater = it.formater || defaultFormater
  if (!input || !output) {
    console.error('please provide "input" and "output" in config file')
    process.exit(1)
  }
  return {
    input,
    output,
    formater
  }
}

const getIconPathArray = async (pathMap) => {
  const arr = []
  for (const pathItem of pathMap) {
    const paths = await glob(pathItem.input)
    paths.forEach(it => {
      let name = path.basename(it, path.extname(it))
      name = pathItem.formater(name)
      //首字符只能是字母或下划线，否则发出警告
      if (!name.match(/^[a-z_A-Z]/)) {
        console.warn(`the name of file '${it}' must start with charater or underline but '${name}'`)
      }

      // 名称必须是驼峰命名
      name = toCamel(name)

      const ret = {
        name,
        input: it,
        output: pathItem.output
      }
      arr.push(ret)
    })
  }
  return arr
}

const toCamel = str => {
  let tempStr = ''
  let flag = true
  for (let i = 0; i < str.length; i++) {
    let char = str.charAt(i)
    if (flag) {
      char = char.toUpperCase()
      flag = false
    } else if (char === '-') {
      flag = true
      continue
    }
    tempStr += char
  }
  return tempStr
}

const getAbsolutePath = filepath => path.isAbsolute(filepath) ? filepath : path.resolve(process.cwd(), filepath)

const readIconMessage = async (svgPath) => {
  const actualPath = getAbsolutePath(svgPath)
  const content = await fs.readFile(actualPath, {
    encoding: "utf-8"
  })
  const optimizeData = await svgo.optimize(content)
  const optimizeContent = optimizeData.data
  const ret = await new Promise((resolve, reject) => {
    const handler = new htmlparser.DomHandler((err, dom) => {
      if (err) {
        reject(err)
      } else {
        const obj = nomalizeData(dom[0])
        resolve(obj)
      }
    })
    const parser = new htmlparser.Parser(handler)
    parser.write(optimizeContent)
    parser.end()
  })
  return ret
}

const nomalizeData = (svgObj) => {
  const type = svgObj.name
  const attrs = svgObj.attribs
  const ch = svgObj.children
  const children = ch ? ch.map(it => nomalizeData(it)) : null
  return {
    type,
    attrs,
    children
  }
}

module.exports = async () => {
  let configPath = path.join(process.cwd(), 'icon.config.js')

  if (!fs.existsSync(configPath)) {
    console.error('please provide a config file named "icon.config.js" in root directory of project')
    process.exit(1)
  }

  const config = require(configPath)

  let pathMap = config.pathMap

  let templatePath = config.template


  if (!pathMap) {
    console.error('please provide "pathMap" in config file')
    process.exit(1)
  }
  if (Array.isArray(pathMap)) {
    pathMap = pathMap.map(it => formatePathMap(it))
  } else if (typeof pathMap === 'object') {
    pathMap = [formatePathMap(pathMap)]
  } else {
    console.error('"pathMap" in config file should be a object or array')
    process.exit(1)
  }

  if (!templatePath) {
    console.error('please provide "template" in config file')
    process.exit(1)
  }
  const FILE_EXT = path.extname(templatePath)

  templatePath = getAbsolutePath(templatePath)
  if (!fs.existsSync(templatePath)) {
    console.error(`the file '${templatePath}' doesn't exist`)
    process.exit(1)
  }

  const IconPathArray = await getIconPathArray(pathMap)

  const templateContent = await fs.readFile(templatePath, {
    encoding: "utf-8"
  })
  IconPathArray.forEach(async it => {
    const message = await readIconMessage(it.input)
    // console.log(templateContent)
    const ret = template.render(templateContent, {
      name: it.name,
      message
    })
    const outputPath = getAbsolutePath(path.join(it.output, `${it.name}.${FILE_EXT}`))
    await fs.outputFile(outputPath, ret)
  })
}