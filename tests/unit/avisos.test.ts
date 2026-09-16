import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

/**
 * Captura de e-mail para o aviso de mudança de regra.
 *
 * Estes testes existem menos para provar que o formulário funciona e mais para impedir que ele
 * vire outra coisa. A ideia original era um popup bloqueante no primeiro uso; a versão que foi ao
 * ar é inline, opcional e posterior ao valor entregue. A diferença entre as duas é o motivo de
 * alguém escolher este site, e é fácil de perder numa "otimização de conversão" futura.
 */
const DIST = join(process.cwd(), 'dist')
const html = (r: string) => readFileSync(join(DIST, r, 'index.html'), 'utf8')

function paginas(): { rota: string; html: string }[] {
  const saida: { rota: string; html: string }[] = []
  const anda = (dir: string) => {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e)
      if (statSync(p).isDirectory()) anda(p)
      else if (e.endsWith('.html')) saida.push({ rota: '/' + p.slice(DIST.length + 1).replace(/index\.html$/, ''), html: readFileSync(p, 'utf8') })
    }
  }
  anda(DIST)
  return saida
}

describe('a captura de e-mail não vira popup', () => {
  const todas = paginas()

  it('nenhuma página abre sobreposição pedindo e-mail', () => {
    /*
     * O sinal de popup é o elemento que cobre a página: <dialog>, position:fixed com formulário,
     * ou um overlay. Nada disso pode existir junto de um campo de e-mail — se existir, alguém
     * trocou o bloco inline por uma barreira.
     */
    const ruins = todas
      .filter((p) => /<dialog|modal-overlay|data-popup/i.test(p.html))
      .filter((p) => /type="email"/.test(p.html))
      .map((p) => p.rota)
    expect(ruins, 'páginas com sobreposição pedindo e-mail').toEqual([])
  })

  it('o formulário não aparece na home nem nas páginas de ferramenta', () => {
    /*
     * A regra de ouro da decisão: nada é pedido enquanto a pessoa está tentando resolver o
     * problema dela. O bloco vive onde a informação já foi entregue — páginas de tribunal.
     */
    const ferramentas = ['/', '/comprimir-pdf/', '/dividir-pdf/', '/juntar-pdf/', '/verificar-assinatura-digital/', '/metadados-pdf/', '/documento-feito-por-ia/']
    const ruins = ferramentas
      .map((r) => todas.find((p) => p.rota === r))
      .filter((p): p is NonNullable<typeof p> => !!p)
      .filter((p) => /data-aviso\b/.test(p.html))
      .map((p) => p.rota)
    expect(ruins, 'páginas de ferramenta pedindo e-mail').toEqual([])
  })

  it('o site continua podendo prometer "sem cadastro"', () => {
    /*
     * 116 páginas prometem isso. A promessa só continua verdadeira porque nada na página depende
     * do e-mail — o bloco é uma folha. A prova é destrutiva: arrancar o bloco inteiro de uma
     * página não pode tirar nada dela. O campo tem `required` (validação nativa do próprio
     * formulário, num <form novalidate>), o que não é o mesmo que exigir o e-mail para liberar
     * conteúdo; o que este teste proíbe é a segunda coisa.
     */
    const p = todas.find((x) => x.rota === '/tribunais/tjsp-esaj/')!
    const semBloco = p.html.replace(/<section class="aviso-regra"[\s\S]*?<\/section>/, '')
    expect(semBloco, 'a resposta da página sumiu junto com o bloco').toMatch(/<table/)
    expect(semBloco, 'o limite sumiu junto com o bloco').toMatch(/Limite por arquivo/)
    // Fora do <script> que o anima, nenhum outro elemento pode estar pendurado nele.
    const marcacao = semBloco.replace(/<script[\s\S]*?<\/script>/g, '')
    expect(marcacao, 'sobrou elemento pendurado no bloco').not.toMatch(/data-aviso/)

    // E nenhuma página esconde ou trava conteúdo esperando o e-mail.
    const ruins = todas
      .filter((x) => /data-aviso\b/.test(x.html))
      .filter((x) => /\b(hidden|inert|disabled)[^<>]{0,60}data-aviso\b|data-aviso\b[^<>]{0,60}\b(hidden|inert)\b/.test(x.html))
      .map((x) => x.rota)
    expect(ruins, 'páginas que travam conteúdo esperando o e-mail').toEqual([])

    // E a promessa segue escrita.
    expect(todas.filter((x) => /sem cadastro/i.test(x.html)).length).toBeGreaterThan(100)
  })

  it('aparece nas páginas de tribunal, que é onde a oferta faz sentido', () => {
    const tribunais = todas.filter((p) => /^\/tribunais\/[^/]+\/$/.test(p.rota))
    expect(tribunais.length).toBeGreaterThan(90)
    const sem = tribunais.filter((p) => !/data-aviso\b/.test(p.html)).map((p) => p.rota)
    expect(sem, 'páginas de tribunal sem a oferta').toEqual([])
  })

  it('vem depois do conteúdo, nunca antes da resposta', () => {
    const p = todas.find((x) => x.rota === '/tribunais/tjsp-esaj/')!
    expect(p.html.indexOf('data-aviso')).toBeGreaterThan(p.html.indexOf('<table'))
  })
})

describe('o consentimento é registrável e reversível', () => {
  const todas = paginas()

  it('o texto aceito viaja junto, para virar prova', () => {
    /*
     * Guardar só o e-mail e a data provaria que alguém se inscreveu, não em quê consentiu. Se a
     * copy mudar amanhã, a prova do que cada um leu precisa continuar correta.
     */
    const p = todas.find((x) => x.rota === '/tribunais/tjsp-esaj/')!
    expect(p.html).toMatch(/data-consentimento="[^"]{40,}"/)
    expect(p.html).toMatch(/data-consentimento="[^"]*cancelar/i)
  })

  it('existe página de cancelamento, fora do índice e do sitemap', () => {
    const c = html('cancelar-aviso')
    expect(c).toMatch(/name="robots" content="noindex"/)
    expect(readFileSync(join(DIST, 'sitemap-0.xml'), 'utf8')).not.toContain('cancelar-aviso')
    expect(readFileSync(join(DIST, 'robots.txt'), 'utf8')).toContain('Disallow: /cancelar-aviso/')
  })

  it('o cancelamento não usa GET', () => {
    /*
     * Pré-carregador de link e antivírus de e-mail visitam URLs sozinhos. Cancelamento por GET
     * seria disparado sem ninguém clicar — e a pessoa sairia da lista sem saber.
     */
    const c = html('cancelar-aviso')
    // O minificador reescreve aspas simples como crase; o que importa é o verbo, não a citação.
    expect(c).toMatch(/method:\s*['"`]DELETE['"`]/)
    expect(c, 'o cancelamento não pode ser um GET disfarçado').not.toMatch(/method:\s*['"`]GET['"`]/)
  })

  it('a política de privacidade declara o que passou a ser guardado', () => {
    /*
     * A política dizia "não coletamos dados pessoais". Virou mentira no instante em que esta
     * tabela passou a existir, e promessa que vira mentira em silêncio é pior que promessa nunca
     * feita.
     */
    const pol = html('privacidade')
    expect(pol).not.toMatch(/Como não coletamos dados pessoais/)
    expect(pol).toMatch(/e-mail/i)
    expect(pol).toMatch(/cancelar/i)
  })

  it('a página que promete inventariar tudo lista o e-mail', () => {
    const inv = html('seguranca/o-que-sai-do-navegador')
    expect(inv).toMatch(/e-mail/i)
    expect(inv).toMatch(/não é pedido no primeiro acesso|não bloqueia nada/i)
  })
})

describe('o Worker guarda o mínimo', () => {
  const fonte = readFileSync(join(process.cwd(), 'src', 'worker', 'index.ts'), 'utf8')
  const migracao = readFileSync(join(process.cwd(), 'migrations', '0003_avisos.sql'), 'utf8')

  it('a tabela não tem colunas de identificação além do e-mail', () => {
    // Coletar "para o caso de precisar" é o começo de todo vazamento.
    for (const proibida of ['ip', 'user_agent', 'navegador', 'nome', 'telefone', 'cpf']) {
      expect(migracao.toLowerCase(), proibida).not.toMatch(new RegExp(`^\\s*${proibida}\\s`, 'm'))
    }
    expect(migracao).toMatch(/consentimento TEXT NOT NULL/)
    expect(migracao).toMatch(/cancelado_em/)
  })

  it('o endpoint responde igual exista ou não a inscrição', () => {
    /*
     * Resposta diferente para e-mail já cadastrado transformaria o endpoint em ferramenta de
     * descoberta: daria para perguntar se um endereço específico usa o site.
     */
    const bloco = /async function inscrever[\s\S]*?\n\}/.exec(fonte)?.[0] ?? ''
    expect(bloco, 'não achei a função').not.toBe('')
    const respostas = [...bloco.matchAll(/return json\(\{ ok: (true|false)[^)]*\)/g)].map((m) => m[0])
    // As respostas negativas só existem para entrada malformada, antes de tocar no banco.
    const depoisDoBanco = bloco.slice(bloco.indexOf('INSERT INTO avisos'))
    expect(depoisDoBanco).not.toMatch(/ok: false/)
    expect(respostas.length).toBeGreaterThan(0)
  })

  it('valida e-mail e exige consentimento antes de gravar', () => {
    const bloco = /async function inscrever[\s\S]*?\n\}/.exec(fonte)?.[0] ?? ''
    const posValida = bloco.indexOf('EMAIL_VALIDO.test')
    const posConsent = bloco.indexOf("consentimento ausente")
    const posInsert = bloco.indexOf('INSERT INTO avisos')
    expect(posValida).toBeGreaterThan(-1)
    expect(posValida).toBeLessThan(posInsert)
    expect(posConsent).toBeLessThan(posInsert)
  })
})

/*
 * O SQL da inscrição, rodado de verdade.
 *
 * O formulário é aberto: qualquer um pode digitar o e-mail de qualquer outro. O que impede isso de
 * virar abuso está inteiro numa cláusula WHERE do ON CONFLICT — o tipo de linha que some numa
 * refatoração sem ninguém notar, porque o endpoint continua respondendo ok dos dois jeitos. Por
 * isso o teste extrai o SQL do Worker e executa contra o schema real, em vez de descrevê-lo.
 */
describe('digitar o e-mail de outra pessoa não a coloca nem a tira da lista', () => {
  const fonte = readFileSync(join(process.cwd(), 'src', 'worker', 'index.ts'), 'utf8')
  const INSERT = /`(INSERT INTO avisos[\s\S]*?)`/.exec(fonte)?.[1] ?? ''

  const banco = () => {
    const db = new DatabaseSync(':memory:')
    db.exec(readFileSync(join(process.cwd(), 'migrations', '0003_avisos.sql'), 'utf8'))
    return db
  }
  const inscrever = (db: DatabaseSync, email: string, token: string) =>
    db.prepare(INSERT).run(email, 'tjsp-esaj', '2026-01-01T00:00:00Z', 'tribunal', 'x'.repeat(30), token)
  const linha = (db: DatabaseSync, email: string) =>
    db.prepare('SELECT * FROM avisos WHERE email = ?').get(email) as Record<string, string | null>

  it('o SQL foi encontrado no Worker', () => {
    expect(INSERT, 'não achei o INSERT — o teste abaixo não valeria nada').toMatch(/ON CONFLICT/)
  })

  it('quem cancelou não volta porque alguém digitou o endereço dele', () => {
    const db = banco()
    inscrever(db, 'quem@saiu.com', 'tok-1')
    db.exec(`UPDATE avisos SET confirmado_em = '2026-01-02T00:00:00Z', cancelado_em = '2026-02-01T00:00:00Z'`)
    inscrever(db, 'quem@saiu.com', 'tok-2')
    const l = linha(db, 'quem@saiu.com')
    expect(l.cancelado_em, 'foi reativado sem clicar em nada').not.toBeNull()
    expect(l.confirmado_em, 'continuou valendo como confirmado').toBeNull()
    // Mas a porta de volta existe: novo token, para o e-mail de confirmação.
    expect(l.token).toBe('tok-2')
    db.close()
  })

  it('quem está inscrito não é desligado porque alguém digitou o endereço dele', () => {
    const db = banco()
    inscrever(db, 'quem@ficou.com', 'tok-1')
    db.exec(`UPDATE avisos SET confirmado_em = '2026-01-02T00:00:00Z'`)
    inscrever(db, 'quem@ficou.com', 'tok-2')
    const l = linha(db, 'quem@ficou.com')
    expect(l.confirmado_em, 'a inscrição de um terceiro derrubou a dele').not.toBeNull()
    expect(l.token, 'o link de cancelamento dele mudou por ação de terceiro').toBe('tok-1')
    db.close()
  })

  it('inscrição ainda não confirmada é atualizada, com token novo', () => {
    const db = banco()
    inscrever(db, 'quem@pensou.com', 'tok-1')
    inscrever(db, 'quem@pensou.com', 'tok-2')
    const l = linha(db, 'quem@pensou.com')
    expect(l.token).toBe('tok-2')
    expect(l.confirmado_em, 'entrou na lista sem confirmar').toBeNull()
    db.close()
  })

  it('ninguém entra na lista sem confirmar', () => {
    const db = banco()
    inscrever(db, 'novo@exemplo.com', 'tok-1')
    expect(linha(db, 'novo@exemplo.com').confirmado_em).toBeNull()
    db.close()
  })
})
