/*
 * Mantém a tela acesa enquanto um lote roda.
 *
 * No celular a tela apaga em 30 segundos a um minuto sem toque. Quando apaga, o iOS suspende a
 * aba e o Android estrangula o JavaScript: o Ghostscript para no meio, e a pessoa volta e encontra
 * "Preparando…" parado onde estava. Um lote de três arquivos grandes num celular leva minutos —
 * tempo de sobra para a tela apagar. Medido antes disto existir: dos primeiros visitantes humanos,
 * 11 em 14 vieram pelo celular, e nenhum deles concluiu um lote.
 *
 * Wake Lock API: Chrome Android 84+, Safari iOS 16.4+. Onde não existe, nada muda. O pedido só
 * vale com a página visível; ao voltar de outra aba o navegador já liberou o lock, então pedimos
 * de novo enquanto o lote estiver rodando.
 */
export interface TelaAcesa {
  readonly suportada: boolean
  /** Pede o lock (e volta a pedir sempre que a página ficar visível), até soltar(). */
  manter(): Promise<void>
  soltar(): Promise<void>
  readonly ativa: boolean
}

type NavegadorComLock = Navigator & { wakeLock?: { request(tipo: 'screen'): Promise<WakeLockSentinel> } }

export function criarTelaAcesa(nav: Navigator = navigator, doc: Document = document): TelaAcesa {
  const lock = (nav as NavegadorComLock).wakeLock
  let sentinela: WakeLockSentinel | null = null
  let querida = false

  const pedir = async () => {
    if (!lock || !querida || sentinela || doc.visibilityState !== 'visible') return
    try {
      const s = await lock.request('screen')
      // O navegador solta sozinho ao esconder a página; sem isto, `sentinela` ficaria apontando para um lock morto.
      s.addEventListener('release', () => {
        if (sentinela === s) sentinela = null
      })
      sentinela = s
      if (!querida) await soltar()
    } catch {
      // Sem permissão ou bateria baixa: o navegador recusa, e o lote continua sem o lock.
    }
  }
  const aoMudarVisibilidade = () => {
    if (querida && doc.visibilityState === 'visible') void pedir()
  }
  const soltar = async () => {
    querida = false
    doc.removeEventListener('visibilitychange', aoMudarVisibilidade)
    const s = sentinela
    sentinela = null
    try {
      await s?.release()
    } catch {
      // já liberado
    }
  }

  return {
    suportada: Boolean(lock),
    async manter() {
      if (querida) return
      querida = true
      doc.addEventListener('visibilitychange', aoMudarVisibilidade)
      await pedir()
    },
    soltar,
    get ativa() {
      return sentinela !== null
    },
  }
}
