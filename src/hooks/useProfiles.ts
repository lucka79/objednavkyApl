import { supabase } from "@/lib/supabase";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export const useMobileUsers = () => {
  return useQuery({
    queryKey: ["mobileUsers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("role", "mobil");
      
      if (error) throw error;
      return data;
    },
  });
}; 

export const useSubsrciberUsers = () => {
  return useQuery({
    queryKey: ["subsrciberUsers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("role", ["buyer", "mobil", "store", "user"])
        .eq("active", true);
      
      if (error) throw error;
      return data;
    },
  });
};

// Add this new mutation
export const useUpdateProfile = () => {
    const queryClient = useQueryClient();
  
    return useMutation({
      async mutationFn({userId, updatedFields}: {userId: string, updatedFields: {crateBig?: number, crateSmall?: number}}) {
        const { error, data: updatedProfile } = await supabase
          .from("profiles")
          .update(updatedFields)
          .eq("id", userId)
          .select()
          .single();
  
        if (error) {
          throw new Error(error.message);
        }
        return updatedProfile;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["profile"] });
      },
    });
  };

// Add this new hook
export const useSelectedUser = (userId: string) => {
  return useQuery({
    queryKey: ["selectedUser", userId],
    queryFn: async () => {
      if (!userId) return null;
      
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!userId, // Only run query if userId exists
  });
};