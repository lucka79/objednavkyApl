import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

export const Route = createFileRoute("/login")({
  component: Login,
});

function Login() {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const signIn = useAuthStore((state) => state.signIn);
  const user = useAuthStore((state) => state.user);
  const navigate = useNavigate();
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async () => {
      console.log("Attempting login with:", {
        identifier: email || phone,
        isPhone: Boolean(phone),
        password,
      });

      await signIn(email || phone, password);
      return user?.role;
    },
    onSuccess: (role) => {
      console.log("Login successful, user role:", role);
      toast({
        title: "Success",
        description: "Jste úspěšně přihlášen",
        variant: "default",
      });

      switch (user?.role) {
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
      console.error("Login failed:", error);
      toast({
        title: "Error",
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
          <CardTitle>Login</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="email" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="email">Email</TabsTrigger>
              <TabsTrigger value="phone">Phone</TabsTrigger>
            </TabsList>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <TabsContent value="email">
                <Input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="off"
                />
              </TabsContent>
              <TabsContent value="phone">
                <Input
                  type="tel"
                  placeholder="Phone (9 digits)"
                  value={phone}
                  onChange={handlePhoneChange}
                  required
                  autoComplete="off"
                  maxLength={9}
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Enter 9 digits without country code
                </p>
              </TabsContent>
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
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
