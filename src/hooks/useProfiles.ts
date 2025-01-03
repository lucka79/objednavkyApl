import { supabase } from "@/lib/supabase";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

interface SubscriberUser {
  id: string;
  full_name: string;
  phone: string;
}


export const useUsers = () => {
  return useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order('active', { ascending: false })
        .order('full_name', { ascending: true });
      
      if (error) throw error;
      return data;
    },
  });
};

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
  return useQuery<SubscriberUser[], Error>({
    queryKey: ["subsrciberUsers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, phone, crateBig, crateSmall")
        .in("role", ["buyer", "mobil", "store"])
        .eq("active", true)
        .order("full_name", { ascending: true })

      
      if (error) throw error;
      return data || [];
    },
    initialData: [],
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


export const updateProfile = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      full_name,
      address,
      ico,
      mo_partners,

    }: {
      id: string;
      full_name?: string;
      address?: string;
      ico?: string;
      mo_partners?: string;

    }) => {
      const { error } = await supabase
        .from("profiles")
        .update({
          ...(full_name && { full_name }),
          ...(address && { address }),
          ...(ico && { ico }),
          ...(mo_partners && { mo_partners }),

        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
};

export const updateRole = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, role }: { id: string; role: string }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ role })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
};

export const updateCrateBig = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, crateBig }: { id: string; crateBig: number }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ crateBig })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
};

export const updateCrateSmall = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, crateSmall }: { id: string; crateSmall: number }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ crateSmall })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
};

export const updatePaidBy = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, paid_by }: { id: string; paid_by: string }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ paid_by })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
};

export const updateNote = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, note }: { id: string; note: string }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ note })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
};

export const updateActive = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
};

export const deleteUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const { error } = await supabase
        .from("profiles")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
};

export const useDriverUsers = () => {
  return useQuery({
    queryKey: ['driverUsers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'driver')
        .order('full_name');

      if (error) throw error;
      return data;
    }
  });
};
