import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase, useAuthStore } from "@/lib/supabase";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/profile")({
  component: Profile,
});

function Profile() {
  const user = useAuthStore((state) => state.user);
  const group = useAuthStore((state) => (state as any).group as string);
  const { toast } = useToast();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user?.id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const updateProfile = useMutation({
    mutationFn: async (updatedProfile: any) => {
      const { data, error } = await supabase
        .from("profiles")
        .update(updatedProfile)
        .eq("id", user?.id);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Profile updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update profile. Please try again.",
        variant: "destructive",
      });
    },
  });

  if (isLoading) return <div>Loading...</div>;

  return (
    <Card className="w-[350px] mx-auto">
      <CardHeader>
        <CardTitle>User Profile</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            const updatedProfile = Object.fromEntries(formData);
            updateProfile.mutate(updatedProfile);
          }}
          className="space-y-4"
        >
          <Input
            name="full_name"
            placeholder="Full Name"
            defaultValue={profile?.full_name || ""}
          />
          <Input
            name="address"
            placeholder="Address"
            defaultValue={profile?.address || ""}
          />
          <div>Role: {group}</div>
          <Button type="submit">Update Profile</Button>
        </form>
      </CardContent>
    </Card>
  );
}
