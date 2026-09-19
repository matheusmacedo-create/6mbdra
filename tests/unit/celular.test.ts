import { describe, expect, it, vi } from 'vitest'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

vi.mock('../../src/tool/lib/analytics', () => ({ track: vi.fn() }))
import { track } from '../../src/tool/lib/analytics'
import { criarTelaAcesa } from '../../src/tool/lib/telaAcesa'
import { compartilharArquivos, paraFile, podeCompartilharArquivos } from '../../src/tool/lib/compartilhar'

/**
 * O que o celular precisa e o desktop nunca cobrou.
 *
 * Medido antes: 11 dos 14 primeiros visitantes humanos vieram pelo celular, e nenhum concluiu um
 * lote. Três coisas que só existem no celular: a tela apaga no meio do processamento, o resultado
 * precisa ir para o WhatsApp sem passar por "Arquivos", e o site vira ícone na tela inicial.
 */

type Sentinela = { release(): Promise<void>; addEventListener(t: string, f: () => void): void }
function navegadorComLock(recusa = false) {
  const chamadas: string[] = []
  const ouvintes: (() => void)[] = []
  const nav = {
    wakeLock: {
      request: async (tipo: string): Promise<Sentinela> => {
        chamadas.push(`request:${tipo}`)
        if (recusa) throw new DOMException('recusado', 'NotAllowedError')
        return {
          release: async () => {
            chamadas.push('release')
            ouvintes.splice(0).forEach((f) => f())
          },
          addEventListener: (_t, f) => ouvintes.push(f),
        }
      },
    },
  } as unknown as Navigator
  /** O que o navegador faz sozinho ao esconder a página: solta o lock e avisa. */
  const navegadorSoltou = () => ouvintes.splice(0).forEach((f) => f())
  return { nav, chamadas, navegadorSoltou }
}
function documento(estado: 'visible' | 'hidden' = 'visible') {
  const ouvintes = new Set<() => void>()
  const doc = {
    visibilityState: estado,
    addEventListener: (_t: string, f: () => void) => ouvintes.add(f),
    removeEventListener: (_t: string, f: () => void) => ouvintes.delete(f),
    mudar(e: 'visible' | 'hidden') {
      doc.visibilityState = e
      ouvintes.forEach((f) => f())
    },
    quantosOuvem: () => ouvintes.size,
  }
  return doc
}
const d = (x: ReturnType<typeof documento>) => x as unknown as Document

describe('tela acesa durante o lote', () => {
  it('pede o lock ao começar e solta ao terminar', async () => {
    const { nav, chamadas } = navegadorComLock()
    const tela = criarTelaAcesa(nav, d(documento()))
    expect(tela.suportada).toBe(true)
    await tela.manter()
    expect(chamadas).toEqual(['request:screen'])
    expect(tela.ativa).toBe(true)
    await tela.soltar()
    expect(chamadas).toEqual(['request:screen', 'release'])
    expect(tela.ativa).toBe(false)
  })

  it('quando a pessoa volta para a aba, pede de novo — o navegador soltou sozinho ao esconder', async () => {
    const { nav, chamadas, navegadorSoltou } = navegadorComLock()
    const doc = documento()
    const tela = criarTelaAcesa(nav, d(doc))
    await tela.manter()
    doc.mudar('hidden')
    navegadorSoltou()
    expect(tela.ativa).toBe(false)
    doc.mudar('visible')
    await new Promise((r) => setTimeout(r, 0))
    expect(chamadas.filter((c) => c === 'request:screen')).toHaveLength(2)
    expect(tela.ativa).toBe(true)
    await tela.soltar()
    expect(doc.quantosOuvem(), 'ouvinte de visibilidade esquecido').toBe(0)
  })

  it('com a página escondida, espera ela voltar em vez de pedir à toa', async () => {
    const { nav, chamadas } = navegadorComLock()
    const doc = documento('hidden')
    const tela = criarTelaAcesa(nav, d(doc))
    await tela.manter()
    expect(chamadas).toEqual([])
    doc.mudar('visible')
    await new Promise((r) => setTimeout(r, 0))
    expect(chamadas).toEqual(['request:screen'])
  })

  it('sem suporte ou com recusa, o lote segue e nada quebra', async () => {
    const semLock = criarTelaAcesa({} as Navigator, d(documento()))
    expect(semLock.suportada).toBe(false)
    await expect(semLock.manter()).resolves.toBeUndefined()
    expect(semLock.ativa).toBe(false)
    await expect(semLock.soltar()).resolves.toBeUndefined()

    const { nav } = navegadorComLock(true)
    const recusado = criarTelaAcesa(nav, d(documento()))
    await expect(recusado.manter()).resolves.toBeUndefined()
    expect(recusado.ativa).toBe(false)
  })
})

describe('compartilhar pela folha do sistema', () => {
  const pdf = { name: 'peticao_otimizada.pdf', bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]), size: 5, kind: 'compressed' as const }

  it('só oferece quando o navegador compartilha arquivos, não só links', () => {
    expect(podeCompartilharArquivos({} as Navigator)).toBe(false)
    expect(podeCompartilharArquivos({ share: async () => {} } as unknown as Navigator)).toBe(false)
    const perguntas: ShareData[] = []
    const comArquivos = { share: async () => {}, canShare: (dados: ShareData) => (perguntas.push(dados), true) } as unknown as Navigator
    expect(podeCompartilharArquivos(comArquivos)).toBe(true)
    expect(perguntas[0].files?.[0]?.type).toBe('application/pdf')
    const soLinks = { share: async () => {}, canShare: () => false } as unknown as Navigator
    expect(podeCompartilharArquivos(soLinks)).toBe(false)
    const quebrado = { share: async () => {}, canShare: () => { throw new TypeError('x') } } as unknown as Navigator
    expect(podeCompartilharArquivos(quebrado)).toBe(false)
  })

  it('manda os PDFs como arquivos e conta o envio uma vez', async () => {
    vi.mocked(track).mockClear()
    let recebido: ShareData | undefined
    const nav = { share: async (dados: ShareData) => { recebido = dados } } as unknown as Navigator
    const files = [paraFile(pdf), paraFile({ ...pdf, name: 'anexo_parte_02.pdf' })]
    await expect(compartilharArquivos(files, 'lote', nav)).resolves.toBe('enviado')
    expect(recebido?.files?.map((f) => f.name)).toEqual(['peticao_otimizada.pdf', 'anexo_parte_02.pdf'])
    expect(recebido?.files?.every((f) => f.type === 'application/pdf')).toBe(true)
    expect(track).toHaveBeenCalledTimes(1)
    expect(track).toHaveBeenCalledWith('compartilhou', { tipo: 'lote', quantidade: 2 })
  })

  it('fechar a folha é "cancelado", não erro, e não conta', async () => {
    vi.mocked(track).mockClear()
    const cancela = { share: async () => { throw new DOMException('fechou', 'AbortError') } } as unknown as Navigator
    await expect(compartilharArquivos([paraFile(pdf)], 'arquivo', cancela)).resolves.toBe('cancelado')
    const falha = { share: async () => { throw new DOMException('sem gesto', 'NotAllowedError') } } as unknown as Navigator
    await expect(compartilharArquivos([paraFile(pdf)], 'arquivo', falha)).resolves.toBe('falhou')
    await expect(compartilharArquivos([], 'lote', cancela)).resolves.toBe('falhou')
    expect(track).not.toHaveBeenCalled()
  })

  it('paraFile preserva nome, tipo e bytes', () => {
    const f = paraFile(pdf)
    expect(f.name).toBe('peticao_otimizada.pdf')
    expect(f.type).toBe('application/pdf')
    expect(f.size).toBe(5)
  })
})

describe('tela inicial do celular', () => {
  const DIST = join(process.cwd(), 'dist')
  const png = (nome: string) => {
    const b = readFileSync(join(DIST, nome))
    expect(b.subarray(1, 4).toString(), `${nome} não é PNG`).toBe('PNG')
    return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) }
  }

  it('o manifest é válido e cada ícone existe no tamanho declarado', () => {
    const m = JSON.parse(readFileSync(join(DIST, 'manifest.webmanifest'), 'utf8'))
    expect(m.short_name).toBe('brpdf')
    expect(m.lang).toBe('pt-BR')
    // minimal-ui, não standalone: no modo app do iOS o download de Blob é instável, e baixar é o que a ferramenta faz.
    expect(m.display).toBe('minimal-ui')
    expect(m.icons.length).toBeGreaterThanOrEqual(2)
    for (const icone of m.icons) {
      const [w, h] = String(icone.sizes).split('x').map(Number)
      expect(existsSync(join(DIST, icone.src)), `falta ${icone.src}`).toBe(true)
      expect(png(icone.src)).toEqual({ w, h })
      expect(icone.type).toBe('image/png')
    }
    expect(m.icons.some((i: { purpose?: string }) => /maskable/.test(i.purpose ?? ''))).toBe(true)
  })

  it('o iOS tem ícone próprio de 180×180; o SVG não serve para ele', () => {
    expect(png('apple-touch-icon.png')).toEqual({ w: 180, h: 180 })
  })

  it('toda página aponta para o ícone e para o manifest, e libera a área segura do iPhone', () => {
    const home = readFileSync(join(DIST, 'index.html'), 'utf8')
    const tribunal = readFileSync(join(DIST, 'tribunais', 'tjsp-esaj', 'index.html'), 'utf8')
    for (const html of [home, tribunal]) {
      expect(html).toContain('<link rel="apple-touch-icon" href="/apple-touch-icon.png">')
      expect(html).toContain('<link rel="manifest" href="/manifest.webmanifest">')
      expect(html).toMatch(/<meta name="viewport" content="[^"]*viewport-fit=cover"/)
      expect(html).toContain('<meta name="apple-mobile-web-app-title" content="brpdf">')
    }
    const css = readdirSync(join(DIST, '_astro')).filter((f) => f.endsWith('.css')).map((f) => readFileSync(join(DIST, '_astro', f), 'utf8')).join('\n')
    expect(css).toContain('safe-area-inset-bottom')
  })
})
