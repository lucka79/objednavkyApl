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
} from "@/hooks/useProfiles";

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
  "user",
] as const;

const formSchema = z.object({
  full_name: z.string().min(1, "Full name is required"),
  phone: z.string().min(1, "Phone is required"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  ico: z.string().optional(),
  address: z.string().optional(),
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
});

export function EditUserForm({ user, onSuccess }: EditUserFormProps) {
  const { toast } = useToast();

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

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      full_name: user.full_name || "",
      phone: user.phone || "",
      email: user.email || "",
      ico: user.ico || "",
      address: user.address || "",
      note: user.note || "",
      role: user.role || "user",
      paid_by: user.paid_by || "-",
      active: user.active || false,
      oz: user.oz || false,
      oz_new: user.oz_new || false,
      mo_partners: user.mo_partners || false,
      crateBig: user.crateBig || 0,
      crateSmall: user.crateSmall || 0,
    },
  });

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
              <FormControl>
                <Input {...field} placeholder="Enter address..." />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

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
                    {roles.map((role) => (
                      <SelectItem key={role} value={role}>
                        {role.charAt(0).toUpperCase() + role.slice(1)}
                      </SelectItem>
                    ))}
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
          {form.formState.isSubmitting ? "Updating..." : "Update User"}
        </Button>
      </form>
    </Form>
  );
}
