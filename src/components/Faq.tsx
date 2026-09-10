export function Faq() {
  return (
    <section className="card">
      <h2>Perguntas frequentes</h2>
      <details>
        <summary>Meus documentos são enviados para algum servidor?</summary>
        <p>
          Não. Toda a compressão acontece dentro do seu navegador, no seu computador. Nenhum arquivo sai da sua máquina, e
          nada fica salvo em lugar nenhum depois que você fecha a página. Você pode até desligar a internet depois que a
          página carregar.
        </p>
      </details>
      <details>
        <summary>O texto continua pesquisável depois de compactar?</summary>
        <p>
          Sim. O motor principal (Ghostscript) reduz apenas as imagens do PDF, mantendo textos, fontes, marcadores e a camada
          de OCR de digitalizações. Só no "modo de emergência", usado quando o arquivo é problemático, as páginas viram
          imagens e o texto deixa de ser selecionável.
        </p>
      </details>
      <details>
        <summary>Como vocês escolhem o quanto comprimir?</summary>
        <p>
          Tentamos primeiro a compressão mais leve que deve caber no limite e só apertamos mais se for necessário. Assim o
          documento fica o mais nítido que o limite permite. Os níveis vão de 200 dpi (quase idêntico ao original) até 80
          dpi (ainda legível em tela).
        </p>
      </details>
      <details>
        <summary>E se mesmo assim não couber?</summary>
        <p>
          Com a opção "dividir em partes" ligada, o arquivo já comprimido é dividido em partes numeradas ("parte 1 de 3"),
          cada uma dentro do limite, sem cortar páginas ao meio. Você protocola cada parte como um documento.
        </p>
      </details>
      <details>
        <summary>Por que a compressão demora?</summary>
        <p>
          O processamento usa o processador do seu computador, não um servidor. Digitalizações grandes (dezenas de MB) podem
          levar de alguns segundos a poucos minutos. Você pode deixar vários arquivos na fila e ir fazendo outra coisa.
        </p>
      </details>
      <details>
        <summary>Funciona com PDF protegido por senha?</summary>
        <p>
          Se o PDF exige senha para abrir, ele precisa ser destravado antes (abra no leitor de PDF, digite a senha e salve
          uma cópia). PDFs com restrição só de edição/impressão são processados normalmente.
        </p>
      </details>
      <details>
        <summary>Qual é o limite do meu tribunal?</summary>
        <p>
          Varia bastante: há sistemas com 1,5 MB, 3 MB, 5 MB, 6 MB, 10 MB ou mais por arquivo, e o valor pode mudar. Confira
          no manual do sistema (PJe, e-SAJ, Projudi, eproc) ou na tela de anexar documentos e ajuste o limite aqui em cima.
        </p>
      </details>
    </section>
  )
}
