import { SITE } from '../../config/site'

/**
 * BreadcrumbList para as páginas que não geram a própria (índices, institucionais).
 *
 * As páginas de tribunal, sistema e guia montam a trilha inline porque o último item vem dos
 * dados; estas têm caminho fixo. O buscador usa a trilha para mostrar "brpdf › Tribunais" no lugar
 * da URL crua — e para entender que /tribunais/ é o pai das 101 páginas de tribunal.
 */
export function trilha(...itens: { nome: string; caminho: string }[]) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: [{ nome: 'Início', caminho: '/' }, ...itens].map((x, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: x.nome,
      item: new URL(x.caminho, SITE.url).href,
    })),
  }
}

export function dadosEstruturados(...nos: object[]) {
  return { '@context': 'https://schema.org', '@graph': nos }
}
