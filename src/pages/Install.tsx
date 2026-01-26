import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Smartphone, CheckCircle2, Share, MoreVertical } from "lucide-react";
import { motion } from "framer-motion";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const Install = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    // Check if iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(isIOSDevice);

    // Listen for install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // Listen for app installed
    window.addEventListener("appinstalled", () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <Card className="border-border/50 shadow-elegant">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-hero text-primary-foreground font-bold text-2xl shadow-elegant">
              TM
            </div>
            <CardTitle className="text-2xl">Tiger's Mark</CardTitle>
            <CardDescription>Inventory Management System</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {isInstalled ? (
              <div className="text-center space-y-4">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                  <CheckCircle2 className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">App Installed!</h3>
                  <p className="text-muted-foreground text-sm mt-1">
                    You can now access Tiger's Mark from your home screen
                  </p>
                </div>
                <Button 
                  onClick={() => window.location.href = "/dashboard"} 
                  className="w-full bg-gradient-hero"
                >
                  Open Dashboard
                </Button>
              </div>
            ) : isIOS ? (
              <div className="space-y-4">
                <div className="text-center">
                  <Smartphone className="h-12 w-12 mx-auto text-primary mb-3" />
                  <h3 className="font-semibold text-lg">Install on iOS</h3>
                  <p className="text-muted-foreground text-sm mt-1">
                    Follow these steps to install the app
                  </p>
                </div>
                <div className="space-y-3 bg-muted/30 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
                      1
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">Tap the</span>
                      <Share className="h-5 w-5 text-primary" />
                      <span className="text-sm font-medium">Share</span>
                      <span className="text-sm">button</span>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
                      2
                    </div>
                    <p className="text-sm">
                      Scroll down and tap <span className="font-medium">"Add to Home Screen"</span>
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
                      3
                    </div>
                    <p className="text-sm">
                      Tap <span className="font-medium">"Add"</span> to install
                    </p>
                  </div>
                </div>
              </div>
            ) : deferredPrompt ? (
              <div className="space-y-4">
                <div className="text-center">
                  <Download className="h-12 w-12 mx-auto text-primary mb-3" />
                  <h3 className="font-semibold text-lg">Install App</h3>
                  <p className="text-muted-foreground text-sm mt-1">
                    Add Tiger's Mark to your home screen for quick access
                  </p>
                </div>
                <Button 
                  onClick={handleInstall} 
                  className="w-full bg-gradient-hero"
                  size="lg"
                >
                  <Download className="mr-2 h-5 w-5" />
                  Install Now
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="text-center">
                  <Smartphone className="h-12 w-12 mx-auto text-primary mb-3" />
                  <h3 className="font-semibold text-lg">Install on Android</h3>
                  <p className="text-muted-foreground text-sm mt-1">
                    Follow these steps to install the app
                  </p>
                </div>
                <div className="space-y-3 bg-muted/30 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
                      1
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">Tap the</span>
                      <MoreVertical className="h-5 w-5 text-primary" />
                      <span className="text-sm font-medium">Menu</span>
                      <span className="text-sm">button</span>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
                      2
                    </div>
                    <p className="text-sm">
                      Tap <span className="font-medium">"Install app"</span> or <span className="font-medium">"Add to Home Screen"</span>
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
                      3
                    </div>
                    <p className="text-sm">
                      Tap <span className="font-medium">"Install"</span> to confirm
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="pt-4 border-t border-border/30">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-lg font-bold text-primary">Fast</div>
                  <div className="text-xs text-muted-foreground">Instant Access</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-primary">Offline</div>
                  <div className="text-xs text-muted-foreground">Works Anywhere</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-primary">Secure</div>
                  <div className="text-xs text-muted-foreground">Protected Data</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default Install;
