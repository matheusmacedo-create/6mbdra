import { track } from './analytics'
import type { OutputFile } from './types'

/*
 * Compartilhar o resultado pela folha do sistema (Web Share API, nível 2 — com arquivos).
 *
 * No celular, o passo seguinte a comprimir um PDF é mandá-lo para alguém: o cliente, o
 * correspondente, o próprio e-mail. Sem isto o caminho no iOS é "Baixar → Arquivos → abrir o
 * WhatsApp → anexar → procurar o arquivo"; com isto é um toque. Onde não há suporte (desktop no
 * Linux, Firefox), o botão não aparece — "Baixar" continua sendo o caminho.
 *
 * Suporte com arquivos: Safari iOS 15+, Chrome Android 75+, Chrome/Edge no Windows e macOS.
 */

/** Só quando o navegador compartilha ARQUIVOS; ter `share` sem `canShare({ files })` não basta. */
export function podeCompartilharArquivos(nav: Navigator = navigator): boolean {
  if (typeof nav.share !== 'function' || typeof nav.canShare !== 'function') return false
  try {
    return nav.canShare({ files: [new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], 'teste.pdf', { type: 'application/pdf' })] })
  } catch {
    return false
  }
}

export type ResultadoCompartilhar = 'enviado' | 'cancelado' | 'falhou'

/**
 * Abre a folha de compartilhamento com os PDFs. "cancelado" é a pessoa fechando a folha — não é
 * erro e não pode virar mensagem de erro. Só "enviado" conta na medição.
 */
/** Resultado em memória → File, sem leitura assíncrona: a folha só abre se for chamada dentro do toque. */
export const paraFile = (o: OutputFile): File => new File([o.bytes as BlobPart], o.name, { type: 'application/pdf' })

export async function compartilharArquivos(files: File[], tipo: 'arquivo' | 'partes' | 'lote', nav: Navigator = navigator): Promise<ResultadoCompartilhar> {
  if (files.length === 0) return 'falhou'
  try {
    await nav.share({ files, title: files.length === 1 ? files[0].name : `${files.length} PDFs preparados` })
    track('compartilhou', { tipo, quantidade: files.length })
    return 'enviado'
  } catch (e) {
    return (e as { name?: string } | null)?.name === 'AbortError' ? 'cancelado' : 'falhou'
  }
}
