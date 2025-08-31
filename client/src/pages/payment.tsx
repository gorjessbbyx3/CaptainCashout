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

const stripePromise = import.meta.env.VITE_STRIPE_PUBLIC_KEY 
  ? loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY)
  : null;

const paymentFormSchema = z.object({
  username: z.string().min(1, "Username is required"),
});

const cellPaySchema = z.object({
  phoneNumber: z.string().min(10, "Valid phone number is required"),
});

type PaymentForm = z.infer<typeof paymentFormSchema>;
type CellPayForm = z.infer<typeof cellPaySchema>;


interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  price: string;
  bonusPercentage: number;
}

export default function PaymentPage() {
  const [username, setUsername] = useState<string>("");
  const [selectedPackage, setSelectedPackage] = useState<CreditPackage | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'stripe' | 'cellpay'>('stripe');
  const [clientSecret, setClientSecret] = useState<string>("");
  const [isPaymentReady, setIsPaymentReady] = useState(false);
  const { toast } = useToast();

  const paymentForm = useForm<PaymentForm>({
    resolver: zodResolver(paymentFormSchema),
  });

  const { data: creditPackages, isLoading: packagesLoading } = useQuery({
    queryKey: ['/api/credit-packages'],
  });


  const createPaymentIntentMutation = useMutation({
    mutationFn: async ({ packageId, amount }: { packageId: string; amount: string }) => {
      const response = await apiRequest("POST", "/api/create-payment-intent", {
        username,
        packageId,
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

  const cellPayMutation = useMutation({
    mutationFn: async (data: CellPayForm) => {
      const response = await apiRequest("POST", "/api/cellpay-payment", {
        username,
        packageId: selectedPackage?.id,
        amount: selectedPackage?.price,
        phoneNumber: data.phoneNumber
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: "Payment Successful!",
          description: `${selectedPackage?.credits} credits have been added to your account.`,
        });
        setUsername("");
        setSelectedPackage(null);
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


  const handlePackageSelect = (pkg: CreditPackage) => {
    setSelectedPackage(pkg);
    if (paymentMethod === 'stripe' && username) {
      createPaymentIntentMutation.mutate({
        packageId: pkg.id,
        amount: pkg.price
      });
    }
  };

  const handlePaymentMethodChange = (method: 'stripe' | 'cellpay') => {
    setPaymentMethod(method);
    setIsPaymentReady(false);
    setClientSecret("");
    
    if (method === 'stripe' && selectedPackage && username) {
      createPaymentIntentMutation.mutate({
        packageId: selectedPackage.id,
        amount: selectedPackage.price
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900">
      {/* Header */}
      <header className="bg-slate-900/80 backdrop-blur-lg border-b border-slate-700 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-600/30">
                <span className="text-xl">💰</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">
                  Captain Cashout
                </h1>
                <p className="text-sm text-slate-400">Secure Payment Portal</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 text-sm text-slate-400">
                <span className="text-green-400">🛡️</span>
                <span>SSL Secured</span>
              </div>
              <div className="flex items-center space-x-2 text-sm text-slate-400">
                <span className="text-green-400">🔒</span>
                <span>PCI Compliant</span>
              </div>
            </div>
          </div>
        </div>
      </header>

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
              <h2 className="text-4xl md:text-5xl font-bold mb-4">
                <span className="bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">
                  Power Up
                </span>{" "}
                <span className="text-white">Your Account</span>
              </h2>
              <p className="text-xl text-slate-300 mb-6">Quick, secure, and hassle-free credit top-ups</p>
              <div className="flex items-center justify-center space-x-6 text-sm text-slate-400">
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

            {/* Credit Packages */}
            <Card className="bg-slate-800 border-slate-700" data-testid="credit-packages-card">
              <CardContent className="p-6">
                <div className="flex items-center space-x-3 mb-6">
                  <div className="w-10 h-10 bg-yellow-500/20 rounded-lg flex items-center justify-center">
                    <span className="text-yellow-400">💎</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-white">Credit Packages</h3>
                    <p className="text-sm text-slate-400">Choose your top-up amount</p>
                  </div>
                </div>

                {packagesLoading ? (
                  <div className="flex justify-center py-8">
                    <LoadingSpinner />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 mb-6">
                    {(creditPackages as any)?.packages?.map((pkg: CreditPackage) => (
                      <div
                        key={pkg.id}
                        data-testid={`package-${pkg.name.toLowerCase()}`}
                        className={`cursor-pointer rounded-lg p-4 transition-all ${
                          selectedPackage?.id === pkg.id
                            ? 'bg-blue-600/20 border-2 border-blue-500'
                            : 'bg-slate-700/50 border border-slate-600 hover:border-blue-500'
                        }`}
                        onClick={() => handlePackageSelect(pkg)}
                      >
                        <div className="text-center">
                          <div className="text-2xl font-bold text-blue-400 mb-1">
                            ${pkg.price}
                          </div>
                          <div className="text-sm text-slate-300">
                            {pkg.credits.toLocaleString()} Credits
                          </div>
                          {pkg.bonusPercentage > 0 && (
                            <div className="text-xs text-green-400 mt-1">
                              +{pkg.bonusPercentage}% Bonus
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {selectedPackage && (
                  <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-4" data-testid="selected-package">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-white">Selected Package:</span>
                      <span className="text-blue-400 font-bold">${selectedPackage.price}</span>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-sm text-slate-400">Credits:</span>
                      <span className="text-sm font-medium text-white">
                        {selectedPackage.credits.toLocaleString()}
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Payment Methods */}
          {username && selectedPackage && (
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
                          <p className="font-medium text-white">Credit/Debit Card</p>
                          <p className="text-sm text-slate-400">Visa, Mastercard, American Express</p>
                        </div>
                      </div>
                    </div>

                    <div
                      data-testid="payment-method-cellpay"
                      className={`cursor-pointer rounded-lg p-4 transition-all ${
                        paymentMethod === 'cellpay'
                          ? 'bg-purple-600/20 border-2 border-purple-500'
                          : 'bg-slate-700/50 border border-slate-600 hover:border-purple-500'
                      }`}
                      onClick={() => handlePaymentMethodChange('cellpay')}
                    >
                      <div className="flex items-center space-x-3">
                        <span className="text-purple-400 text-xl">📱</span>
                        <div>
                          <p className="font-medium text-white">CellPay</p>
                          <p className="text-sm text-slate-400">Quick mobile payments</p>
                        </div>
                        <div className="ml-auto bg-purple-600 text-white px-2 py-1 rounded text-xs">
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
                            amount={selectedPackage.price}
                            credits={selectedPackage.credits}
                            onSuccess={() => {
                              toast({
                                title: "Payment Successful!",
                                description: `${selectedPackage.credits} credits have been added to your account.`,
                              });
                              setUsername("");
                              setSelectedPackage(null);
                              setIsPaymentReady(false);
                            }}
                          />
                        )}
                      </>
                    )}

                    {paymentMethod === 'cellpay' && (
                      <CellPayForm
                        onSubmit={cellPayMutation.mutate}
                        isLoading={cellPayMutation.isPending}
                        amount={selectedPackage.price}
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
  credits, 
  onSuccess 
}: { 
  clientSecret: string; 
  isReady: boolean; 
  amount: string; 
  credits: number; 
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
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <StripeCheckoutForm amount={amount} credits={credits} onSuccess={onSuccess} />
    </Elements>
  );
}

function StripeCheckoutForm({ 
  amount, 
  credits, 
  onSuccess 
}: { 
  amount: string; 
  credits: number; 
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
      <PaymentElement />
      
      <div className="bg-green-900/20 border border-green-700/50 rounded-lg p-3">
        <div className="flex items-center space-x-2 text-sm">
          <span className="text-green-400">🛡️</span>
          <span className="text-green-400">Your payment information is encrypted and secure</span>
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

// CellPay Form Component
function CellPayForm({ 
  onSubmit, 
  isLoading, 
  amount 
}: { 
  onSubmit: (data: CellPayForm) => void; 
  isLoading: boolean; 
  amount: string; 
}) {
  const cellPayForm = useForm<CellPayForm>({
    resolver: zodResolver(cellPaySchema),
  });

  return (
    <form onSubmit={cellPayForm.handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <Label htmlFor="phoneNumber" className="text-white">Phone Number</Label>
        <Input
          id="phoneNumber"
          data-testid="input-phone-number"
          placeholder="Enter your phone number"
          className="bg-slate-700 border-slate-600 text-white placeholder-slate-400"
          {...cellPayForm.register("phoneNumber")}
        />
        {cellPayForm.formState.errors.phoneNumber && (
          <p className="text-red-400 text-sm mt-1">
            {cellPayForm.formState.errors.phoneNumber.message}
          </p>
        )}
      </div>

      <div className="bg-purple-900/20 border border-purple-700/50 rounded-lg p-3">
        <div className="flex items-center space-x-2 text-sm">
          <span className="text-purple-400">📱</span>
          <span className="text-purple-400">CellPay payment link will be sent to your phone</span>
        </div>
      </div>

      <Button
        type="submit"
        data-testid="button-cellpay-payment"
        className="w-full bg-purple-600 hover:bg-purple-700 text-white py-4 text-lg shadow-lg shadow-purple-600/30"
        disabled={isLoading}
      >
        {isLoading ? (
          <>
            <LoadingSpinner size="sm" className="mr-2" />
            Processing...
          </>
        ) : (
          <>
            📱 Pay with CellPay - ${amount}
          </>
        )}
      </Button>
    </form>
  );
}
