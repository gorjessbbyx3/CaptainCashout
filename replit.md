# Payment System Application

## Overview

This is a full-stack payment processing application built with React, Express, and PostgreSQL. The system handles credit purchases through multiple payment methods including Stripe and CellPay. Users can look up accounts by username, select credit packages, and complete payments with email notifications. The application uses a monorepo structure with shared schemas between client and server, featuring a modern UI built with shadcn/ui components and Tailwind CSS.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript using Vite as the build tool
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack Query (React Query) for server state management
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS custom properties for theming
- **Form Handling**: React Hook Form with Zod validation
- **Payment Integration**: Stripe Elements for secure payment processing

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM for type-safe database operations
- **API Design**: RESTful endpoints for user lookup, payment processing, and transaction management
- **Middleware**: Custom logging and error handling middleware
- **Development**: Hot reload with tsx and Vite dev server integration

### Database Design
- **Users Table**: Stores user accounts with username, display name, current credits, and spending history
- **Credit Packages Table**: Defines available credit packages with pricing and bonus percentages
- **Transactions Table**: Tracks payment transactions with status, payment method, and external service references
- **Schema Management**: Drizzle migrations with PostgreSQL-specific features like enums and UUID generation

### Payment Processing
- **Stripe Integration**: Full Stripe Elements integration for card payments including Google Pay and Apple Pay
- **CellPay Integration**: Alternative payment method for mobile payments with phone number validation
- **Transaction Tracking**: Comprehensive transaction lifecycle management with status updates
- **Email Notifications**: Automated payment confirmation emails via Nodemailer

### Authentication & Security
- **Session Management**: Express sessions with PostgreSQL storage using connect-pg-simple
- **Environment Configuration**: Secure environment variable handling for API keys and database connections
- **CORS & Security**: Proper request handling with credentials and CORS configuration

### Development Environment
- **Build System**: esbuild for production builds, tsx for development
- **Type Safety**: Shared TypeScript schemas between client and server
- **Code Quality**: Consistent imports and path resolution with TypeScript path mapping
- **Development Tools**: Replit-specific plugins for runtime error handling and code mapping

## External Dependencies

### Payment Services
- **Stripe**: Primary payment processor with support for multiple payment methods
- **CellPay**: Alternative mobile payment service for phone-based transactions

### Database & Infrastructure
- **Neon Database**: Serverless PostgreSQL provider with WebSocket connections
- **SMTP Service**: Email delivery service for payment notifications (configurable provider)

### UI & Development Libraries
- **Radix UI**: Unstyled, accessible UI primitives for complex components
- **Lucide React**: Icon library for consistent iconography
- **TanStack Query**: Server state management and caching
- **React Hook Form**: Form validation and submission handling
- **Zod**: Runtime type validation for forms and API responses
- **date-fns**: Date manipulation and formatting utilities

### Build & Development Tools
- **Vite**: Fast build tool and development server
- **esbuild**: JavaScript bundler for production builds
- **Tailwind CSS**: Utility-first CSS framework
- **TypeScript**: Type safety across the entire application stack