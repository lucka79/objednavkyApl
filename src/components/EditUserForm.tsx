import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { UserRole } from "../../types";
import {
  updateProfile,
  updateRole,
  updatePaidBy,
  updateActive,
  updateOZ,
  updateOZNew,
  updateMoPartners,
  updatePhone,
  updateCrateBig,
  updateCrateSmall,
  updateNote,
  updateSupplier,
  updateUserGeocoding,
} from "@/hooks/useProfiles";
import { geocodingService } from "@/lib/geocoding";
import { MapPin } from "lucide-react";
import { useState } from "react";

interface EditUserFormProps {
  user: any;
  onSuccess: () => void;
}

const roles = [
  "buyer",
  "driver",
  "expedition",
  "store",
  "mobil",

  "supplier",
] as const;

const formSchema = z.object({
  full_name: z.string().min(1, "Full name is required"),
  phone: z.string().min(1, "Phone is required"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  ico: z.string().optional(),
  address: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  formatted_address: z.string().optional(),
  place_id: z.string().optional(),
  note: z.string().optional(),
  role: z.enum(roles, {
    required_error: "Please select a role",
  }),
  paid_by: z.enum(["Hotově", "Příkazem", "-"], {
    required_error: "Please select payment type",
  }),
  active: z.boolean(),
  oz: z.boolean(),
  oz_new: z.boolean(),
  mo_partners: z.boolean(),
  crateBig: z.number().min(0),
  crateSmall: z.number().min(0),
  supplier: z.boolean(),
});

export function EditUserForm({ user, onSuccess }: EditUserFormProps) {
  const { toast } = useToast();
  const [isGeocoding, setIsGeocoding] = useState(false);

  // Mutation hooks
  const updateProfileMutation = updateProfile();
  const updateRoleMutation = updateRole();
  const updatePaidByMutation = updatePaidBy();
  const updateActiveMutation = updateActive();
  const updateOZMutation = updateOZ();
  const updateOZNewMutation = updateOZNew();
  const updateMoPartnersMutation = updateMoPartners();
  const updatePhoneMutation = updatePhone();
  const updateCrateBigMutation = updateCrateBig();
  const updateCrateSmallMutation = updateCrateSmall();
  const updateNoteMutation = updateNote();
  const updateSupplierMutation = updateSupplier();
  const updateGeocodingMutation = updateUserGeocoding();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      full_name: user.full_name || "",
      phone: user.phone || "",
      email: user.email || "",
      ico: user.ico || "",
      address: user.address || "",
      lat: user.lat || undefined,
      lng: user.lng || undefined,
      formatted_address: user.formatted_address || "",
      place_id: user.place_id || "",
      note: user.note || "",
      role: user.role || "user",
      paid_by: user.paid_by || "-",
      active: user.active || false,
      oz: user.oz || false,
      oz_new: user.oz_new || false,
      mo_partners: user.mo_partners || false,
      crateBig: user.crateBig || 0,
      crateSmall: user.crateSmall || 0,
      supplier: user.supplier || false,
    },
  });

  // Geocoding function
  const handleGeocodeAddress = async () => {
    const address = form.getValues("address");
    if (!address || address.trim() === "") {
      toast({
        title: "Error",
        description: "Please enter an address first",
        variant: "destructive",
      });
      return;
    }

    setIsGeocoding(true);
    try {
      const result = await geocodingService.geocodeAddress(address);

      if ("error" in result) {
        toast({
          title: "Geocoding Error",
          description: result.message,
          variant: "destructive",
        });
        return;
      }

      // Update form fields with geocoding results
      form.setValue("lat", result.lat);
      form.setValue("lng", result.lng);
      form.setValue("formatted_address", result.formatted_address);
      form.setValue("place_id", result.place_id);

      toast({
        title: "Success",
        description: `Address geocoded: ${result.formatted_address}`,
      });
    } catch (error) {
      console.error("Geocoding error:", error);
      toast({
        title: "Error",
        description: "Failed to geocode address",
        variant: "destructive",
      });
    } finally {
      setIsGeocoding(false);
    }
  };

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      // Update basic profile fields
      await updateProfileMutation.mutateAsync({
        id: user.id,
        full_name: values.full_name,
        address: values.address,
        ico: values.ico,
      });

      // Update note
      await updateNoteMutation.mutateAsync({
        id: user.id,
        note: values.note || "",
      });

      // Update phone (requires special handling)
      if (values.phone !== user.phone) {
        await updatePhoneMutation.mutateAsync({
          id: user.id,
          phone: values.phone,
        });
      }

      // Update crates
      await updateCrateBigMutation.mutateAsync({
        id: user.id,
        crateBig: values.crateBig,
      });

      await updateCrateSmallMutation.mutateAsync({
        id: user.id,
        crateSmall: values.crateSmall,
      });

      // Update role
      await updateRoleMutation.mutateAsync({
        id: user.id,
        role: values.role as UserRole,
      });

      // Update payment type
      await updatePaidByMutation.mutateAsync({
        id: user.id,
        paid_by: values.paid_by,
      });

      // Update active status
      await updateActiveMutation.mutateAsync({
        id: user.id,
        active: values.active,
      });

      // Update OZ status
      await updateOZMutation.mutateAsync({
        id: user.id,
        oz: values.oz,
      });

      // Update OZ New status
      await updateOZNewMutation.mutateAsync({
        id: user.id,
        oz_new: values.oz_new,
      });

      // Update MO Partners status
      await updateMoPartnersMutation.mutateAsync({
        id: user.id,
        mo_partners: values.mo_partners,
      });

      // Update Supplier status
      await updateSupplierMutation.mutateAsync({
        id: user.id,
        supplier: values.supplier,
      });

      // Update geocoding data if coordinates are present
      if (
        values.lat &&
        values.lng &&
        values.formatted_address &&
        values.place_id
      ) {
        await updateGeocodingMutation.mutateAsync({
          id: user.id,
          lat: values.lat,
          lng: values.lng,
          formatted_address: values.formatted_address,
          place_id: values.place_id,
        });
      }

      toast({
        title: "Success",
        description: "User updated successfully",
      });
      onSuccess();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error",
        description: err instanceof Error ? err.message : "An error occurred",
      });
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-4"
        autoComplete="off"
      >
        <div className="flex items-center space-x-6">
          <FormField
            control={form.control}
            name="active"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center space-x-2">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    className="data-[state=checked]:bg-orange-600 data-[state=checked]:border-orange-600"
                  />
                </FormControl>
                <FormLabel className="text-sm font-normal">Active</FormLabel>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="oz"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center space-x-2">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    className="data-[state=checked]:bg-orange-600 data-[state=checked]:border-orange-600"
                  />
                </FormControl>
                <FormLabel className="text-sm font-normal">OZ</FormLabel>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="oz_new"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center space-x-2">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    className="data-[state=checked]:bg-orange-600 data-[state=checked]:border-orange-600"
                  />
                </FormControl>
                <FormLabel className="text-sm font-normal">OZ New</FormLabel>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="mo_partners"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center space-x-2">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    className="data-[state=checked]:bg-orange-600 data-[state=checked]:border-orange-600"
                  />
                </FormControl>
                <FormLabel className="text-sm font-normal">
                  MO Partners
                </FormLabel>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="supplier"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center space-x-2">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    className="data-[state=checked]:bg-orange-600 data-[state=checked]:border-orange-600"
                  />
                </FormControl>
                <FormLabel className="text-sm font-normal">Dodavatel</FormLabel>
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="full_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Full Name</FormLabel>
                <FormControl>
                  <Input {...field} autoComplete="off" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone</FormLabel>
                <FormControl>
                  <Input {...field} autoComplete="off" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input {...field} type="email" autoComplete="off" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="ico"
            render={({ field }) => (
              <FormItem>
                <FormLabel>IČO</FormLabel>
                <FormControl>
                  <Input {...field} autoComplete="off" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Address</FormLabel>
              <div className="flex gap-2">
                <FormControl>
                  <Input {...field} placeholder="Enter address..." />
                </FormControl>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleGeocodeAddress}
                  disabled={isGeocoding || !field.value}
                  className="flex-shrink-0"
                >
                  {isGeocoding ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                  ) : (
                    <MapPin className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Geocoding Results */}
        {(form.watch("lat") || form.watch("lng")) && (
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="lat"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Latitude</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="number"
                      step="any"
                      placeholder="Latitude"
                      value={field.value || ""}
                      onChange={(e) =>
                        field.onChange(
                          e.target.value ? Number(e.target.value) : undefined
                        )
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="lng"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Longitude</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="number"
                      step="any"
                      placeholder="Longitude"
                      value={field.value || ""}
                      onChange={(e) =>
                        field.onChange(
                          e.target.value ? Number(e.target.value) : undefined
                        )
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        )}

        {form.watch("formatted_address") && (
          <FormField
            control={form.control}
            name="formatted_address"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Formatted Address</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder="Formatted address from Google..."
                    readOnly
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <FormField
          control={form.control}
          name="note"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Note</FormLabel>
              <FormControl>
                <Textarea {...field} placeholder="Enter note..." />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="role"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Role</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select role..." />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {roles.map((role) => {
                      const roleMap: Record<string, string> = {
                        buyer: "Odběratel (Pohoda)",
                        driver: "Řidič",
                        store: "Prodejna",
                        mobil: "Mobil",
                        expedition: "Expedice",
                        supplier: "Dodavatel",
                        admin: "Administrátor",
                      };
                      return (
                        <SelectItem key={role} value={role}>
                          {roleMap[role] ||
                            role.charAt(0).toUpperCase() + role.slice(1)}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="paid_by"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Payment Type</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select payment type..." />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {["Hotově", "Příkazem", "-"].map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="crateBig"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Big Crates</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="number"
                    min="0"
                    onChange={(e) => field.onChange(Number(e.target.value))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="crateSmall"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Small Crates</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="number"
                    min="0"
                    onChange={(e) => field.onChange(Number(e.target.value))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <Button
          type="submit"
          className="w-full bg-orange-600 text-white hover:bg-orange-700 focus:bg-orange-700"
          disabled={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting ? "Upravuji..." : "Upravit"}
        </Button>
      </form>
    </Form>
  );
}
