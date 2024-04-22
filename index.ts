#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import prompts from 'prompts'
import { red, green, bold } from 'kolorist'

const defaultBanner = 'Vue Mini - 简单，强大，高性能的小程序框架'

// Generated by the following code:
//
// require('gradient-string')([
//   { color: '#42d392', pos: 0 },
//   { color: '#42d392', pos: 0.1 },
//   { color: '#647eff', pos: 1 }
// ])('Vue Mini - 简单，强大，高性能的小程序框架')
//
// Use the output directly here to keep the bundle small.
const gradientBanner =
  '\u001B[38;2;66;211;146mV\u001B[39m\u001B[38;2;66;211;146mu\u001B[39m\u001B[38;2;66;211;146me\u001B[39m \u001B[38;2;68;207;151mM\u001B[39m\u001B[38;2;69;203;157mi\u001B[39m\u001B[38;2;71;198;162mn\u001B[39m\u001B[38;2;73;194;168mi\u001B[39m \u001B[38;2;75;190;173m-\u001B[39m \u001B[38;2;76;186;179m简\u001B[39m\u001B[38;2;78;181;184m单\u001B[39m\u001B[38;2;80;177;190m，\u001B[39m\u001B[38;2;81;173;195m强\u001B[39m\u001B[38;2;83;169;201m大\u001B[39m\u001B[38;2;85;164;206m，\u001B[39m\u001B[38;2;86;160;211m高\u001B[39m\u001B[38;2;88;156;217m性\u001B[39m\u001B[38;2;90;152;222m能\u001B[39m\u001B[38;2;92;147;228m的\u001B[39m\u001B[38;2;93;143;233m小\u001B[39m\u001B[38;2;95;139;239m程\u001B[39m\u001B[38;2;97;135;244m序\u001B[39m\u001B[38;2;98;130;250m框\u001B[39m\u001B[38;2;100;126;255m架\u001B[39m'

function postOrderDirectoryTraverse(
  dir: string,
  dirCallback: (dir: string) => void,
  fileCallback: (file: string) => void,
) {
  for (const filename of fs.readdirSync(dir)) {
    if (filename === '.git') {
      continue
    }

    const fullpath = path.resolve(dir, filename)
    if (fs.lstatSync(fullpath).isDirectory()) {
      postOrderDirectoryTraverse(fullpath, dirCallback, fileCallback)
      dirCallback(fullpath)
      continue
    }

    fileCallback(fullpath)
  }
}

function isValidPackageName(projectName: string) {
  return /^(?:@[a-z\d-*~][a-z\d-*._~]*\/)?[a-z\d-~][a-z\d-._~]*$/.test(
    projectName,
  )
}

function toValidPackageName(projectName: string) {
  return projectName
    .trim()
    .toLowerCase()
    .replaceAll(/\s+/g, '-')
    .replace(/^[._]/, '')
    .replaceAll(/[^a-z\d-~]+/g, '-')
}

function canSkipEmptying(dir: string) {
  if (!fs.existsSync(dir)) {
    return true
  }

  const files = fs.readdirSync(dir)
  if (files.length === 0) {
    return true
  }

  if (files.length === 1 && files[0] === '.git') {
    return true
  }

  return false
}

function emptyDir(dir: string) {
  if (!fs.existsSync(dir)) {
    return
  }

  postOrderDirectoryTraverse(
    dir,
    (dir) => {
      fs.rmdirSync(dir)
    },
    (file) => {
      fs.unlinkSync(file)
    },
  )
}

function renderTemplate(src: string, dest: string, packageName: string) {
  const stats = fs.statSync(src)

  if (stats.isDirectory()) {
    // If it's a directory, render its subdirectories and files recursively
    fs.mkdirSync(dest, { recursive: true })
    for (const file of fs.readdirSync(src)) {
      renderTemplate(
        path.resolve(src, file),
        path.resolve(
          dest,
          /^_[a-z]/.test(file) ? file.replace('_', '.') : file,
        ),
        packageName,
      )
    }

    return
  }

  const filename = path.basename(src)

  if (filename === 'package.json') {
    const pkg = JSON.parse(fs.readFileSync(src, 'utf8')) as Record<string, any>
    pkg.name = packageName
    fs.writeFileSync(dest, JSON.stringify(pkg, null, 2) + '\n')
    return
  }

  if (filename === 'project.config.json') {
    const project = JSON.parse(fs.readFileSync(src, 'utf8')) as Record<
      string,
      any
    >
    project.projectname = packageName
    fs.writeFileSync(dest, JSON.stringify(project, null, 2) + '\n')
    return
  }

  if (filename === 'app.json') {
    const app = JSON.parse(fs.readFileSync(src, 'utf8')) as Record<string, any>
    app.window.navigationBarTitleText = packageName
    fs.writeFileSync(dest, JSON.stringify(app, null, 2) + '\n')
    return
  }

  if (filename === 'README.md') {
    const readme = fs.readFileSync(src, 'utf8')
    fs.writeFileSync(dest, `# ${packageName}\n\n${readme}`)
    return
  }

  fs.copyFileSync(src, dest)
}

async function init() {
  console.log()
  console.log(
    process.stdout.isTTY && process.stdout.getColorDepth() > 8 ?
      gradientBanner
    : defaultBanner,
  )
  console.log()

  const cwd = process.cwd()
  let targetDir = process.argv[2]
  const defaultProjectName = targetDir ?? 'vue-mini-project'

  let result: {
    projectName?: string
    shouldOverwrite?: boolean
    packageName?: string
  } = {}

  try {
    // Prompts:
    // - Project name:
    //   - whether to overwrite the existing directory or not?
    //   - enter a valid package name for package.json
    result = await prompts(
      [
        {
          name: 'projectName',
          type: targetDir ? null : 'text',
          message: '请输入项目名称：',
          initial: defaultProjectName,
          onState(state) {
            targetDir = String(state.value).trim() || defaultProjectName
          },
        },
        {
          name: 'shouldOverwrite',
          type: () => (canSkipEmptying(targetDir) ? null : 'toggle'),
          message() {
            const dirForPrompt =
              targetDir === '.' ? '当前目录' : `目标文件夹 "${targetDir}"`

            return `${dirForPrompt} 非空，是否覆盖？`
          },
          initial: true,
          active: '是',
          inactive: '否',
        },
        {
          name: 'overwriteChecker',
          type(_, values) {
            if (values.shouldOverwrite === false) {
              throw new Error(red('✖') + ` 操作取消`)
            }

            return null
          },
        },
        {
          name: 'packageName',
          type: () => (isValidPackageName(targetDir) ? null : 'text'),
          message: '请输入包名称：',
          initial: () => toValidPackageName(targetDir),
          validate: (dir: string) =>
            isValidPackageName(dir) || '无效的 package.json 名称',
        },
      ],
      {
        onCancel() {
          throw new Error(red('✖') + ` 操作取消`)
        },
      },
    )
  } catch (error: any) {
    console.error(error.message)
    process.exit(1)
  }

  // `initial` won't take effect if the prompt type is null
  // so we still have to assign the default values here
  const {
    projectName,
    packageName = projectName ?? defaultProjectName,
    shouldOverwrite = false,
  } = result

  const root = path.join(cwd, targetDir)

  if (fs.existsSync(root) && shouldOverwrite) {
    emptyDir(root)
  } else if (!fs.existsSync(root)) {
    fs.mkdirSync(root)
  }

  console.log(`\n正在初始化项目 ${root}...`)

  renderTemplate(
    new URL('template', import.meta.url).pathname,
    root,
    packageName,
  )

  console.log(`\n项目初始化完成，可执行以下命令：\n`)
  if (root !== cwd) {
    const cdProjectName = path.relative(cwd, root)
    console.log(
      `  ${bold(green(`cd ${cdProjectName.includes(' ') ? `"${cdProjectName}"` : cdProjectName}`))}`,
    )
  }

  console.log(`  ${bold(green('pnpm install'))}`)
  // Console.log(`  ${bold(green('pnpm format'))}`)
  console.log(`  ${bold(green('pnpm dev'))}`)
  console.log()
}

try {
  await init()
} catch (error) {
  console.error(error)
}