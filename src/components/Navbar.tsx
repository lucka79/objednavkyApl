import { Link } from "@tanstack/react-router";
import { useAuthStore } from "@/lib/supabase";
import { Button } from "@/components/ui/button";

export function Navbar() {
  const user = useAuthStore((state) => state.user);
  const signOut = useAuthStore((state) => state.signOut);

  return (
    <nav className="bg-primary text-primary-foreground shadow-lg">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="text-xl font-bold">
            Logo
          </Link>
          <div className="flex items-center space-x-4">
            {user ? (
              <>
                {/* <Link to="/" className="hover:text-gray-300">
                  Products
                </Link> */}

                {user.role === "user" && (
                  <>
                    <Link to="/user/products" className="hover:text-gray-300">
                      Výrobky
                    </Link>
                    <Link to="/user/orders" className="hover:text-gray-300">
                      Objednávky
                    </Link>
                    <Link to="/cart" className="hover:text-gray-300">
                      Košík
                    </Link>
                    <Link to="/Cart2" className="hover:text-gray-300">
                      Košík2
                    </Link>
                  </>
                )}
                {user.role === "admin" && (
                  <>
                    <Link to="/admin" className="hover:text-gray-300">
                      Admin
                    </Link>
                    <Link to="/admin/orders" className="hover:text-gray-300">
                      Objednávky
                    </Link>
                    <Link
                      to="/admin/products/create"
                      className="hover:text-gray-300"
                    >
                      Výrobky +
                    </Link>
                    <Link to="/cart" className="hover:text-gray-300">
                      Košík
                    </Link>
                  </>
                )}
                {user.role === "driver" && (
                  <Link to="/driver" className="hover:text-gray-300">
                    Driver
                  </Link>
                )}
                <Button variant="secondary" onClick={signOut}>
                  <Link to="/" className="hover:text-gray-300">
                    Sign out
                  </Link>
                </Button>
              </>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="secondary">Login</Button>
                </Link>
                {/* <Link to="/register">
                  <Button variant="secondary">Register</Button>
                </Link> */}
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
