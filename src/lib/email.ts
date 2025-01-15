import { createClient } from '@supabase/supabase-js';

interface EmailParams {
  to: string;
  subject: string;
  text: string;
  attachments?: Array<{
    filename: string;
    content: Blob;
  }>;
}

export const sendEmail = async ({ to, subject, text, attachments = [] }: EmailParams) => {
  const supabase = createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY
  );

  try {
    // Convert PDF blob to base64
    const attachmentsWithBase64 = await Promise.all(
      attachments.map(async (attachment) => ({
        filename: attachment.filename,
        content: await blobToBase64(attachment.content),
      }))
    );

    const { data, error } = await supabase.functions.invoke('send-email', {
      body: { 
        to, 
        subject, 
        text,
        attachments: attachmentsWithBase64
      }
    });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error in sendEmail:', error);
    throw error;
  }
};

// Helper function to convert Blob to base64
const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      // Remove the data URL prefix (e.g., "data:application/pdf;base64,")
      const base64Content = base64String.split(',')[1];
      resolve(base64Content);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}; 