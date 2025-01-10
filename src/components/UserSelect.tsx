import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface Profile {
  id: string;
  full_name?: string;
  email?: string;
}

interface UserSelectProps {
  onSelect: (userId: string) => void;
}

export function UserSelect({ onSelect }: UserSelectProps) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadProfiles() {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .order("full_name");

        if (error) throw error;
        setProfiles(data || []);
      } catch (error) {
        console.error("Error loading profiles:", error);
      } finally {
        setIsLoading(false);
      }
    }

    loadProfiles();
  }, []);

  if (isLoading) return <div>Loading users...</div>;

  return (
    <select
      className="w-full max-w-xs p-2 border rounded-md"
      onChange={(e) => onSelect(e.target.value)}
      defaultValue=""
    >
      <option value="" disabled>
        Select a user
      </option>
      {profiles.map((profile) => (
        <option key={profile.id} value={profile.id}>
          {profile.full_name || profile.email || profile.id}
        </option>
      ))}
    </select>
  );
}
