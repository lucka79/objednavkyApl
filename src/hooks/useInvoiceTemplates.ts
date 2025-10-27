import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

export interface InvoiceTemplate {
  id: string;
  supplier_id: string;
  template_name: string;
  version: string;
  is_active: boolean;
  config: TemplateConfig;
  success_rate: number;
  usage_count: number;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TemplateConfig {
  page_regions?: {
    header?: Region;
    items_table?: Region;
  };
  table_columns?: {
    product_code?: ColumnConfig;
    description?: ColumnConfig;
    quantity?: ColumnConfig;
    unit?: ColumnConfig;
    unit_price?: ColumnConfig;
    total?: ColumnConfig;
    line_pattern?: string;
  };
  patterns?: {
    invoice_number?: string;
    date?: string;
    supplier?: string;
    total_amount?: string;
    payment_type?: string;
    table_start?: string;
    table_end?: string;
  };
  ocr_settings?: {
    dpi?: number;
    language?: string;
    psm?: number;
  };
  display_layout?: "standard" | "makro" | "two-line";
}

interface Region {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ColumnConfig {
  index: number;
  x_start: number;
  x_end: number;
}

export const useInvoiceTemplates = (supplierId?: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch templates for supplier
  const { data: templates, isLoading } = useQuery({
    queryKey: ["invoice-templates", supplierId],
    queryFn: async () => {
      let query = supabase
        .from("invoice_templates")
        .select("*")
        .order("is_active", { ascending: false })
        .order("last_used_at", { ascending: false, nullsFirst: false });

      if (supplierId) {
        query = query.eq("supplier_id", supplierId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as InvoiceTemplate[];
    },
    enabled: true,
  });

  // Create template
  const createTemplate = useMutation({
    mutationFn: async (newTemplate: Omit<InvoiceTemplate, "id" | "created_at" | "updated_at" | "success_rate" | "usage_count" | "last_used_at">) => {
      const { data, error } = await supabase
        .from("invoice_templates")
        .insert(newTemplate)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoice-templates"] });
      toast({
        title: "Šablona vytvořena",
        description: "Šablona faktury byla úspěšně vytvořena",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Chyba",
        description: `Nepodařilo se vytvořit šablonu: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Update template
  const updateTemplate = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<InvoiceTemplate> }) => {
      const { data, error } = await supabase
        .from("invoice_templates")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoice-templates"] });
      toast({
        title: "Šablona aktualizována",
        description: "Šablona faktury byla úspěšně aktualizována",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Chyba",
        description: `Nepodařilo se aktualizovat šablonu: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Delete template
  const deleteTemplate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("invoice_templates")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoice-templates"] });
      toast({
        title: "Šablona smazána",
        description: "Šablona faktury byla úspěšně smazána",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Chyba",
        description: `Nepodařilo se smazat šablonu: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Toggle active status
  const toggleActive = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from("invoice_templates")
        .update({ is_active: isActive })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoice-templates"] });
    },
  });

  return {
    templates: templates || [],
    isLoading,
    createTemplate: createTemplate.mutate,
    updateTemplate: updateTemplate.mutate,
    deleteTemplate: deleteTemplate.mutate,
    toggleActive: toggleActive.mutate,
    isCreating: createTemplate.isPending,
    isUpdating: updateTemplate.isPending,
    isDeleting: deleteTemplate.isPending,
  };
};

