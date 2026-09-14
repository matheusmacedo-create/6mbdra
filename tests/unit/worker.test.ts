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
