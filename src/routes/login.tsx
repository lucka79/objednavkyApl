import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

export const Route = createFileRoute("/login")({
  component: Login,
});

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const signIn = useAuthStore((state) => state.signIn);
  const user = useAuthStore((state) => state.user);
  const navigate = useNavigate();
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async () => {
      await signIn(email, password);
      return user?.role;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Jste úspěšně přihlášen",
        variant: "default",
      });

      // Redirect based on user role
      // if (user?.role === "admin") {
      //   navigate({ to: "/admin" });
      // } else if (user?.role === "driver") {
      //   navigate({ to: "/driver" });
      // } else {
      //   navigate({ to: "/profile" });
      // }
      switch (user?.role) {
        case "admin":
          navigate({ to: "/admin" });
          break;
        case "driver":
          navigate({ to: "/driver" });
          break;
        default:
          navigate({ to: "/user/products" });
      }
    },
    onError: (error: Error) => {
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

  return (
    <div className="flex justify-center items-center min-h-screen bg-background">
      <Card className="w-[350px]">
        <CardHeader>
          <CardTitle>Login</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <Button
              type="submit"
              className="w-full"
              disabled={mutation.isPending}
            >
              {mutation.isPending ? "Logging in..." : "Login"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
