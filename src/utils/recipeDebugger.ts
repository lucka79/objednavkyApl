import { supabase } from "@/lib/supabase";

/**
 * Debug utility for recipes
 * 
 * Usage:
 * 1. In browser console:
 *    await window.debugRecipe("Salát Kuřecí velká b.")
 * 
 * 2. In code:
 *    import { debugRecipeByName } from "@/utils/recipeDebugger"
 *    await debugRecipeByName("Salát Kuřecí velká b.")
 */

export async function debugRecipeByName(recipeName: string) {
  console.group(`🔍 Debugging Recipe: ${recipeName}`);

  try {
    // Fetch recipe with all related data
    const { data: recipes, error: recipeError } = await supabase
      .from("recipes")
      .select(`
        *,
        categories!recepts_category_id_fkey(*),
        recipe_ingredients(
          *,
          ingredient:ingredients(*)
        )
      `)
      .ilike("name", recipeName);

    if (recipeError) {
      console.error("❌ Error fetching recipe:", recipeError);
      console.groupEnd();
      return;
    }

    if (!recipes || recipes.length === 0) {
      console.warn("⚠️ Recipe not found:", recipeName);
      console.groupEnd();
      return;
    }

    const recipe = recipes[0];
    console.log("✅ Recipe found!");
    console.log("\n📋 Basic Information:");
    console.log("  ID:", recipe.id);
    console.log("  Name:", recipe.name);
    console.log("  Category:", recipe.categories?.name || "N/A");
    console.log("  Price:", recipe.price, "Kč");
    console.log("  Price per Kilo:", recipe.pricePerKilo, "Kč/kg");
    console.log("  Quantity:", recipe.quantity, "kg");
    console.log("  Baker:", recipe.baker);
    console.log("  Pastry:", recipe.pastry);
    console.log("  Donut:", recipe.donut);
    console.log("  Store:", recipe.store);
    console.log("  Test:", recipe.test);

    // Check ingredients
    const recipeIngredients = recipe.recipe_ingredients || [];
    console.log("\n🥕 Recipe Ingredients:", recipeIngredients.length);
    
    let totalWeight = 0;  // Move outside the conditional
    
    if (recipeIngredients.length === 0) {
      console.warn("⚠️ No ingredients found for this recipe!");
    } else {
      let totalWeight = 0;
      let totalPrice = 0;
      let totalKJ = 0;
      let totalKcal = 0;
      let totalFat = 0;
      let totalSaturates = 0;
      let totalCarbohydrate = 0;
      let totalSugars = 0;
      let totalProtein = 0;
      let totalFibre = 0;
      let totalSalt = 0;

      console.log("\n  Ingredient Details:");
      recipeIngredients.forEach((recipeIng: any, index: number) => {
        const ingredient = recipeIng.ingredient;
        if (!ingredient) {
          console.error(`  ❌ #${index + 1}: Ingredient ID ${recipeIng.ingredient_id} not found!`);
          return;
        }

        const weightInKg = recipeIng.quantity * ingredient.kiloPerUnit;
        const cost = weightInKg * (ingredient.price || 0);
        totalWeight += weightInKg;
        totalPrice += cost;

        // Calculate nutritional values
        const factor = weightInKg * 10; // Convert kg to 100g units
        totalKJ += ingredient.kJ * factor;
        totalKcal += ingredient.kcal * factor;
        totalFat += ingredient.fat * factor;
        totalSaturates += ingredient.saturates * factor;
        totalCarbohydrate += ingredient.carbohydrate * factor;
        totalSugars += ingredient.sugars * factor;
        totalProtein += ingredient.protein * factor;
        totalFibre += ingredient.fibre * factor;
        totalSalt += ingredient.salt * factor;

        console.log(`  ✅ #${index + 1}: ${ingredient.name}`);
        console.log(`      Quantity: ${recipeIng.quantity} ${ingredient.unit}`);
        console.log(`      Weight: ${weightInKg.toFixed(3)} kg`);
        console.log(`      Unit Price: ${ingredient.price || 0} Kč/kg`);
        console.log(`      Cost: ${cost.toFixed(2)} Kč`);
        console.log(`      Kilo per Unit: ${ingredient.kiloPerUnit}`);
        
        if (ingredient.element && ingredient.element.trim() !== "") {
          console.log(`      Element: ${ingredient.element.substring(0, 100)}...`);
        }
      });

      console.log("\n💰 Calculated Totals:");
      console.log("  Total Weight:", totalWeight.toFixed(3), "kg");
      console.log("  Total Price:", totalPrice.toFixed(2), "Kč");
      console.log("  Price per Kilo:", totalWeight > 0 ? (totalPrice / totalWeight).toFixed(2) : "0.00", "Kč/kg");

      // Compare with stored values
      console.log("\n🔄 Comparison with Stored Values:");
      console.log("  Stored Quantity:", recipe.quantity, "kg");
      console.log("  Calculated Weight:", totalWeight.toFixed(3), "kg");
      console.log("  Difference:", (recipe.quantity - totalWeight).toFixed(3), "kg");
      
      const storedPricePerKilo = recipe.pricePerKilo || 0;
      const calculatedPricePerKilo = totalWeight > 0 ? totalPrice / totalWeight : 0;
      console.log("  Stored Price/kg:", storedPricePerKilo.toFixed(2), "Kč/kg");
      console.log("  Calculated Price/kg:", calculatedPricePerKilo.toFixed(2), "Kč/kg");
      console.log("  Difference:", (storedPricePerKilo - calculatedPricePerKilo).toFixed(2), "Kč/kg");

      // Nutritional information
      console.log("\n🍎 Nutritional Totals (per 100g):");
      if (totalWeight > 0) {
        console.log("  Energy:", 
          ((totalKJ / totalWeight) * 0.1).toFixed(0), "kJ /",
          ((totalKcal / totalWeight) * 0.1).toFixed(0), "kcal"
        );
        console.log("  Fat:", ((totalFat / totalWeight) * 0.1).toFixed(1), "g");
        console.log("  Saturates:", ((totalSaturates / totalWeight) * 0.1).toFixed(1), "g");
        console.log("  Carbohydrates:", ((totalCarbohydrate / totalWeight) * 0.1).toFixed(1), "g");
        console.log("  Sugars:", ((totalSugars / totalWeight) * 0.1).toFixed(1), "g");
        console.log("  Protein:", ((totalProtein / totalWeight) * 0.1).toFixed(1), "g");
        console.log("  Fibre:", ((totalFibre / totalWeight) * 0.1).toFixed(1), "g");
        console.log("  Salt:", ((totalSalt / totalWeight) * 0.1).toFixed(1), "g");
      } else {
        console.warn("  ⚠️ No nutritional data (total weight is 0)");
      }
    }

    // Check products using this recipe
    console.log("\n📦 Products Using This Recipe:");
    const { data: productParts, error: productPartsError } = await supabase
      .from("product_parts")
      .select(`
        product_id,
        quantity,
        products!product_parts_product_id_fkey (
          id,
          name,
          active,
          store,
          buyer
        )
      `)
      .eq("recipe_id", recipe.id);

    if (productPartsError) {
      console.error("  ❌ Error fetching product parts:", productPartsError);
    } else if (productParts && productParts.length > 0) {
      console.log(`  Found ${productParts.length} product(s):`);
      productParts.forEach((part: any) => {
        const product = part.products;
        if (product) {
          console.log(`    - ${product.name}`);
          console.log(`      Used quantity: ${part.quantity}`);
          console.log(`      Active: ${product.active ? "Yes" : "No"}`);
          console.log(`      Store: ${product.store ? "Yes" : "No"}`);
          console.log(`      Buyer: ${product.buyer ? "Yes" : "No"}`);
        }
      });
    } else {
      console.log("  No products found using this recipe.");
    }

    // Check for potential issues
    console.log("\n⚠️ Potential Issues:");
    let issuesFound = false;

    if (recipeIngredients.length === 0) {
      console.warn("  - Recipe has no ingredients");
      issuesFound = true;
    }

    recipeIngredients.forEach((recipeIng: any) => {
      if (!recipeIng.ingredient) {
        console.warn(`  - Missing ingredient reference for ID: ${recipeIng.ingredient_id}`);
        issuesFound = true;
      }
      if (recipeIng.quantity <= 0) {
        console.warn(`  - Invalid quantity (${recipeIng.quantity}) for ingredient ID: ${recipeIng.ingredient_id}`);
        issuesFound = true;
      }
      
      // Check for potentially incorrect prices
      const ingredient = recipeIng.ingredient;
      if (ingredient && ingredient.unit !== "kg" && ingredient.kiloPerUnit < 1) {
        const pricePerUnit = ingredient.price * ingredient.kiloPerUnit;
        const pricePerKg = ingredient.price;
        
        if (pricePerKg < 100 && pricePerUnit < pricePerKg * 0.5) {
          console.warn(`  ⚠️ "${ingredient.name}": Cena ${pricePerKg} Kč/kg se zdá nízká pro jednotku "${ingredient.unit}".`);
          console.warn(`     Pokud je skutečná cena ${pricePerKg} Kč za ${ingredient.unit}, měla by být v databázi: ${(pricePerKg / ingredient.kiloPerUnit).toFixed(2)} Kč/kg`);
          console.warn(`     Aktuální cena za ${ingredient.unit}: ${pricePerUnit.toFixed(2)} Kč`);
          issuesFound = true;
        }
      }
    });

    if (totalWeight === 0) {
      console.warn("  - Total weight is 0");
      issuesFound = true;
    }

    if (!issuesFound) {
      console.log("  ✅ No issues detected!");
    }

  } catch (error) {
    console.error("❌ Error during debugging:", error);
  }

  console.groupEnd();
}

export async function debugRecipeById(recipeId: number) {
  console.group(`🔍 Debugging Recipe ID: ${recipeId}`);

  try {
    const { data: recipe, error } = await supabase
      .from("recipes")
      .select(`
        *,
        categories!recepts_category_id_fkey(*),
        recipe_ingredients(
          *,
          ingredient:ingredients(*)
        )
      `)
      .eq("id", recipeId)
      .single();

    if (error) {
      console.error("❌ Error fetching recipe:", error);
      console.groupEnd();
      return;
    }

    if (!recipe) {
      console.warn("⚠️ Recipe not found");
      console.groupEnd();
      return;
    }

    console.groupEnd();
    await debugRecipeByName(recipe.name);
  } catch (error) {
    console.error("❌ Error during debugging:", error);
    console.groupEnd();
  }
}

// Make it available globally in development
if (typeof window !== "undefined") {
  (window as any).debugRecipe = debugRecipeByName;
  (window as any).debugRecipeById = debugRecipeById;
}

