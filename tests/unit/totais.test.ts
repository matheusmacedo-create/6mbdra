import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

/**
 * Os totais de sempre são a única consulta do painel sem filtro de data, e é justamente por isso
 * que ela merece um teste de verdade: um `dia >= ?1` que voltasse a entrar aí sem ninguém notar
 * transformaria "desde o começo" em "últimos 30 dias" — um número errado com cara de certo.
 *
 * Em vez de conferir o texto do SQL com regex, o teste extrai a consulta do próprio Worker e a
 * roda contra um SQLite criado pela migration real. Assim ele prova três coisas ao mesmo tempo:
 * que o SQL é válido, que casa com o schema, e que as contas batem.
 */
function sqlDosTotais(): string {
  const fonte = readFileSync(join(process.cwd(), 'src', 'worker', 'index.ts'), 'utf8')
  const m = fonte.match(/`(SELECT MIN\(dia\) AS primeiro_dia[\s\S]*?FROM eventos)`/)
  if (!m) throw new Error('consulta de totais não encontrada em src/worker/index.ts')
  return m[1]
}

function bancoComEventos(linhas: [string, string, string, number | null, string | null][]): DatabaseSync {
  const db = new DatabaseSync(':memory:')
  db.exec(readFileSync(join(process.cwd(), 'migrations', '0001_eventos.sql'), 'utf8'))
  const ins = db.prepare('INSERT INTO eventos (ts, dia, visitante, nome, paginas, situacao) VALUES (?, ?, ?, ?, ?, ?)')
  linhas.forEach(([dia, visitante, nome, paginas, situacao], i) => ins.run(i + 1, dia, visitante, nome, paginas, situacao))
  return db
}

const total = (db: DatabaseSync) => db.prepare(sqlDosTotais()).get() as Record<string, number | string | null>

describe('totais desde o começo', () => {
  it('não filtra por data: conta o que está fora da janela do painel', () => {
    const sql = sqlDosTotais()
    expect(sql).not.toMatch(/dia\s*>=/)
    expect(sql).not.toMatch(/\?1/)
  })

  it('soma arquivos, páginas e visitas de dias distantes', () => {
    const db = bancoComEventos([
      // Um dia muito antigo, que nenhum período do painel alcança.
      ['2024-01-05', 'antigo', 'acesso', null, null],
      ['2024-01-05', 'antigo', 'arquivo_analisado', 12, 'ok'],
      ['2024-01-05', 'antigo', 'arquivo_resultado', null, 'otimizado'],
      // E dois dias recentes.
      ['2026-09-11', 'bb', 'acesso', null, null],
      ['2026-09-11', 'bb', 'arquivo_analisado', 30, 'ok'],
      ['2026-09-11', 'bb', 'arquivo_resultado', null, 'acima_do_limite'],
      ['2026-09-12', 'cc', 'arquivo_resultado', null, 'mantido'],
      ['2026-09-12', 'cc', 'download', null, null],
      ['2026-09-12', 'cc', 'erro', null, null],
    ])
    const t = total(db)
    expect(t.primeiro_dia).toBe('2024-01-05')
    expect(t.dias_com_registro).toBe(3)
    expect(t.acessos).toBe(2)
    expect(t.arquivos).toBe(3)
    // 'acima_do_limite' é o único que não coube; 'mantido' já cabia e conta como sucesso.
    expect(t.arquivos_ok).toBe(2)
    expect(t.paginas).toBe(42)
    expect(t.downloads).toBe(1)
    expect(t.erros).toBe(1)
  })

  it('conta visitante-dia, que é o que o hash diário permite', () => {
    // O mesmo IP em dois dias vira dois hashes (o dia entra no hash), então são duas visitas.
    const db = bancoComEventos([
      ['2026-09-11', 'hash-do-dia-11', 'acesso', null, null],
      ['2026-09-12', 'hash-do-dia-12', 'acesso', null, null],
      ['2026-09-12', 'hash-do-dia-12', 'acesso', null, null],
    ])
    expect(total(db).visitas).toBe(2)
  })

  it('banco vazio devolve zeros, não nulos que quebram a soma', () => {
    const t = total(bancoComEventos([]))
    expect(t.primeiro_dia).toBeNull()
    expect(t.arquivos).toBe(0)
    expect(t.paginas).toBe(0)
    expect(t.visitas).toBe(0)
  })
})

describe('arquivo mantido entra na contagem', () => {
  it('o arquivo que já cabia dispara arquivo_resultado', () => {
    const fonte = readFileSync(join(process.cwd(), 'src', 'tool', 'hooks', 'useJobQueue.ts'), 'utf8')
    const trecho = fonte.slice(fonte.indexOf("result.status === 'unchanged'"))
    expect(trecho.slice(0, 600)).toMatch(/track\('arquivo_resultado', \{ situacao: 'mantido'/)
  })

  it('o painel sabe traduzir essa situação', () => {
    const painel = readFileSync(join(process.cwd(), 'src', 'scripts', 'painel.ts'), 'utf8')
    expect(painel).toMatch(/\bmantido:/)
  })
})
