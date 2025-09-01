import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASSWORD || ''
  }
});

interface PaymentNotificationData {
  username: string;
  amount: string;
  transactionId: string;
  paymentMethod: string;
  status: 'success' | 'failed';
  errorMessage?: string;
}

export async function sendPaymentNotificationEmail(data: PaymentNotificationData): Promise<void> {
  try {
    const { username, amount, transactionId, paymentMethod, status, errorMessage } = data;
    
    const isSuccess = status === 'success';
    const statusColor = isSuccess ? '#28a745' : '#dc3545';
    const statusIcon = isSuccess ? '✅' : '❌';
    const timestamp = new Date().toLocaleString();
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .header { text-align: center; margin-bottom: 30px; }
          .logo { font-size: 24px; font-weight: bold; color: #ffd700; background: linear-gradient(135deg, #ffd700, #ffb347); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
          .title { color: #333; margin: 10px 0; }
          .amount { font-size: 36px; font-weight: bold; color: ${statusColor}; text-align: center; margin: 20px 0; }
          .details { background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .detail-row { display: flex; justify-content: space-between; margin: 10px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          .error { background-color: #f8d7da; color: #721c24; padding: 15px; border-radius: 8px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">💰 Captain Cashout</div>
            <h1 class="title">${statusIcon} Payment ${isSuccess ? 'Successful' : 'Failed'}!</h1>
          </div>
          
          <div class="amount">$${amount}</div>
          
          <div class="details">
            <div class="detail-row">
              <strong>Username:</strong>
              <span>${username}</span>
            </div>
            <div class="detail-row">
              <strong>Amount:</strong>
              <span>$${amount}</span>
            </div>
            <div class="detail-row">
              <strong>Payment Method:</strong>
              <span>${paymentMethod}</span>
            </div>
            <div class="detail-row">
              <strong>Transaction ID:</strong>
              <span>${transactionId}</span>
            </div>
            <div class="detail-row">
              <strong>Timestamp:</strong>
              <span>${timestamp}</span>
            </div>
          </div>
          
          ${!isSuccess && errorMessage ? `<div class="error"><strong>Error Details:</strong> ${errorMessage}</div>` : ''}
          
          <div class="footer">
            <p>This is an automated notification from Captain Cashout payment system.</p>
            <p>For support, contact @captaincashout on Instagram or email captaincashout@my.com</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const mailOptions = {
      from: process.env.SMTP_FROM || 'noreply@captaincashout.com',
      to: 'captaincashout@my.com',
      subject: `Payment ${isSuccess ? 'Received' : 'Failed'} - $${amount} from ${username}`,
      html: htmlContent,
      text: `
        Captain Cashout - Payment Notification
        
        Payment ${isSuccess ? 'Successful' : 'Failed'}:
        
        Username: ${username}
        Amount: $${amount}
        Payment Method: ${paymentMethod}
        Transaction ID: ${transactionId}
        Timestamp: ${timestamp}
        ${!isSuccess && errorMessage ? `Error: ${errorMessage}` : ''}
        
        This is an automated notification from Captain Cashout payment system.
      `
    };

    await transporter.sendMail(mailOptions);
    console.log(`Payment notification email sent for transaction ${transactionId}`);
  } catch (error) {
    console.error('Failed to send payment notification email:', error);
    // Don't throw error as email failure shouldn't break the payment flow
  }
}
