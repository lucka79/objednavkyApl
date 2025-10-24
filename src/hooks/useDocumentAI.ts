import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";

interface DocumentAIResult {
  success: boolean;
  data?: any;
  error?: string;
}

type ProcessingMethod = 'template' | 'google-ai';

export const useDocumentAI = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  /**
   * Process document using template-based extraction (recommended)
   */
  const processDocumentWithTemplate = async (
    file: File, 
    supplierId: string,
    templateId?: string
  ): Promise<DocumentAIResult> => {
    setIsProcessing(true);
    
    try {
      console.log(`Processing document with template for supplier: ${supplierId}`);
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

      console.log('File uploaded, calling template processing...');
      
      const requestBody = {
        storagePath: filePath,
        fileName: file.name,
        supplierId: supplierId,
        templateId: templateId,
      };
      
      console.log('Request body:', JSON.stringify(requestBody));
      
      // Call template-based processing edge function
      const { data, error } = await supabase.functions.invoke('process-invoice-template', {
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
      
      console.log('Template processing result:', data.data);
      
      // Show success message with unmapped codes warning
      if (data.data.unmapped_codes > 0) {
        toast({
          title: "Dokument zpracován",
          description: `Nalezeno ${data.data.items.length} položek. ${data.data.unmapped_codes} kódů nemá přiřazenou surovinu.`,
          variant: "default",
        });
      }
      
      setIsProcessing(false);
      return {
        success: true,
        data: data.data,
      };
      
    } catch (error) {
      setIsProcessing(false);
      
      console.error('Template processing error:', error);
      
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

  /**
   * Process document using Google Document AI (fallback)
   */
  const processDocumentWithGoogleAI = async (file: File, supplierId?: string): Promise<DocumentAIResult> => {
    setIsProcessing(true);
    
    try {
      console.log(`Processing document with Google AI for supplier: ${supplierId}`);
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
      
      const requestBody = {
        storagePath: filePath,
        fileName: file.name,
        mimeType: file.type,
        supplierId: supplierId || 'default',
      };
      
      console.log('Request body:', JSON.stringify(requestBody));
      
      // Call Google AI edge function
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
      
      console.log('Google AI processing result:', data.data);
      
      setIsProcessing(false);
      return {
        success: true,
        data: data.data,
      };
      
    } catch (error) {
      setIsProcessing(false);
      
      console.error('Google AI processing error:', error);
      
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

  /**
   * Main processing function - auto-selects best method
   */
  const processDocument = async (
    file: File, 
    supplierId: string,
    method: ProcessingMethod = 'template'
  ): Promise<DocumentAIResult> => {
    if (method === 'template') {
      return processDocumentWithTemplate(file, supplierId);
    } else {
      return processDocumentWithGoogleAI(file, supplierId);
    }
  };

  return {
    processDocument,
    processDocumentWithTemplate,
    processDocumentWithGoogleAI,
    isProcessing,
  };
};
