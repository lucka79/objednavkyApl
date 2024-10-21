import * as z from 'zod'

export const productSchema = z.object({
  name: z.string().min(3, 'Název produktu musí mít alespoň 3 znaky').max(100, 'Název produktu musí mít méně než 100 znaků'),
  description: z.string().min(1, 'Description is required').max(500, 'Description must be 500 characters or less'),
  price: z.number().positive('Cena musí být kladná').min(0.01, 'Minimální cena je 0.01'),
  priceMobil: z.number().positive('Cena musí být kladná').min(0.01, 'Minimální cena je 0.01'),
  category_id: z.number().int('Category ID must be an integer').nonnegative('Category ID cannot be negative'),
//   stock: z.number().int('Stock must be an integer').nonnegative('Stock cannot be negative'),
})

export type ProductFormData = z.infer<typeof productSchema>