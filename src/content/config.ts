import { defineCollection, z } from 'astro:content';
const posts = defineCollection({ schema: z.object({ title:z.string(), date:z.coerce.date(), topic:z.string().min(1), topicSlug:z.string().min(1), tags:z.array(z.string()).default([]), description:z.string().default('') }) });
export const collections = { posts };


