import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { resolveConfig } from 'vite'

const dist = new URL('../dist/', import.meta.url)
const { base } = await resolveConfig({}, 'build')
const source = await readFile(new URL('index.html', dist), 'utf8')
const bundle = source.match(/<script\b[^>]*\bsrc="([^"]+)"[^>]*><\/script>/i)
const stylesheet = source.match(/<link\b[^>]*\bhref="([^"]+\.css)"[^>]*>/i)
if (!bundle || !stylesheet) throw new Error('Build the application before creating its standalone HTML.')

function builtAsset(path) {
  return new URL(path.startsWith(base) ? path.slice(base.length) : path, dist)
}

const [js, css, notices] = await Promise.all([
  readFile(builtAsset(bundle[1]), 'utf8'),
  readFile(builtAsset(stylesheet[1]), 'utf8'),
  readFile(new URL('third-party-notices.txt', dist), 'utf8'),
])
const html = source
  .replace(bundle[0], () => '<script type="module">\n' + js.replace(/<\/script/gi, '<\\/script') + '\n</script>')
  .replace(stylesheet[0], () => '<style>\n' + css + '\n</style>')
const target = resolve(process.argv[2] ?? 'tower-builder.html')
await writeFile(target, html.replace('<!doctype html>', () => '<!doctype html>\n<!--\n' + notices + '-->'))
console.log(target)
