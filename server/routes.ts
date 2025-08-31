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

const cellPayConfig = {
  apiUrl: process.env.CELLPAY_API_URL || 'https://api.cellpay.com',
  memberId: process.env.CELLPAY_MEMBER_ID || '',
  apiKey: process.env.CELLPAY_API_KEY || ''
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

  // CellPay payment processing
  app.post("/api/cellpay-payment", async (req, res) => {
    try {
      const { amount, username, packageId, phoneNumber } = req.body;
      
      if (!amount || !username || !packageId || !phoneNumber) {
        return res.status(400).json({ 
          success: false, 
          message: "Missing required fields: amount, username, packageId, phoneNumber" 
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
        paymentMethod: 'cellpay',
        metadata: JSON.stringify({ phoneNumber, username })
      });

      // Process CellPay payment (simplified integration)
      // In production, you would integrate with actual CellPay API
      const cellPayResponse = await processCellPayPayment({
        amount: parseFloat(amount),
        phoneNumber,
        transactionId: transaction.id,
        description: `Credit purchase - ${creditPackage.credits} credits`
      });

      if (cellPayResponse.success) {
        // Update transaction with CellPay transaction ID
        await storage.updateTransactionStatus(transaction.id, 'completed');
        
        // Send email notification
        await sendPaymentNotificationEmail({
          username: username,
          amount: amount,
          credits: creditPackage.credits,
          transactionId: transaction.id,
          paymentMethod: 'CellPay'
        });

        res.json({ 
          success: true, 
          transactionId: transaction.id,
          cellPayTransactionId: cellPayResponse.transactionId
        });
      } else {
        await storage.updateTransactionStatus(transaction.id, 'failed');
        res.status(400).json({ 
          success: false, 
          message: cellPayResponse.error || "CellPay payment failed" 
        });
      }
    } catch (error: any) {
      res.status(500).json({ 
        success: false, 
        message: "Error processing CellPay payment: " + error.message 
      });
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

// CellPay payment processing function
async function processCellPayPayment(paymentData: {
  amount: number;
  phoneNumber: string;
  transactionId: string;
  description: string;
}): Promise<{ success: boolean; transactionId?: string; error?: string }> {
  try {
    // This is a simplified CellPay integration
    // In production, you would use the actual CellPay API
    const cellPayPayload = {
      memberId: cellPayConfig.memberId,
      amount: paymentData.amount,
      memberPrincipal: paymentData.phoneNumber,
      invoice: paymentData.transactionId,
      description: paymentData.description,
      traceNumber: Date.now().toString()
    };

    // Simulate API call to CellPay
    // Replace with actual CellPay API integration
    const response = await fetch(`${cellPayConfig.apiUrl}/payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cellPayConfig.apiKey}`
      },
      body: JSON.stringify(cellPayPayload)
    });

    if (response.ok) {
      const result = await response.json();
      return {
        success: true,
        transactionId: result.transactionId || paymentData.transactionId
      };
    } else {
      return {
        success: false,
        error: 'CellPay payment failed'
      };
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message
    };
  }
}
