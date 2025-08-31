
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

const trustlySchema = z.object({
  country: z.string().min(2, "Country is required"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Valid email is required"),
});

type PaymentForm = z.infer<typeof paymentFormSchema>;
type TrustlyForm = z.infer<typeof trustlySchema>;

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
  const [customAmount, setCustomAmount] = useState<string>("");
  const [useCustomAmount, setUseCustomAmount] = useState<boolean>(false);
  const [paymentMethod, setPaymentMethod] = useState<'stripe' | 'trustly'>('stripe');
  const [clientSecret, setClientSecret] = useState<string>("");
  const [isPaymentReady, setIsPaymentReady] = useState(false);
  const { toast } = useToast();

  const paymentForm = useForm<PaymentForm>({
    resolver: zodResolver(paymentFormSchema),
  });

  const { data: creditPackages, isLoading: packagesLoading } = useQuery({
    queryKey: ['/api/credit-packages'],
  });

  const getPaymentAmount = () => {
    if (useCustomAmount && customAmount) {
      return customAmount;
    }
    return selectedPackage?.price || "";
  };

  const getCreditsAmount = () => {
    if (useCustomAmount && customAmount) {
      return parseInt(customAmount) * 100;
    }
    return selectedPackage?.credits || 0;
  };

  const createPaymentIntentMutation = useMutation({
    mutationFn: async ({ packageId, amount }: { packageId: string; amount: string }) => {
      const response = await apiRequest("POST", "/api/create-payment-intent", {
        username,
        packageId: useCustomAmount ? 'custom' : packageId,
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
        packageId: useCustomAmount ? 'custom' : selectedPackage?.id,
        amount: getPaymentAmount(),
        country: data.country,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        if (data.redirectUrl) {
          window.open(data.redirectUrl, '_blank');
        }
        toast({
          title: "Payment Initiated!",
          description: "You'll be redirected to complete your bank transfer.",
        });
        resetForm();
      } else {
        toast({
          title: "Payment Failed",
          description: data.message,
          variant: "destructive",
        });
      }
    },
  });

  const resetForm = () => {
    setUsername("");
    setSelectedPackage(null);
    setCustomAmount("");
    setUseCustomAmount(false);
    setIsPaymentReady(false);
    paymentForm.reset();
  };

  const handlePackageSelect = (pkg: CreditPackage) => {
    setSelectedPackage(pkg);
    setUseCustomAmount(false);
    setCustomAmount("");
    if (paymentMethod === 'stripe' && username) {
      createPaymentIntentMutation.mutate({
        packageId: pkg.id,
        amount: pkg.price
      });
    }
  };

  const handleCustomAmountChange = (amount: string) => {
    setCustomAmount(amount);
    setUseCustomAmount(true);
    setSelectedPackage(null);
    setIsPaymentReady(false);
    setClientSecret("");
  };

  const handleCustomAmountConfirm = () => {
    if (customAmount && parseFloat(customAmount) >= 1 && username) {
      if (paymentMethod === 'stripe') {
        createPaymentIntentMutation.mutate({
          packageId: 'custom',
          amount: customAmount
        });
      }
    }
  };

  const handlePaymentMethodChange = (method: 'stripe' | 'trustly') => {
    setPaymentMethod(method);
    setIsPaymentReady(false);
    setClientSecret("");
    
    const amount = getPaymentAmount();
    if (method === 'stripe' && amount && username) {
      createPaymentIntentMutation.mutate({
        packageId: useCustomAmount ? 'custom' : selectedPackage?.id || '',
        amount
      });
    }
  };

  const isReadyForPayment = username && (selectedPackage || (useCustomAmount && customAmount && parseFloat(customAmount) >= 1));

  return (
    <div className="min-h-screen bg-white">
      {/* Tesla-style Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-white/95 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 sm:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-black rounded flex items-center justify-center">
                <span className="text-white text-sm font-bold">C</span>
              </div>
              <span className="text-xl font-medium text-black">Captain Cashout</span>
            </div>
            <div className="hidden md:flex items-center space-x-8 text-sm font-medium text-gray-600">
              <span>Secure</span>
              <span>Instant</span>
              <span>Trusted</span>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section - Tesla Style */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Background Image */}
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url('/assets/hero-bg.webp')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
        
        {/* Dark Overlay */}
        <div className="absolute inset-0 bg-black/60" />
        
        {/* Content */}
        <div className="relative z-10 text-center px-6 max-w-6xl mx-auto">
          {/* Tesla-style CTA */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
            <Button 
              className="bg-white text-black hover:bg-gray-100 px-12 py-4 text-lg font-medium rounded-none border-0"
              onClick={() => document.getElementById('packages')?.scrollIntoView({ behavior: 'smooth' })}
            >
              Order Now
            </Button>
            <Button 
              variant="outline" 
              className="border-2 border-white text-white hover:bg-white hover:text-black px-12 py-4 text-lg font-medium rounded-none bg-transparent"
              onClick={() => document.getElementById('custom')?.scrollIntoView({ behavior: 'smooth' })}
            >
              Custom Amount
            </Button>
          </div>

          {/* Minimal Stats */}
          <div className="grid grid-cols-3 gap-12 text-white">
            <div className="text-center">
              <div className="text-3xl font-light mb-2">&lt; 1s</div>
              <div className="text-sm font-light opacity-80">Processing Time</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-light mb-2">100%</div>
              <div className="text-sm font-light opacity-80">Secure</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-light mb-2">24/7</div>
              <div className="text-sm font-light opacity-80">Support</div>
            </div>
          </div>
        </div>
      </section>

      {/* Username Section - Tesla Clean */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h3 className="text-4xl font-light text-black mb-4">Enter Your Username</h3>
          <p className="text-xl text-gray-600 mb-12 font-light">Simple. Secure. Fast.</p>
          
          <div className="max-w-md mx-auto">
            <Input
              data-testid="input-username"
              placeholder="Username"
              className="h-14 text-lg text-center border-0 border-b-2 border-gray-300 rounded-none bg-transparent focus:border-black focus:ring-0 placeholder:text-gray-400"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            
            {username && (
              <div className="mt-8 p-6 bg-white rounded-lg shadow-sm border border-gray-200" data-testid="username-entered">
                <div className="text-black font-medium">Ready: {username}</div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Packages Section - Tesla Grid */}
      <section id="packages" className="py-24 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h3 className="text-4xl font-light text-black mb-4">Choose Your Package</h3>
            <p className="text-xl text-gray-600 font-light">Select the perfect amount for your needs</p>
          </div>

          {packagesLoading ? (
            <div className="flex justify-center py-16">
              <LoadingSpinner />
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
              {(creditPackages as any)?.packages?.map((pkg: CreditPackage) => (
                <div
                  key={pkg.id}
                  data-testid={`package-${pkg.name.toLowerCase()}`}
                  className={`group cursor-pointer transition-all duration-300 ${
                    selectedPackage?.id === pkg.id
                      ? 'transform scale-105'
                      : 'hover:transform hover:scale-105'
                  }`}
                  onClick={() => handlePackageSelect(pkg)}
                >
                  <Card className={`h-full border-2 transition-all ${
                    selectedPackage?.id === pkg.id
                      ? 'border-black shadow-lg'
                      : 'border-gray-200 hover:border-gray-400'
                  }`}>
                    <CardContent className="p-8 text-center">
                      <div className="text-4xl font-light text-black mb-4">
                        ${pkg.price}
                      </div>
                      {pkg.bonusPercentage > 0 && (
                        <div className="mt-4 text-sm font-medium text-green-600">
                          +{pkg.bonusPercentage}% Bonus
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              ))}
            </div>
          )}

          {/* Tesla-style toggle */}
          <div className="flex justify-center mb-16">
            <div className="bg-gray-100 p-1 rounded-full">
              <Button
                variant={!useCustomAmount ? "default" : "ghost"}
                className={`px-8 py-3 rounded-full font-medium transition-all ${
                  !useCustomAmount 
                    ? 'bg-black text-white shadow-lg' 
                    : 'text-gray-600 hover:text-black hover:bg-gray-50'
                }`}
                onClick={() => {
                  setUseCustomAmount(false);
                  setCustomAmount("");
                  setIsPaymentReady(false);
                  setClientSecret("");
                }}
              >
                Packages
              </Button>
              <Button
                variant={useCustomAmount ? "default" : "ghost"}
                className={`px-8 py-3 rounded-full font-medium transition-all ${
                  useCustomAmount 
                    ? 'bg-black text-white shadow-lg' 
                    : 'text-gray-600 hover:text-black hover:bg-gray-50'
                }`}
                onClick={() => {
                  setUseCustomAmount(true);
                  setSelectedPackage(null);
                  setIsPaymentReady(false);
                  setClientSecret("");
                }}
              >
                Custom Amount
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Custom Amount Section */}
      {useCustomAmount && (
        <section id="custom" className="py-16 bg-gray-50">
          <div className="max-w-2xl mx-auto px-6 text-center">
            <h3 className="text-3xl font-light text-black mb-8">Enter Any Amount</h3>
            
            <div className="max-w-sm mx-auto mb-8">
              <div className="relative">
                <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-2xl text-gray-400">$</span>
                <Input
                  data-testid="input-custom-amount"
                  type="number"
                  min="1"
                  step="0.01"
                  placeholder="0"
                  className="h-16 text-2xl text-center pl-12 border-0 border-b-2 border-gray-300 rounded-none bg-transparent focus:border-black focus:ring-0"
                  value={customAmount}
                  onChange={(e) => handleCustomAmountChange(e.target.value)}
                />
              </div>
              
              {customAmount && parseFloat(customAmount) >= 1 && (
                <div className="mt-6 text-gray-600">
                  <span className="text-lg font-light">
                    {(parseInt(customAmount) * 100).toLocaleString()} Credits
                  </span>
                </div>
              )}
            </div>

            {customAmount && parseFloat(customAmount) >= 1 && username && (
              <Button
                onClick={handleCustomAmountConfirm}
                className="bg-black text-white hover:bg-gray-800 px-12 py-4 text-lg font-medium rounded-full"
                data-testid="button-confirm-custom-amount"
              >
                Continue
              </Button>
            )}
          </div>
        </section>
      )}

      {/* Payment Section - Tesla Minimal */}
      {isReadyForPayment && (
        <section className="py-24 bg-white">
          <div className="max-w-4xl mx-auto px-6">
            <div className="text-center mb-16">
              <h3 className="text-4xl font-light text-black mb-4">Complete Your Order</h3>
              <div className="text-xl text-gray-600 font-light">
                ${getPaymentAmount()} • {getCreditsAmount().toLocaleString()} Credits
              </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-16">
              {/* Payment Method Selection - Tesla Style */}
              <div className="space-y-6">
                <h4 className="text-2xl font-light text-black mb-8">Payment Method</h4>

                <div
                  data-testid="payment-method-stripe"
                  className={`cursor-pointer p-6 border-2 transition-all ${
                    paymentMethod === 'stripe'
                      ? 'border-black bg-gray-50'
                      : 'border-gray-200 hover:border-gray-400'
                  }`}
                  onClick={() => handlePaymentMethodChange('stripe')}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-lg font-medium text-black">Credit Card</div>
                      <div className="text-sm text-gray-500 font-light">Visa, Mastercard, Amex</div>
                    </div>
                    <div className={`w-4 h-4 rounded-full border-2 ${
                      paymentMethod === 'stripe' ? 'border-black bg-black' : 'border-gray-300'
                    }`} />
                  </div>
                </div>

                <div
                  data-testid="payment-method-trustly"
                  className={`cursor-pointer p-6 border-2 transition-all ${
                    paymentMethod === 'trustly'
                      ? 'border-black bg-gray-50'
                      : 'border-gray-200 hover:border-gray-400'
                  }`}
                  onClick={() => handlePaymentMethodChange('trustly')}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-lg font-medium text-black">Bank Transfer</div>
                      <div className="text-sm text-gray-500 font-light">Secure Trustly</div>
                    </div>
                    <div className={`w-4 h-4 rounded-full border-2 ${
                      paymentMethod === 'trustly' ? 'border-black bg-black' : 'border-gray-300'
                    }`} />
                  </div>
                </div>
              </div>

              {/* Payment Form */}
              <div className="space-y-6">
                <h4 className="text-2xl font-light text-black mb-8">Payment Details</h4>

                {paymentMethod === 'stripe' && (
                  <>
                    {!import.meta.env.VITE_STRIPE_PUBLIC_KEY ? (
                      <div className="p-6 bg-yellow-50 border border-yellow-200">
                        <p className="text-yellow-800 font-light">
                          Payment processing not configured. Contact support.
                        </p>
                      </div>
                    ) : (
                      <StripePaymentForm
                        clientSecret={clientSecret}
                        isReady={isPaymentReady}
                        amount={getPaymentAmount()}
                        credits={getCreditsAmount()}
                        onSuccess={() => {
                          toast({
                            title: "Payment Successful!",
                            description: `${getCreditsAmount()} credits added to your account.`,
                          });
                          resetForm();
                        }}
                      />
                    )}
                  </>
                )}

                {paymentMethod === 'trustly' && (
                  <TrustlyForm
                    onSubmit={trustlyMutation.mutate}
                    isLoading={trustlyMutation.isPending}
                    amount={getPaymentAmount()}
                  />
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Footer - Tesla Minimal */}
      <footer className="py-16 bg-black text-white">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <div>
              <div className="text-2xl font-light mb-2">Secure</div>
              <div className="text-sm font-light opacity-70">Bank-level encryption</div>
            </div>
            <div>
              <div className="text-2xl font-light mb-2">Instant</div>
              <div className="text-sm font-light opacity-70">Immediate processing</div>
            </div>
            <div>
              <div className="text-2xl font-light mb-2">Support</div>
              <div className="text-sm font-light opacity-70">Always available</div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Tesla-style Stripe Payment Form
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
      <div className="p-6 bg-red-50 border border-red-200">
        <p className="text-red-800 font-light">
          Stripe not configured. Contact support.
        </p>
      </div>
    );
  }

  if (!isReady || !clientSecret) {
    return (
      <div className="flex justify-center items-center py-12">
        <LoadingSpinner />
        <span className="ml-3 text-gray-600 font-light">Setting up payment...</span>
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
    <form onSubmit={handleSubmit} className="space-y-8">
      <div className="[&_.Input]:border-0 [&_.Input]:border-b-2 [&_.Input]:border-gray-300 [&_.Input]:rounded-none [&_.Input]:h-12">
        <PaymentElement />
      </div>
      
      <Button
        type="submit"
        data-testid="button-complete-payment"
        className="w-full bg-black text-white hover:bg-gray-800 py-4 text-lg font-medium rounded-full"
        disabled={!stripe || isProcessing}
      >
        {isProcessing ? (
          <div className="flex items-center justify-center">
            <LoadingSpinner size="sm" className="mr-3" />
            Processing...
          </div>
        ) : (
          `Complete Payment • $${amount}`
        )}
      </Button>
    </form>
  );
}

// Tesla-style Trustly Form
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
    <form onSubmit={trustlyForm.handleSubmit(onSubmit)} className="space-y-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <Input
            data-testid="input-first-name"
            placeholder="First Name"
            className="h-12 border-0 border-b-2 border-gray-300 rounded-none bg-transparent focus:border-black focus:ring-0"
            {...trustlyForm.register("firstName")}
          />
          {trustlyForm.formState.errors.firstName && (
            <p className="text-red-500 text-sm mt-2 font-light">
              {trustlyForm.formState.errors.firstName.message}
            </p>
          )}
        </div>
        
        <div>
          <Input
            data-testid="input-last-name"
            placeholder="Last Name"
            className="h-12 border-0 border-b-2 border-gray-300 rounded-none bg-transparent focus:border-black focus:ring-0"
            {...trustlyForm.register("lastName")}
          />
          {trustlyForm.formState.errors.lastName && (
            <p className="text-red-500 text-sm mt-2 font-light">
              {trustlyForm.formState.errors.lastName.message}
            </p>
          )}
        </div>
      </div>
      
      <div>
        <Input
          data-testid="input-email"
          type="email"
          placeholder="Email Address"
          className="h-12 border-0 border-b-2 border-gray-300 rounded-none bg-transparent focus:border-black focus:ring-0"
          {...trustlyForm.register("email")}
        />
        {trustlyForm.formState.errors.email && (
          <p className="text-red-500 text-sm mt-2 font-light">
            {trustlyForm.formState.errors.email.message}
          </p>
        )}
      </div>
      
      <div>
        <select
          data-testid="select-country"
          className="w-full h-12 border-0 border-b-2 border-gray-300 rounded-none bg-transparent focus:border-black focus:outline-none text-gray-600"
          {...trustlyForm.register("country")}
        >
          <option value="">Select Country</option>
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
          <p className="text-red-500 text-sm mt-2 font-light">
            {trustlyForm.formState.errors.country.message}
          </p>
        )}
      </div>

      <Button
        type="submit"
        data-testid="button-trustly-payment"
        className="w-full bg-black text-white hover:bg-gray-800 py-4 text-lg font-medium rounded-full"
        disabled={isLoading}
      >
        {isLoading ? (
          <div className="flex items-center justify-center">
            <LoadingSpinner size="sm" className="mr-3" />
            Processing...
          </div>
        ) : (
          `Pay with Bank Transfer • $${amount}`
        )}
      </Button>
    </form>
  );
}
