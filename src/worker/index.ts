/**
 * Worker de métricas do brpdf.
 *
 * Existe por um motivo só: contar uso. Nenhum PDF passa por aqui — os documentos continuam sendo
 * processados no navegador. O Worker recebe eventos agregados (contagens e categorias), grava no
 * D1 e serve o painel interno. Todo o resto do site sai dos arquivos estáticos.
 *
 * Privacidade: não guardamos IP, cookie, nome de arquivo nem número de processo. O "visitante" é um
 * hash salgado de IP + navegador + dia, que muda à meia-noite e não pode ser revertido para o IP.
 */

export interface Env {
  ASSETS: Fetcher
  METRICAS: D1Database
  /** Senha do painel (wrangler secret put PAINEL_TOKEN) */
  PAINEL_TOKEN?: string
  /** Sal do hash de visitante (wrangler secret put SAL_VISITANTE) */
  SAL_VISITANTE?: string
}

/** Eventos aceitos, na ordem do funil. Espelha EventName em src/tool/lib/analytics.ts. */
const EVENTOS = new Set([
  'acesso', 'tempo_pagina', 'link_externo', 'faq_aberto',
  'abriu_ferramenta', 'voltou_inicio', 'motor', 'regra_selecionada', 'opcao_alterada',
  'arquivo_adicionado', 'arquivo_analisado', 'arquivo_removido', 'liberar_arquivo',
  'juntou_documentos', 'lote_iniciado', 'lote_cancelado', 'lote_concluido', 'arquivo_resultado', 'tentar_novamente', 'erro',
  'assinatura_conferida',
  'zip_gerado', 'download',
])

/** Campos de texto aceitos, com o tamanho máximo de cada um. */
const TEXTOS: Record<string, number> = {
  caminho: 120,
  origem: 80,
  tribunal: 16,
  sistema: 24,
  situacao: 24,
  categoria: 24,
  faixa: 12,
  tipo: 12,
}
const NUMEROS = ['quantidade', 'nivel', 'partes', 'segundos', 'paginas', 'meta_mb'] as const

interface EventoEntrada {
  nome?: unknown
  props?: Record<string, unknown>
}

const json = (dados: unknown, status = 200) =>
  new Response(JSON.stringify(dados), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } })

/** Dia no fuso de São Paulo, para o painel bater com o dia de trabalho de quem usa. */
function diaSaoPaulo(agora: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(agora)
}

async function hashVisitante(req: Request, dia: string, sal: string): Promise<string> {
  const ip = req.headers.get('cf-connecting-ip') ?? ''
  const ua = req.headers.get('user-agent') ?? ''
  const dados = new TextEncoder().encode(`${sal}|${dia}|${ip}|${ua}`)
  const digest = await crypto.subtle.digest('SHA-256', dados)
  // 12 hex bastam para contar visitantes do dia e não servem para procurar ninguém.
  return [...new Uint8Array(digest).slice(0, 6)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function texto(valor: unknown, max: number): string | null {
  if (typeof valor !== 'string') return null
  const limpo = valor.trim().slice(0, max)
  return limpo.length ? limpo : null
}

function numero(valor: unknown): number | null {
  return typeof valor === 'number' && Number.isFinite(valor) ? valor : null
}

function dispositivo(req: Request): string {
  const ua = req.headers.get('user-agent') ?? ''
  return /Mobi|Android|iPhone|iPad/i.test(ua) ? 'celular' : 'computador'
}

async function registrar(req: Request, env: Env): Promise<Response> {
  if (!env.METRICAS) return json({ ok: false }, 503)
  let corpo: { eventos?: EventoEntrada[] }
  try {
    corpo = (await req.json()) as { eventos?: EventoEntrada[] }
  } catch {
    return json({ ok: false, erro: 'json inválido' }, 400)
  }
  const entrada = Array.isArray(corpo.eventos) ? corpo.eventos.slice(0, 20) : []
  if (entrada.length === 0) return json({ ok: true, gravados: 0 })

  const agora = new Date()
  const dia = diaSaoPaulo(agora)
  const visitante = await hashVisitante(req, dia, env.SAL_VISITANTE ?? 'brpdf')
  const pais = (req as { cf?: { country?: string } }).cf?.country ?? null
  const disp = dispositivo(req)

  const statements = []
  for (const e of entrada) {
    const nome = typeof e.nome === 'string' ? e.nome : ''
    if (!EVENTOS.has(nome)) continue
    const props = (e.props ?? {}) as Record<string, unknown>
    const t = (k: string) => texto(props[k], TEXTOS[k])
    statements.push(
      env.METRICAS.prepare(
        `INSERT INTO eventos (ts, dia, visitante, nome, caminho, origem, pais, dispositivo, tribunal, sistema, situacao, categoria, faixa, tipo, quantidade, nivel, partes, segundos, paginas, meta_mb)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19,?20)`,
      ).bind(
        agora.getTime(), dia, visitante, nome,
        t('caminho'), t('origem'), pais, disp,
        t('tribunal'), t('sistema'), t('situacao'), t('categoria'), t('faixa'), t('tipo'),
        ...NUMEROS.map((k) => numero(props[k])),
      ),
    )
  }
  if (statements.length === 0) return json({ ok: true, gravados: 0 })
  try {
    await env.METRICAS.batch(statements)
  } catch {
    // Medir nunca pode atrapalhar quem está usando a ferramenta.
    return json({ ok: false }, 202)
  }
  return json({ ok: true, gravados: statements.length })
}

/** Comparação de tokens em tempo constante, para o painel não vazar a senha por tempo de resposta. */
function tokenConfere(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let d = 0
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return d === 0
}

async function painel(req: Request, env: Env): Promise<Response> {
  const esperado = env.PAINEL_TOKEN
  if (!esperado) return json({ erro: 'painel sem senha configurada (wrangler secret put PAINEL_TOKEN)' }, 503)
  const enviado = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!enviado || !tokenConfere(enviado, esperado)) return json({ erro: 'senha inválida' }, 401)
  if (!env.METRICAS) return json({ erro: 'banco indisponível' }, 503)

  const url = new URL(req.url)
  const dias = Math.min(180, Math.max(1, Number(url.searchParams.get('dias') ?? 30) || 30))
  const desde = diaSaoPaulo(new Date(Date.now() - (dias - 1) * 86_400_000))

  const q = (sql: string) => env.METRICAS.prepare(sql).bind(desde)
  const [porDia, resumo, totais, funil, entradas, tamanhos, motor, situacoes, erros, tribunais, paginas, origens, dispositivos, ultimos, rastPorDia, rastPorTipo] = await env.METRICAS.batch([
    q(`SELECT dia,
              SUM(nome = 'acesso') AS acessos,
              COUNT(DISTINCT visitante) AS visitantes,
              SUM(nome = 'lote_iniciado') AS lotes,
              SUM(nome = 'arquivo_resultado') AS arquivos,
              SUM(nome = 'erro') AS erros
       FROM eventos WHERE dia >= ?1 GROUP BY dia ORDER BY dia`),
    q(`SELECT COUNT(*) FILTER (WHERE nome = 'acesso') AS acessos,
              COUNT(DISTINCT visitante) AS visitantes,
              COUNT(*) FILTER (WHERE nome = 'lote_iniciado') AS lotes,
              COUNT(*) FILTER (WHERE nome = 'lote_concluido') AS lotes_concluidos,
              COUNT(*) FILTER (WHERE nome = 'arquivo_resultado') AS arquivos,
              COUNT(*) FILTER (WHERE nome = 'arquivo_resultado' AND situacao <> 'acima_do_limite') AS arquivos_ok,
              COUNT(*) FILTER (WHERE nome = 'erro') AS erros,
              COUNT(*) FILTER (WHERE nome = 'download') AS downloads,
              COALESCE(SUM(quantidade) FILTER (WHERE nome = 'lote_iniciado'), 0) AS arquivos_enfileirados
       FROM eventos WHERE dia >= ?1`),
    /*
     * Totais desde o primeiro dia, ignorando o filtro de período — é a pergunta "quanto já rodou
     * até hoje", que o recorte de 30 dias nunca responde.
     *
     * Duas honestidades embutidas nos nomes:
     *
     * 1. "visitas" e não "usuários". O hash de visitante inclui o dia (ver hashVisitante), então
     *    a mesma pessoa voltando em três dias vira três valores distintos. Somar isso dá
     *    visitante-dia, não gente. Como não guardamos cookie nem identificador que atravesse o
     *    dia, pessoa única é um número que este banco não tem — e inventá-lo seria mentir.
     * 2. "páginas lidas" vem de arquivo_analisado, a leitura prévia no navegador: conta páginas de
     *    documento que passaram pela ferramenta, não páginas do site.
     *
     * Custo: varre a tabela inteira a cada carga do painel. Aceitável no volume atual; se um dia
     * doer, o caminho é uma tabela de totais escrita por dia fechado, não um recorte aqui.
     */
    env.METRICAS.prepare(
      `SELECT MIN(dia) AS primeiro_dia,
              COUNT(DISTINCT dia) AS dias_com_registro,
              COUNT(*) FILTER (WHERE nome = 'acesso') AS acessos,
              COUNT(DISTINCT visitante) AS visitas,
              COUNT(*) FILTER (WHERE nome = 'lote_iniciado') AS lotes,
              COUNT(*) FILTER (WHERE nome = 'arquivo_resultado') AS arquivos,
              COUNT(*) FILTER (WHERE nome = 'arquivo_resultado' AND situacao <> 'acima_do_limite') AS arquivos_ok,
              COUNT(*) FILTER (WHERE nome = 'download') AS downloads,
              COUNT(*) FILTER (WHERE nome = 'erro') AS erros,
              COALESCE(SUM(paginas) FILTER (WHERE nome = 'arquivo_analisado'), 0) AS paginas
       FROM eventos`,
    ),
    // Funil por visitante: em quantas pessoas cada etapa sobreviveu (não quantas vezes aconteceu).
    q(`SELECT nome, COUNT(DISTINCT visitante) AS visitantes, COUNT(*) AS n
       FROM eventos
       WHERE dia >= ?1 AND nome IN ('acesso','abriu_ferramenta','regra_selecionada','arquivo_adicionado','lote_iniciado','arquivo_resultado','download')
       GROUP BY nome`),
    // O que as pessoas trazem: estado do PDF na leitura prévia e tamanho médio de páginas.
    q(`SELECT situacao, COUNT(*) AS n, CAST(ROUND(AVG(paginas)) AS INTEGER) AS paginas
       FROM eventos WHERE dia >= ?1 AND nome = 'arquivo_analisado' AND situacao IS NOT NULL GROUP BY situacao ORDER BY n DESC`),
    q(`SELECT faixa, COUNT(*) AS n FROM eventos WHERE dia >= ?1 AND nome = 'arquivo_analisado' AND faixa IS NOT NULL GROUP BY faixa ORDER BY n DESC`),
    q(`SELECT situacao, COUNT(*) AS n FROM eventos WHERE dia >= ?1 AND nome = 'motor' AND situacao IS NOT NULL GROUP BY situacao ORDER BY n DESC`),
    q(`SELECT situacao, COUNT(*) AS n FROM eventos WHERE dia >= ?1 AND nome = 'arquivo_resultado' AND situacao IS NOT NULL GROUP BY situacao ORDER BY n DESC`),
    q(`SELECT categoria, COUNT(*) AS n FROM eventos WHERE dia >= ?1 AND nome = 'erro' AND categoria IS NOT NULL GROUP BY categoria ORDER BY n DESC LIMIT 20`),
    q(`SELECT tribunal, sistema, COUNT(*) AS n FROM eventos WHERE dia >= ?1 AND nome = 'regra_selecionada' AND tribunal IS NOT NULL GROUP BY tribunal, sistema ORDER BY n DESC LIMIT 20`),
    q(`SELECT caminho, COUNT(*) AS n, COUNT(DISTINCT visitante) AS visitantes FROM eventos WHERE dia >= ?1 AND nome = 'acesso' AND caminho IS NOT NULL GROUP BY caminho ORDER BY n DESC LIMIT 20`),
    q(`SELECT COALESCE(origem, 'direto') AS origem, COUNT(*) AS n FROM eventos WHERE dia >= ?1 AND nome = 'acesso' GROUP BY origem ORDER BY n DESC LIMIT 15`),
    q(`SELECT dispositivo, COUNT(DISTINCT visitante) AS visitantes FROM eventos WHERE dia >= ?1 GROUP BY dispositivo`),
    q(`SELECT ts, nome, situacao, categoria, faixa, tribunal, sistema, segundos, partes, quantidade, dispositivo, pais
       FROM eventos WHERE dia >= ?1 AND nome IN ('arquivo_resultado','erro','lote_concluido') ORDER BY ts DESC LIMIT 60`),
    // Rastreamento: a evidência de que o buscador está passando, antes de o Search Console reportar.
    q(`SELECT dia, SUM(n) AS n, COUNT(DISTINCT tipo) AS tipos FROM rastreadores WHERE dia >= ?1 GROUP BY dia ORDER BY dia`),
    q(`SELECT bot, tipo, SUM(n) AS n FROM rastreadores WHERE dia >= ?1 GROUP BY bot, tipo ORDER BY n DESC LIMIT 40`),
  ])

  return json({
    desde,
    dias,
    resumo: resumo.results?.[0] ?? {},
    totais: totais.results?.[0] ?? {},
    funil: funil.results ?? [],
    entradas: entradas.results ?? [],
    tamanhos: tamanhos.results ?? [],
    motor: motor.results ?? [],
    porDia: porDia.results ?? [],
    situacoes: situacoes.results ?? [],
    erros: erros.results ?? [],
    tribunais: tribunais.results ?? [],
    paginas: paginas.results ?? [],
    origens: origens.results ?? [],
    dispositivos: dispositivos.results ?? [],
    ultimos: ultimos.results ?? [],
    rastPorDia: rastPorDia.results ?? [],
    rastPorTipo: rastPorTipo.results ?? [],
  })
}

/**
 * Rastreadores que vale contar. Só os que trazem tráfego de busca — não é lista de bloqueio, é
 * lista de quem interessa acompanhar.
 */
const BOTS: { padrao: RegExp; nome: string }[] = [
  { padrao: /Googlebot-Image/i, nome: 'googlebot-imagem' },
  { padrao: /Googlebot|Google-InspectionTool|Storebot-Google/i, nome: 'googlebot' },
  { padrao: /bingbot|adidxbot/i, nome: 'bingbot' },
  { padrao: /DuckDuckBot/i, nome: 'duckduckbot' },
  { padrao: /YandexBot/i, nome: 'yandexbot' },
  { padrao: /Applebot/i, nome: 'applebot' },
]

/** Tipo da página, para o contador não crescer uma linha por URL rastreada. */
function tipoDePagina(caminho: string): string {
  if (caminho === '/') return 'home'
  if (caminho.startsWith('/tribunais/')) return caminho === '/tribunais/' ? 'diretorio' : 'tribunal'
  if (caminho.startsWith('/sistemas/')) return 'sistema'
  if (caminho.startsWith('/guias/')) return 'guia'
  if (/^\/(comprimir|dividir|juntar)-pdf\/$/.test(caminho)) return 'tarefa'
  if (/^\/(metodologia|privacidade|termos|contato)\/$/.test(caminho)) return 'institucional'
  return 'outro'
}

/**
 * Conta uma passada de rastreador. É contador agregado (uma linha por dia/bot/tipo), e roda fora
 * do caminho da resposta: se o banco estiver fora do ar, a página é servida do mesmo jeito.
 */
async function contarRastreador(req: Request, env: Env, url: URL): Promise<void> {
  if (!env.METRICAS) return
  const ua = req.headers.get('user-agent') ?? ''
  const bot = BOTS.find((b) => b.padrao.test(ua))
  if (!bot) return
  // Só página; asset rastreado não diz nada sobre indexação.
  if (/\.[a-z0-9]{2,5}$/i.test(url.pathname) && !url.pathname.endsWith('.txt') && !url.pathname.endsWith('.xml')) return
  const dia = diaSaoPaulo(new Date())
  try {
    await env.METRICAS.prepare(
      `INSERT INTO rastreadores (dia, bot, tipo, n) VALUES (?1, ?2, ?3, 1)
       ON CONFLICT(dia, bot, tipo) DO UPDATE SET n = n + 1`,
    )
      .bind(dia, bot.nome, tipoDePagina(url.pathname))
      .run()
  } catch {
    // Contar rastreador nunca pode atrapalhar quem está lendo o site.
  }
}

/**
 * Um endereço canônico só: www.brpdf.com manda para brpdf.com, com 301, preservando caminho e
 * query. Fica aqui, e não numa Redirect Rule da Cloudflare, para o comportamento ficar versionado
 * e testável. Só funciona porque "run_worker_first" está ligado para tudo (wrangler.jsonc): com
 * ele restrito a /api/*, a camada de arquivos estáticos responderia antes e este código nunca
 * rodaria numa página comum.
 */
function semWww(url: URL): Response | null {
  if (!url.hostname.startsWith('www.')) return null
  const destino = new URL(url)
  destino.hostname = url.hostname.slice(4)
  return Response.redirect(destino.toString(), 301)
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url)
    const redirecionamento = semWww(url)
    if (redirecionamento) return redirecionamento
    // Fora do caminho da resposta: a página não espera o banco.
    if (req.method === 'GET') ctx.waitUntil(contarRastreador(req, env, url))
    if (url.pathname === '/api/e' && req.method === 'POST') return registrar(req, env)
    if (url.pathname === '/api/painel' && req.method === 'GET') return painel(req, env)
    if (url.pathname.startsWith('/api/')) return json({ erro: 'não encontrado' }, 404)
    return env.ASSETS.fetch(req)
  },
}
