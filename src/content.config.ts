import { defineCollection } from 'astro:content'
import { z } from 'astro/zod'
import { glob } from 'astro/loaders'

const guias = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/guias' }),
  schema: z.object({
    title: z.string().max(80),
    description: z.string().max(170),
    updated: z.coerce.date(),
    tags: z.array(z.string()).default([]),
  }),
})

export const collections = { guias }
