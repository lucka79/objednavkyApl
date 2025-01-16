import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

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
    const client = new SMTPClient({
      connection: {
        hostname: "smtp.cesky-hosting.cz",
        port: 465,
        tls: true,
        auth: {
          username: Deno.env.get('SMTP_USERNAME') || '',
          password: Deno.env.get('SMTP_PASSWORD') || '',
        }
      },
    });

    const { to, subject, text, attachments } = await req.json();
    console.log('Sending email to:', to);

    // Make sure the from address matches your authenticated domain
    const fromEmail = Deno.env.get('SMTP_USERNAME') || 'fakturace@aplica.cz';

    // Send email
    await client.send({
      from: fromEmail,
      to,
      subject,
      content: text,
      html: text.replace(/\n/g, '<br>'),
      attachments: attachments?.map((attachment: any) => ({
        filename: attachment.filename,
        content: Uint8Array.from(atob(attachment.content).split('').map(c => c.charCodeAt(0))),
        contentType: 'application/pdf',
      })),
    });

    await client.close();

    console.log('Email sent successfully');
    return new Response(
      JSON.stringify({ success: true }),
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