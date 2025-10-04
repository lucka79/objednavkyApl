import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

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
      
      // Always use real Document AI processing
      const { documentAIService } = await import('@/lib/documentAI');
      const result = await documentAIService.processDocument(file, supplierId || 'default');
      
      console.log('Document AI processing result:', result);
      
      setIsProcessing(false);
      return {
        success: true,
        data: result,
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
