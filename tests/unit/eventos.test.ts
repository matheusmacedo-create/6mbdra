import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * A lista de eventos vive em dois lugares que não podem se importar: o tipo EventName no navegador
 * e a lista EVENTOS no Worker (runtime da Cloudflare, tipos próprios). Se uma mudar sem a outra, o
 * evento novo é silenciosamente descartado na ingestão — e ninguém percebe. Este teste lê os dois
 * arquivos e compara.
 */
const ler = (...partes: string[]) => readFileSync(join(process.cwd(), ...partes), 'utf8')

function nomesDoNavegador(): string[] {
  const fonte = ler('src', 'tool', 'lib', 'analytics.ts')
  // Termina na primeira linha em branco, e não num tipo vizinho pelo nome: inserir outro tipo
  // entre os dois fazia esta extração engolir a união seguinte inteira.
  const bloco = /export type EventName =([\s\S]*?)\n\n/.exec(fonte)
  expect(bloco, 'não achei o tipo EventName em analytics.ts').not.toBeNull()
  return [...bloco![1].matchAll(/\|\s*'([a-z_]+)'/g)].map((m) => m[1])
}

function nomesDoWorker(): string[] {
  const fonte = ler('src', 'worker', 'index.ts')
  const bloco = /const EVENTOS = new Set\(\[([\s\S]*?)\]\)/.exec(fonte)
  expect(bloco, 'não achei a lista EVENTOS no worker').not.toBeNull()
  return [...bloco![1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1])
}

describe('lista de eventos do navegador e do servidor', () => {
  it('tem os mesmos nomes dos dois lados', () => {
    const navegador = nomesDoNavegador()
    const worker = nomesDoWorker()
    expect(navegador.length).toBeGreaterThan(10)
    expect([...worker].sort()).toEqual([...navegador].sort())
  })

  it('não repete nome', () => {
    const navegador = nomesDoNavegador()
    expect(new Set(navegador).size).toBe(navegador.length)
  })

  it('cobre o funil inteiro, da chegada ao download', () => {
    const navegador = new Set(nomesDoNavegador())
    for (const etapa of ['acesso', 'abriu_ferramenta', 'regra_selecionada', 'arquivo_adicionado', 'lote_iniciado', 'arquivo_resultado', 'download']) {
      expect(navegador, `falta a etapa ${etapa}`).toContain(etapa)
    }
  })
})

describe('campos aceitos pelo worker', () => {
  const fonte = ler('src', 'worker', 'index.ts')
  const numeros = [...(/const NUMEROS = \[([^\]]*)\]/.exec(fonte)?.[1] ?? '').matchAll(/'([a-z_]+)'/g)].map((m) => m[1])
  const textos = [...(/const TEXTOS: Record<string, number> = \{([\s\S]*?)\n\}/.exec(fonte)?.[1] ?? '').matchAll(/^\s*([a-z_]+):/gm)].map((m) => m[1])

  it('grava cada campo numa coluna que existe na tabela', () => {
    const schema = ler('migrations', '0001_eventos.sql')
    for (const campo of [...numeros, ...textos]) {
      expect(schema, `a coluna ${campo} não existe em eventos`).toMatch(new RegExp(`^\\s*${campo}\\s+(TEXT|INTEGER|REAL)`, 'm'))
    }
  })

  it('CampoDeMedicao no navegador lista exatamente o que o worker grava', () => {
    /*
     * Enquanto EventProps era Record<string, …>, mandar um campo que o Worker não conhece
     * compilava, subia e sumia na ingestão sem erro nenhum — foi o que aconteceu com um `limiteMb`
     * que nunca virou linha. Agora o tipo é fechado, e este teste garante que ele não descole da
     * lista do servidor: campo novo exige os dois lados (e a coluna na migration, testada acima).
     */
    const analytics = ler('src', 'tool', 'lib', 'analytics.ts')
    const bloco = /export type CampoDeMedicao =([\s\S]*?)\n\n/.exec(analytics)
    expect(bloco, 'não achei o tipo CampoDeMedicao em analytics.ts').not.toBeNull()
    const noNavegador = [...bloco![1].matchAll(/\|\s*'([a-z_]+)'/g)].map((m) => m[1])
    expect([...noNavegador].sort()).toEqual([...numeros, ...textos].sort())
  })

  it('não aceita nenhum campo que possa carregar dado de documento', () => {
    for (const campo of [...numeros, ...textos]) {
      expect(campo).not.toMatch(/nome|name|file|path|processo|texto|conteudo|hash/i)
    }
  })
})
