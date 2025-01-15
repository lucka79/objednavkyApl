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

export const sendEmail = async ({ to, subject, text, attachments }: EmailParams) => {
  const supabase = createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY
  );
  
  try {
    const emailData = { to, subject, text };
    console.log('Sending email with data:', emailData);
    
    const { data, error } = await supabase.functions.invoke('send-email', {
      body: emailData
    });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error in sendEmail:', error);
    throw error;
  }
}; 