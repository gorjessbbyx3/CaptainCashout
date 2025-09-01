import type { Express } from "express";
import { createServer, type Server } from "http";
import Stripe from "stripe";
import { storage } from "./storage";
import { insertUserSchema, insertTransactionSchema } from "@shared/schema";
import { z } from "zod";
import { sendPaymentNotificationEmail } from "./services/email";

// For development, allow missing Stripe keys
if (!process.env.STRIPE_SECRET_KEY) {
  console.warn('⚠️  STRIPE_SECRET_KEY not found - Payment processing will not work');
}

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-08-27.basil",
}) : null;

const trustlyConfig = {
  apiUrl: process.env.TRUSTLY_API_URL || 'https://test.trustly.com/api/1',
  username: process.env.TRUSTLY_USERNAME || '',
  password: process.env.TRUSTLY_PASSWORD || '',
  privateKey: process.env.TRUSTLY_PRIVATE_KEY || ''
};

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Simple username validation endpoint
  app.get("/api/users/:username", async (req, res) => {
    try {
      const { username } = req.params;
      
      // Simple validation for username format
      if (!username || username.length < 3) {
        return res.status(404).json({ 
          success: false, 
          message: "Username must be at least 3 characters long." 
        });
      }

      // For now, accept any valid username format
      res.json({ 
        success: true, 
        user: {
          username: username,
          displayName: username,
          message: "Username is valid"
        }
      });
    } catch (error: any) {
      res.status(500).json({ 
        success: false, 
        message: "Failed to validate username: " + error.message 
      });
    }
  });

  // Create payment intent for Stripe
  app.post("/api/create-payment-intent", async (req, res) => {
    try {
      const { amount, username, paymentMethod = 'stripe_card' } = req.body;
      
      if (!amount || !username) {
        return res.status(400).json({ 
          success: false, 
          message: "Missing required fields: amount, username" 
        });
      }

      // Validate amount
      const numAmount = parseFloat(amount);
      if (isNaN(numAmount) || numAmount < 10 || numAmount > 500) {
        return res.status(400).json({ 
          success: false, 
          message: "Amount must be between $10 and $500" 
        });
      }

      if (!stripe) {
        return res.status(500).json({ 
          success: false, 
          message: "Payment processing not configured" 
        });
      }

      // Create payment intent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(numAmount * 100), // Convert to cents
        currency: "usd",
        metadata: {
          username,
          paymentMethod,
          reloadAmount: amount
        }
      });

      // Create transaction record
      const transaction = await storage.createTransaction({
        username,
        amount: amount.toString(),
        paymentMethod: paymentMethod as any,
        stripePaymentIntentId: paymentIntent.id,
        metadata: JSON.stringify({ paymentIntentId: paymentIntent.id, username, reloadAmount: amount })
      });

      res.json({ 
        success: true, 
        clientSecret: paymentIntent.client_secret,
        transactionId: transaction.id
      });
    } catch (error: any) {
      // Send failure notification email if we have the required data
      if (req.body.username && req.body.amount) {
        try {
          await sendPaymentNotificationEmail({
            username: req.body.username,
            amount: req.body.amount,
            transactionId: 'system-error',
            paymentMethod: 'Stripe',
            status: 'failed',
            errorMessage: error.message
          });
        } catch (emailError) {
          console.error('Failed to send error notification email:', emailError);
        }
      }
      
      res.status(500).json({ 
        success: false, 
        message: "Error creating payment intent: " + error.message 
      });
    }
  });

  // Trustly payment processing
  app.post("/api/trustly-payment", async (req, res) => {
    try {
      const { amount, username, country = 'US', firstName, lastName, email } = req.body;
      
      if (!amount || !username || !country || !firstName || !lastName || !email) {
        return res.status(400).json({ 
          success: false, 
          message: "Missing required fields: amount, username, country, firstName, lastName, email" 
        });
      }

      // Validate amount
      const numAmount = parseFloat(amount);
      if (isNaN(numAmount) || numAmount < 10 || numAmount > 500) {
        return res.status(400).json({ 
          success: false, 
          message: "Amount must be between $10 and $500" 
        });
      }

      // Create transaction record
      const transaction = await storage.createTransaction({
        username,
        amount: amount.toString(),
        paymentMethod: 'trustly',
        metadata: JSON.stringify({ country, firstName, lastName, email, username })
      });

      // Process Trustly payment (simplified integration)
      // In production, you would integrate with actual Trustly API
      const trustlyResponse = await processTrustlyPayment({
        amount: numAmount,
        currency: 'USD',
        country,
        firstName,
        lastName,
        email,
        transactionId: transaction.id,
        description: `Account reload - $${amount}`
      });

      if (trustlyResponse.success) {
        // Update transaction with Trustly transaction ID
        await storage.updateTransactionStatus(transaction.id, 'completed');
        
        // Send email notification
        await sendPaymentNotificationEmail({
          username: username,
          amount: amount,
          transactionId: transaction.id,
          paymentMethod: 'Trustly',
          status: 'success'
        });

        res.json({ 
          success: true, 
          transactionId: transaction.id,
          trustlyTransactionId: trustlyResponse.transactionId,
          redirectUrl: trustlyResponse.redirectUrl
        });
      } else {
        await storage.updateTransactionStatus(transaction.id, 'failed');
        
        // Send failure notification email
        await sendPaymentNotificationEmail({
          username: username,
          amount: amount,
          transactionId: transaction.id,
          paymentMethod: 'Trustly',
          status: 'failed',
          errorMessage: trustlyResponse.error || "Trustly payment failed"
        });
        
        res.status(400).json({ 
          success: false, 
          message: trustlyResponse.error || "Trustly payment failed" 
        });
      }
    } catch (error: any) {
      // Send failure notification email if we have the required data
      if (req.body.username && req.body.amount) {
        try {
          await sendPaymentNotificationEmail({
            username: req.body.username,
            amount: req.body.amount,
            transactionId: 'system-error',
            paymentMethod: 'Trustly',
            status: 'failed',
            errorMessage: error.message
          });
        } catch (emailError) {
          console.error('Failed to send error notification email:', emailError);
        }
      }
      
      res.status(500).json({ 
        success: false, 
        message: "Error processing Trustly payment: " + error.message 
      });
    }
  });

  // Trustly webhook handler
  app.post("/api/trustly-webhook", async (req, res) => {
    try {
      const notification = req.body;
      
      // In production, verify the notification signature here
      console.log('Trustly webhook received:', notification);
      
      if (notification.method === 'credit' && notification.params) {
        const { messageid, amount } = notification.params;
        
        // Find transaction by message ID
        const transaction = await storage.getTransaction(messageid);
        if (transaction) {
          // Update transaction status to completed
          await storage.updateTransactionStatus(transaction.id, 'completed');
          
          // Send email notification
          await sendPaymentNotificationEmail({
            username: transaction.username,
            amount: amount,
            transactionId: transaction.id,
            paymentMethod: 'Trustly',
            status: 'success'
          });
        }
      }
      
      // Respond with OK status
      res.json({ status: 'OK' });
    } catch (error: any) {
      console.error('Trustly webhook error:', error.message);
      res.status(400).json({ error: error.message });
    }
  });

  // Stripe webhook handler
  app.post("/api/stripe-webhook", async (req, res) => {
    try {
      const sig = req.headers['stripe-signature'] as string;
      const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

      if (!endpointSecret) {
        throw new Error('Missing Stripe webhook secret');
      }

      if (!stripe) {
        return res.status(500).json({ error: 'Stripe not configured' });
      }
      
      const event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);

      if (event.type === 'payment_intent.succeeded') {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const { username } = paymentIntent.metadata;

        // Find transaction by payment intent ID
        const transaction = await storage.getTransactionByPaymentIntentId(paymentIntent.id);
        if (!transaction) {
          console.error('Transaction not found for payment intent:', paymentIntent.id);
          return res.status(404).json({ error: 'Transaction not found' });
        }

        // Update transaction status
        await storage.updateTransactionStatus(transaction.id, 'completed');

        // Send email notification
        await sendPaymentNotificationEmail({
          username: username,
          amount: (paymentIntent.amount / 100).toString(),
          transactionId: transaction.id,
          paymentMethod: 'Stripe',
          status: 'success'
        });
      } else if (event.type === 'payment_intent.payment_failed') {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const { username } = paymentIntent.metadata;

        // Find transaction by payment intent ID
        const transaction = await storage.getTransactionByPaymentIntentId(paymentIntent.id);
        if (transaction) {
          // Update transaction status
          await storage.updateTransactionStatus(transaction.id, 'failed');

          // Send failure notification email
          await sendPaymentNotificationEmail({
            username: username,
            amount: (paymentIntent.amount / 100).toString(),
            transactionId: transaction.id,
            paymentMethod: 'Stripe',
            status: 'failed',
            errorMessage: paymentIntent.last_payment_error?.message || 'Payment failed'
          });
        }
      }

      res.json({ received: true });
    } catch (error: any) {
      console.error('Webhook error:', error.message);
      res.status(400).json({ error: error.message });
    }
  });

  // Test email endpoint
  app.post("/api/test-email", async (req, res) => {
    try {
      console.log('Sending test email...');
      
      await sendPaymentNotificationEmail({
        username: 'TestUser',
        amount: '25.00',
        transactionId: 'test-' + Date.now(),
        paymentMethod: 'Test',
        status: 'success'
      });

      res.json({ 
        success: true, 
        message: "Test email sent successfully to captaincashout@my.com" 
      });
    } catch (error: any) {
      console.error('Test email failed:', error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to send test email: " + error.message 
      });
    }
  });


  const httpServer = createServer(app);
  return httpServer;
}

// Trustly payment processing function
async function processTrustlyPayment(paymentData: {
  amount: number;
  currency: string;
  country: string;
  firstName: string;
  lastName: string;
  email: string;
  transactionId: string;
  description: string;
}): Promise<{ success: boolean; transactionId?: string; redirectUrl?: string; error?: string }> {
  try {
    // This is a simplified Trustly integration
    // In production, you would use the actual Trustly API with proper authentication
    const trustlyPayload = {
      method: 'Deposit',
      params: {
        notificationurl: `${process.env.BASE_URL || 'http://localhost:5000'}/api/trustly-webhook`,
        enduserid: paymentData.email,
        messageid: paymentData.transactionId,
        amount: paymentData.amount.toFixed(2),
        currency: paymentData.currency,
        country: paymentData.country,
        firstname: paymentData.firstName,
        lastname: paymentData.lastName,
        email: paymentData.email,
        successfulurlredirect: `${process.env.BASE_URL || 'http://localhost:5000'}?payment=success`,
        errorurlredirect: `${process.env.BASE_URL || 'http://localhost:5000'}?payment=error`,
        locale: 'en_US'
      }
    };

    // Simulate API call to Trustly
    // Replace with actual Trustly API integration using their SDK
    console.log('Trustly Payment Request:', trustlyPayload);
    
    // For demo purposes, return a successful response with a mock redirect URL
    // In production, you would get a real redirect URL from Trustly
    const mockRedirectUrl = `https://test.trustly.com/select-bank?token=mock_${paymentData.transactionId}`;
    
    return {
      success: true,
      transactionId: paymentData.transactionId,
      redirectUrl: mockRedirectUrl
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message
    };
  }
}
