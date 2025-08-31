import { users, creditPackages, transactions, type User, type InsertUser, type CreditPackage, type InsertCreditPackage, type Transaction, type InsertTransaction } from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  // User operations (not needed for username-only flow)
  // getUser(id: string): Promise<User | undefined>;
  // getUserByUsername(username: string): Promise<User | undefined>;
  // createUser(user: InsertUser): Promise<User>;
  // updateUserCredits(userId: string, credits: number): Promise<User>;

  // Credit package operations
  getCreditPackages(): Promise<CreditPackage[]>;
  getCreditPackage(id: string): Promise<CreditPackage | undefined>;
  createCreditPackage(pkg: InsertCreditPackage): Promise<CreditPackage>;

  // Transaction operations
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  getTransaction(id: string): Promise<Transaction | undefined>;
  getTransactionByPaymentIntentId(paymentIntentId: string): Promise<Transaction | undefined>;
  updateTransactionStatus(id: string, status: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded'): Promise<Transaction>;
}

export class DatabaseStorage implements IStorage {

  async getCreditPackages(): Promise<CreditPackage[]> {
    return await db.select().from(creditPackages).where(eq(creditPackages.isActive, true));
  }

  async getCreditPackage(id: string): Promise<CreditPackage | undefined> {
    const [pkg] = await db.select().from(creditPackages).where(eq(creditPackages.id, id));
    return pkg || undefined;
  }

  async createCreditPackage(insertPkg: InsertCreditPackage): Promise<CreditPackage> {
    const [pkg] = await db
      .insert(creditPackages)
      .values(insertPkg)
      .returning();
    return pkg;
  }

  async createTransaction(insertTransaction: InsertTransaction): Promise<Transaction> {
    const [transaction] = await db
      .insert(transactions)
      .values(insertTransaction)
      .returning();
    return transaction;
  }

  async getTransaction(id: string): Promise<Transaction | undefined> {
    const [transaction] = await db.select().from(transactions).where(eq(transactions.id, id));
    return transaction || undefined;
  }

  async getTransactionByPaymentIntentId(paymentIntentId: string): Promise<Transaction | undefined> {
    const [transaction] = await db.select().from(transactions).where(eq(transactions.stripePaymentIntentId, paymentIntentId));
    return transaction || undefined;
  }

  async updateTransactionStatus(id: string, status: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded'): Promise<Transaction> {
    const [transaction] = await db
      .update(transactions)
      .set({ 
        paymentStatus: status,
        updatedAt: new Date()
      })
      .where(eq(transactions.id, id))
      .returning();
    return transaction;
  }

}

export const storage = new DatabaseStorage();
