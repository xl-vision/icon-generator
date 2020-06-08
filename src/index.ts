import handlebars from 'handlebars'
import chalk from 'chalk'
import path from 'path'
import fs from 'fs-extra'
import glob from 'glob-promise'
import Svgo from 'svgo'
import htmlParse from './utils/htmlParse'

const defaultFormater = (name: string) => name

export type SvgoPlugin = {
  [name: string]: any
}

export type IconOption = {
  src: string
  dest: string
  svgoPlugins?: SvgoPlugin | Array<SvgoPlugin>
  nameFormatter?: (
    name: string
  ) =>
    | string
    | {
        name: string
        filename: string
      }
}

export type Config = {
  template: string
  icons: IconOption | Array<IconOption>
  helpers?: handlebars.HelperDeclareSpec
  svgoPlugins?: SvgoPlugin | Array<SvgoPlugin>
}

const getSvgo = (svgoPlugins?: SvgoPlugin | Array<SvgoPlugin>) => {
  const plugins: Array<any> = []

  if (Array.isArray(svgoPlugins)) {
    plugins.push(...svgoPlugins)
  } else if (!svgoPlugins) {
    plugins.push(svgoPlugins)
  }

  return new Svgo({ full: true, plugins })
}

export default async (config: Config) => {
  let { template, icons, helpers, svgoPlugins } = config

  const defaultSvgo = getSvgo(svgoPlugins)

  if (!template) {
    console.error(chalk.red(`No template is provided.`))
    process.exit(1)
  }

  template = getAbsolutePath(template)

  if (!fs.existsSync(template)) {
    console.error(chalk.red(`The template path: '${template}' does not exist.`))
    process.exit(1)
  }

  if (typeof icons === 'undefined') {
    console.error(chalk.red(`The option 'icons' is not provided.`))
    process.exit(1)
  }

  if (!Array.isArray(icons)) {
    icons = [icons]
  }

  const FILE_EXT = path.extname(template)

  const templateContent = await fs.readFile(template, {
    encoding: 'utf-8',
  })

  if (helpers) {
    for (const name of Object.keys(helpers)) {
      handlebars.registerHelper(name, helpers[name])
    }
  }

  const compiler = handlebars.compile(templateContent)

  for (const icon of icons) {
    await renderIcon(compiler, FILE_EXT, icon, defaultSvgo)
  }
}

const getAbsolutePath = (dir: string) =>
  path.isAbsolute(dir) ? dir : path.join(process.cwd(), dir)

const renderIcon = async (
  compiler: handlebars.TemplateDelegate,
  ext: string,
  icon: IconOption,
  defaultSvgo: Svgo
) => {
  const {
    src,
    dest: _dest,
    nameFormatter = defaultFormater,
    svgoPlugins,
  } = icon

  if (svgoPlugins) {
    defaultSvgo = getSvgo(svgoPlugins)
  }

  if (!src) {
    console.error(chalk.red(`No icon source path is provided.`))
    process.exit(1)
  }

  if (!_dest) {
    console.error(chalk.red(`No icon destination path is provided.`))
    process.exit(1)
  }

  const dest = getAbsolutePath(_dest)

  const files = await glob(src)

  const fileInfos = files.map((it) => {
    const filename = path.basename(it, path.extname(it))
    const formatter = nameFormatter(filename)
    const nameObj =
      typeof formatter === 'string'
        ? {
            filename: formatter,
            // 名称必须时驼峰格式
            name: toCamel(formatter),
          }
        : formatter

    return {
      src: it,
      ...nameObj,
    }
  })

  for (const info of fileInfos) {
    const absolutePath = getAbsolutePath(info.src)
    const content = await fs.readFile(absolutePath, {
      encoding: 'utf-8',
    })

    const svgoObj = await defaultSvgo.optimize(content)

    const node = await htmlParse(svgoObj.data)
    const compileContent = compiler({
      filename: info.filename,
      name: info.name,
      node,
    })

    const outputPath = path.join(dest, `${info.filename}${ext}`)

    await fs.outputFile(outputPath, compileContent)
  }
}

/**
 * 首字母大写
 * @param name
 */
const toCamel = (name: string) => {
  const ret = name.replace(/\-(\w)/g, function (all, letter) {
    return letter.toUpperCase()
  })

  if (ret.length <= 1) {
    return ret.toUpperCase()
  }
  return ret.charAt(0).toUpperCase() + ret.substr(1)
}
