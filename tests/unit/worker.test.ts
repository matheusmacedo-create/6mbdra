import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * O redirecionamento de www vive no Worker, então não dá para importá-lo aqui (ele usa tipos do
 * runtime da Cloudflare). O que este teste garante é a regra em si, com a mesma implementação:
 * qualquer host começando com "www." vai para o mesmo endereço sem ele, preservando o resto.
 */
function semWww(entrada: string): string | null {
  const url = new URL(entrada)
  if (!url.hostname.startsWith('www.')) return null
  const destino = new URL(url)
  destino.hostname = url.hostname.slice(4)
  return destino.toString()
}

describe('www vai para o endereço canônico', () => {
  it('redireciona a raiz', () => {
    expect(semWww('https://www.brpdf.com/')).toBe('https://brpdf.com/')
  })

  it('preserva caminho e query', () => {
    expect(semWww('https://www.brpdf.com/tribunais/tjsp-esaj/?view=tool')).toBe('https://brpdf.com/tribunais/tjsp-esaj/?view=tool')
  })

  it('não mexe em quem já está no endereço certo', () => {
    expect(semWww('https://brpdf.com/guias/')).toBeNull()
    expect(semWww('https://6mb.6mb-app.workers.dev/')).toBeNull()
    expect(semWww('http://localhost:8788/painel/')).toBeNull()
  })

  it('não confunde um host que só começa com as mesmas letras', () => {
    expect(semWww('https://wwwbrpdf.com/')).toBeNull()
  })
})

describe('o Worker usa essa mesma regra', () => {
  it('redireciona antes de qualquer outra rota', () => {
    const fonte = readFileSync(join(process.cwd(), 'src', 'worker', 'index.ts'), 'utf8')
    const corpo = /async fetch\(req: Request, env: Env,? ?[^)]*\): Promise<Response> \{([\s\S]*?)\n  \},/.exec(fonte)?.[1] ?? ''
    expect(corpo, 'não achei o corpo do fetch do Worker').not.toBe('')
    const posRedirect = corpo.indexOf('semWww(url)')
    const posApi = corpo.indexOf("'/api/e'")
    const posAssets = corpo.indexOf('env.ASSETS.fetch')
    expect(posRedirect, 'o Worker precisa chamar semWww()').toBeGreaterThanOrEqual(0)
    expect(posRedirect, 'o redirecionamento vem antes das rotas de API').toBeLessThan(posApi)
    expect(posRedirect, 'o redirecionamento vem antes dos arquivos estáticos').toBeLessThan(posAssets)
  })

  it('conta rastreador fora do caminho da resposta', () => {
    const fonte = readFileSync(join(process.cwd(), 'src', 'worker', 'index.ts'), 'utf8')
    const corpo = /async fetch\(req: Request, env: Env,? ?[^)]*\): Promise<Response> \{([\s\S]*?)\n  \},/.exec(fonte)?.[1] ?? ''
    // waitUntil: a página não espera o banco. Sem isso, D1 lento vira site lento.
    expect(corpo, 'a contagem precisa rodar em ctx.waitUntil').toMatch(/ctx\.waitUntil\(contarRastreador/)
    // E depois do redirecionamento, para não contar duas vezes a mesma visita (www e raiz).
    expect(corpo.indexOf('semWww(url)')).toBeLessThan(corpo.indexOf('contarRastreador'))
  })
})

/**
 * Endereços que mudaram de nome.
 *
 * A verificação de assinatura nasceu em /conferir-assinatura/ e virou /verificar-assinatura-digital/
 * quando a página passou a usar a palavra que as pessoas buscam. O endereço antigo circulou, foi
 * indexado e recebia link de todas as páginas do site — deixá-lo morrer geraria 404 para quem
 * salvou e jogaria fora o que o buscador já tinha aprendido.
 */
const MUDARAM: Record<string, string> = {
  '/conferir-assinatura': '/verificar-assinatura-digital/',
  '/conferir-assinatura/': '/verificar-assinatura-digital/',
}
function mudouDeEndereco(entrada: string): string | null {
  const url = new URL(entrada)
  const destino = MUDARAM[url.pathname]
  if (!destino) return null
  const novo = new URL(destino, url)
  novo.search = url.search
  return novo.toString()
}

describe('endereço antigo continua chegando ao novo', () => {
  it('redireciona com e sem barra no fim', () => {
    expect(mudouDeEndereco('https://brpdf.com/conferir-assinatura/')).toBe('https://brpdf.com/verificar-assinatura-digital/')
    expect(mudouDeEndereco('https://brpdf.com/conferir-assinatura')).toBe('https://brpdf.com/verificar-assinatura-digital/')
  })

  it('preserva a query, que é como as campanhas marcam origem', () => {
    expect(mudouDeEndereco('https://brpdf.com/conferir-assinatura/?utm_source=x')).toBe(
      'https://brpdf.com/verificar-assinatura-digital/?utm_source=x',
    )
  })

  it('não mexe em nenhuma outra rota', () => {
    for (const r of ['/', '/verificar-assinatura-digital/', '/metadados-pdf/', '/guias/', '/api/e']) {
      expect(mudouDeEndereco(`https://brpdf.com${r}`), r).toBeNull()
    }
  })

  it('a tabela do Worker é exatamente esta', () => {
    // Se alguém acrescentar uma mudança de endereço lá e esquecer aqui, este teste avisa.
    const fonte = readFileSync(join(process.cwd(), 'src', 'worker', 'index.ts'), 'utf8')
    const bloco = /const MUDARAM: Record<string, string> = \{([\s\S]*?)\}/.exec(fonte)?.[1] ?? ''
    expect(bloco, 'não achei a tabela no Worker').not.toBe('')
    for (const rota of Object.keys(MUDARAM)) expect(bloco, rota).toContain(`'${rota}'`)
    const quantos = (bloco.match(/:/g) ?? []).length
    expect(quantos, 'o Worker tem mais mudanças de endereço do que este teste conhece').toBe(Object.keys(MUDARAM).length)
  })

  it('nenhuma página do site ainda aponta para o endereço antigo', () => {
    /*
     * O redirecionamento existe para links de FORA. Link interno apontando para o endereço antigo
     * é desperdício: obriga um salto a mais e dilui o sinal.
     */
    const { readdirSync, statSync } = require('node:fs') as typeof import('node:fs')
    const dist = join(process.cwd(), 'dist')
    const ruins: string[] = []
    const anda = (dir: string) => {
      for (const e of readdirSync(dir)) {
        const p = join(dir, e)
        if (statSync(p).isDirectory()) anda(p)
        else if (e.endsWith('.html') && readFileSync(p, 'utf8').includes('href="/conferir-assinatura/"')) {
          ruins.push('/' + p.slice(dist.length + 1))
        }
      }
    }
    anda(dist)
    expect(ruins, 'páginas apontando para o endereço antigo').toEqual([])
  })
})
