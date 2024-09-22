import React, { useState } from "react";

import { Link, createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ReloadIcon } from "@radix-ui/react-icons";

export const Route = createFileRoute("/auth/sign-up")({
  component: SignUpComponent,
});

function SignUpComponent() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function signUpWithEmail() {
    setLoading(true);
    const { error } = await supabase.auth.signUp({ email, password });

    if (error) alert(error.message);
    setLoading(false);
  }

  return (
    <div className="flex justify-center p-5">
      <Card className="w-[350px]">
        <CardHeader>
          <CardTitle>Registrace</CardTitle>
          <CardDescription>Pokud nemáte založený účet.</CardDescription>
        </CardHeader>
        <CardContent>
          <form>
            <div className="grid w-full items-center gap-4">
              <div className="flex flex-col space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jon@gmail.com"
                  type="email"
                />
              </div>
              <div className="flex flex-col space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder=""
                  type="password"
                />
              </div>
            </div>
          </form>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button>
            <Link to="/">Cancel</Link>
          </Button>
          <Button variant="outline" onClick={signUpWithEmail} asChild>
            <Link to={"/auth/sign-up"}>
              {loading ? (
                <Button disabled>
                  <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />
                  Vytvářím účet, čekejte...
                </Button>
              ) : (
                "Vytvořte účet"
              )}
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
