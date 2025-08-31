import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, decimal, boolean, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

export const paymentStatusEnum = pgEnum('payment_status', ['pending', 'processing', 'completed', 'failed', 'refunded']);
export const paymentMethodEnum = pgEnum('payment_method', ['stripe_card', 'stripe_google_pay', 'stripe_apple_pay', 'cellpay']);

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  displayName: text("display_name"),
  email: text("email"),
  currentCredits: integer("current_credits").default(0).notNull(),
  totalSpent: decimal("total_spent", { precision: 10, scale: 2 }).default("0.00").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const creditPackages = pgTable("credit_packages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  credits: integer("credits").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  bonusPercentage: integer("bonus_percentage").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const transactions = pgTable("transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull(),
  packageId: varchar("package_id").references(() => creditPackages.id).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  credits: integer("credits").notNull(),
  paymentMethod: paymentMethodEnum("payment_method").notNull(),
  paymentStatus: paymentStatusEnum("payment_status").default('pending').notNull(),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  cellpayTransactionId: text("cellpay_transaction_id"),
  metadata: text("metadata"), // JSON string for additional data
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});


export const creditPackagesRelations = relations(creditPackages, ({ many }) => ({
  transactions: many(transactions),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  package: one(creditPackages, {
    fields: [transactions.packageId],
    references: [creditPackages.id],
  }),
}));

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  displayName: true,
  email: true,
});

export const insertCreditPackageSchema = createInsertSchema(creditPackages).pick({
  name: true,
  credits: true,
  price: true,
  bonusPercentage: true,
});

export const insertTransactionSchema = createInsertSchema(transactions).pick({
  username: true,
  packageId: true,
  amount: true,
  credits: true,
  paymentMethod: true,
  stripePaymentIntentId: true,
  cellpayTransactionId: true,
  metadata: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertCreditPackage = z.infer<typeof insertCreditPackageSchema>;
export type CreditPackage = typeof creditPackages.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactions.$inferSelect;
