import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Lock, Mail, ChevronLeft, ChevronRight, Shield, Package, BarChart3 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import carousel1 from "@/assets/login-carousel-1.jpg";
import carousel2 from "@/assets/login-carousel-2.jpg";
import carousel3 from "@/assets/login-carousel-3.jpg";
import carousel4 from "@/assets/login-carousel-4.jpg";

const carouselImages = [
  {
    src: carousel1,
    title: "Building Excellence",
    subtitle: "Managing construction inventory with precision and efficiency",
    icon: Package,
  },
  {
    src: carousel2,
    title: "Quality Materials",
    subtitle: "Track every item from warehouse to worksite",
    icon: BarChart3,
  },
  {
    src: carousel3,
    title: "Professional Management",
    subtitle: "Streamlined inventory control for modern construction",
    icon: Shield,
  },
  {
    src: carousel4,
    title: "Trusted Solutions",
    subtitle: "Your partner in construction inventory management",
    icon: Package,
  }
];

const features = [
  { icon: Package, text: "Real-time Tracking" },
  { icon: BarChart3, text: "Advanced Analytics" },
  { icon: Shield, text: "Secure Access" },
];

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, signIn } = useAuth();

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % carouselImages.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (user) {
      navigate("/dashboard");
    }
  }, [user, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!agreedToTerms) {
      toast({
        title: "Terms Required",
        description: "Please agree to the Terms and Policies to continue.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    const { error } = await signIn(email, password);
    setIsLoading(false);

    if (error) {
      toast({
        title: "Login Failed",
        description: error.message || "Invalid email or password. Please try again.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Welcome Back!",
        description: "Login successful. Redirecting to dashboard...",
      });
      setTimeout(() => navigate("/dashboard"), 500);
    }
  };

  const goToPrevious = () => {
    setCurrentImageIndex((prev) => 
      prev === 0 ? carouselImages.length - 1 : prev - 1
    );
  };

  const goToNext = () => {
    setCurrentImageIndex((prev) => (prev + 1) % carouselImages.length);
  };

  return (
    <div className="min-h-screen w-full flex bg-background">
      {/* Left Side - Image Carousel */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-3/5 relative overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentImageIndex}
            initial={{ opacity: 0, scale: 1.1 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.7 }}
            className="absolute inset-0"
          >
            <img
              src={carouselImages[currentImageIndex].src}
              alt={carouselImages[currentImageIndex].title}
              className="w-full h-full object-cover"
            />
            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-r from-background via-background/50 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
          </motion.div>
        </AnimatePresence>
 {/* Content Overlay */}
        <div className="absolute inset-0 flex flex-col justify-between p-12 z-10">
          {/* Top - Logo */}
     <motion.div 
  initial={{ opacity: 0, y: -20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ delay: 0.3, duration: 0.5 }}
  className="flex items-center gap-8"
>
  <div className="flex h-50 w-50 items-center justify-center overflow-hidden">
    <img
      src="/TMClog0s.png"
      alt="Tiger's Mark Logo"
      className="h-full w-full object-contain"
    />
  </div>
</motion.div>

          {/* Bottom - Text Content */}
          <div className="space-y-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentImageIndex}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -30 }}
                transition={{ duration: 0.5 }}
                className="space-y-4"
              >
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 backdrop-blur-sm border border-primary/20">
                  {(() => {
                    const IconComponent = carouselImages[currentImageIndex].icon;
                    return <IconComponent className="h-4 w-4 text-primary" />;
                  })()}
                  <span className="text-sm font-medium text-foreground">Enterprise Solution</span>
                </div>
                <h2 className="text-4xl xl:text-5xl font-bold text-foreground leading-tight">
                  {carouselImages[currentImageIndex].title}
                </h2>
                <p className="text-lg text-muted-foreground max-w-md">
                  {carouselImages[currentImageIndex].subtitle}
                </p>
              </motion.div>
            </AnimatePresence>

            {/* Carousel Navigation */}
            <div className="flex items-center gap-4">
              <div className="flex gap-2">
                {carouselImages.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentImageIndex(index)}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      index === currentImageIndex 
                        ? "w-10 bg-primary" 
                        : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50"
                    }`}
                  />
                ))}
              </div>
              <div className="flex gap-2 ml-auto">
                <button
                  onClick={goToPrevious}
                  className="h-10 w-10 rounded-xl bg-card/80 backdrop-blur-sm border border-border flex items-center justify-center text-foreground hover:bg-card transition-colors"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  onClick={goToNext}
                  className="h-10 w-10 rounded-xl bg-card/80 backdrop-blur-sm border border-border flex items-center justify-center text-foreground hover:bg-card transition-colors"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Features */}
            <div className="flex gap-6 pt-4 border-t border-border/30">
              {features.map((feature, index) => (
                <div key={index} className="flex items-center gap-2 text-muted-foreground">
                  <feature.icon className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">{feature.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 xl:w-2/5 flex items-center justify-center p-6 sm:p-12">
        <motion.div 
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="w-full max-w-md space-y-8"
        >
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center justify-center gap-4 mb-8">
  <div className="flex h-50 w-50 items-center justify-center overflow-hidden">
    <img
      src="/TMClog0s.png"
      alt="Tiger's Mark Logo"
      className="h-full w-full object-contain"
    />
  </div>
</div>

          {/* Header */}
          <div className="text-center lg:text-left">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.4 }}
            >
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-4">
                <Shield className="h-3 w-3" />
                Secure Login
              </span>
              <h1 className="text-3xl font-bold text-foreground mb-2">
                Welcome Back
              </h1>
              <p className="text-muted-foreground">
                Sign in to access your inventory management dashboard
              </p>
            </motion.div>
          </div>

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-5">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.4 }}
              className="space-y-2"
            >
              <Label htmlFor="login-email" className="text-foreground font-medium">
                Email Address
              </Label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                </div>
                <Input
                  id="login-email"
                  type="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-16 h-14 bg-muted/30 border-border/50 rounded-xl"
                  required
                />
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.4 }}
              className="space-y-2"
            >
              <Label htmlFor="login-password" className="text-foreground font-medium">
                Password
              </Label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
                  <Lock className="h-4 w-4 text-muted-foreground" />
                </div>
                <Input
                  id="login-password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-16 h-14 bg-muted/30 border-border/50 rounded-xl"
                  required
                />
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7, duration: 0.4 }}
              className="flex items-start space-x-3 pt-2"
            >
              <Checkbox
                id="login-terms"
                checked={agreedToTerms}
                onCheckedChange={(checked) => setAgreedToTerms(checked as boolean)}
                className="mt-1 rounded-md"
              />
              <label
                htmlFor="login-terms"
                className="text-sm text-muted-foreground leading-relaxed cursor-pointer"
              >
                I agree to the{" "}
                <a href="#" className="text-primary hover:underline font-medium">
                  Terms of Service
                </a>{" "}
                and{" "}
                <a href="#" className="text-primary hover:underline font-medium">
                  Privacy Policy
                </a>
              </label>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8, duration: 0.4 }}
              className="pt-2"
            >
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-14 bg-gradient-hero hover:opacity-90 text-primary-foreground rounded-xl text-base font-semibold shadow-elegant"
              >
                {isLoading ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center gap-3"
                  >
                    <div className="h-5 w-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    Signing In...
                  </motion.div>
                ) : (
                  "Sign In to Dashboard"
                )}
              </Button>
            </motion.div>
          </form>

          {/* Footer */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1, duration: 0.4 }}
            className="pt-6 border-t border-border/30"
          >
            <p className="text-center text-sm text-muted-foreground">
              Tiger's Mark Corporation © {new Date().getFullYear()}
            </p>
            <p className="text-center text-xs text-muted-foreground/70 mt-1">
              Enterprise Inventory Management System
            </p>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
};

export default Login;
