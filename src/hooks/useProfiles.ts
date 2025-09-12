import { supabase, supabaseAdmin } from "@/lib/supabase";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

interface SubscriberUser {
  id: string;
  full_name: string;
  phone: string;
  role: 'buyer' | 'driver' | 'store' | 'mobil' | 'admin'| 'expedition';  // Add this line
}


export const useUsers = () => {
  return useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .order('active', { ascending: false })
        .order('full_name', { ascending: true });
      
      if (profilesError) throw profilesError;
      
      // Sort by name using Czech locale for proper diacritic handling
      if (profiles) {
        return profiles.sort((a, b) => {
          const nameA = (a.full_name || '').toLowerCase();
          const nameB = (b.full_name || '').toLowerCase();
          return nameA.localeCompare(nameB, 'cs');
        });
      }
      
      return profiles;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
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
        .select("id, full_name, phone, crateBig, crateSmall, role")
        .eq("active", true)
        .order("full_name", { ascending: true });
      
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
      

    }: {
      id: string;
      full_name?: string;
      address?: string;
      ico?: string;



    }) => {
      const { error } = await supabase
        .from("profiles")
        .update({
          ...(full_name && { full_name }),
          ...(address && { address }),
          ...(ico && { ico }),



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

export const updateOZ = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, oz }: { id: string; oz: boolean }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ oz })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
};

export const updateOZNew = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, oz_new }: { id: string; oz_new: boolean }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ oz_new })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
};

export const updateMoPartners = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, mo_partners }: { id: string; mo_partners: boolean }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ mo_partners })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
};

export const updateSupplier = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, supplier }: { id: string; supplier: boolean }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ supplier })
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

// Add new mutation
export const updatePhone = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, phone }: { id: string; phone: string }) => {
      console.log('Updating user phone:', { id, phone });
      
      // Update profile first
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ phone })
        .eq('id', id);

      if (profileError) {
        console.error('Profile update error:', profileError);
        throw profileError;
      }

      console.log('Profile phone updated successfully');

      // Try to update auth user using admin client
      try {
        const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(id, {
          phone
        });

        if (authError) {
          console.warn('Auth phone update failed (this is often expected):', authError);
          // Don't throw error - profile update was successful
        } else {
          console.log('Auth phone updated successfully');
        }
      } catch (authUpdateError) {
        console.warn('Auth phone update failed (this is often expected):', authUpdateError);
        // Don't throw error - profile update was successful
      }
      
      console.log('Phone update completed for user:', id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
};

export const useSupplierUsers = () => {
  return useQuery({
    queryKey: ["supplierUsers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, supplier, active")
        .eq("supplier", true)
        .order("full_name", { ascending: true });
      if (error) throw error;
      return (data || []).filter((u) => u.full_name);
    },
  });
};

// Geocoding mutation
export const updateUserGeocoding = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ 
      id, 
      lat, 
      lng, 
      formatted_address, 
      place_id 
    }: { 
      id: string; 
      lat: number; 
      lng: number; 
      formatted_address: string; 
      place_id: string; 
    }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ 
          lat, 
          lng, 
          formatted_address, 
          place_id 
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
};
