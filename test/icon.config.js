module.exports = {
  // 支持glob
  // path: {
  //   input: 'src/**/*.svg',
  //   formater: name => name,
  //   output: 'dist'
  // }
  pathMap: {
    //支持绝对路径和相对路径，相对路径从项目根目录算起
    input: 'test/icons/**/*.svg',
    // 生成组件的名称，根据文件名生成
    formater: name => name,
    //支持绝对路径和相对路径，相对路径从项目根目录算起
    output: 'test/dist/a'
  },
  template: 'test/template/index.tsx'
}