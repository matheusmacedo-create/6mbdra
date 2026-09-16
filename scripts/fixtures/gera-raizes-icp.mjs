/**
 * Gera src/tool/lib/raizes-icp.ts a partir das raízes publicadas pelo ITI.
 *
 * Por que as raízes ficam EMBUTIDAS no código, e não são buscadas em tempo de execução:
 *
 * 1. Sigilo. Buscar a cadeia de um certificado durante a verificação contaria a um terceiro que
 *    aquele documento está sendo conferido aqui. A promessa do produto é que nada sai da máquina —
 *    e isso vale para os metadados do certificado tanto quanto para o PDF.
 * 2. Funcionar offline. A ferramenta roda em modo avião hoje; buscar raiz quebraria isso.
 * 3. O HTTPS do próprio ITI não valida. `acraiz.icpbrasil.gov.br` serve só a folha do certificado,
 *    sem a intermediária, então toda busca automatizada falha na verificação de TLS (medido na
 *    Etapa 0 — ver docs/conferidor-etapa-0.md). Baixar por HTTP é aceitável PORQUE certificado é
 *    autoautenticável: a impressão digital fixada abaixo é o que autentica, não o canal.
 *
 * Uso: node scripts/fixtures/gera-raizes-icp.mjs
 * As raízes mudam de década em década; isto é um ritual, não um cron.
 */
import { writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { X509Certificate } from 'node:crypto'

const BASE = 'http://acraiz.icpbrasil.gov.br/credenciadas/RAIZ'
const VERSOES = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]

const achados = []
for (const v of VERSOES) {
  const r = await fetch(`${BASE}/ICP-Brasilv${v}.crt`)
  if (!r.ok) { console.log(`  v${v}: HTTP ${r.status}, pulando`); continue }
  const bruto = Buffer.from(await r.arrayBuffer())
  // O ITI publica ora em PEM, ora em DER. Normalizamos para DER.
  const texto = bruto.toString('latin1')
  const der = texto.includes('BEGIN CERTIFICATE')
    ? Buffer.from(texto.replace(/-----[^-]+-----/g, '').replace(/\s+/g, ''), 'base64')
    : bruto
  const cert = new X509Certificate(der)
  const sha = createHash('sha256').update(der).digest('hex')
  achados.push({
    v,
    der: der.toString('base64'),
    sha,
    nome: /CN=([^,]+)/.exec(cert.subject.replace(/\n/g, ','))?.[1]?.trim() ?? `Raiz v${v}`,
    ate: cert.validTo,
    bytes: der.length,
  })
  console.log(`  v${v}: ${der.length} bytes, expira ${cert.validTo}, sha256 ${sha.slice(0, 16)}…`)
}

const total = achados.reduce((n, a) => n + a.der.length, 0)
const saida = `/**
 * Raízes da ICP-Brasil, embutidas.
 *
 * ARQUIVO GERADO — não edite à mão. Regenere com:
 *   node scripts/fixtures/gera-raizes-icp.mjs
 *
 * São ${achados.length} raízes (v${achados[0].v} a v${achados[achados.length - 1].v}), ${(total / 1024).toFixed(1)} KB em base64. Ficam no código, e não são
 * buscadas durante a verificação, por três razões que se somam: buscar contaria a um terceiro que
 * este documento está sendo conferido aqui (o oposto da promessa do produto), quebraria o
 * funcionamento offline, e o HTTPS do próprio ITI serve cadeia incompleta — nenhuma busca
 * automatizada por lá valida. Certificado é autoautenticável: a impressão digital abaixo é o que
 * garante a origem, não o canal por onde veio.
 *
 * As versões v2 e v3 já expiraram (2023) e continuam aqui de propósito: elas ainda são a âncora de
 * assinaturas feitas na época em que valiam. Reconhecer a raiz e informar que ela expirou é mais
 * útil que dizer "não conheço este certificado".
 */

export interface RaizIcp {
  /** Versão da Autoridade Certificadora Raiz Brasileira. */
  versao: number
  nome: string
  /** DER em base64. */
  der: string
  /** SHA-256 do DER, em hex. Fixado: é o que autentica a raiz. */
  sha256: string
  /** Fim da validade, como veio no certificado. */
  validoAte: string
}

export const RAIZES_ICP: readonly RaizIcp[] = [
${achados.map((a) => `  {
    versao: ${a.v},
    nome: ${JSON.stringify(a.nome)},
    sha256: '${a.sha}',
    validoAte: ${JSON.stringify(a.ate)},
    der:
      '${a.der.match(/.{1,100}/g).join("' +\n      '")}',
  },`).join('\n')}
]
`
writeFileSync('src/tool/lib/raizes-icp.ts', saida)
console.log(`\n${achados.length} raízes, ${(total / 1024).toFixed(1)} KB em base64 → src/tool/lib/raizes-icp.ts`)
