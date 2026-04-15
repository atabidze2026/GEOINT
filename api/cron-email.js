import { Resend } from 'resend';
import crypto from 'crypto';

export default async function handler(request, response) {
  // 1. Verify Vercel Cron Secret (optional but recommended)
  const authHeader = request.headers.authorization;
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return response.status(401).json({ error: 'Unauthorized' });
  }

  const adminPassword = process.env.ADMIN_PASSWORD || 'default_admin_password';
  const recipientEmail = 'a.tabidze2024@gmail.com';
  const resendApiKey = process.env.RESEND_API_KEY;

  if (!resendApiKey) {
    console.error('RESEND_API_KEY is missing');
    return response.status(500).json({ error: 'Email service not configured' });
  }

  try {
    const resend = new Resend(resendApiKey);

    // Hash the password
    const hashed = crypto.createHash('sha256').update(adminPassword).digest('hex');

    const { data, error } = await resend.emails.send({
      from: 'OSINT App <onboarding@resend.dev>',
      to: [recipientEmail],
      subject: 'Daily Admin Password Hash',
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #333;">
          <h2>Daily Security Update</h2>
          <p>This is your automated 24-hour admin password reminder.</p>
          <div style="background: #f4f4f4; padding: 15px; border-radius: 8px; border: 1px solid #ddd; margin: 20px 0;">
            <strong>Current Hashed Password (SHA-256):</strong><br/>
            <code style="word-break: break-all; color: #e11d48;">${hashed}</code>
          </div>
          <p style="font-size: 0.85rem; color: #666;">This email was sent automatically by the OSINT App system.</p>
        </div>
      `,
    });

    if (error) {
      console.error(error);
      return response.status(500).json({ error: 'Failed to send email' });
    }

    return response.status(200).json({ success: true, messageId: data.id });
  } catch (err) {
    console.error(err);
    return response.status(500).json({ error: 'Internal server error' });
  }
}
