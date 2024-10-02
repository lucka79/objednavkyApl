import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useAuthStore } from "../lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

export const Route = createFileRoute("/register")({
  component: Register,
});

function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const signUp = useAuthStore((state) => state.signUp);
  const navigate = useNavigate();
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: () => signUp(email, password, fullName),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Registration successful. Please log in.",
      });
      navigate({ to: "/login" });
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
          <CardTitle>Register</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="text"
              placeholder="Full Name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
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
              {mutation.isPending ? "Registering..." : "Register"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
