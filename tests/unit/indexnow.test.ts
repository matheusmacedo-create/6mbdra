import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { SITE } from '../../src/config/site.mjs'
import { caminhoLocal, conferirChaveNoAr, ehPreview, enviar, impressaoDigital, planejar, urlsDoSitemap } from '../../scripts/indexnow.mjs'

/**
 * IndexNow e Bing Webmaster Tools.
 *
 * O que não pode quebrar em silêncio: a chave publicada precisa ser a mesma que o script envia (senão
 * o Bing responde 403 e ninguém vê); "mudou" precisa ignorar o hash dos assets (senão todo deploy
 * reenvia o site inteiro e o Bing passa a ignorar os envios); e um preview nunca pode ser enviado.
 */
const raiz = process.cwd()
const DIST = join(raiz, 'dist')
const chave = SITE.indexNow.chave as string

describe('chave e verificação publicadas no build', () => {
  it('a chave tem o formato que o protocolo aceita', () => {
    expect(chave).toMatch(/^[a-f0-9-]{8,128}$/)
  })

  it('/<chave>.txt existe no dist/ e contém exatamente a chave', () => {
    const arquivo = join(DIST, `${chave}.txt`)
    expect(existsSync(arquivo), `${chave}.txt não foi gerado — ver src/pages/[chave].txt.ts`).toBe(true)
    expect(readFileSync(arquivo, 'utf8').trim()).toBe(chave)
  })

  it('a chave não entra no sitemap: é prova de posse, não conteúdo', () => {
    expect(readFileSync(join(DIST, 'sitemap-0.xml'), 'utf8')).not.toContain(`${chave}.txt`)
  })

  it('a página inicial traz a meta tag de verificação do Bing', () => {
    const home = readFileSync(join(DIST, 'index.html'), 'utf8')
    expect(home).toContain(`<meta name="msvalidate.01" content="${SITE.verificacao.bing}"`)
    expect(SITE.verificacao.bing).toMatch(/^[A-F0-9]{32}$/)
  })

  it('o deploy planeja antes de publicar e envia depois; o plano não é versionado', () => {
    const pkg = JSON.parse(readFileSync(join(raiz, 'package.json'), 'utf8'))
    const deploy: string = pkg.scripts.deploy
    expect(deploy.indexOf('indexnow.mjs plan')).toBeGreaterThan(-1)
    expect(deploy.indexOf('indexnow.mjs plan')).toBeLessThan(deploy.indexOf('wrangler'))
    expect(deploy.indexOf('indexnow.mjs submit')).toBeGreaterThan(deploy.indexOf('wrangler'))
    expect(readFileSync(join(raiz, '.gitignore'), 'utf8')).toMatch(/^\.cache\/$/m)
  })
})

describe('o que conta como "mudou"', () => {
  const pagina = (titulo: string, texto: string, asset: string) =>
    `<html><head><title>${titulo}</title><meta name="description" content="d"><script src="/_astro/App.${asset}.js"></script></head><body><main><p>${texto}</p><astro-island component-url="/_astro/Ilha.${asset}.js"><script>x()</script></astro-island></main><footer>rodapé</footer></body></html>`

  it('trocar o hash dos assets não é mudança', () => {
    expect(impressaoDigital(pagina('t', 'a', 'AAA111'))).toBe(impressaoDigital(pagina('t', 'a', 'BBB222')))
  })

  it('trocar o texto, o título ou a descrição é mudança', () => {
    expect(impressaoDigital(pagina('t', 'a', 'X'))).not.toBe(impressaoDigital(pagina('t', 'b', 'X')))
    expect(impressaoDigital(pagina('t1', 'a', 'X'))).not.toBe(impressaoDigital(pagina('t2', 'a', 'X')))
    expect(impressaoDigital(pagina('t', 'a', 'X').replace('content="d"', 'content="e"'))).not.toBe(impressaoDigital(pagina('t', 'a', 'X')))
  })

  it('o rodapé fica de fora: ele muda em todas as páginas ao mesmo tempo', () => {
    expect(impressaoDigital(pagina('t', 'a', 'X').replace('rodapé', 'outro'))).toBe(impressaoDigital(pagina('t', 'a', 'X')))
  })
})

describe('plano contra o site no ar', () => {
  const urls = urlsDoSitemap(DIST)

  it('lê todas as URLs do sitemap construído', () => {
    expect(urls.length).toBeGreaterThan(150)
    expect(urls.every((u) => u.startsWith(SITE.url) && u.endsWith('/'))).toBe(true)
    expect(existsSync(caminhoLocal(urls[0], DIST))).toBe(true)
  })

  it('classifica nova, alterada, removida, igual e desconhecida', async () => {
    const [igual, alterada, nova, quebrada] = urls.slice(0, 4)
    const removida = `${SITE.url}/tribunais/nao-existe-mais/`
    const html = (u: string) => readFileSync(caminhoLocal(u, DIST), 'utf8')
    const resposta = (status: number, corpo = '') => ({ ok: status < 300, status, text: async () => corpo })
    const fetchFalso = async (url: string) => {
      if (url.endsWith('/sitemap-index.xml')) return resposta(200, `<loc>${SITE.url}/sitemap-0.xml</loc>`)
      if (url.endsWith('/sitemap-0.xml')) return resposta(200, [...urls, removida].map((u) => `<loc>${u}</loc>`).join(''))
      if (url === alterada) return resposta(200, html(url).replace('<main', '<main><p>texto novo no ar</p><span'))
      if (url === nova) return resposta(404)
      if (url === quebrada) throw new Error('rede caiu')
      return resposta(200, html(url))
    }
    const plano = await planejar({ dist: DIST, siteUrl: SITE.url, fetch: fetchFalso as unknown as typeof fetch })
    expect(plano.motivos[igual]).toBe('igual')
    expect(plano.motivos[alterada]).toBe('mudou')
    expect(plano.motivos[nova]).toBe('nova')
    expect(plano.motivos[quebrada]).toBe('desconhecida')
    expect(plano.motivos[removida]).toBe('removida')
    expect(plano.urls).toContain(alterada)
    expect(plano.urls).toContain(removida)
    expect(plano.urls).not.toContain(igual)
    expect(plano.resumo.igual).toBe(urls.length - 3)
  })
})

describe('envio', () => {
  it('manda host, chave, keyLocation e a lista, e aceita 200 ou 202', async () => {
    const chamadas: { url: string; body: Record<string, unknown> }[] = []
    const fetchFalso = async (url: string, init: { body: string }) => {
      chamadas.push({ url, body: JSON.parse(init.body) })
      return { status: 202, text: async () => '' }
    }
    const { enviadas, status } = await enviar({ urls: [`${SITE.url}/a/`, `${SITE.url}/b/`], chave, siteUrl: SITE.url, fetch: fetchFalso as unknown as typeof fetch })
    expect(enviadas).toBe(2)
    expect(status).toBe(202)
    expect(chamadas[0].url).toBe('https://api.indexnow.org/indexnow')
    expect(chamadas[0].body).toMatchObject({ host: new URL(SITE.url).host, key: chave, keyLocation: `${SITE.url}/${chave}.txt` })
    expect(chamadas[0].body.urlList).toHaveLength(2)
  })

  it('explica o 403 em vez de só repetir o número', async () => {
    const fetchFalso = async () => ({ status: 403, text: async () => '' })
    await expect(enviar({ urls: [`${SITE.url}/a/`], chave, siteUrl: SITE.url, fetch: fetchFalso as unknown as typeof fetch })).rejects.toThrow(/chave inválida/)
  })

  it('confere a chave no ar antes, e desiste com mensagem quando ela não bate', async () => {
    const certo = async () => ({ ok: true, status: 200, text: async () => `${chave}\n` })
    await expect(conferirChaveNoAr({ chave, siteUrl: SITE.url, fetch: certo as unknown as typeof fetch, tentativas: 1, espera: 0 })).resolves.toBe(`${SITE.url}/${chave}.txt`)
    const errado = async () => ({ ok: true, status: 200, text: async () => 'outra' })
    await expect(conferirChaveNoAr({ chave, siteUrl: SITE.url, fetch: errado as unknown as typeof fetch, tentativas: 2, espera: 0 })).rejects.toThrow(/não está no ar/)
  })

  it('preview nunca é enviado', () => {
    expect(ehPreview('https://abc123.brpdf.pages.dev')).toBe(true)
    expect(ehPreview('https://6mb.matheus.workers.dev')).toBe(true)
    expect(ehPreview('http://localhost:4329')).toBe(true)
    expect(ehPreview('https://brpdf.com')).toBe(false)
  })
})
