import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const dist = new URL('../dist/', import.meta.url)
const source = await readFile(new URL('index.html', dist), 'utf8')
const bundle = source.match(/<script\b[^>]*\bsrc="([^"]+)"[^>]*><\/script>/i)
const stylesheet = source.match(/<link\b[^>]*\bhref="([^"]+\.css)"[^>]*>/i)
if (!bundle || !stylesheet) throw new Error('Build the application before creating its standalone HTML.')
const [js, css, notices] = await Promise.all([
  readFile(new URL(bundle[1], dist), 'utf8'),
  readFile(new URL(stylesheet[1], dist), 'utf8'),
  readFile(new URL('third-party-notices.txt', dist), 'utf8'),
])
const html = source
  .replace(bundle[0], () => '<script type="module">\n' + js.replace(/<\/script/gi, '<\\/script') + '\n</script>')
  .replace(stylesheet[0], () => '<style>\n' + css + '\n</style>')
const target = resolve(process.argv[2] ?? 'tower-builder.html')
await writeFile(target, html.replace('<!doctype html>', () => '<!doctype html>\n<!--\n' + notices + '-->'))
console.log(target)
