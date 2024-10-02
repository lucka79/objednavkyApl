import { supabase } from "@/lib/supabase";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useState } from "react";
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

export const Route = createFileRoute("/auth/sign-in")({
  component: SignInScreen,
});

function SignInScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function signInWithEmail() {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    console.log(error);

    if (error) alert(error.message);
    setLoading(false);
  }

  return (
    <div className="flex justify-center p-5">
      <Card className="w-[350px]">
        <CardHeader>
          <CardTitle>Přihlášení do objednávek</CardTitle>
          <CardDescription>
            Pokud si chcete vytvořit objednávku.
          </CardDescription>
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
          <Button variant="outline" onClick={signInWithEmail} asChild>
            <Link to={"/orders/user"}>
              {loading ? (
                <Button disabled>
                  <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />
                  Vstupte...
                </Button>
              ) : (
                "Vstupte"
              )}
            </Link>
          </Button>
          <Button>
            <Link to="/">Cancel</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
