import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  Package,
  Tag,
  Scale,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  TrendingDown,
  Minus,
  Sparkles,
} from "lucide-react";

import { removeDiacritics } from "@/utils/removeDiacritics";
import { useIngredients } from "@/hooks/useIngredients";
import { useUsers } from "@/hooks/useProfiles";
import { supabase } from "@/lib/supabase";
import { MonthlyIngredientConsumption } from "./MonthlyIngredientConsumption";
import { StoreProductionIngredientConsumption } from "./StoreProductionIngredientConsumption";
import { DailyIngredientConsumption } from "./DailyIngredientConsumption";
import { ProductionCalendar } from "./ProductionCalendar";
import { IngredientPriceFluctuation } from "./IngredientPriceFluctuation";
import { useQuery } from "@tanstack/react-query";

export function IngredientQuantityOverview() {
  const [globalFilter, setGlobalFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("overview");
  const [showZeroQuantities, setShowZeroQuantities] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(
    "e597fcc9-7ce8-407d-ad1a-fdace061e42f"
  );
  const [inventoryDate, setInventoryDate] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [useBakersCalculation, setUseBakersCalculation] = useState(true);
  const [isPriceFluctuationOpen, setIsPriceFluctuationOpen] = useState(false);

  // Fetch inventory data from database
  const {
    data: inventoryItems,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["inventoryItems", selectedUserId, selectedMonth.toISOString()],
    queryFn: async () => {
      // First, determine the appropriate inventory date for the selected month
      const today = new Date();
      const isCurrentMonth =
        selectedMonth.getFullYear() === today.getFullYear() &&
        selectedMonth.getMonth() === today.getMonth();

      let targetInventoryDate: string | null = null;

      if (isCurrentMonth) {
        // For current month, use the latest inventory
        const { data: inventory } = await supabase
          .from("inventories")
          .select("date")
          .eq("user_id", selectedUserId)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        targetInventoryDate = inventory?.date || null;
      } else {
        // For past months, use inventory from the last day of the month before the selected month
        const firstDayOfSelectedMonth = new Date(
          selectedMonth.getFullYear(),
          selectedMonth.getMonth(),
          1
        );
        const lastDayOfPreviousMonth = new Date(firstDayOfSelectedMonth);
        lastDayOfPreviousMonth.setDate(lastDayOfPreviousMonth.getDate() - 1);

        const lastDayStr = `${lastDayOfPreviousMonth.getFullYear()}-${String(lastDayOfPreviousMonth.getMonth() + 1).padStart(2, "0")}-${String(lastDayOfPreviousMonth.getDate()).padStart(2, "0")}`;

        const { data: inventory } = await supabase
          .from("inventories")
          .select("date")
          .eq("user_id", selectedUserId)
          .lte("date", lastDayStr)
          .order("date", { ascending: false })
          .limit(1)
          .single();

        targetInventoryDate = inventory?.date || null;
      }

      if (!targetInventoryDate) {
        return [];
      }

      // Now fetch inventory items for the specific inventory date
      const { data, error } = await supabase
        .from("inventory_items")
        .select(
          `
          id,
          quantity,
          ingredient_id,
          inventories!inner (
            user_id,
            date
          ),
          ingredients!inner (
            id,
            name,
            unit,
            price,
            ingredient_categories (
              id,
              name
            ),
            ingredient_supplier_codes (
              id,
              supplier_id,
              supplier_ingredient_name,
              is_active
            )
          )
        `
        )
        .eq("inventories.user_id", selectedUserId)
        .eq("inventories.date", targetInventoryDate)
        .not("ingredient_id", "is", null);

      if (error) {
        console.error("Error fetching inventory items:", error);
        throw error;
      }

      return data || [];
    },
    enabled: !!selectedUserId,
  });

  const { data: ingredients } = useIngredients();
  const { data: allUsers } = useUsers();

  // Filter only store users
  const storeUsers = useMemo(() => {
    if (!allUsers) return [];
    return allUsers.filter((user: any) => user.role === "store");
  }, [allUsers]);

  // Check if selected user is a store user (not APLICA - Pekárna výrobna)
  const isStoreUser = useMemo(() => {
    if (!selectedUserId || !storeUsers) return false;
    const user = storeUsers.find((u: any) => u.id === selectedUserId);
    return user && user.full_name !== "APLICA - Pekárna výrobna";
  }, [selectedUserId, storeUsers]);

  // Fetch suppliers for lookup (from profiles table)
  const { data: suppliers } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, role")
        .eq("role", "supplier");

      if (error) {
        console.error("Error fetching suppliers:", error);
        throw error;
      }

      return data || [];
    },
  });

  // Fetch transfers data for the selected month and user
  const { data: transfersData } = useQuery({
    queryKey: ["transfers", selectedUserId, selectedMonth.toISOString()],
    queryFn: async () => {
      const firstDayOfMonth = new Date(
        selectedMonth.getFullYear(),
        selectedMonth.getMonth(),
        1
      );
      const lastDayOfMonth = new Date(
        selectedMonth.getFullYear(),
        selectedMonth.getMonth() + 1,
        0
      );

      // If selected month is current month, use today as end date
      const today = new Date();
      const isCurrentMonth =
        selectedMonth.getFullYear() === today.getFullYear() &&
        selectedMonth.getMonth() === today.getMonth();

      const endDate = isCurrentMonth ? today : lastDayOfMonth;

      const formatLocalDate = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
      };

      const startDateStr = formatLocalDate(firstDayOfMonth);
      const endDateStr = formatLocalDate(endDate);

      const { data, error } = await supabase
        .from("transfers")
        .select(
          `
          id,
          date,
          sender_id,
          receiver_id,
          transfer_items (
            id,
            quantity,
            ingredient_id
          )
        `
        )
        .or(`sender_id.eq.${selectedUserId},receiver_id.eq.${selectedUserId}`)
        .gte("date", startDateStr)
        .lte("date", endDateStr);

      if (error) {
        console.error("Error fetching transfers:", error);
        throw error;
      }

      if (!data || data.length === 0) {
        return [];
      }

      // Aggregate quantities by ingredient_id - separate sent and received
      const ingredientQuantities = new Map<
        number,
        { sent: number; received: number; net: number }
      >();

      data.forEach((transfer: any) => {
        if (transfer.transfer_items) {
          transfer.transfer_items.forEach((item: any) => {
            const ingredientId = item.ingredient_id;
            const quantity = item.quantity || 0;

            // Get existing quantities or initialize
            const existing = ingredientQuantities.get(ingredientId) || {
              sent: 0,
              received: 0,
              net: 0,
            };

            if (transfer.receiver_id === selectedUserId) {
              // User is receiver - add to received
              existing.received += quantity;
              existing.net += quantity;
            } else {
              // User is sender - add to sent
              existing.sent += quantity;
              existing.net -= quantity;
            }

            ingredientQuantities.set(ingredientId, existing);
          });
        }
      });

      const result = Array.from(ingredientQuantities.entries()).map(
        ([ingredientId, quantities]) => ({
          ingredientId,
          sent: quantities.sent,
          received: quantities.received,
          net: quantities.net,
        })
      );

      return result;
    },
    staleTime: 1000 * 30, // 30 seconds
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    enabled: !!selectedUserId,
  });

  // Fetch received invoices data for the selected month and user
  const { data: receivedInvoicesData } = useQuery({
    queryKey: ["receivedInvoices", selectedUserId, selectedMonth.toISOString()],
    queryFn: async () => {
      const firstDayOfMonth = new Date(
        selectedMonth.getFullYear(),
        selectedMonth.getMonth(),
        1
      );
      const lastDayOfMonth = new Date(
        selectedMonth.getFullYear(),
        selectedMonth.getMonth() + 1,
        0
      );

      // If selected month is current month, use today as end date
      const today = new Date();
      const isCurrentMonth =
        selectedMonth.getFullYear() === today.getFullYear() &&
        selectedMonth.getMonth() === today.getMonth();

      const endDate = isCurrentMonth ? today : lastDayOfMonth;

      const formatLocalDate = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
      };

      const startDateStr = formatLocalDate(firstDayOfMonth);
      const endDateStr = formatLocalDate(endDate);

      const { data, error } = await supabase
        .from("invoices_received")
        .select(
          `
          id,
          invoice_date,
          created_by,
          receiver_id,
          items_received (
            id,
            quantity,
            matched_ingredient_id
          )
        `
        )
        .eq("receiver_id", selectedUserId)
        .gte("invoice_date", startDateStr)
        .lte("invoice_date", endDateStr);

      if (error) {
        console.error("Error fetching received invoices:", error);
        throw error;
      }

      if (!data || data.length === 0) {
        return [];
      }

      // Aggregate quantities by ingredient_id
      const ingredientQuantities = new Map<number, number>();

      data.forEach((invoice: any) => {
        if (invoice.items_received) {
          invoice.items_received.forEach((item: any) => {
            const ingredientId = item.matched_ingredient_id;
            const quantity = item.quantity || 0;

            if (ingredientQuantities.has(ingredientId)) {
              ingredientQuantities.set(
                ingredientId,
                ingredientQuantities.get(ingredientId)! + quantity
              );
            } else {
              ingredientQuantities.set(ingredientId, quantity);
            }
          });
        }
      });

      const result = Array.from(ingredientQuantities.entries()).map(
        ([ingredientId, totalQuantity]) => ({
          ingredientId,
          totalQuantity,
        })
      );

      return result;
    },
    staleTime: 1000 * 30, // 30 seconds
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    enabled: !!selectedUserId,
  });
  // Fetch store production consumption (for store users)
  const { data: storeProductionConsumption } = useQuery({
    queryKey: [
      "storeProductionConsumption",
      selectedUserId,
      selectedMonth.toISOString(),
      useBakersCalculation,
    ],
    queryFn: async () => {
      const firstDayOfMonth = new Date(
        selectedMonth.getFullYear(),
        selectedMonth.getMonth(),
        1
      );
      const lastDayOfMonth = new Date(
        selectedMonth.getFullYear(),
        selectedMonth.getMonth() + 1,
        0
      );

      // If selected month is current month, use today as end date
      const today = new Date();
      const isCurrentMonth =
        selectedMonth.getFullYear() === today.getFullYear() &&
        selectedMonth.getMonth() === today.getMonth();

      const endDate = isCurrentMonth ? today : lastDayOfMonth;

      const formatLocalDate = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
      };

      const startDateStr = formatLocalDate(firstDayOfMonth);
      const endDateStr = formatLocalDate(endDate);

      // Check if this is the main production facility (uses bakers table)
      const isMainProductionFacility =
        selectedUserId === "e597fcc9-7ce8-407d-ad1a-fdace061e42f";

      if (isMainProductionFacility) {
        // Always fetch from bakers table for main production facility
        // Toggle controls calculation method, not data source
        // Fetch all bakers data using pagination to avoid Supabase limits
        let allBakers: any[] = [];
        let from = 0;
        const batchSize = 1000;
        let hasMore = true;

        while (hasMore) {
          const { data: batch, error: bakersError } = await supabase
            .from("bakers")
            .select(
              `
              id,
              date,
              recipe_id,
              baker_items(
                id,
                product_id,
                recipe_quantity,
                products(id, name)
              )
            `
            )
            .gte("date", startDateStr)
            .lte("date", endDateStr)
            .order("date", { ascending: true })
            .range(from, from + batchSize - 1);

          if (bakersError) {
            console.error("Error fetching bakers:", bakersError);
            throw bakersError;
          }

          if (batch && batch.length > 0) {
            allBakers = allBakers.concat(batch);
            from += batchSize;
            hasMore = batch.length === batchSize;
          } else {
            hasMore = false;
          }
        }

        const bakers = allBakers;

        if (!bakers || bakers.length === 0) {
          console.log("No bakers found for main production facility");
          return [];
        }

        console.log("=== BAKERS PRODUCTION PLANS COUNT ===");
        console.log("User ID:", selectedUserId);
        console.log("Date range:", startDateStr, "to", endDateStr);
        console.log("Total production plans found:", bakers.length);
        console.log("=== END BAKERS PRODUCTION PLANS COUNT ===");

        // Get product IDs from baker_items
        const productIds = new Set<number>();
        bakers.forEach((baker: any) => {
          baker.baker_items?.forEach((item: any) => {
            if (item.product_id) {
              productIds.add(item.product_id);
            }
          });
        });

        if (productIds.size === 0) {
          return [];
        }

        // Fetch product parts
        const { data: productParts, error: partsError } = await supabase
          .from("product_parts")
          .select(
            `
            product_id,
            recipe_id,
            pastry_id,
            ingredient_id,
            quantity,
            productOnly,
            bakerOnly,
            recipes (id, name, quantity),
            products:pastry_id (id, name, priceBuyer),
            ingredients (
              id,
              name,
              unit,
              price,
              kiloPerUnit,
              ingredient_categories (name)
            )
          `
          )
          .in("product_id", Array.from(productIds));

        if (partsError) throw partsError;
        if (!productParts) return [];

        // Get recipe IDs
        const recipeIds = new Set<number>();
        productParts.forEach((part: any) => {
          if (part.recipe_id) {
            recipeIds.add(part.recipe_id);
          }
        });

        // Also add recipe_ids from bakers
        bakers.forEach((baker: any) => {
          if (baker.recipe_id) {
            recipeIds.add(baker.recipe_id);
          }
        });

        // Fetch recipe ingredients
        const { data: recipeIngredients, error: recipeError } = await supabase
          .from("recipe_ingredients")
          .select(
            `
            recipe_id,
            ingredient_id,
            quantity,
            ingredients (
              id,
              name,
              unit,
              price,
              kiloPerUnit,
              ingredient_categories (name)
            ),
            recipes (
              id,
              quantity,
              name
            )
          `
          )
          .in("recipe_id", Array.from(recipeIds));

        if (recipeError) {
          console.error("Error fetching recipe ingredients:", recipeError);
          throw recipeError;
        }

        console.log("=== RECIPE INGREDIENTS COUNT ===");
        console.log(
          "Recipe ingredients found:",
          recipeIngredients?.length || 0
        );
        console.log("=== END RECIPE INGREDIENTS COUNT ===");

        // Calculate consumption
        const consumptionMap = new Map<number, number>();

        // Process bakers
        bakers.forEach((baker: any) => {
          baker.baker_items?.forEach((item: any) => {
            if (item.product_id && item.recipe_quantity && baker.recipe_id) {
              const recipeQuantity = item.recipe_quantity;

              // Get recipe ingredients for this baker's recipe
              const ingredientsForRecipe = (recipeIngredients || []).filter(
                (ri: any) => ri.recipe_id === baker.recipe_id
              );

              ingredientsForRecipe.forEach((ri: any) => {
                if (ri.ingredients && ri.recipes) {
                  const ingredient = ri.ingredients;
                  const baseQty = ri.quantity || 0;
                  const baseRecipeWeight = ri.recipes.quantity || 1;
                  const proportion = baseQty / baseRecipeWeight;
                  let ingredientQuantity = proportion * recipeQuantity;

                  if (
                    ingredient.unit &&
                    ingredient.unit !== "kg" &&
                    ingredient.kiloPerUnit
                  ) {
                    ingredientQuantity =
                      ingredientQuantity * ingredient.kiloPerUnit;
                  }

                  const ingredientId = ingredient.id;
                  if (consumptionMap.has(ingredientId)) {
                    consumptionMap.set(
                      ingredientId,
                      consumptionMap.get(ingredientId)! + ingredientQuantity
                    );
                  } else {
                    consumptionMap.set(ingredientId, ingredientQuantity);
                  }
                }
              });
            }
          });
        });

        const result = Array.from(consumptionMap.entries()).map(
          ([ingredientId, totalQuantity]) => ({
            ingredientId,
            totalQuantity,
          })
        );

        console.log("=== CONSUMPTION CALCULATION RESULT ===");
        console.log("Total ingredients with consumption:", result.length);
        console.log("=== END CONSUMPTION CALCULATION RESULT ===");

        return result;
      }

      // For other users, fetch from productions table
      const { data: productions, error: productionsError } = await supabase
        .from("productions")
        .select(
          `
          *,
          production_items(
            *,
            products(*)
          )
        `
        )
        .eq("user_id", selectedUserId)
        .gte("date", startDateStr)
        .lte("date", endDateStr);

      if (productionsError) throw productionsError;
      if (!productions || productions.length === 0) return [];

      // Get product IDs
      const productIds = new Set<number>();
      productions.forEach((production: any) => {
        production.production_items?.forEach((item: any) => {
          if (item.products?.id) {
            productIds.add(item.products.id);
          }
        });
      });

      if (productIds.size === 0) return [];

      // Fetch product parts
      const { data: productParts, error: partsError } = await supabase
        .from("product_parts")
        .select(
          `
          product_id,
          recipe_id,
          pastry_id,
          ingredient_id,
          quantity,
          productOnly,
          bakerOnly,
          recipes (id, name, quantity),
          products:pastry_id (id, name, priceBuyer),
          ingredients (
            id,
            name,
            unit,
            price,
            kiloPerUnit,
            ingredient_categories (name)
          )
        `
        )
        .in("product_id", Array.from(productIds));

      if (partsError) throw partsError;
      if (!productParts) return [];

      // Get recipe IDs
      const recipeIds = new Set<number>();
      productParts.forEach((part: any) => {
        if (part.recipe_id) {
          recipeIds.add(part.recipe_id);
        }
      });

      // Fetch recipe ingredients
      const { data: recipeIngredients, error: recipeError } = await supabase
        .from("recipe_ingredients")
        .select(
          `
          recipe_id,
          ingredient_id,
          quantity,
          ingredients (
            id,
            name,
            unit,
            price,
            kiloPerUnit,
            ingredient_categories (name)
          ),
          recipes (
            id,
            quantity,
            name
          )
        `
        )
        .in("recipe_id", Array.from(recipeIds));

      if (recipeError) throw recipeError;

      // Calculate consumption
      const consumptionMap = new Map<number, number>();

      // Create mappings
      const productToRecipeMap: Record<
        number,
        Array<{ recipe_id: number; quantity: number }>
      > = {};
      const productToIngredientsMap: Record<
        number,
        Array<{ ingredient_id: number; quantity: number; ingredient: any }>
      > = {};

      productParts.forEach((part: any) => {
        if (part.recipe_id && !part.productOnly && !part.bakerOnly) {
          if (!productToRecipeMap[part.product_id]) {
            productToRecipeMap[part.product_id] = [];
          }
          productToRecipeMap[part.product_id].push({
            recipe_id: part.recipe_id,
            quantity: part.quantity,
          });
        }

        if (part.ingredient_id && part.ingredients && !part.bakerOnly) {
          if (!productToIngredientsMap[part.product_id]) {
            productToIngredientsMap[part.product_id] = [];
          }
          productToIngredientsMap[part.product_id].push({
            ingredient_id: part.ingredient_id,
            quantity: part.quantity,
            ingredient: part.ingredients,
          });
        }
      });

      // Process productions
      productions.forEach((production: any) => {
        production.production_items?.forEach((item: any) => {
          if (item.products?.id && item.quantity) {
            const productId = item.products.id;
            const productQuantity = item.quantity;

            // Process recipe-based ingredients
            const recipes = productToRecipeMap[productId] || [];
            recipes.forEach((recipeMapping: any) => {
              const totalDoughWeight = recipeMapping.quantity * productQuantity;

              const ingredientsForRecipe = (recipeIngredients || []).filter(
                (ri: any) => ri.recipe_id === recipeMapping.recipe_id
              );

              ingredientsForRecipe.forEach((ri: any) => {
                if (ri.ingredients && ri.recipes) {
                  const ingredient = ri.ingredients;
                  const baseQty = ri.quantity || 0;
                  const baseRecipeWeight = ri.recipes.quantity || 1;
                  const proportion = baseQty / baseRecipeWeight;
                  let ingredientQuantity = proportion * totalDoughWeight;

                  if (
                    ingredient.unit &&
                    ingredient.unit !== "kg" &&
                    ingredient.kiloPerUnit
                  ) {
                    ingredientQuantity =
                      ingredientQuantity * ingredient.kiloPerUnit;
                  }

                  const ingredientId = ingredient.id;
                  if (consumptionMap.has(ingredientId)) {
                    consumptionMap.set(
                      ingredientId,
                      consumptionMap.get(ingredientId)! + ingredientQuantity
                    );
                  } else {
                    consumptionMap.set(ingredientId, ingredientQuantity);
                  }
                }
              });
            });

            // Process direct ingredients
            const directIngredients = productToIngredientsMap[productId] || [];
            directIngredients.forEach((directIngredient: any) => {
              const ingredient = directIngredient.ingredient;
              let ingredientQuantity =
                directIngredient.quantity * productQuantity;

              if (
                ingredient.unit &&
                ingredient.unit !== "kg" &&
                ingredient.kiloPerUnit
              ) {
                ingredientQuantity =
                  ingredientQuantity * ingredient.kiloPerUnit;
              }

              const ingredientId = ingredient.id;
              if (consumptionMap.has(ingredientId)) {
                consumptionMap.set(
                  ingredientId,
                  consumptionMap.get(ingredientId)! + ingredientQuantity
                );
              } else {
                consumptionMap.set(ingredientId, ingredientQuantity);
              }
            });
          }
        });
      });

      return Array.from(consumptionMap.entries()).map(
        ([ingredientId, totalQuantity]) => ({
          ingredientId,
          totalQuantity,
        })
      );
    },
    staleTime: 1000 * 30, // 30 seconds
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    enabled: !!selectedUserId,
  });

  // Fetch monthly consumption data from daily_ingredient_consumption table
  const { data: monthlyConsumption } = useQuery({
    queryKey: ["monthlyConsumptionForOverview", selectedMonth.toISOString()],
    queryFn: async () => {
      const firstDayOfMonth = new Date(
        selectedMonth.getFullYear(),
        selectedMonth.getMonth(),
        1
      );
      const lastDayOfMonth = new Date(
        selectedMonth.getFullYear(),
        selectedMonth.getMonth() + 1,
        0
      );

      // If selected month is current month, use tomorrow as end date
      const today = new Date();
      const isCurrentMonth =
        selectedMonth.getFullYear() === today.getFullYear() &&
        selectedMonth.getMonth() === today.getMonth();

      const endDate = isCurrentMonth
        ? new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
        : lastDayOfMonth;

      const formatLocalDate = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
      };

      const startDateStr = formatLocalDate(firstDayOfMonth);
      const endDateStr = formatLocalDate(endDate);

      const { data: consumptionData, error } = await supabase
        .from("daily_ingredient_consumption")
        .select(
          `
          ingredient_id,
          quantity
        `
        )
        .gte("date", startDateStr)
        .lte("date", endDateStr);

      if (error) {
        console.error("Error fetching monthly consumption:", error);
        throw error;
      }

      if (!consumptionData || consumptionData.length === 0) {
        return [];
      }

      // Aggregate consumption by ingredient
      const consumptionMap = new Map<number, number>();

      consumptionData.forEach((item) => {
        const ingredientId = item.ingredient_id;
        const quantity = item.quantity || 0;

        if (consumptionMap.has(ingredientId)) {
          consumptionMap.set(
            ingredientId,
            consumptionMap.get(ingredientId)! + quantity
          );
        } else {
          consumptionMap.set(ingredientId, quantity);
        }
      });

      return Array.from(consumptionMap.entries()).map(
        ([ingredientId, totalQuantity]) => ({
          ingredientId,
          totalQuantity,
        })
      );
    },
    staleTime: 1000 * 30, // 30 seconds
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    enabled: true,
  });

  // Fetch price comparison data for the selected month
  const { data: priceComparisonData } = useQuery({
    queryKey: ["priceComparison", selectedMonth.toISOString()],
    queryFn: async () => {
      const firstDayOfMonth = new Date(
        selectedMonth.getFullYear(),
        selectedMonth.getMonth(),
        1
      );
      const lastDayOfMonth = new Date(
        selectedMonth.getFullYear(),
        selectedMonth.getMonth() + 1,
        0
      );

      const formatLocalDate = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
      };

      const startDateStr = formatLocalDate(firstDayOfMonth);
      const endDateStr = formatLocalDate(lastDayOfMonth);

      // Fetch received invoice prices for the selected month
      const { data: receivedPrices, error: receivedError } = await supabase
        .from("items_received")
        .select(
          `
          matched_ingredient_id,
          unit_price,
          created_at,
          invoice_received_id,
          invoices_received!inner(
            invoice_date
          )
        `
        )
        .gte("invoices_received.invoice_date", startDateStr)
        .lte("invoices_received.invoice_date", endDateStr)
        .order("created_at", { ascending: false });

      if (receivedError) {
        console.error("Error fetching received prices:", receivedError);
        throw receivedError;
      }

      // Fetch ingredient supplier codes and base ingredient prices
      const { data: ingredients, error: ingredientsError } =
        await supabase.from("ingredients").select(`
          id,
          price,
          ingredient_supplier_codes (
            supplier_id,
            price
          )
        `);

      if (ingredientsError) {
        console.error("Error fetching ingredients:", ingredientsError);
        throw ingredientsError;
      }

      // Process the data to create price comparisons
      const priceMap = new Map();

      // First, get the most recent received price for each ingredient
      const receivedPriceMap = new Map();
      (receivedPrices || []).forEach((item: any) => {
        const ingredientId = item.matched_ingredient_id;
        if (!ingredientId) return; // Skip items without matched ingredient

        if (
          !receivedPriceMap.has(ingredientId) ||
          new Date(item.created_at) >
            new Date(receivedPriceMap.get(ingredientId).created_at)
        ) {
          receivedPriceMap.set(ingredientId, {
            unit_price: item.unit_price,
            created_at: item.created_at,
            invoice_date: item.invoices_received?.invoice_date,
          });
        }
      });

      // Create comparison data for each ingredient
      (ingredients || []).forEach((ingredient: any) => {
        const receivedPrice = receivedPriceMap.get(ingredient.id);
        const basePrice = ingredient.price;

        // Get supplier price (first available supplier code)
        const supplierPrice = ingredient.ingredient_supplier_codes?.[0]?.price;

        // Determine comparison price (supplier price > base price > received price)
        let comparisonPrice = basePrice;
        if (supplierPrice && supplierPrice > 0) {
          comparisonPrice = supplierPrice;
        }

        if (receivedPrice) {
          priceMap.set(ingredient.id, {
            received_price: receivedPrice.unit_price,
            comparison_price: comparisonPrice,
            base_price: basePrice,
            supplier_price: supplierPrice,
            has_received_price: true,
            received_date: receivedPrice.invoice_date,
          });
        } else {
          priceMap.set(ingredient.id, {
            received_price: null,
            comparison_price: comparisonPrice,
            base_price: basePrice,
            supplier_price: supplierPrice,
            has_received_price: false,
            received_date: null,
          });
        }
      });

      return Object.fromEntries(priceMap);
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });

  // Extract inventory date from the first inventory item (if any)
  useEffect(() => {
    if (inventoryItems && inventoryItems.length > 0) {
      const firstItem = inventoryItems[0] as any;
      if (firstItem.inventories?.date) {
        setInventoryDate(firstItem.inventories.date);
      }
    } else {
      setInventoryDate(null);
    }
  }, [inventoryItems]);

  // Get categories from ingredients data
  const categories = useMemo(() => {
    if (!ingredients?.ingredients) return [];

    const categoryMap = new Map();
    ingredients.ingredients.forEach((ingredient: any) => {
      if (ingredient.ingredient_categories) {
        categoryMap.set(
          ingredient.ingredient_categories.id,
          ingredient.ingredient_categories
        );
      }
    });

    return Array.from(categoryMap.values());
  }, [ingredients]);

  // Transform inventory data for display and group by category
  const groupedQuantities = useMemo(() => {
    // Create a map of consumption data for quick lookup
    // Use store production consumption if data is available (for both stores and main production facility)
    const consumptionMap = new Map<number, number>();
    const consumptionSource =
      storeProductionConsumption && storeProductionConsumption.length > 0
        ? storeProductionConsumption
        : monthlyConsumption;

    if (consumptionSource) {
      consumptionSource.forEach((consumption) => {
        consumptionMap.set(consumption.ingredientId, consumption.totalQuantity);
      });
    }

    // Create a map of received invoices data for quick lookup
    const receivedInvoicesMap = new Map<number, number>();
    if (receivedInvoicesData) {
      receivedInvoicesData.forEach((invoice) => {
        receivedInvoicesMap.set(invoice.ingredientId, invoice.totalQuantity);
      });
    }

    // Create a map of transfers data for quick lookup
    const transfersMap = new Map<
      number,
      { sent: number; received: number; net: number }
    >();
    if (transfersData) {
      transfersData.forEach((transfer) => {
        transfersMap.set(transfer.ingredientId, {
          sent: transfer.sent,
          received: transfer.received,
          net: transfer.net,
        });
      });
    }

    // Create a map of suppliers for quick lookup
    const supplierMap = new Map<string, string>();
    if (suppliers) {
      suppliers.forEach((supplier: any) => {
        supplierMap.set(supplier.id, supplier.full_name);
      });
    }

    // Create a map of inventory items for quick lookup
    const inventoryMap = new Map<number, any>();
    if (inventoryItems) {
      inventoryItems.forEach((item) => {
        const ingredientId = item.ingredient_id;
        const existing = inventoryMap.get(ingredientId);

        if (existing) {
          // Add to existing quantity
          existing.quantity += item.quantity || 0;
        } else {
          inventoryMap.set(ingredientId, {
            id: item.id,
            quantity: item.quantity || 0,
            ingredient: item.ingredients,
          });
        }
      });
    }

    // Get all ingredients from the ingredients data
    const allIngredients = ingredients?.ingredients || [];

    // Aggregate quantities by ingredient
    const aggregatedData = new Map();

    allIngredients.forEach((ingredient: any) => {
      const ingredientId = ingredient.id;
      const inventoryData = inventoryMap.get(ingredientId);
      const currentQuantity = inventoryData?.quantity || 0;

      // Skip if we're hiding zero quantities and this ingredient has zero quantity AND zero consumption AND zero invoices
      const monthlyConsumption = consumptionMap.get(ingredientId) || 0;
      const receivedInvoicesQuantity =
        receivedInvoicesMap.get(ingredientId) || 0;

      if (
        !showZeroQuantities &&
        currentQuantity === 0 &&
        monthlyConsumption === 0 &&
        receivedInvoicesQuantity === 0
      ) {
        return;
      }

      const price = ingredient?.price || 0;
      const transfersData = transfersMap.get(ingredientId) || {
        sent: 0,
        received: 0,
        net: 0,
      };

      // Find supplier from ingredient_supplier_codes (prefer active, fallback to first)
      const activeSupplierCode = ingredient?.ingredient_supplier_codes?.find(
        (code: any) => code.is_active
      );
      const supplierToUse =
        activeSupplierCode || ingredient?.ingredient_supplier_codes?.[0];

      const supplierName = supplierToUse?.supplier_id
        ? supplierMap.get(supplierToUse.supplier_id) || "—"
        : "—";

      // Get active supplier's ingredient name
      const supplierIngredientName =
        (activeSupplierCode as any)?.supplier_ingredient_name || null;

      // Get all other suppliers' ingredient names (non-active)
      const otherSupplierNames =
        ingredient?.ingredient_supplier_codes
          ?.filter(
            (code: any) => !code.is_active && code.supplier_ingredient_name
          )
          .map((code: any) => code.supplier_ingredient_name)
          .filter(
            (name: string, index: number, arr: string[]) =>
              // Remove duplicates
              arr.indexOf(name) === index
          )
          // Filter out names that match the active supplier name
          // Only filter out internal name if it matches the active supplier name (to avoid showing same name twice)
          .filter((name: string) => {
            // Always filter out if it matches active supplier
            if (name === supplierIngredientName) return false;

            // Only filter out internal name if active supplier name is same as internal name
            if (
              name === ingredient?.name &&
              supplierIngredientName === ingredient?.name
            ) {
              return false;
            }

            return true;
          }) || [];

      aggregatedData.set(ingredientId, {
        id: inventoryData?.id || `ingredient-${ingredientId}`, // Use inventory ID if available, otherwise create a unique ID
        ingredientId,
        name: ingredient?.name || "Neznámá surovina",
        supplierIngredientName: supplierIngredientName || null,
        alternativeSupplierNames: otherSupplierNames,
        currentQuantity,
        monthlyConsumption,
        receivedInvoicesQuantity,
        transfersSent: transfersData.sent,
        transfersReceived: transfersData.received,
        transfersNet: transfersData.net,
        unit: ingredient?.unit || "kg",
        package: ingredient?.package || null,
        category: ingredient?.ingredient_categories?.name || "Bez kategorie",
        supplier: supplierName,
        lastUpdated: new Date().toISOString(),
        price,
        totalValue: currentQuantity * price,
        created_at: ingredient?.created_at || null,
      });
    });

    const transformedData = Array.from(aggregatedData.values()).map((item) => {
      const status =
        item.currentQuantity < 10
          ? "low"
          : item.currentQuantity > 80
            ? "high"
            : "normal";
      return {
        ...item,
        status,
      };
    });

    // Group by category
    const grouped = transformedData.reduce(
      (acc, item) => {
        const categoryName = item.category;
        if (!acc[categoryName]) {
          acc[categoryName] = [];
        }
        acc[categoryName].push(item);
        return acc;
      },
      {} as Record<string, typeof transformedData>
    );

    // Sort categories and ingredients within each category
    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([categoryName, ingredients]) => ({
        categoryName,
        ingredients: (ingredients as any[]).sort((a: any, b: any) => {
          // Use supplier ingredient name for sorting if available
          const aName = a.supplierIngredientName || a.name;
          const bName = b.supplierIngredientName || b.name;
          return aName.localeCompare(bName);
        }),
      }));
  }, [
    ingredients,
    inventoryItems,
    monthlyConsumption,
    storeProductionConsumption,
    isStoreUser,
    receivedInvoicesData,
    transfersData,
    showZeroQuantities,
    suppliers,
  ]);

  // Filter grouped ingredients based on search, category, and status
  const filteredGroupedQuantities = useMemo(() => {
    return groupedQuantities
      .filter(
        ({ categoryName }) =>
          // If there's a search term, show all categories to allow global search
          // Otherwise, respect the category filter
          globalFilter.trim() !== "" ||
          categoryFilter === "all" ||
          categoryName === categoryFilter
      )
      .map(({ categoryName, ingredients }) => ({
        categoryName,
        ingredients: ingredients.filter((item: any) => {
          const searchLower = removeDiacritics(globalFilter.toLowerCase());
          const nameMatch = removeDiacritics(item.name.toLowerCase()).includes(
            searchLower
          );
          const categoryMatch = removeDiacritics(
            item.category.toLowerCase()
          ).includes(searchLower);
          const supplierMatch = removeDiacritics(
            item.supplier.toLowerCase()
          ).includes(searchLower);

          const searchMatch =
            globalFilter.trim() === "" ||
            nameMatch ||
            categoryMatch ||
            supplierMatch;
          const categoryFilterMatch =
            categoryFilter === "all" || item.category === categoryFilter;
          const statusFilterMatch =
            statusFilter === "all" || item.status === statusFilter;
          const supplierFilterMatch =
            supplierFilter === "all" || item.supplier === supplierFilter;

          return (
            searchMatch &&
            categoryFilterMatch &&
            statusFilterMatch &&
            supplierFilterMatch
          );
        }),
      }))
      .filter(({ ingredients }) => ingredients.length > 0);
  }, [
    groupedQuantities,
    globalFilter,
    categoryFilter,
    statusFilter,
    supplierFilter,
  ]);

  // Flatten for summary stats and other uses
  const filteredQuantities = useMemo(() => {
    return filteredGroupedQuantities.flatMap(({ ingredients }) => ingredients);
  }, [filteredGroupedQuantities]);

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    const totalItems = filteredQuantities.length;
    const lowStock = filteredQuantities.filter(
      (item) => item.status === "low"
    ).length;
    const totalValue = filteredQuantities.reduce(
      (sum, item) => sum + item.totalValue,
      0
    );
    const averageQuantity =
      filteredQuantities.reduce((sum, item) => sum + item.currentQuantity, 0) /
        totalItems || 0;

    return {
      totalItems,
      lowStock,
      totalValue,
      averageQuantity,
    };
  }, [filteredQuantities]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "low":
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case "high":
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      default:
        return <CheckCircle className="h-4 w-4 text-blue-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "low":
        return <Badge variant="destructive">Nízké zásoby</Badge>;
      case "high":
        return (
          <Badge variant="default" className="bg-green-100 text-green-800">
            Vysoké zásoby
          </Badge>
        );
      default:
        return <Badge variant="secondary">Normální</Badge>;
    }
  };

  // Helper function to check if ingredient was created in the selected month
  const isCreatedInSelectedMonth = (item: any) => {
    if (!item.created_at) return false;
    const createdAt = new Date(item.created_at);
    return (
      createdAt.getFullYear() === selectedMonth.getFullYear() &&
      createdAt.getMonth() === selectedMonth.getMonth()
    );
  };

  // Helper function to format package quantity with fractions
  const formatPackageQuantity = (quantity: number, packageSize: number) => {
    const packages = quantity / packageSize;
    const wholePackages = Math.floor(packages);
    const remainder = packages - wholePackages;

    // If very close to whole number, just show whole number
    if (remainder < 0.05) {
      return `${wholePackages}`;
    }

    // Determine fraction
    let fraction = "";
    if (remainder >= 0.875) {
      // Round up to next whole
      return `${wholePackages + 1}`;
    } else if (remainder >= 0.625) {
      fraction = "¾";
    } else if (remainder >= 0.375) {
      fraction = "½";
    } else if (remainder >= 0.125) {
      fraction = "¼";
    } else {
      return `${wholePackages}`;
    }

    return wholePackages > 0 ? `${wholePackages}${fraction}` : fraction;
  };

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="h-4 w-24 mb-2" />
                  <Skeleton className="h-8 w-16" />
                </CardContent>
              </Card>
            ))}
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <div className="text-center py-8 text-red-600">
          Chyba při načítání zásob: {error.message}
        </div>
      </Card>
    );
  }

  if (!ingredients?.ingredients || ingredients.ingredients.length === 0) {
    return (
      <Card className="p-6">
        <div className="text-center py-12">
          <div className="mx-auto w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mb-4">
            <Package className="h-8 w-8 text-orange-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Žádné suroviny nebyly nalezeny
          </h3>
          <p className="text-gray-600 mb-4">
            Pro zobrazení surovin je potřeba mít alespoň jednu surovinu v
            databázi.
          </p>
          <div className="flex gap-3 justify-center">
            <Button onClick={() => window.location.reload()} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Obnovit
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card className="p-6">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-2xl font-bold">Přehled zásob surovin</h2>
              <p className="text-muted-foreground">
                Celkový počet položek: {summaryStats.totalItems} | Nízké zásoby:{" "}
                {summaryStats.lowStock} | Celková hodnota:{" "}
                {summaryStats.totalValue.toFixed(2)} Kč
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Uživatel:{" "}
                {storeUsers?.find((user) => user.id === selectedUserId)
                  ?.full_name || selectedUserId}
                {inventoryDate && (
                  <span className="ml-2">
                    | Datum inventury:{" "}
                    {new Date(inventoryDate).toLocaleDateString("cs-CZ")}
                  </span>
                )}
              </p>
            </div>
            <div className="flex gap-2">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">Měsíc:</label>
                <Select
                  value={`${selectedMonth.getFullYear()}-${selectedMonth.getMonth()}`}
                  onValueChange={(value) => {
                    const [year, month] = value.split("-");
                    setSelectedMonth(
                      new Date(parseInt(year), parseInt(month), 1)
                    );
                  }}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue>
                      {(() => {
                        const months = [
                          "Leden",
                          "Únor",
                          "Březen",
                          "Duben",
                          "Květen",
                          "Červen",
                          "Červenec",
                          "Srpen",
                          "Září",
                          "Říjen",
                          "Listopad",
                          "Prosinec",
                        ];
                        return `${months[selectedMonth.getMonth()]} ${selectedMonth.getFullYear()}`;
                      })()}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {(() => {
                      const months = [
                        "Leden",
                        "Únor",
                        "Březen",
                        "Duben",
                        "Květen",
                        "Červen",
                        "Červenec",
                        "Srpen",
                        "Září",
                        "Říjen",
                        "Listopad",
                        "Prosinec",
                      ];
                      const currentYear = new Date().getFullYear();
                      const options = [];

                      // Add current year months
                      for (let month = 0; month < 12; month++) {
                        options.push(
                          <SelectItem
                            key={`${currentYear}-${month}`}
                            value={`${currentYear}-${month}`}
                          >
                            {months[month]} {currentYear}
                          </SelectItem>
                        );
                      }

                      // Add previous year months
                      for (let month = 0; month < 12; month++) {
                        options.push(
                          <SelectItem
                            key={`${currentYear - 1}-${month}`}
                            value={`${currentYear - 1}-${month}`}
                          >
                            {months[month]} {currentYear - 1}
                          </SelectItem>
                        );
                      }

                      return options;
                    })()}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={() => setShowZeroQuantities(!showZeroQuantities)}
                variant={showZeroQuantities ? "default" : "outline"}
                size="sm"
              >
                {showZeroQuantities ? (
                  <>
                    <Package className="h-4 w-4 mr-2" />
                    Skrýt nulové
                  </>
                ) : (
                  <>
                    <Package className="h-4 w-4 mr-2" />
                    Zobrazit nulové
                  </>
                )}
              </Button>
              <Button
                onClick={() => setIsPriceFluctuationOpen(true)}
                variant="outline"
                size="sm"
              >
                <TrendingUp className="h-4 w-4 mr-2" />
                Vývoj cen
              </Button>
              {selectedUserId === "e597fcc9-7ce8-407d-ad1a-fdace061e42f" && (
                <Button
                  onClick={() => setUseBakersCalculation(!useBakersCalculation)}
                  variant={useBakersCalculation ? "default" : "outline"}
                  size="sm"
                >
                  {useBakersCalculation
                    ? "Bakers Method"
                    : "Alternative Method"}
                </Button>
              )}
              <Select
                value={selectedUserId}
                onValueChange={(value) => {
                  setSelectedUserId(value);
                  setInventoryDate(null);
                }}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Vyberte prodejnu" />
                </SelectTrigger>
                <SelectContent>
                  {(storeUsers || []).map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Celkem položek
                </CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {summaryStats.totalItems}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Nízké zásoby
                </CardTitle>
                <AlertTriangle className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {summaryStats.lowStock}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Celková hodnota
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {summaryStats.totalValue.toFixed(2)} Kč
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Průměrné množství
                </CardTitle>
                <Scale className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {summaryStats.averageQuantity.toFixed(1)}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Hledat podle názvu, kategorie nebo dodavatele..."
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Filtr kategorie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Všechny kategorie</SelectItem>
                {categories.map((category: any) => (
                  <SelectItem key={category.id} value={category.name}>
                    {category.name}
                  </SelectItem>
                ))}
                <SelectItem value="Bez kategorie">Bez kategorie</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Filtr stavu" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Všechny stavy</SelectItem>
                <SelectItem value="low">Nízké zásoby</SelectItem>
                <SelectItem value="normal">Normální</SelectItem>
                <SelectItem value="high">Vysoké zásoby</SelectItem>
              </SelectContent>
            </Select>
            <Select value={supplierFilter} onValueChange={setSupplierFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Filtr dodavatele" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Všichni dodavatelé</SelectItem>
                {suppliers?.map((supplier: any) => (
                  <SelectItem key={supplier.id} value={supplier.full_name}>
                    {supplier.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="overview">Přehled zásob</TabsTrigger>
              <TabsTrigger value="low-stock">Nízké zásoby</TabsTrigger>
              <TabsTrigger value="daily">Denní spotřeba</TabsTrigger>
              <TabsTrigger value="consumption">Měsíční spotřeba</TabsTrigger>
              <TabsTrigger value="store-consumption">
                Spotřeba prodejen
              </TabsTrigger>
              <TabsTrigger value="calendar">Kalendář produkce</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6 mt-6">
              {/* Production Calendar */}
              <ProductionCalendar
                selectedMonth={selectedMonth}
                selectedUserId={selectedUserId}
              />

              {filteredGroupedQuantities.map(
                ({ categoryName, ingredients }) => (
                  <div key={categoryName} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Tag className="h-4 w-4 text-orange-600" />
                      <h3 className="text-lg font-semibold text-orange-800">
                        {categoryName}
                      </h3>
                      <Badge variant="outline" className="text-xs">
                        {ingredients.length} surovin
                      </Badge>
                    </div>

                    <div className="border rounded-md">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[200px]">Název</TableHead>
                            <TableHead className="text-right w-[120px]">
                              <div className="flex flex-col items-end">
                                <span>Množství</span>
                                {inventoryDate && (
                                  <span className="text-xs text-muted-foreground font-normal">
                                    Inventura:{" "}
                                    {new Date(inventoryDate).toLocaleDateString(
                                      "cs-CZ"
                                    )}
                                  </span>
                                )}
                              </div>
                            </TableHead>
                            <TableHead className="w-[100px]">
                              Jednotka
                            </TableHead>
                            <TableHead className="text-right w-[140px]">
                              <div className="flex flex-col items-end">
                                <span>Spotřeba (měsíc)</span>
                                <span className="text-xs text-muted-foreground font-normal">
                                  {selectedMonth.getFullYear()}-
                                  {String(
                                    selectedMonth.getMonth() + 1
                                  ).padStart(2, "0")}
                                  -01 až{" "}
                                  {(() => {
                                    const today = new Date();
                                    const isCurrentMonth =
                                      selectedMonth.getFullYear() ===
                                        today.getFullYear() &&
                                      selectedMonth.getMonth() ===
                                        today.getMonth();
                                    if (isCurrentMonth) {
                                      return String(
                                        today.getDate() + 1
                                      ).padStart(2, "0");
                                    } else {
                                      const lastDay = new Date(
                                        selectedMonth.getFullYear(),
                                        selectedMonth.getMonth() + 1,
                                        0
                                      );
                                      return String(lastDay.getDate()).padStart(
                                        2,
                                        "0"
                                      );
                                    }
                                  })()}
                                </span>
                              </div>
                            </TableHead>
                            <TableHead className="text-right w-[140px]">
                              <div className="flex flex-col items-end">
                                <span>Přijaté faktury</span>
                                <span className="text-xs text-muted-foreground font-normal">
                                  {selectedMonth.getFullYear()}-
                                  {String(
                                    selectedMonth.getMonth() + 1
                                  ).padStart(2, "0")}
                                </span>
                              </div>
                            </TableHead>
                            <TableHead className="text-right w-[200px]">
                              <div className="flex flex-col items-end">
                                <span>Transfery</span>
                                <span className="text-xs text-muted-foreground font-normal">
                                  {selectedMonth.getFullYear()}-
                                  {String(
                                    selectedMonth.getMonth() + 1
                                  ).padStart(2, "0")}
                                </span>
                                <span className="text-xs text-muted-foreground font-normal">
                                  Odesl./Přijat.
                                </span>
                              </div>
                            </TableHead>
                            <TableHead className="text-right w-[100px]">
                              Cena
                            </TableHead>
                            <TableHead className="text-right w-[120px]">
                              Změna ceny
                            </TableHead>
                            <TableHead className="text-right w-[140px]">
                              <div className="flex flex-col items-end">
                                <span>Aktuální stav</span>
                                <span className="text-xs text-muted-foreground font-normal">
                                  Inventura + Faktury + Transfery - Spotřeba
                                </span>
                              </div>
                            </TableHead>
                            <TableHead className="w-[120px]">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {ingredients.map((item: any) => (
                            <TableRow key={item.id}>
                              <TableCell className="font-medium">
                                <div className="flex flex-col">
                                  <div className="flex items-center gap-2">
                                    {isCreatedInSelectedMonth(item) && (
                                      <Sparkles className="h-4 w-4 text-yellow-500" />
                                    )}
                                    <div className="flex flex-col">
                                      <span>
                                        {item.supplierIngredientName ||
                                          item.name}
                                      </span>
                                      {item.alternativeSupplierNames &&
                                        item.alternativeSupplierNames.length >
                                          0 && (
                                          <span className="text-xs text-blue-500 italic">
                                            {item.alternativeSupplierNames.join(
                                              ", "
                                            )}
                                          </span>
                                        )}
                                    </div>
                                  </div>
                                  <span className="text-xs text-muted-foreground">
                                    {item.supplier}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex flex-col items-end gap-1">
                                  <span className="text-sm font-mono">
                                    {item.currentQuantity.toFixed(1)}
                                  </span>
                                  {item.package && (
                                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                      <Package className="h-3 w-3" />
                                      <span>
                                        {formatPackageQuantity(
                                          item.currentQuantity,
                                          item.package
                                        )}{" "}
                                        bal
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <Scale className="h-3 w-3 text-muted-foreground" />
                                  <span className="text-sm">{item.unit}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <span className="text-sm font-mono text-blue-600">
                                  {item.monthlyConsumption.toFixed(1)}
                                </span>
                              </TableCell>
                              <TableCell className="text-right">
                                <span className="text-sm font-mono text-green-600">
                                  {item.receivedInvoicesQuantity.toFixed(1)}
                                </span>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex flex-col items-end">
                                  <span className="text-sm font-mono text-muted-foreground">
                                    {(item.transfersSent || 0) > 0
                                      ? `-${(item.transfersSent || 0).toFixed(1)}`
                                      : ""}
                                    {(item.transfersSent || 0) > 0 &&
                                    (item.transfersReceived || 0) > 0
                                      ? " / "
                                      : ""}
                                    {(item.transfersReceived || 0) > 0
                                      ? `+${(item.transfersReceived || 0).toFixed(1)}`
                                      : ""}
                                    {(item.transfersSent || 0) === 0 &&
                                    (item.transfersReceived || 0) === 0
                                      ? "0"
                                      : ""}
                                  </span>
                                  <span
                                    className={`text-sm font-mono font-semibold ${
                                      (item.transfersNet || 0) > 0
                                        ? "text-green-600"
                                        : (item.transfersNet || 0) < 0
                                          ? "text-red-600"
                                          : "text-gray-600"
                                    }`}
                                  >
                                    {(item.transfersNet || 0) > 0 ? "+" : ""}
                                    {(item.transfersNet || 0).toFixed(1)}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                {(() => {
                                  const priceData =
                                    priceComparisonData?.[item.ingredientId];
                                  // Show comparison price (supplier price or base price) instead of outdated base price
                                  const displayPrice =
                                    priceData?.comparison_price ?? item.price;
                                  return (
                                    <div className="flex flex-col items-end">
                                      <span className="text-sm font-semibold">
                                        {displayPrice.toFixed(2)} Kč
                                      </span>
                                      {priceData?.supplier_price &&
                                        priceData.supplier_price !==
                                          priceData.base_price && (
                                          <span className="text-xs text-muted-foreground">
                                            (dodavatel)
                                          </span>
                                        )}
                                    </div>
                                  );
                                })()}
                              </TableCell>
                              <TableCell className="text-right">
                                {(() => {
                                  const priceData =
                                    priceComparisonData?.[item.ingredientId];
                                  if (!priceData) {
                                    return (
                                      <span className="text-sm text-muted-foreground">
                                        —
                                      </span>
                                    );
                                  }

                                  // If no received price, show comparison with supplier/base price
                                  if (!priceData.has_received_price) {
                                    return (
                                      <div className="flex flex-col items-end">
                                        <span className="text-xs text-muted-foreground">
                                          Bez faktury
                                        </span>
                                        <span className="text-xs text-blue-600">
                                          {priceData.comparison_price?.toFixed(
                                            2
                                          )}{" "}
                                          Kč
                                        </span>
                                      </div>
                                    );
                                  }

                                  const receivedPrice =
                                    priceData.received_price;
                                  const comparisonPrice =
                                    priceData.comparison_price;
                                  const priceChange =
                                    receivedPrice - comparisonPrice;
                                  const percentageChange =
                                    comparisonPrice > 0
                                      ? (priceChange / comparisonPrice) * 100
                                      : 0;

                                  if (Math.abs(priceChange) < 0.01) {
                                    return (
                                      <div className="flex flex-col items-end gap-1">
                                        <div className="flex items-center gap-1">
                                          {/* <Minus className="h-3 w-3 text-gray-500" /> */}
                                          <span className="text-sm text-gray-500">
                                            Stejná cena
                                          </span>
                                        </div>
                                        <span className="text-xs font-semibold text-green-600">
                                          Faktura: {receivedPrice.toFixed(2)} Kč
                                        </span>
                                      </div>
                                    );
                                  }

                                  const isIncrease = priceChange > 0;
                                  const icon = isIncrease
                                    ? TrendingUp
                                    : TrendingDown;
                                  const colorClass = isIncrease
                                    ? "text-red-600"
                                    : "text-green-600";

                                  return (
                                    <div className="flex flex-col items-end gap-1">
                                      <span className="text-xs font-semibold text-green-600">
                                        {receivedPrice.toFixed(2)} Kč
                                      </span>
                                      <div className="flex items-center gap-1">
                                        {React.createElement(icon, {
                                          className: `h-3 w-3 ${colorClass}`,
                                        })}
                                        <span
                                          className={`text-sm ${colorClass}`}
                                        >
                                          {isIncrease ? "+" : ""}
                                          {priceChange.toFixed(2)} Kč
                                        </span>
                                      </div>
                                      <span className={`text-xs ${colorClass}`}>
                                        ({isIncrease ? "+" : ""}
                                        {percentageChange.toFixed(1)}%)
                                      </span>
                                      <span className="text-xs text-muted-foreground">
                                        vs{" "}
                                        {priceData.comparison_price?.toFixed(2)}{" "}
                                        Kč
                                      </span>
                                    </div>
                                  );
                                })()}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex flex-col items-end gap-1">
                                  <span className="text-sm font-mono font-semibold">
                                    {(
                                      item.currentQuantity +
                                      item.receivedInvoicesQuantity +
                                      (item.transfersNet || 0) -
                                      item.monthlyConsumption
                                    ).toFixed(1)}
                                  </span>
                                  {item.package && (
                                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                      <Package className="h-3 w-3" />
                                      <span>
                                        {formatPackageQuantity(
                                          item.currentQuantity +
                                            item.receivedInvoicesQuantity +
                                            (item.transfersNet || 0) -
                                            item.monthlyConsumption,
                                          item.package
                                        )}{" "}
                                        bal
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  {getStatusIcon(item.status)}
                                  {getStatusBadge(item.status)}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )
              )}

              {filteredGroupedQuantities.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  Nebyly nalezeny žádné položky odpovídající filtru.
                </div>
              )}
            </TabsContent>

            {/* Low Stock Tab */}
            <TabsContent value="low-stock" className="space-y-6 mt-6">
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[200px]">Název</TableHead>
                      <TableHead className="w-[150px]">Kategorie</TableHead>
                      <TableHead className="w-[100px]">Jednotka</TableHead>
                      <TableHead className="text-right w-[100px]">
                        Cena
                      </TableHead>
                      <TableHead className="text-right w-[120px]">
                        Změna ceny
                      </TableHead>
                      <TableHead className="text-right w-[140px]">
                        <div className="flex flex-col items-end">
                          <span>Aktuální stav</span>
                          <span className="text-xs text-muted-foreground font-normal">
                            Inventura + Faktury + Transfery - Spotřeba
                          </span>
                        </div>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredQuantities
                      .filter((item: any) => item.status === "low")
                      .map((item: any) => (
                        <TableRow key={item.id} className="bg-red-50">
                          <TableCell className="font-medium">
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2">
                                {isCreatedInSelectedMonth(item) && (
                                  <Sparkles className="h-4 w-4 text-yellow-500" />
                                )}
                                <div className="flex flex-col">
                                  <span>
                                    {item.supplierIngredientName || item.name}
                                  </span>
                                  {item.alternativeSupplierNames &&
                                    item.alternativeSupplierNames.length >
                                      0 && (
                                      <span className="text-xs text-blue-500 italic">
                                        {item.alternativeSupplierNames.join(
                                          ", "
                                        )}
                                      </span>
                                    )}
                                </div>
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {item.supplier}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Tag className="h-3 w-3 text-orange-600" />
                              <span className="text-sm">{item.category}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Scale className="h-3 w-3 text-muted-foreground" />
                              <span className="text-sm">{item.unit}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            {(() => {
                              const priceData =
                                priceComparisonData?.[item.ingredientId];
                              // Show comparison price (supplier price or base price) instead of outdated base price
                              const displayPrice =
                                priceData?.comparison_price ?? item.price;
                              return (
                                <div className="flex flex-col items-end">
                                  <span className="text-sm font-semibold">
                                    {displayPrice.toFixed(2)} Kč
                                  </span>
                                  {priceData?.supplier_price &&
                                    priceData.supplier_price !==
                                      priceData.base_price && (
                                      <span className="text-xs text-muted-foreground">
                                        (dodavatel)
                                      </span>
                                    )}
                                </div>
                              );
                            })()}
                          </TableCell>
                          <TableCell className="text-right">
                            {(() => {
                              const priceData =
                                priceComparisonData?.[item.ingredientId];
                              if (!priceData) {
                                return (
                                  <span className="text-sm text-muted-foreground">
                                    —
                                  </span>
                                );
                              }

                              // If no received price, show comparison with supplier/base price
                              if (!priceData.has_received_price) {
                                return (
                                  <div className="flex flex-col items-end">
                                    <span className="text-xs text-muted-foreground">
                                      Bez faktury
                                    </span>
                                    <span className="text-xs text-blue-600">
                                      {priceData.comparison_price?.toFixed(2)}{" "}
                                      Kč
                                    </span>
                                  </div>
                                );
                              }

                              const receivedPrice = priceData.received_price;
                              const comparisonPrice =
                                priceData.comparison_price;
                              const priceChange =
                                receivedPrice - comparisonPrice;
                              const percentageChange =
                                comparisonPrice > 0
                                  ? (priceChange / comparisonPrice) * 100
                                  : 0;

                              if (Math.abs(priceChange) < 0.01) {
                                return (
                                  <div className="flex flex-col items-end gap-1">
                                    <div className="flex items-center gap-1">
                                      <Minus className="h-3 w-3 text-gray-500" />
                                      <span className="text-sm text-gray-500">
                                        Stejná cena
                                      </span>
                                    </div>
                                    <span className="text-xs font-semibold text-green-600">
                                      Faktura: {receivedPrice.toFixed(2)} Kč
                                    </span>
                                  </div>
                                );
                              }

                              const isIncrease = priceChange > 0;
                              const icon = isIncrease
                                ? TrendingUp
                                : TrendingDown;
                              const colorClass = isIncrease
                                ? "text-red-600"
                                : "text-green-600";

                              return (
                                <div className="flex flex-col items-end gap-1">
                                  <span className="text-xs font-semibold text-green-600">
                                    Faktura: {receivedPrice.toFixed(2)} Kč
                                  </span>
                                  <div className="flex items-center gap-1">
                                    {React.createElement(icon, {
                                      className: `h-3 w-3 ${colorClass}`,
                                    })}
                                    <span className={`text-sm ${colorClass}`}>
                                      {isIncrease ? "+" : ""}
                                      {priceChange.toFixed(2)} Kč
                                    </span>
                                  </div>
                                  <span className={`text-xs ${colorClass}`}>
                                    ({isIncrease ? "+" : ""}
                                    {percentageChange.toFixed(1)}%)
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    vs {priceData.comparison_price?.toFixed(2)}{" "}
                                    Kč
                                  </span>
                                </div>
                              );
                            })()}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex flex-col items-end gap-1">
                              <span className="text-m font-mono font-semibold">
                                {(
                                  item.currentQuantity +
                                  item.receivedInvoicesQuantity +
                                  (item.transfersNet || 0) -
                                  item.monthlyConsumption
                                ).toFixed(1)}
                              </span>
                              {item.package && (
                                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                  <Package className="h-3 w-3" />
                                  <span>
                                    {formatPackageQuantity(
                                      item.currentQuantity +
                                        item.receivedInvoicesQuantity +
                                        (item.transfersNet || 0) -
                                        item.monthlyConsumption,
                                      item.package
                                    )}{" "}
                                    bal
                                  </span>
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>

              {filteredQuantities.filter((item) => item.status === "low")
                .length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  Žádné položky s nízkými zásobami.
                </div>
              )}
            </TabsContent>

            {/* Daily Consumption Tab */}
            <TabsContent value="daily" className="space-y-6 mt-6">
              <DailyIngredientConsumption />
            </TabsContent>

            {/* Monthly Consumption Tab */}
            <TabsContent value="consumption" className="space-y-6 mt-6">
              <MonthlyIngredientConsumption />
            </TabsContent>

            {/* Store Consumption Tab */}
            <TabsContent value="store-consumption" className="space-y-6 mt-6">
              <StoreProductionIngredientConsumption
                selectedUserId={selectedUserId}
              />
            </TabsContent>

            {/* Production Calendar Tab */}
            <TabsContent value="calendar" className="space-y-6 mt-6">
              <ProductionCalendar
                selectedMonth={selectedMonth}
                selectedUserId={selectedUserId}
              />
            </TabsContent>
          </Tabs>
        </div>
      </Card>

      {/* Price Fluctuation Dialog */}
      <IngredientPriceFluctuation
        open={isPriceFluctuationOpen}
        onClose={() => setIsPriceFluctuationOpen(false)}
        selectedMonth={selectedMonth}
        receiverId={selectedUserId}
        useWholeYear={true}
        supplierId={
          supplierFilter !== "all"
            ? suppliers?.find((s: any) => s.full_name === supplierFilter)?.id
            : undefined
        }
      />
    </>
  );
}
