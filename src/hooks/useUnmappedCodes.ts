import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

export interface UnmappedProductCode {
  id: string;
  supplier_id: string;
  product_code: string;
  description: string | null;
  unit_of_measure: string | null;
  last_seen_price: number | null;
  last_seen_quantity: number | null;
  suggested_ingredient_id: number | null;
  suggestion_confidence: number | null;
  status: 'pending' | 'mapped' | 'ignored';
  mapped_to_ingredient_id: number | null;
  mapped_at: string | null;
  mapped_by: string | null;
  occurrence_count: number;
  first_seen_at: string;
  last_seen_at: string;
  created_at: string;
  updated_at: string;
}

export interface UnmappedCodeWithDetails extends UnmappedProductCode {
  suggested_ingredient?: {
    id: number;
    name: string;
    unit: string;
  };
  mapped_ingredient?: {
    id: number;
    name: string;
    unit: string;
  };
  supplier?: {
    id: string;
    full_name: string;
  };
}

export const useUnmappedCodes = (supplierId?: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch unmapped codes
  const { data: unmappedCodes, isLoading } = useQuery({
    queryKey: ["unmapped-codes", supplierId],
    queryFn: async () => {
      let query = supabase
        .from("unmapped_product_codes")
        .select(`
          *,
          suggested_ingredient:ingredients!unmapped_product_codes_suggested_ingredient_id_fkey(id, name, unit),
          mapped_ingredient:ingredients!unmapped_product_codes_mapped_to_ingredient_id_fkey(id, name, unit),
          supplier:profiles!unmapped_product_codes_supplier_id_fkey(id, full_name)
        `)
        .order("occurrence_count", { ascending: false })
        .order("last_seen_at", { ascending: false });

      if (supplierId) {
        query = query.eq("supplier_id", supplierId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as UnmappedCodeWithDetails[];
    },
    enabled: true,
  });

  // Map code to ingredient
  const mapCode = useMutation({
    mutationFn: async ({ 
      codeId, 
      ingredientId,
      createMapping = true 
    }: { 
      codeId: string; 
      ingredientId: number | string;
      createMapping?: boolean;
    }) => {
      const code = unmappedCodes?.find(c => c.id === codeId);
      if (!code) throw new Error("Code not found");

      // Update unmapped code status
      const { error: updateError } = await supabase
        .from("unmapped_product_codes")
        .update({
          status: 'mapped',
          mapped_to_ingredient_id: ingredientId,
          mapped_at: new Date().toISOString(),
        })
        .eq("id", codeId);

      if (updateError) throw updateError;

      // Create mapping in ingredient_supplier_codes if requested
      if (createMapping) {
        // First check if mapping already exists (case-insensitive)
        const { data: existingMapping } = await supabase
          .from("ingredient_supplier_codes")
          .select("id, product_code, is_active")
          .eq("supplier_id", code.supplier_id)
          .eq("ingredient_id", ingredientId)
          .ilike("product_code", code.product_code)
          .maybeSingle();

        if (existingMapping) {
          // Mapping already exists - just activate it if needed
          if (!existingMapping.is_active) {
            await supabase
              .from("ingredient_supplier_codes")
              .update({ is_active: true })
              .eq("id", existingMapping.id);
          }
          console.log("Mapping already exists, reusing:", existingMapping);
        } else {
          // Create new mapping
          const { error: mappingError } = await supabase
            .from("ingredient_supplier_codes")
            .insert({
              ingredient_id: ingredientId,
              supplier_id: code.supplier_id,
              product_code: code.product_code,
              supplier_ingredient_name: code.description,
              price: code.last_seen_price || 0, // Use price from invoice, default to 0
              is_active: true,
            });

          if (mappingError) {
            console.error("Error creating mapping:", mappingError);
            // Check if it's a duplicate error (might happen with race conditions)
            if (mappingError.code !== '23505') {
              throw mappingError;
            }
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["unmapped-codes"] });
      queryClient.invalidateQueries({ queryKey: ["ingredient-supplier-codes"] });
      toast({
        title: "Kód namapován",
        description: "Kód produktu byl úspěšně přiřazen surovině",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Chyba",
        description: `Nepodařilo se namapovat kód: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Ignore code
  const ignoreCode = useMutation({
    mutationFn: async (codeId: string) => {
      const { error } = await supabase
        .from("unmapped_product_codes")
        .update({ status: 'ignored' })
        .eq("id", codeId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["unmapped-codes"] });
      toast({
        title: "Kód ignorován",
        description: "Kód produktu byl označen jako ignorovaný",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Chyba",
        description: `Nepodařilo se ignorovat kód: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Reset code to pending
  const resetCode = useMutation({
    mutationFn: async (codeId: string) => {
      const { error } = await supabase
        .from("unmapped_product_codes")
        .update({ 
          status: 'pending',
          mapped_to_ingredient_id: null,
          mapped_at: null,
        })
        .eq("id", codeId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["unmapped-codes"] });
    },
  });

  // Delete code
  const deleteCode = useMutation({
    mutationFn: async (codeId: string) => {
      const { error } = await supabase
        .from("unmapped_product_codes")
        .delete()
        .eq("id", codeId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["unmapped-codes"] });
      toast({
        title: "Kód smazán",
        description: "Nenamapovaný kód byl smazán",
      });
    },
  });

  const pendingCodes = unmappedCodes?.filter(c => c.status === 'pending') || [];
  const mappedCodes = unmappedCodes?.filter(c => c.status === 'mapped') || [];
  const ignoredCodes = unmappedCodes?.filter(c => c.status === 'ignored') || [];

  return {
    unmappedCodes: unmappedCodes || [],
    pendingCodes,
    mappedCodes,
    ignoredCodes,
    isLoading,
    mapCode: mapCode.mutate,
    ignoreCode: ignoreCode.mutate,
    resetCode: resetCode.mutate,
    deleteCode: deleteCode.mutate,
    isMapping: mapCode.isPending,
  };
};

