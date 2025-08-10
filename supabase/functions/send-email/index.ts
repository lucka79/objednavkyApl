import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

// Define CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',  // Changed to allow all origins for testing
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
  'Access-Control-Max-Age': '86400',
};

// Helper function to handle base64 decoding
function base64ToUint8Array(base64: string) {
  try {
    // Remove potential data URL prefix and clean the string
    const cleanBase64 = base64.trim().replace(/^data:.+;base64,/, '');
    
    // Replace URL-safe characters and add padding
    const normalizedBase64 = cleanBase64
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(cleanBase64.length + (4 - cleanBase64.length % 4) % 4, '=');

    // Convert to Uint8Array directly using TextEncoder
    const binaryString = atob(normalizedBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer; // Return ArrayBuffer instead of Uint8Array
  } catch (error) {
    console.error('Base64 decoding error:', error);
    throw new Error(`Base64 decoding failed: ${error.message}`);
  }
}

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,  // Changed to 204 for OPTIONS
      headers: corsHeaders
    });
  }

  try {
    const data = await req.json();
    console.log('Request received:', {
      to: data.to,
      subject: data.subject,
      textLength: data.text?.length,
      attachmentsCount: data?.attachments?.length,
      attachmentSizes: data?.attachments?.map(a => ({
        name: a.filename,
        size: a.content.length
      }))
    });
    
    const { to, subject, text, attachments } = data;
    
    if (!to || !subject || !text) {
      console.error('Missing required fields:', { to, subject, text });
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }}
      );
    }

    // Log SMTP configuration (without sensitive data)
    const smtpUsername = Deno.env.get('SMTP_USERNAME');
    const smtpPassword = Deno.env.get('SMTP_PASSWORD');
    console.log('SMTP Configuration:', {
      hostname: "smtp.cesky-hosting.cz",
      port: 465,
      tls: true,
      username: smtpUsername ? `${smtpUsername.substring(0, 3)}***` : 'NOT_SET',
      password: smtpPassword ? '***SET***' : 'NOT_SET'
    });

    // Check if SMTP credentials are set
    if (!smtpUsername || !smtpPassword) {
      const errorMsg = 'SMTP credentials not configured';
      console.error(errorMsg);
      return new Response(
        JSON.stringify({ 
          error: errorMsg,
          details: 'SMTP_USERNAME or SMTP_PASSWORD environment variables are not set'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }}
      );
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
          },
        },
      });

      console.log('SMTP client created successfully');

      // Process all attachments at once
      const processedAttachments = attachments?.map(attachment => ({
        filename: attachment.filename,
        content: base64ToUint8Array(attachment.content),
        contentType: attachment.contentType || 'application/octet-stream',
      }));

      console.log('Email content prepared:', {
        from: smtpUsername,
        to: to,
        subject: subject,
        contentLength: text.length,
        attachmentsCount: processedAttachments?.length || 0
      });

      // Log the actual email content for debugging
      console.log('Email content preview:', {
        subject: subject,
        contentPreview: text.substring(0, 200) + (text.length > 200 ? '...' : ''),
        fullContentLength: text.length,
        containsError: text.includes('Error Details:'),
        containsJson: text.includes('{') && text.includes('}')
      });

      // Check for potential issues with email content
      const contentIssues = [];
      if (text.length > 10000) contentIssues.push('Content too large');
      if (text.includes('\u0000')) contentIssues.push('Contains null characters');
      if (text.includes('\u0001')) contentIssues.push('Contains control characters');
      if (subject.length > 100) contentIssues.push('Subject too long');
      
      if (contentIssues.length > 0) {
        console.warn('Potential email content issues:', contentIssues);
      } else {
        console.log('Email content validation passed');
      }

      // First, try sending a test email without attachments to verify SMTP connection
      console.log('Attempting to send email...');
      
      // Log the exact email configuration being used
      const emailConfig = {
        from: smtpUsername,
        to: to,
        subject: subject,
        content: text,
        html: text.replace(/\n/g, '<br>'),
        attachmentsCount: processedAttachments?.length || 0
      };
      console.log('Email configuration:', emailConfig);

      // Send single email with all attachments
      await client.send({
        from: Deno.env.get('SMTP_USERNAME') || '',
        to: to,
        subject: subject,
        content: text,
        html: text.replace(/\n/g, '<br>'),
        attachments: processedAttachments
      });

      console.log('Email sent successfully with all attachments');
      console.log('Email delivery completed for:', to);
      await client.close();
      
      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }}
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Email send error:', errorMessage);
      if (error instanceof Error && error.stack) {
        console.error('Stack trace:', error.stack);
      }
      return new Response(
        JSON.stringify({ 
          error: 'Failed to send email', 
          details: errorMessage,
          stack: error instanceof Error ? error.stack : undefined 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }}
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Request processing error:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }}
    );
  }
});