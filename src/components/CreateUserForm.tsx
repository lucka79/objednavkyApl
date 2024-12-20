import { useState, useRef, useEffect } from "react";
import { useAuthStore } from "../lib/supabase";
import { UserRole } from "../../types";

const roles = [
  "buyer",
  "driver",
  "expedition",
  "store",
  "mobil",
  "admin",
] as const;

export function CreateUserForm() {
  const createUser = useAuthStore((state) => state.createUser);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Reset form when component mounts
  useEffect(() => {
    formRef.current?.reset();
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);

    try {
      await createUser({
        phone: formData.get("phone") as string,
        password: formData.get("password") as string,
        full_name: formData.get("full_name") as string,
        role: formData.get("role") as UserRole,
      });

      // Clear form after successful creation
      formRef.current?.reset();

      // Optional: Reset any form-related state if you have any
      setError(null);

      alert("User created successfully!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="space-y-4"
      autoComplete="off"
    >
      {error && (
        <div className="bg-red-100 text-red-700 p-3 rounded">{error}</div>
      )}

      <div>
        <label htmlFor="full_name" className="block text-sm font-medium">
          Full Name
        </label>
        <input
          type="text"
          id="full_name"
          name="full_name"
          required
          autoComplete="off"
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
        />
      </div>

      <div>
        <label htmlFor="phone" className="block text-sm font-medium">
          Phone
        </label>
        <input
          type="tel"
          id="phone"
          name="phone"
          required
          autoComplete="off"
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
        />
      </div>

      <div>
        <label htmlFor="role" className="block text-sm font-medium">
          Role
        </label>
        <select
          id="role"
          name="role"
          required
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
        >
          <option value="">Select a role</option>
          {roles.map((role) => (
            <option key={role} value={role}>
              {role.charAt(0).toUpperCase() + role.slice(1)}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium">
          Password
        </label>
        <input
          type="password"
          id="password"
          name="password"
          required
          autoComplete="new-password"
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
        />
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50"
      >
        {isLoading ? "Creating..." : "Create User"}
      </button>
    </form>
  );
}
