import { z } from "zod";

export const CalculateRequestSchema = z.object({
  image: z.string()
    .refine(str => str.startsWith('data:image/'), {
      message: 'Must be a base64 encoded image'
    }),
  dict_of_vars: z.record(z.string(), z.string())
});

export type CalculateRequest = z.infer<typeof CalculateRequestSchema>; 