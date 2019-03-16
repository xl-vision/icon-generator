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
    throw new Error('please provide "input" and "output" in config file')
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
      const srcName = path.basename(it, path.extname(it))
      //{name:'',filename:''}
      let formatName = pathItem.formater(srcName)
      if (typeof formatName === 'string') {
        formatName = {
          name: formatName,
          filename: formatName
        }
      }
      let name = formatName.name
      let filename = formatName.filename

      if(!name || !filename){
        throw new Error(`the 'formater' in config has to return a string or a object include 'name' and 'filename'`)
      }

      //首字符只能是字母或下划线，否则发出警告
      if (!name.match(/^[a-z_A-Z]/)) {
        console.warn(`the name of file '${it}' must start with charater or underline but '${name}'`)
      }

      // 名称必须是驼峰命名
      name = toCamel(name)
      
      const ret = {
        name,
        filename,
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

module.exports = async (config) => {
  if (!config) {
    throw new Error('please provide a config argument')
  }

  let pathMap = config.pathMap

  let templatePath = config.template

  if (!pathMap) {
    throw new Error('please provide "pathMap" in config file')
  }
  if (Array.isArray(pathMap)) {
    pathMap = pathMap.map(it => formatePathMap(it))
  } else if (typeof pathMap === 'object') {
    pathMap = [formatePathMap(pathMap)]
  } else {
    throw new Error('"pathMap" in config file should be a object or array')
  }

  if (!templatePath) {
    throw new Error('please provide "template" in config file')
  }
  const FILE_EXT = path.extname(templatePath)

  templatePath = getAbsolutePath(templatePath)
  if (!fs.existsSync(templatePath)) {
    throw new Error(`the file '${templatePath}' doesn't exist`)
  }

  const IconPathArray = await getIconPathArray(pathMap)

  const templateContent = await fs.readFile(templatePath, {
    encoding: "utf-8"
  })
  const render = template.compile(templateContent)
  IconPathArray.forEach(async it => {
    const message = await readIconMessage(it.input)
    const ret = render({
      ...it,
      message
    })
    const outputPath = getAbsolutePath(path.join(getAbsolutePath(it.output), `${it.filename}${FILE_EXT}`))
    await fs.outputFile(outputPath, ret)
  })
}