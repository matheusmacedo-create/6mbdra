import { defineCollection } from 'astro:content'
import { z } from 'astro/zod'
import { glob } from 'astro/loaders'

const guias = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/guias' }),
  schema: z.object({
    title: z.string().max(80),
    /**
     * Título para o resultado da busca, quando o editorial não cabe em 60 caracteres. O h1 continua
     * sendo `title`; só a aba e o snippet usam este. Sem ele, o Base corta o sufixo " · brpdf".
     */
    titleSeo: z.string().max(60).optional(),
    description: z.string().max(170),
    updated: z.coerce.date(),
    tags: z.array(z.string()).default([]),
  }),
})

export const collections = { guias }
