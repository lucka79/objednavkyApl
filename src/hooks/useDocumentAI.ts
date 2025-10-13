import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";

interface DocumentAIResult {
  success: boolean;
  data?: any;
  error?: string;
}

export const useDocumentAI = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const processDocument = async (file: File, supplierId?: string): Promise<DocumentAIResult> => {
    setIsProcessing(true);
    
    try {
      console.log(`Processing document with Document AI for supplier: ${supplierId}`);
      console.log(`File: ${file.name}, Size: ${file.size} bytes, Type: ${file.type}`);
      
      // Upload file to Supabase Storage first
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `temp-documents/${fileName}`;
      
      console.log('Uploading file to storage...');
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) {
        throw new Error(`Failed to upload file: ${uploadError.message}`);
      }

      console.log('File uploaded, calling Edge Function...');
      
      // Prepare request body
      const requestBody = {
        storagePath: filePath,
        fileName: file.name,
        mimeType: file.type,
        supplierId: supplierId || 'default',
      };
      
      console.log('Request body:', JSON.stringify(requestBody));
      
      // Call Supabase Edge Function with storage path
      const { data, error } = await supabase.functions.invoke('process-document', {
        body: requestBody,
      });

      // Clean up temp file from storage
      console.log('Cleaning up temp file...');
      await supabase.storage.from('documents').remove([filePath]);

      if (error) {
        throw new Error(error.message || 'Failed to process document');
      }

      if (!data.success) {
        throw new Error(data.error || 'Document processing failed');
      }
      
      console.log('Document AI processing result:', data.data);
      
      setIsProcessing(false);
      return {
        success: true,
        data: data.data,
      };
      
    } catch (error) {
      setIsProcessing(false);
      
      // Log error for debugging
      console.error('Document AI processing error:', error);
      
      toast({
        title: "Chyba zpracování",
        description: `Nepodařilo se zpracovat dokument: ${error instanceof Error ? error.message : 'Neznámá chyba'}`,
        variant: "destructive",
      });
      
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  };

  return {
    processDocument,
    isProcessing,
  };
};
