import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { Resend } from "https://esm.sh/resend@2.0.0"

// Define CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',  // Changed to allow all origins for testing
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Max-Age': '86400',
};

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,  // Changed to 204 for OPTIONS
      headers: corsHeaders
    });
  }

  try {
    const apiKey = Deno.env.get('RESEND_API_KEY');
    if (!apiKey) throw new Error('RESEND_API_KEY not found');
    
    const resend = new Resend(apiKey);

    const { to, subject, text, attachments } = await req.json();
    console.log('Sending email to:', to);

    const emailData: any = {
      // from: 'onboarding@resend.dev',
      from: 'fakturace@aplica.cz',
      to,
      subject,
      html: text.replace(/\n/g, '<br>'),
    };

    if (attachments && attachments.length > 0) {
      emailData.attachments = attachments.map((attachment: any) => ({
        filename: attachment.filename,
        content: attachment.content,
      }));
    }

    const { data, error } = await resend.emails.send(emailData);

    if (error) {
      console.error('Resend error:', error);
      throw error;
    }

    console.log('Email sent successfully:', data);
    return new Response(
      JSON.stringify({ success: true, data }),
      { 
        status: 200,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json'
        } 
      }
    );
  } catch (error) {
    console.error('Function error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 200,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json'
        }
      }
    );
  }
});