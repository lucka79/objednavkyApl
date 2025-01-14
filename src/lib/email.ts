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

export const sendEmail = async (params: EmailParams) => {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data, error } = await supabase.functions.invoke('send-email', {
    body: {
      to: params.to,
      subject: params.subject,
      text: params.text,
      attachments: params.attachments
    }
  });

  if (error) throw error;
  return data;
}; 