import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import gamingImage from "@assets/IMG_4688_1756679627792.webp";

const stripePromise = import.meta.env.VITE_STRIPE_PUBLIC_KEY 
  ? loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY)
  : null;

const paymentFormSchema = z.object({
  username: z.string().min(1, "Username is required"),
  amount: z.string().refine((val) => {
    const num = parseFloat(val);
    return num >= 10 && num <= 500;
  }, "Amount must be between $10 and $500"),
});

const trustlySchema = z.object({
  country: z.string().min(2, "Country is required"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Valid email is required"),
});

type PaymentForm = z.infer<typeof paymentFormSchema>;
type TrustlyForm = z.infer<typeof trustlySchema>;

const presetAmounts = [
  { label: "$10", value: "10.00" },
  { label: "$25", value: "25.00" },
  { label: "$50", value: "50.00" },
];

export default function PaymentPage() {
  const [username, setUsername] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [customAmount, setCustomAmount] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<'stripe' | 'trustly'>('stripe');
  const [clientSecret, setClientSecret] = useState<string>("");
  const [isPaymentReady, setIsPaymentReady] = useState(false);
  const { toast } = useToast();

  const paymentForm = useForm<PaymentForm>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: {
      username: "",
      amount: ""
    }
  });


  const createPaymentIntentMutation = useMutation({
    mutationFn: async ({ amount }: { amount: string }) => {
      const response = await apiRequest("POST", "/api/create-payment-intent", {
        username,
        amount,
        paymentMethod: 'stripe_card'
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        setClientSecret(data.clientSecret);
        setIsPaymentReady(true);
      } else {
        toast({
          title: "Payment Setup Failed",
          description: data.message,
          variant: "destructive",
        });
      }
    },
  });

  const trustlyMutation = useMutation({
    mutationFn: async (data: TrustlyForm) => {
      const response = await apiRequest("POST", "/api/trustly-payment", {
        username,
        amount,
        country: data.country,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        // Redirect to Trustly's payment page
        if (data.redirectUrl) {
          window.open(data.redirectUrl, '_blank');
        }
        toast({
          title: "Payment Initiated!",
          description: "You'll be redirected to complete your bank transfer.",
        });
        setUsername("");
        setAmount("");
        setCustomAmount("");
        setIsPaymentReady(false);
        paymentForm.reset();
      } else {
        toast({
          title: "Payment Failed",
          description: data.message,
          variant: "destructive",
        });
      }
    },
  });


  const handleAmountSelect = (selectedAmount: string) => {
    setAmount(selectedAmount);
    setCustomAmount(""); // Clear custom amount when preset is selected
    if (paymentMethod === 'stripe' && username && selectedAmount) {
      createPaymentIntentMutation.mutate({
        amount: selectedAmount
      });
    }
  };

  const handleCustomAmountChange = (customValue: string) => {
    setCustomAmount(customValue);
    setAmount(customValue); // Use custom amount as the main amount
    if (paymentMethod === 'stripe' && username && customValue) {
      createPaymentIntentMutation.mutate({
        amount: customValue
      });
    }
  };

  const handlePaymentMethodChange = (method: 'stripe' | 'trustly') => {
    setPaymentMethod(method);
    setIsPaymentReady(false);
    setClientSecret("");
    
    if (method === 'stripe' && amount && username) {
      createPaymentIntentMutation.mutate({
        amount: amount
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900">
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Hero Section */}
          <div className="relative text-center mb-12 overflow-hidden rounded-2xl">
            {/* Background Image */}
            <div 
              className="absolute inset-0 bg-cover bg-center opacity-20"
              style={{
                backgroundImage: `url('/attached_assets/IMG_4688_1756680598898.webp')`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                filter: 'brightness(0.3) saturate(1.2)'
              }}
            />
            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent" />
            
            {/* Content */}
            <div className="relative z-10 py-12 px-6">
              {/* Captain Cashout Brand */}
              <div className="flex items-center justify-center space-x-3 mb-6">
                <div className="w-16 h-16 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-600/30">
                  <span className="text-3xl">💰</span>
                </div>
                <div className="text-left">
                  <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">
                    Captain Cashout
                  </h1>
                  <p className="text-lg text-slate-300">Secure Payment Portal</p>
                </div>
              </div>
              
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                <span className="bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">
                  Power Up
                </span>{" "}
                <span className="text-white">Your Account</span>
              </h2>
              <p className="text-xl text-slate-300 mb-6">Quick, secure, and hassle-free credit top-ups</p>
              <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-slate-400">
                <div className="flex items-center space-x-2">
                  <span className="text-yellow-400">⚡</span>
                  <span>Instant Processing</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-purple-400">👥</span>
                  <span>2M+ Active Players</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-green-400">🏆</span>
                  <span>99.9% Uptime</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-green-400">🛡️</span>
                  <span>SSL Secured</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-green-400">🔒</span>
                  <span>PCI Compliant</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-8">
            {/* Username Input */}
            <Card className="bg-slate-800 border-slate-700" data-testid="username-input-card">
              <CardContent className="p-6">
                <div className="flex items-center space-x-3 mb-6">
                  <div className="w-10 h-10 bg-blue-600/20 rounded-lg flex items-center justify-center">
                    <span className="text-blue-400">👤</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-white">Your Username</h3>
                    <p className="text-sm text-slate-400">Enter your gaming username</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label htmlFor="username" className="text-white">Username</Label>
                    <Input
                      id="username"
                      data-testid="input-username"
                      placeholder="Enter your username"
                      className="bg-slate-700 border-slate-600 text-white placeholder-slate-400"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                    />
                  </div>
                </div>

                {username && (
                  <div className="mt-6 p-4 bg-blue-900/20 border border-blue-700/50 rounded-lg" data-testid="username-entered">
                    <div className="flex items-center space-x-3">
                      <span className="text-blue-400">✨</span>
                      <div>
                        <p className="font-medium text-blue-400">Ready for Payment</p>
                        <p className="text-sm text-slate-300">Username: {username}</p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Reload Amounts */}
            <Card className="bg-slate-800 border-slate-700" data-testid="reload-amounts-card">
              <CardContent className="p-6">
                <div className="flex items-center space-x-3 mb-6">
                  <div className="w-10 h-10 bg-yellow-500/20 rounded-lg flex items-center justify-center">
                    <span className="text-yellow-400">💰</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-white">Reload Amount</h3>
                    <p className="text-sm text-slate-400">Choose your top-up amount</p>
                  </div>
                </div>

                {/* Gaming Image */}
                <div className="mb-6 rounded-lg overflow-hidden bg-slate-900/50">
                  <img 
                    src={gamingImage} 
                    alt="Popular gaming platforms" 
                    className="w-full object-contain opacity-95"
                  />
                </div>

                {/* Preset Amounts */}
                <div className="grid grid-cols-3 gap-3 mb-6">
                  {presetAmounts.map((preset) => (
                    <div
                      key={preset.value}
                      data-testid={`amount-${preset.label.replace('$', '')}`}
                      className={`cursor-pointer rounded-lg p-4 transition-all ${
                        amount === preset.value && !customAmount
                          ? 'bg-blue-600/20 border-2 border-blue-500'
                          : 'bg-slate-700/50 border border-slate-600 hover:border-blue-500'
                      }`}
                      onClick={() => handleAmountSelect(preset.value)}
                    >
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-400">
                          {preset.label}
                        </div>
                        <div className="text-xs text-slate-400 mt-1">
                          Quick reload
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Custom Amount Input */}
                <div className="mb-6">
                  <Label htmlFor="customAmount" className="text-white mb-2 block">
                    Or enter custom amount ($10 - $500)
                  </Label>
                  <Input
                    id="customAmount"
                    data-testid="input-custom-amount"
                    placeholder="Enter amount"
                    type="number"
                    min="10"
                    max="500"
                    step="0.01"
                    className="bg-slate-700 border-slate-600 text-white placeholder-slate-400"
                    value={customAmount}
                    onChange={(e) => handleCustomAmountChange(e.target.value)}
                  />
                </div>

                {amount && (
                  <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-4" data-testid="selected-amount">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-white">Reload Amount:</span>
                      <span className="text-blue-400 font-bold text-xl">${amount}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Payment Methods */}
          {username && amount && (
            <Card className="mt-8 bg-slate-800 border-slate-700" data-testid="payment-methods-card">
              <CardContent className="p-6">
                <div className="flex items-center space-x-3 mb-6">
                  <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                    <span className="text-green-400">💳</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-white">Payment Method</h3>
                    <p className="text-sm text-slate-400">Choose how you'd like to pay</p>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  {/* Payment Method Selection */}
                  <div className="space-y-4">
                    <h4 className="font-medium text-white mb-4">Select Payment Method</h4>

                    <div
                      data-testid="payment-method-stripe"
                      className={`cursor-pointer rounded-lg p-4 transition-all ${
                        paymentMethod === 'stripe'
                          ? 'bg-blue-600/20 border-2 border-blue-500'
                          : 'bg-slate-700/50 border border-slate-600 hover:border-blue-500'
                      }`}
                      onClick={() => handlePaymentMethodChange('stripe')}
                    >
                      <div className="flex items-center space-x-3">
                        <span className="text-blue-400 text-xl">💳</span>
                        <div>
                          <p className="font-medium text-white">Cards & Digital Wallets</p>
                          <p className="text-sm text-slate-400">Visa, Mastercard, Apple Pay, Google Pay</p>
                        </div>
                      </div>
                    </div>

                    <div
                      data-testid="payment-method-trustly"
                      className={`cursor-pointer rounded-lg p-4 transition-all ${
                        paymentMethod === 'trustly'
                          ? 'bg-blue-600/20 border-2 border-blue-500'
                          : 'bg-slate-700/50 border border-slate-600 hover:border-blue-500'
                      }`}
                      onClick={() => handlePaymentMethodChange('trustly')}
                    >
                      <div className="flex items-center space-x-3">
                        <span className="text-blue-400 text-xl">🏦</span>
                        <div>
                          <p className="font-medium text-white">Trustly</p>
                          <p className="text-sm text-slate-400">Secure bank transfers</p>
                        </div>
                        <div className="ml-auto bg-blue-600 text-white px-2 py-1 rounded text-xs">
                          Popular
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Payment Form */}
                  <div className="space-y-4">
                    <h4 className="font-medium text-white mb-4">Payment Details</h4>

                    {paymentMethod === 'stripe' && (
                      <>
                        {!import.meta.env.VITE_STRIPE_PUBLIC_KEY ? (
                          <div className="p-4 bg-yellow-900/20 border border-yellow-700/50 rounded-lg">
                            <p className="text-yellow-400 text-sm">
                              ⚠️ Stripe payment processing is not configured. Please contact support.
                            </p>
                          </div>
                        ) : (
                          <StripePaymentForm
                            clientSecret={clientSecret}
                            isReady={isPaymentReady}
                            amount={amount}
                            onSuccess={() => {
                              toast({
                                title: "Payment Successful!",
                                description: `$${amount} has been added to your account.`,
                              });
                              setUsername("");
                              setAmount("");
                              setCustomAmount("");
                              setIsPaymentReady(false);
                            }}
                          />
                        )}
                      </>
                    )}

                    {paymentMethod === 'trustly' && (
                      <TrustlyForm
                        onSubmit={trustlyMutation.mutate}
                        isLoading={trustlyMutation.isPending}
                        amount={amount}
                      />
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Trust Indicators */}
          <div className="mt-8 grid md:grid-cols-3 gap-6">
            <Card className="bg-slate-800 border-slate-700 text-center">
              <CardContent className="p-6">
                <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-green-400 text-2xl">🛡️</span>
                </div>
                <h4 className="font-semibold text-white mb-2">Bank-Level Security</h4>
                <p className="text-sm text-slate-400">256-bit SSL encryption protects all transactions</p>
              </CardContent>
            </Card>

            <Card className="bg-slate-800 border-slate-700 text-center">
              <CardContent className="p-6">
                <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-blue-400 text-2xl">⚡</span>
                </div>
                <h4 className="font-semibold text-white mb-2">Instant Processing</h4>
                <p className="text-sm text-slate-400">Credits added to your account immediately</p>
              </CardContent>
            </Card>

            <Card className="bg-slate-800 border-slate-700 text-center">
              <CardContent className="p-6">
                <div className="w-16 h-16 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-purple-400 text-2xl">🎧</span>
                </div>
                <h4 className="font-semibold text-white mb-2">24/7 Support</h4>
                <p className="text-sm text-slate-400">Get help whenever you need it</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}

// Stripe Payment Form Component
function StripePaymentForm({ 
  clientSecret, 
  isReady, 
  amount, 
  onSuccess 
}: { 
  clientSecret: string; 
  isReady: boolean; 
  amount: string; 
  onSuccess: () => void; 
}) {
  if (!stripePromise) {
    return (
      <div className="p-4 bg-red-900/20 border border-red-700/50 rounded-lg">
        <p className="text-red-400 text-sm">
          Stripe is not configured. Please contact support.
        </p>
      </div>
    );
  }

  if (!isReady || !clientSecret) {
    return (
      <div className="flex justify-center py-8">
        <LoadingSpinner />
        <span className="ml-2 text-slate-400">Setting up payment...</span>
      </div>
    );
  }

  return (
    <Elements 
      stripe={stripePromise} 
      options={{ 
        clientSecret,
        appearance: {
          theme: 'night',
          variables: {
            colorPrimary: '#3b82f6',
            colorBackground: '#1e293b',
            colorText: '#ffffff',
            colorDanger: '#ef4444',
            borderRadius: '8px',
          }
        }
      }}
    >
      <StripeCheckoutForm amount={amount} onSuccess={onSuccess} />
    </Elements>
  );
}

function StripeCheckoutForm({ 
  amount, 
  onSuccess 
}: { 
  amount: string; 
  onSuccess: () => void; 
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) return;

    setIsProcessing(true);

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.origin,
      },
      redirect: 'if_required'
    });

    if (error) {
      toast({
        title: "Payment Failed",
        description: error.message,
        variant: "destructive",
      });
    } else {
      onSuccess();
    }

    setIsProcessing(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement 
        options={{
          layout: {
            type: 'tabs',
            defaultCollapsed: false,
          },
          paymentMethodOrder: ['card', 'apple_pay', 'google_pay'],
          wallets: {
            applePay: 'auto',
            googlePay: 'auto'
          }
        }}
      />
      
      <div className="bg-green-900/20 border border-green-700/50 rounded-lg p-3">
        <div className="flex items-center space-x-2 text-sm">
          <span className="text-green-400">🛡️</span>
          <span className="text-green-400">Your payment information is encrypted and secure</span>
        </div>
      </div>

      <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-3">
        <div className="text-xs text-blue-300 space-y-1">
          <p className="flex items-center space-x-2">
            <span>💳</span>
            <span>Credit/Debit Cards</span>
          </p>
          <p className="flex items-center space-x-2">
            <span>📱</span>
            <span>Apple Pay (iOS devices)</span>
          </p>
          <p className="flex items-center space-x-2">
            <span>🤖</span>
            <span>Google Pay (Android devices)</span>
          </p>
        </div>
      </div>

      <Button
        type="submit"
        data-testid="button-complete-payment"
        className="w-full bg-green-600 hover:bg-green-700 text-white py-4 text-lg shadow-lg shadow-green-600/30"
        disabled={!stripe || isProcessing}
      >
        {isProcessing ? (
          <>
            <LoadingSpinner size="sm" className="mr-2" />
            Processing...
          </>
        ) : (
          <>
            🔒 Complete Payment - ${amount}
          </>
        )}
      </Button>
    </form>
  );
}

// Trustly Form Component
function TrustlyForm({ 
  onSubmit, 
  isLoading, 
  amount 
}: { 
  onSubmit: (data: TrustlyForm) => void; 
  isLoading: boolean; 
  amount: string; 
}) {
  const trustlyForm = useForm<TrustlyForm>({
    resolver: zodResolver(trustlySchema),
  });

  return (
    <form onSubmit={trustlyForm.handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="firstName" className="text-white">First Name</Label>
          <Input
            id="firstName"
            data-testid="input-first-name"
            placeholder="Enter your first name"
            className="bg-slate-700 border-slate-600 text-white placeholder-slate-400"
            {...trustlyForm.register("firstName")}
          />
          {trustlyForm.formState.errors.firstName && (
            <p className="text-red-400 text-sm mt-1">
              {trustlyForm.formState.errors.firstName.message}
            </p>
          )}
        </div>
        
        <div>
          <Label htmlFor="lastName" className="text-white">Last Name</Label>
          <Input
            id="lastName"
            data-testid="input-last-name"
            placeholder="Enter your last name"
            className="bg-slate-700 border-slate-600 text-white placeholder-slate-400"
            {...trustlyForm.register("lastName")}
          />
          {trustlyForm.formState.errors.lastName && (
            <p className="text-red-400 text-sm mt-1">
              {trustlyForm.formState.errors.lastName.message}
            </p>
          )}
        </div>
      </div>
      
      <div>
        <Label htmlFor="email" className="text-white">Email Address</Label>
        <Input
          id="email"
          data-testid="input-email"
          type="email"
          placeholder="Enter your email address"
          className="bg-slate-700 border-slate-600 text-white placeholder-slate-400"
          {...trustlyForm.register("email")}
        />
        {trustlyForm.formState.errors.email && (
          <p className="text-red-400 text-sm mt-1">
            {trustlyForm.formState.errors.email.message}
          </p>
        )}
      </div>
      
      <div>
        <Label htmlFor="country" className="text-white">Country</Label>
        <select
          id="country"
          data-testid="select-country"
          className="w-full p-3 bg-slate-700 border border-slate-600 text-white rounded-md"
          {...trustlyForm.register("country")}
        >
          <option value="">Select your country</option>
          <option value="US">United States</option>
          <option value="CA">Canada</option>
          <option value="SE">Sweden</option>
          <option value="FI">Finland</option>
          <option value="NO">Norway</option>
          <option value="DK">Denmark</option>
          <option value="DE">Germany</option>
          <option value="NL">Netherlands</option>
          <option value="GB">United Kingdom</option>
        </select>
        {trustlyForm.formState.errors.country && (
          <p className="text-red-400 text-sm mt-1">
            {trustlyForm.formState.errors.country.message}
          </p>
        )}
      </div>

      <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-3">
        <div className="flex items-center space-x-2 text-sm">
          <span className="text-blue-400">🏦</span>
          <span className="text-blue-400">You'll be redirected to your bank to complete the transfer</span>
        </div>
      </div>

      <Button
        type="submit"
        data-testid="button-trustly-payment"
        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 text-lg shadow-lg shadow-blue-600/30"
        disabled={isLoading}
      >
        {isLoading ? (
          <>
            <LoadingSpinner size="sm" className="mr-2" />
            Processing...
          </>
        ) : (
          <>
            🏦 Pay with Trustly - ${amount}
          </>
        )}
      </Button>
    </form>
  );
}
