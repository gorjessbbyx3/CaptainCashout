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
  
  // Get user by username
  app.get("/api/users/:username", async (req, res) => {
    try {
      const { username } = req.params;
      const user = await storage.getUserByUsername(username);
      
      if (!user) {
        return res.status(404).json({ 
          success: false, 
          message: "User not found. Please check your username." 
        });
      }

      res.json({ 
        success: true, 
        user: {
          id: user.id,
          username: user.username,
          displayName: user.displayName || user.username,
          currentCredits: user.currentCredits
        }
      });
    } catch (error: any) {
      res.status(500).json({ 
        success: false, 
        message: "Failed to lookup user: " + error.message 
      });
    }
  });

  // Get credit packages
  app.get("/api/credit-packages", async (req, res) => {
    try {
      const packages = await storage.getCreditPackages();
      res.json({ success: true, packages });
    } catch (error: any) {
      res.status(500).json({ 
        success: false, 
        message: "Failed to fetch credit packages: " + error.message 
      });
    }
  });

  // Create payment intent for Stripe
  app.post("/api/create-payment-intent", async (req, res) => {
    try {
      const { amount, username, packageId, paymentMethod = 'stripe_card' } = req.body;
      
      if (!amount || !username || !packageId) {
        return res.status(400).json({ 
          success: false, 
          message: "Missing required fields: amount, username, packageId" 
        });
      }

      // Verify package exists
      const creditPackage = await storage.getCreditPackage(packageId);
      if (!creditPackage) {
        return res.status(404).json({ 
          success: false, 
          message: "Credit package not found" 
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
        amount: Math.round(parseFloat(amount) * 100), // Convert to cents
        currency: "usd",
        metadata: {
          username,
          packageId,
          paymentMethod,
          credits: creditPackage.credits.toString()
        }
      });

      // Create transaction record
      const transaction = await storage.createTransaction({
        username,
        packageId,
        amount: amount.toString(),
        credits: creditPackage.credits,
        paymentMethod: paymentMethod as any,
        stripePaymentIntentId: paymentIntent.id,
        metadata: JSON.stringify({ paymentIntentId: paymentIntent.id, username })
      });

      res.json({ 
        success: true, 
        clientSecret: paymentIntent.client_secret,
        transactionId: transaction.id
      });
    } catch (error: any) {
      res.status(500).json({ 
        success: false, 
        message: "Error creating payment intent: " + error.message 
      });
    }
  });

  // Trustly payment processing
  app.post("/api/trustly-payment", async (req, res) => {
    try {
      const { amount, username, packageId, country = 'US', firstName, lastName, email } = req.body;
      
      if (!amount || !username || !packageId || !country || !firstName || !lastName || !email) {
        return res.status(400).json({ 
          success: false, 
          message: "Missing required fields: amount, username, packageId, country, firstName, lastName, email" 
        });
      }

      // Verify package exists
      const creditPackage = await storage.getCreditPackage(packageId);
      
      if (!creditPackage) {
        return res.status(404).json({ 
          success: false, 
          message: "Package not found" 
        });
      }

      // Create transaction record
      const transaction = await storage.createTransaction({
        username,
        packageId,
        amount: amount.toString(),
        credits: creditPackage.credits,
        paymentMethod: 'trustly',
        metadata: JSON.stringify({ country, firstName, lastName, email, username })
      });

      // Process Trustly payment (simplified integration)
      // In production, you would integrate with actual Trustly API
      const trustlyResponse = await processTrustlyPayment({
        amount: parseFloat(amount),
        currency: 'USD',
        country,
        firstName,
        lastName,
        email,
        transactionId: transaction.id,
        description: `Credit purchase - ${creditPackage.credits} credits`
      });

      if (trustlyResponse.success) {
        // Update transaction with Trustly transaction ID
        await storage.updateTransactionStatus(transaction.id, 'completed');
        
        // Send email notification
        await sendPaymentNotificationEmail({
          username: username,
          amount: amount,
          credits: creditPackage.credits,
          transactionId: transaction.id,
          paymentMethod: 'Trustly'
        });

        res.json({ 
          success: true, 
          transactionId: transaction.id,
          trustlyTransactionId: trustlyResponse.transactionId,
          redirectUrl: trustlyResponse.redirectUrl
        });
      } else {
        await storage.updateTransactionStatus(transaction.id, 'failed');
        res.status(400).json({ 
          success: false, 
          message: trustlyResponse.error || "Trustly payment failed" 
        });
      }
    } catch (error: any) {
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
            credits: transaction.credits,
            transactionId: transaction.id,
            paymentMethod: 'Trustly'
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
        const { username, packageId, credits } = paymentIntent.metadata;

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
          credits: parseInt(credits),
          transactionId: transaction.id,
          paymentMethod: 'Stripe'
        });
      }

      res.json({ received: true });
    } catch (error: any) {
      console.error('Webhook error:', error.message);
      res.status(400).json({ error: error.message });
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
