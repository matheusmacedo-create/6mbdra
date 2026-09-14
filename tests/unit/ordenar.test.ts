import { describe, expect, it } from 'vitest'
import { classificar, compararNomes, ordenarPorNome } from '../../src/tool/lib/ordenar'

const ordem = (nomes: string[]) => ordenarPorNome(nomes, (n) => n)

describe('numeração escrita pela pessoa manda', () => {
  it('respeita o prefixo numérico mesmo contra a convenção do tipo', () => {
    // A procuração está numerada como 1: vai antes da petição, porque quem numerou decidiu.
    expect(ordem(['02 - Peticao inicial.pdf', '01 - Procuracao.pdf'])).toEqual(['01 - Procuracao.pdf', '02 - Peticao inicial.pdf'])
  })

  it('entende os separadores mais comuns', () => {
    for (const nome of ['1 - doc.pdf', '1. doc.pdf', '1) doc.pdf', '1_doc.pdf', '01 doc.pdf']) {
      expect(classificar(nome).numero, nome).toBe(1)
    }
  })

  it('ordena por valor, não por texto: 2 vem antes de 10', () => {
    expect(ordem(['10 - anexo.pdf', '2 - anexo.pdf'])).toEqual(['2 - anexo.pdf', '10 - anexo.pdf'])
  })

  it('quem está numerado vem antes de quem não está', () => {
    expect(ordem(['procuracao.pdf', '3 - rg.pdf'])).toEqual(['3 - rg.pdf', 'procuracao.pdf'])
  })

  it('não confunde número que faz parte do nome', () => {
    expect(classificar('contrato 2024 assinado.pdf').numero).toBe(undefined)
    expect(classificar('cnh.pdf').numero).toBe(undefined)
  })
})

describe('sem numeração, vale a ordem de uma petição', () => {
  it('põe a peça primeiro e as guias por último', () => {
    const entrada = ['guia de custas.pdf', 'rg do autor.pdf', 'procuracao.pdf', 'peticao inicial.pdf', 'comprovante de residencia.pdf']
    expect(ordem(entrada)).toEqual([
      'peticao inicial.pdf',
      'procuracao.pdf',
      'rg do autor.pdf',
      'comprovante de residencia.pdf',
      'guia de custas.pdf',
    ])
  })

  it('reconhece o tipo com ou sem acento', () => {
    expect(classificar('petição inicial.pdf').rotulo).toBe('peça')
    expect(classificar('peticao inicial.pdf').rotulo).toBe('peça')
    expect(classificar('PROCURAÇÃO.pdf').rotulo).toBe('procuração')
  })

  it('coloca substabelecimento logo depois da procuração', () => {
    expect(ordem(['substabelecimento.pdf', 'procuracao.pdf'])).toEqual(['procuracao.pdf', 'substabelecimento.pdf'])
  })

  it('reconhece as peças de defesa e recurso, não só a inicial', () => {
    for (const nome of ['contestacao.pdf', 'recurso de apelacao.pdf', 'agravo de instrumento.pdf', 'embargos.pdf']) {
      expect(classificar(nome).rotulo, nome).toBe('peça')
    }
  })
})

describe('empates e casos sem tipo', () => {
  it('desconhecidos ficam entre as provas nomeadas e os anexos', () => {
    expect(ordem(['anexo 1.pdf', 'scan0001.pdf', 'certidao.pdf'])).toEqual(['certidao.pdf', 'scan0001.pdf', 'anexo 1.pdf'])
  })

  it('no empate usa ordem natural do nome', () => {
    expect(ordem(['scan10.pdf', 'scan2.pdf'])).toEqual(['scan2.pdf', 'scan10.pdf'])
  })

  it('é estável e não muda a lista original', () => {
    const original = ['b.pdf', 'a.pdf']
    const saida = ordenarPorNome(original, (n) => n)
    expect(original).toEqual(['b.pdf', 'a.pdf'])
    expect(saida).toEqual(['a.pdf', 'b.pdf'])
  })

  it('compararNomes devolve 0 para o mesmo nome', () => {
    expect(compararNomes('procuracao.pdf', 'procuracao.pdf')).toBe(0)
  })
})
