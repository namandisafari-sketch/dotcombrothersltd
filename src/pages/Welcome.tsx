import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Phone, MessageCircle, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

export default function Welcome() {
  const developerPhone = "+256745368426";

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-primary/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-pulse" />
      </div>

      <Card className="relative max-w-md w-full border-0 shadow-2xl bg-background/80 backdrop-blur-sm">
        <CardContent className="pt-10 pb-8 px-8 text-center space-y-8">
          <div className="space-y-4">
            <h1 className="text-3xl font-bold tracking-tight">
              Welcome! 👋
            </h1>
            <p className="text-lg text-muted-foreground">
              Would you like to contact the developer of this app?
            </p>
          </div>

          <div className="space-y-4">
            <a href={`tel:${developerPhone}`} className="block">
              <Button 
                size="lg" 
                className="w-full gap-3 py-6 text-lg bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600"
              >
                <Phone className="h-5 w-5" />
                Call {developerPhone}
              </Button>
            </a>

            <a 
              href={`https://wa.me/${developerPhone.replace(/\+/g, "")}?text=Hi%2C%20I%20wanted%20to%20contact%20the%20developer`} 
              target="_blank" 
              rel="noopener noreferrer"
              className="block"
            >
              <Button 
                size="lg" 
                variant="outline"
                className="w-full gap-3 py-6 text-lg hover:bg-green-500/10 hover:border-green-500/50 hover:text-green-600"
              >
                <MessageCircle className="h-5 w-5" />
                WhatsApp
              </Button>
            </a>
          </div>

          <div className="pt-4 border-t">
            <Link to="/home">
              <Button variant="ghost" className="gap-2 text-muted-foreground hover:text-foreground">
                Continue to App <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
