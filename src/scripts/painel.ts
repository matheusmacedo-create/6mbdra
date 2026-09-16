/**
 * Painel interno de uso (rota /painel/).
 *
 * Lê /api/painel com a senha guardada no navegador e desenha os números. Nenhum dado de documento
 * chega até aqui: o Worker só guarda contagens, categorias e o hash diário de visitante.
 * A página é noindex e está bloqueada no robots.txt.
 */
const CHAVE = 'brpdf.painel.token'

interface Resumo {
  acessos?: number
  visitantes?: number
  lotes?: number
  lotes_concluidos?: number
  arquivos?: number
  arquivos_ok?: number
  erros?: number
  downloads?: number
  arquivos_enfileirados?: number
}

/** Totais desde o primeiro registro. Não muda com o seletor de período. */
interface Totais {
  primeiro_dia?: string | null
  dias_com_registro?: number
  acessos?: number
  visitas?: number
  lotes?: number
  arquivos?: number
  arquivos_ok?: number
  downloads?: number
  erros?: number
  paginas?: number
}

interface Dia {
  dia: string
  acessos: number
  visitantes: number
  lotes: number
  arquivos: number
  erros: number
}

interface Linha {
  [coluna: string]: string | number | null
}

interface Dados {
  desde: string
  dias: number
  resumo: Resumo
  totais: Totais
  porDia: Dia[]
  funil: Linha[]
  rastPorDia: Linha[]
  rastPorTipo: Linha[]
  entradas: Linha[]
  tamanhos: Linha[]
  motor: Linha[]
  situacoes: Linha[]
  erros: Linha[]
  tribunais: Linha[]
  paginas: Linha[]
  origens: Linha[]
  dispositivos: Linha[]
  ultimos: Linha[]
}

/** Nomes técnicos que aparecem no banco, traduzidos para quem lê o painel. */
const ROTULOS: Record<string, string> = {
  home: 'Página inicial',
  tribunal: 'Página de tribunal',
  diretorio: 'Diretório de tribunais',
  sistema: 'Página de sistema',
  guia: 'Guia',
  tarefa: 'Página de tarefa',
  institucional: 'Institucional',
  googlebot: 'Google',
  'googlebot-imagem': 'Google (imagens)',
  bingbot: 'Bing',
  duckduckbot: 'DuckDuckGo',
  yandexbot: 'Yandex',
  applebot: 'Apple',
  ok: 'Legível, sem travas',
  senha: 'Exige senha para abrir',
  assinado: 'Assinado digitalmente',
  restrito: 'Com restrições de edição',
  invalido: 'Não é um PDF legível',
  nao_analisado: 'Leitura prévia não terminou',
  pronto: 'Carregou',
  falhou: 'Não carregou',
  sem_suporte: 'Navegador sem suporte',
  otimizado: 'Compactado dentro do limite',
  mantido: 'Já cabia, devolvido intacto',
  dividido: 'Dividido em partes',
  acima_do_limite: 'Não coube no limite',
  arquivo_resultado: 'Arquivo preparado',
  lote_concluido: 'Lote concluído',
  erro: 'Erro',
  // Conferidor de assinaturas. 'conferida' e 'quebrada' de propósito: nunca 'válida'.
  assinatura_conferida: 'Assinatura conferida',
  conferida: 'Integridade confere',
  quebrada: 'Alterado depois de assinado',
  sem_assinatura: 'Sem assinatura no arquivo',
  indeterminada: 'Não deu para concluir',
  nao_suportada: 'Formato ainda não lido',
  conferidor: 'Conferidor de assinaturas',
  UNSUPPORTED: 'Navegador sem suporte',
  PASSWORD: 'PDF com senha',
  INVALID: 'PDF inválido ou corrompido',
  OOM: 'Memória insuficiente',
  TIMEOUT: 'Motor travou (tempo esgotado)',
  PAGES_MISMATCH: 'Saída com menos páginas',
  PAGE_TOO_BIG: 'Página maior que o limite',
  EMPTY: 'PDF sem páginas',
  LOAD: 'Falha ao abrir o PDF',
  ABORTED: 'Cancelado pela pessoa',
  UNKNOWN: 'Falha não identificada',
}
const rotulo = (v: unknown): string => (typeof v === 'string' && ROTULOS[v]) || (v == null || v === '' ? '—' : String(v))

const num = (v: unknown): string => (typeof v === 'number' ? v.toLocaleString('pt-BR') : '0')
const relogio = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
const diaCurto = (iso: string): string => iso.slice(8, 10) + '/' + iso.slice(5, 7)

const $ = <T extends HTMLElement>(sel: string): T => {
  const el = document.querySelector<T>(sel)
  if (!el) throw new Error(`elemento ausente: ${sel}`)
  return el
}

function elemento(tag: string, classe?: string, texto?: string): HTMLElement {
  const el = document.createElement(tag)
  if (classe) el.className = classe
  if (texto !== undefined) el.textContent = texto
  return el
}

/** Cartão de número grande. */
function kpi(titulo: string, valor: string, nota?: string): HTMLElement {
  const card = elemento('div', 'kpi')
  card.append(elemento('span', 't', titulo), elemento('strong', 'v', valor))
  if (nota) card.append(elemento('span', 'd', nota))
  return card
}

function tabela(colunas: string[], chaves: string[], linhas: Linha[], vazio: string): HTMLElement {
  const caixa = elemento('div', 'rules-table')
  if (linhas.length === 0) {
    caixa.append(elemento('p', 'vazio', vazio))
    return caixa
  }
  const t = document.createElement('table')
  const thead = document.createElement('thead')
  const trh = document.createElement('tr')
  for (const c of colunas) {
    const th = document.createElement('th')
    th.textContent = c
    trh.append(th)
  }
  thead.append(trh)
  const tbody = document.createElement('tbody')
  for (const l of linhas) {
    const tr = document.createElement('tr')
    for (const k of chaves) {
      const td = document.createElement('td')
      const v = l[k]
      td.textContent = typeof v === 'number' ? num(v) : rotulo(v)
      if (typeof v === 'number') td.className = 'n'
      tr.append(td)
    }
    tbody.append(tr)
  }
  t.append(thead, tbody)
  caixa.append(t)
  return caixa
}

/** Barras por dia. A altura vai pelo CSSOM porque a CSP não permite atributo style. */
function serie(dias: Dia[]): DocumentFragment {
  const caixa = document.createDocumentFragment()
  if (dias.length === 0) {
    caixa.append(elemento('p', 'vazio', 'Nenhum acesso registrado neste período.'))
    return caixa
  }
  const teto = Math.max(1, ...dias.map((d) => Math.max(d.acessos ?? 0, d.visitantes ?? 0)))
  for (const d of dias) {
    const col = elemento('div', 'col')
    col.title = `${diaCurto(d.dia)} — ${num(d.acessos)} acessos, ${num(d.visitantes)} visitantes, ${num(d.arquivos)} arquivos, ${num(d.erros)} erros`
    const pilha = elemento('div', 'pilha')
    const acessos = elemento('span', 'b acessos')
    acessos.style.height = `${Math.round(((d.acessos ?? 0) / teto) * 100)}%`
    const visitantes = elemento('span', 'b visitantes')
    visitantes.style.height = `${Math.round(((d.visitantes ?? 0) / teto) * 100)}%`
    pilha.append(acessos, visitantes)
    col.append(pilha, elemento('span', 'rot', diaCurto(d.dia)))
    caixa.append(col)
  }
  return caixa
}

interface Etapa {
  chave: string
  titulo: string
  /** Etapa que dá para pular (quem digita um limite manual não escolhe tribunal): não conta perda. */
  opcional?: boolean
}
/** Etapas do funil, na ordem em que acontecem. */
const ETAPAS: Etapa[] = [
  { chave: 'acesso', titulo: 'Abriu o site' },
  { chave: 'abriu_ferramenta', titulo: 'Abriu a ferramenta' },
  { chave: 'regra_selecionada', titulo: 'Escolheu o tribunal', opcional: true },
  { chave: 'arquivo_adicionado', titulo: 'Trouxe arquivos' },
  { chave: 'lote_iniciado', titulo: 'Mandou preparar' },
  { chave: 'arquivo_resultado', titulo: 'Teve arquivo pronto' },
  { chave: 'download', titulo: 'Baixou' },
]

/** Funil por visitante: quantas pessoas chegaram a cada etapa e quantas sobraram da anterior. */
function funil(linhas: Linha[]): DocumentFragment {
  const caixa = document.createDocumentFragment()
  const por = new Map(linhas.map((l) => [String(l.nome), Number(l.visitantes) || 0]))
  const topo = por.get('acesso') ?? 0
  if (!topo) {
    caixa.append(elemento('p', 'vazio', 'Ainda não há acessos para montar o funil.'))
    return caixa
  }
  // A perda é sempre medida contra a última etapa obrigatória: pular uma etapa opcional não é desistir.
  let anterior = topo
  for (const { chave, titulo, opcional } of ETAPAS) {
    const v = por.get(chave) ?? 0
    const etapa = elemento('div', 'etapa' + (opcional ? ' opcional' : ''))
    const cabeca = elemento('div', 'cabeca')
    cabeca.append(
      elemento('span', 'nome', opcional ? `${titulo} (opcional)` : titulo),
      elemento('span', 'valor', `${num(v)} (${porcentagem(v, topo)})`),
    )
    const trilho = elemento('div', 'trilho')
    const barra = elemento('span', 'preenchida')
    barra.style.width = `${Math.round((v / topo) * 100)}%`
    trilho.append(barra)
    etapa.append(cabeca, trilho)
    if (opcional) {
      etapa.append(elemento('span', 'perda', 'quem digita o limite na mão não passa por aqui'))
    } else if (chave !== 'acesso') {
      const perda = anterior - v
      etapa.append(elemento('span', 'perda', perda > 0 ? `${num(perda)} não passaram desta etapa` : 'ninguém se perdeu aqui'))
      anterior = v
    }
    caixa.append(etapa)
  }
  return caixa
}

function porcentagem(parte: number, total: number): string {
  if (!total) return '—'
  return `${Math.round((parte / total) * 100)}%`
}

/** Data por extenso curta, para "desde 14 de setembro de 2026". */
const porExtenso = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: 'numeric', month: 'long', year: 'numeric' })

function dataLonga(iso: string): string {
  const [a, m, dia] = iso.split('-').map(Number)
  return porExtenso.format(new Date(Date.UTC(a, m - 1, dia, 12)))
}

/**
 * Totais de sempre.
 *
 * Os rótulos aqui são escolhidos com cuidado. "Visitas" e não "usuários": o identificador de
 * visitante é um hash que muda todo dia (é assim que o site não segue ninguém), então a mesma
 * pessoa voltando na semana seguinte conta de novo. O número honesto que temos é visitante-dia, e
 * é esse que o cartão diz — com a ressalva escrita embaixo, não escondida.
 */
function desenharTotais(t: Totais) {
  const caixa = $('#totais')
  const arquivos = t.arquivos ?? 0
  const paginas = t.paginas ?? 0
  caixa.replaceChildren(
    kpi('Arquivos processados', num(arquivos), `${num(t.arquivos_ok)} ficaram dentro do limite`),
    kpi('Páginas de PDF lidas', num(paginas), arquivos ? `${num(Math.round(paginas / Math.max(1, arquivos)))} páginas por arquivo, em média` : 'nenhum documento ainda'),
    kpi('Visitas', num(t.visitas), 'quem volta outro dia conta de novo — não seguimos ninguém entre dias'),
    kpi('Acessos a páginas', num(t.acessos), `${num(t.downloads)} downloads · ${num(t.lotes)} lotes`),
  )

  const dias = t.dias_com_registro ?? 0
  $('#totais-periodo').textContent = t.primeiro_dia
    ? `Tudo que o site já registrou, desde ${dataLonga(t.primeiro_dia)} — ${dias} ${dias === 1 ? 'dia' : 'dias'} com movimento. Este bloco não muda quando você troca o período abaixo.`
    : 'Ainda não há nada registrado. Os números aparecem assim que a primeira pessoa usar a ferramenta.'
}

function desenhar(d: Dados) {
  const r = d.resumo ?? {}
  desenharTotais(d.totais ?? {})
  const kpis = $('#kpis')
  kpis.replaceChildren(
    kpi('Acessos', num(r.acessos), `${num(r.visitantes)} visitantes distintos`),
    kpi('Lotes iniciados', num(r.lotes), `${num(r.arquivos_enfileirados)} arquivos enviados à fila`),
    kpi('Arquivos preparados', num(r.arquivos), `${num(r.downloads)} downloads`),
    kpi('Deu certo', porcentagem(r.arquivos_ok ?? 0, r.arquivos ?? 0), `${num(r.arquivos_ok)} de ${num(r.arquivos)} dentro do limite`),
    kpi('Erros', num(r.erros), r.arquivos ? `${porcentagem(r.erros ?? 0, (r.arquivos ?? 0) + (r.erros ?? 0))} das tentativas` : 'nenhuma tentativa'),
    kpi('Lotes concluídos', num(r.lotes_concluidos), `de ${num(r.lotes)} iniciados`),
  )

  $('#serie').replaceChildren(serie(d.porDia ?? []))
  $('#funil').replaceChildren(funil(d.funil ?? []))
  $('#rastreadores').replaceChildren(
    tabela(['Rastreador', 'Tipo de página', 'Passadas'], ['bot', 'tipo', 'n'], d.rastPorTipo ?? [], 'Nenhum rastreador passou por aqui ainda.'),
  )
  const totalRast = (d.rastPorDia ?? []).reduce((soma, l) => soma + (Number(l.n) || 0), 0)
  const diasComRast = (d.rastPorDia ?? []).length
  $('#rastreio-resumo').textContent = totalRast
    ? `${num(totalRast)} páginas rastreadas no período, em ${diasComRast} ${diasComRast === 1 ? 'dia' : 'dias'}.`
    : 'Ainda não houve passada de rastreador registrada. É o normal nos primeiros dias depois de publicar.'
  $('#entradas').replaceChildren(
    tabela(['Como o PDF chegou', 'Arquivos', 'Páginas (média)'], ['situacao', 'n', 'paginas'], d.entradas ?? [], 'Ninguém trouxe arquivos ainda.'),
  )
  $('#tamanhos').replaceChildren(tabela(['Tamanho do original', 'Arquivos'], ['faixa', 'n'], d.tamanhos ?? [], 'Ninguém trouxe arquivos ainda.'))
  $('#motor').replaceChildren(tabela(['Compactador', 'Vezes'], ['situacao', 'n'], d.motor ?? [], 'A ferramenta ainda não foi aberta.'))
  $('#situacoes').replaceChildren(tabela(['Resultado', 'Arquivos'], ['situacao', 'n'], d.situacoes ?? [], 'Nenhum arquivo preparado no período.'))
  $('#erros').replaceChildren(tabela(['Motivo', 'Ocorrências'], ['categoria', 'n'], d.erros ?? [], 'Nenhum erro registrado.'))
  $('#tribunais').replaceChildren(tabela(['Tribunal', 'Sistema', 'Escolhas'], ['tribunal', 'sistema', 'n'], d.tribunais ?? [], 'Ninguém escolheu um tribunal ainda.'))
  $('#paginas').replaceChildren(tabela(['Página', 'Acessos', 'Visitantes'], ['caminho', 'n', 'visitantes'], d.paginas ?? [], 'Sem acessos no período.'))
  $('#origens').replaceChildren(tabela(['Origem', 'Acessos'], ['origem', 'n'], d.origens ?? [], 'Sem acessos no período.'))
  $('#dispositivos').replaceChildren(tabela(['Dispositivo', 'Visitantes'], ['dispositivo', 'visitantes'], d.dispositivos ?? [], 'Sem acessos no período.'))

  const ultimos: Linha[] = (d.ultimos ?? []).map((l) => ({
    quando: typeof l.ts === 'number' ? relogio.format(new Date(l.ts)) : '—',
    evento: rotulo(l.nome),
    detalhe: rotulo(l.situacao ?? l.categoria),
    faixa: l.faixa ?? '—',
    tribunal: l.tribunal ?? '—',
    partes: l.partes ?? l.quantidade ?? '—',
    segundos: l.segundos ?? '—',
    dispositivo: l.dispositivo ?? '—',
  }))
  $('#ultimos').replaceChildren(
    tabela(
      ['Quando', 'Evento', 'Detalhe', 'Tamanho', 'Tribunal', 'Partes', 'Segundos', 'Dispositivo'],
      ['quando', 'evento', 'detalhe', 'faixa', 'tribunal', 'partes', 'segundos', 'dispositivo'],
      ultimos,
      'Nenhum evento registrado ainda.',
    ),
  )
  $('#desde').textContent = `Desde ${diaCurto(d.desde)} · ${d.dias} dias · fuso de São Paulo`
}

let dias = 30

function guardarToken(t: string) {
  try {
    localStorage.setItem(CHAVE, t)
  } catch {
    // navegador sem armazenamento: o painel funciona, só pede a senha de novo depois.
  }
}
function lerToken(): string {
  try {
    return localStorage.getItem(CHAVE) ?? ''
  } catch {
    return ''
  }
}

async function carregar() {
  const token = lerToken()
  if (!token) return mostrarLogin()
  const estado = $('#estado')
  estado.textContent = 'Carregando…'
  try {
    const resp = await fetch(`/api/painel?dias=${dias}`, { headers: { authorization: `Bearer ${token}` } })
    if (resp.status === 401) {
      try {
        localStorage.removeItem(CHAVE)
      } catch {
        /* nada a fazer */
      }
      return mostrarLogin('Senha inválida. Tente de novo.')
    }
    if (!resp.ok) {
      const corpo = (await resp.json().catch(() => ({}))) as { erro?: string }
      estado.textContent = corpo.erro ? `Não deu para carregar: ${corpo.erro}` : `Não deu para carregar (HTTP ${resp.status}).`
      return
    }
    desenhar((await resp.json()) as Dados)
    estado.textContent = ''
  } catch {
    estado.textContent = 'Não deu para falar com o servidor. Verifique a conexão e tente de novo.'
  }
}

function mostrarLogin(erro?: string) {
  $('#entrar').hidden = false
  $('#conteudo').hidden = true
  const aviso = $('#erro-login')
  aviso.textContent = erro ?? ''
  aviso.hidden = !erro
  $<HTMLInputElement>('#token').focus()
}

function mostrarPainel() {
  $('#entrar').hidden = true
  $('#conteudo').hidden = false
  void carregar()
}

$('#entrar').addEventListener('submit', (e) => {
  e.preventDefault()
  const valor = $<HTMLInputElement>('#token').value.trim()
  if (!valor) return
  guardarToken(valor)
  $<HTMLInputElement>('#token').value = ''
  mostrarPainel()
})

$('#atualizar').addEventListener('click', () => void carregar())

$('#sair').addEventListener('click', () => {
  try {
    localStorage.removeItem(CHAVE)
  } catch {
    /* nada a fazer */
  }
  mostrarLogin()
})

for (const b of document.querySelectorAll<HTMLButtonElement>('.periodos button')) {
  b.addEventListener('click', () => {
    dias = Number(b.dataset.dias) || 30
    for (const outro of document.querySelectorAll<HTMLButtonElement>('.periodos button')) outro.setAttribute('aria-pressed', String(outro === b))
    void carregar()
  })
}

if (lerToken()) mostrarPainel()
else mostrarLogin()
