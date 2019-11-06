import * as htmlparser from 'htmlparser2'
import { Element } from "domhandler"

export default (content: string) => {
  const ret = new Promise<Data>((resolve, reject) => {
    const handler = new htmlparser.DomHandler((err, dom) => {
      if (err) {
        reject(err)
      } else {
        const obj = nomalizeData(dom[0] as Element)
        resolve(obj)
      }
    })
    const parser = new htmlparser.Parser(handler, { xmlMode: true })
    parser.write(content)
    parser.end()
  })
  return ret
}

type Data = {
  type: string,
  attrs: {
    [key: string]: string
  },
  children?: Data[]
}

const nomalizeData: (ele: Element) => Data = (node: Element) => {
  const type = node.name
  const attrs = node.attribs
  const ch = node.children as Element[]
  const children = ch ? ch.map(it => nomalizeData(it)) : undefined
  return {
    type,
    attrs,
    children
  }
}
