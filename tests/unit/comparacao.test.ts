import { describe, expect, it } from 'vitest'
import { comparacao, nomeCurto, posicaoNoSistema, relacao, ufsDoTribunal } from '../../src/tool/lib/comparacao'
import { paginasDeRegras, tribunalPorSigla } from '../../src/tool/lib/regras'

/**
 * A comparação por estado existe para dar a cada página de tribunal texto e links que só ela tem.
 * O que estes testes travam: os estados são lidos certo (inclusive dos nomes com parêntese
 * aninhado), toda página de tribunal ganha vizinhos, e nenhuma lista aponta para a própria página.
 */
describe('estados de um tribunal', () => {
  const t = (sigla: string) => tribunalPorSigla(sigla)!

  it('lê o campo uf quando existe', () => {
    expect(ufsDoTribunal(t('TJMG'))).toEqual(['MG'])
    expect(ufsDoTribunal(t('TRE-BA'))).toEqual(['BA'])
    expect(ufsDoTribunal(t('TJMSP'))).toEqual(['SP'])
  })

  it('lê as siglas do parêntese nos TRTs e TRFs, inclusive com parêntese aninhado', () => {
    expect(ufsDoTribunal(t('TRT2'))).toEqual(['SP'])
    expect(ufsDoTribunal(t('TRT8')).sort()).toEqual(['AP', 'PA'])
    expect(ufsDoTribunal(t('TRF4')).sort()).toEqual(['PR', 'RS', 'SC'])
    expect(ufsDoTribunal(t('TRF1'))).toHaveLength(13)
  })

  it('tribunal superior não tem estado', () => {
    expect(ufsDoTribunal(t('STF'))).toEqual([])
    expect(ufsDoTribunal(t('TSE'))).toEqual([])
  })

  it('o nome curto tira o parêntese e mantém o nome inteiro', () => {
    expect(nomeCurto(t('TRT2'))).toBe('Tribunal Regional do Trabalho da 2ª Região')
    expect(nomeCurto(t('TJMG'))).toBe('Tribunal de Justiça do Estado de Minas Gerais')
  })
})

describe('vizinhos de cada página', () => {
  const todas = paginasDeRegras()

  it('toda página de tribunal tem pelo menos dois vizinhos', () => {
    const sem = todas.filter((p) => (comparacao(p, todas)?.itens.length ?? 0) < 2).map((p) => p.tribunal.sigla)
    expect(sem, 'páginas sem comparação').toEqual([])
  })

  it('nenhuma lista inclui o próprio tribunal nem repete página', () => {
    for (const p of todas) {
      const c = comparacao(p, todas)!
      expect(c.itens.some((v) => v.pagina.tribunal.sigla === p.tribunal.sigla), p.tribunal.sigla).toBe(false)
      expect(new Set(c.itens.map((v) => v.id)).size).toBe(c.itens.length)
    }
  })

  it('num estado, a lista traz as justiças que atendem aquele estado', () => {
    const treBa = todas.find((p) => p.tribunal.sigla === 'TRE-BA')!
    const c = comparacao(treBa, todas)!
    expect(c.escopo).toBe('estado')
    expect(c.titulo).toBe('Outros tribunais na Bahia')
    const siglas = new Set(c.itens.map((v) => v.pagina.tribunal.sigla))
    expect(siglas).toContain('TJBA')
    expect(siglas).toContain('TRT5')
    expect(siglas).toContain('TRF1')
    expect(siglas).not.toContain('TRE-SP')
  })

  it('tribunal de muitos estados lista um tribunal por estado, não o diretório inteiro', () => {
    const trf1 = todas.find((p) => p.tribunal.sigla === 'TRF1')! // 13 estados
    const c = comparacao(trf1, todas)!
    expect(c.escopo).toBe('regiao')
    const siglas = c.itens.map((v) => v.pagina.tribunal.sigla)
    // Um TJ por estado que tem TJ com regra…
    expect(siglas.filter((x) => x === 'TJBA')).toHaveLength(1)
    // …e, onde o TJ não tem regra (Amapá), os outros tribunais do estado no lugar dele.
    expect(siglas).toContain('TRE-AP')
    expect(siglas).not.toContain('TJAP')
    expect(c.itens.length).toBeLessThanOrEqual(20)
  })

  it('tribunal de poucos estados lista todas as justiças desses estados', () => {
    const trt8 = todas.find((p) => p.tribunal.sigla === 'TRT8')! // PA e AP
    const c = comparacao(trt8, todas)!
    expect(c.escopo).toBe('regiao')
    expect(c.intro).toContain('Pará e Amapá')
    const siglas = new Set(c.itens.map((v) => v.pagina.tribunal.sigla))
    expect(siglas).toContain('TJPA')
    expect(siglas).toContain('TRE-AP')
  })

  it('as 27 páginas de TRE recebem listas diferentes entre si', () => {
    const tres = todas.filter((p) => p.tribunal.ramo === 'eleitoral' && p.tribunal.sigla.startsWith('TRE-'))
    expect(tres.length).toBe(27)
    const assinaturas = new Set(tres.map((p) => comparacao(p, todas)!.itens.map((v) => v.id).join('|')))
    expect(assinaturas.size, 'TREs com a mesma lista de vizinhos').toBe(27)
  })

  it('o resumo diz o menor e o maior limite do grupo, contando a própria página', () => {
    const tjam = todas.find((p) => p.regra.id === 'tjam-esaj')! // 1 MB, o menor do estado
    const c = comparacao(tjam, todas)!
    expect(c.resumo).toMatch(/^No Amazonas, o menor limite por arquivo é 1 MB \(TJAM no e-SAJ\) e o maior, /)
  })

  it('a relação entre limites é dita em palavras exatas', () => {
    const tjam = todas.find((p) => p.regra.id === 'tjam-esaj')! // 1 MB
    const tjac = todas.find((p) => p.regra.id === 'tjac-esaj')! // 3 MB
    const tjal = todas.find((p) => p.regra.id === 'tjal-esaj')! // 1 MB
    expect(relacao(tjam, tjac)).toBe('3× o limite daqui')
    expect(relacao(tjac, tjam)).toBe('1/3 do limite daqui')
    expect(relacao(tjam, tjal)).toBe('o mesmo limite')
  })
})

describe('posição no sistema', () => {
  const todas = paginasDeRegras()

  it('conta regras próprias, então a regra nacional do TSE entra uma vez', () => {
    const treBa = todas.find((p) => p.tribunal.sigla === 'TRE-BA')!
    const pos = posicaoNoSistema(treBa, todas)!
    expect(pos.total).toBeLessThan(30)
    expect(pos.menores + pos.maiores).toBeLessThan(pos.total)
  })

  it('sistema com menos de três regras não tem posição', () => {
    const stj = todas.find((p) => p.regra.id === 'stj-e-stj')!
    expect(posicaoNoSistema(stj, todas)).toBeUndefined()
  })
})
