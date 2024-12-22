import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff } from "lucide-react";

export const Route = createFileRoute("/login")({
  component: Login,
});

function Login() {
  const [activeTab, setActiveTab] = useState<"email" | "phone">("email");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const signInWithEmail = useAuthStore((state) => state.signInWithEmail);
  const signInWithPhone = useAuthStore((state) => state.signInWithPhone);
  const user = useAuthStore((state) => state.user);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleTabChange = (value: string) => {
    setActiveTab(value as "email" | "phone");
    setEmail("");
    setPhone("");
    setPassword("");
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (activeTab === "email") {
        if (!email || !password) {
          throw new Error("Vyplňte prosím email a heslo");
        }
        console.log("📧 Email login attempt:", {
          email,
          passwordLength: password.length,
        });
        return await signInWithEmail(email, password);
      } else {
        if (!phone || !password) {
          throw new Error("Vyplňte prosím telefon a heslo");
        }
        if (phone.length !== 9) {
          throw new Error("Telefonní číslo musí mít 9 číslic");
        }

        const formattedPhone = `+420${phone}`;
        console.log("📱 Phone login attempt:", {
          phone: formattedPhone,
          rawPhone: phone,
          passwordLength: password.length,
        });

        return await signInWithPhone(formattedPhone, password);
      }
    },
    onSuccess: (role) => {
      console.log(`✅ Login successful with ${activeTab}. User role:`, role);
      toast({
        title: "Úspěch",
        description: "Přihlášení proběhlo úspěšně",
        variant: "default",
      });

      switch (role) {
        case "admin":
          navigate({ to: "/admin/products" });
          break;
        case "driver":
          navigate({ to: "/driver" });
          break;
        case "mobil":
          navigate({ to: "/user/products" });
          break;
        case "store":
          navigate({ to: "/store" });
          break;
        default:
          navigate({ to: "/user/products" });
      }
    },
    onError: (error: Error) => {
      console.error(`❌ ${activeTab.toUpperCase()} login failed:`, error);
      toast({
        title: "Chyba přihlášení",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate();
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, "");
    if (value.length > 9) value = value.slice(0, 9);
    setPhone(value);
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-background">
      <Card className="w-[350px]">
        <CardHeader>
          <CardTitle>Přihlášení</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs
            defaultValue="email"
            value={activeTab}
            onValueChange={handleTabChange}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="email">Email</TabsTrigger>
              <TabsTrigger value="phone">Telefon</TabsTrigger>
            </TabsList>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <TabsContent value="email">
                <Input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </TabsContent>
              <TabsContent value="phone">
                <Input
                  type="tel"
                  placeholder="Phone (9 digits)"
                  value={phone}
                  onChange={handlePhoneChange}
                  required
                  autoComplete="tel"
                  maxLength={9}
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Enter 9 digits without country code
                </p>
              </TabsContent>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => {
                    console.log("Password changed:", e.target.value.length);
                    setPassword(e.target.value);
                  }}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={mutation.isPending}
              >
                {mutation.isPending ? "Logging in..." : "Login"}
              </Button>
            </form>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
