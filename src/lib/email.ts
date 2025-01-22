import { createClient } from '@supabase/supabase-js';

interface EmailParams {
  to: string;
  subject: string;
  text: string;
  attachments?: Array<{
    filename: string;
    content: string;
    contentType?: string;
    encoding?: string;
  }>;
}

export const sendEmail = async ({ to, subject, text, attachments = [] }: EmailParams) => {
  const supabase = createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY
  );

  try {
    console.log('Sending email with attachments:', attachments.map(a => ({
      filename: a.filename,
      size: a.content.length
    })));

    const response = await supabase.functions.invoke('send-email', {
      body: {
        to,
        subject,
        text,
        attachments: attachments.map(attachment => ({
          filename: attachment.filename,
          content: attachment.content,
          contentType: attachment.contentType || 'application/octet-stream',
          encoding: 'base64'
        }))
      }
    });

    if (response.error) {
      console.error('Response error details:', response.error);
      throw new Error(response.error.message || 'Unknown error');
    }

    return response.data;
  } catch (error) {
    console.error('Error in sendEmail:', error);
    throw error;
  }
}; 