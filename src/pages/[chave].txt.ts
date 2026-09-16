import type { APIRoute, GetStaticPaths } from 'astro'
import { SITE } from '../config/site'

/*
 * Arquivo de chave do IndexNow, em /<chave>.txt.
 *
 * É como o protocolo prova que quem envia URLs controla o host: o buscador busca este arquivo e
 * confere que o conteúdo é a própria chave. Gerado no build a partir de src/config/site.mjs, que é
 * a única fonte da chave — scripts/indexnow.mjs lê de lá também, então não há como os dois
 * divergirem. Rota estática (robots.txt) tem precedência sobre esta dinâmica.
 */
export const getStaticPaths: GetStaticPaths = () => [{ params: { chave: SITE.indexNow.chave } }]

export const GET: APIRoute = () =>
  new Response(SITE.indexNow.chave, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
