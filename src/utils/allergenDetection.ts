import {
  AlertTriangle,
  Wheat,
  Milk,
  Egg,
  Fish,
  Shell,
  Nut,
} from "lucide-react";

export interface Allergen {
  name: string;
  icon: any;
  color: string;
}

export const detectAllergens = (
  element: string | null
): Array<Allergen> => {
  if (!element) return [];
  
  const allergenKeywords = [
    {
      keywords: [
        "gluten",
        "pšenice",
        "pšeničný lepek",
        "pšen",
        "pšeničná",
        "pšen.mouka",
        "žito",
        "žitný",
        "žitná",
        "žit.mouka",
        "ječmen",
        "ječná",
        "ječný",
        "oves",
        "špalda",
      ],
      name: "Lepek",
      icon: Wheat,
      color: "bg-amber-100 text-amber-800",
    },
    {
      keywords: ["mléko", "laktóza", "sýr", "máslo", "smetana", "syrovátka", "mléč.bílkovina", "mléčná bílkovina"],
      name: "Mléko",
      icon: Milk,
      color: "bg-blue-100 text-blue-800",
    },
    {
      keywords: ["vejce", "vaječný", "vaječná", "vaječné", "vaječ"],
      name: "Vejce",
      icon: Egg,
      color: "bg-yellow-100 text-yellow-800",
    },
    {
      keywords: ["sója", "soj.", "sójový", "sójová", "sojová", "sojový", "sójové"],
      name: "Sója",
      icon: AlertTriangle,
      color: "bg-green-100 text-green-800",
    },
    {
      keywords: [
        "ořechy",
        "mandle", "MANDLE",
        "lískové",
        "vlašské",
        "pekanové",
        "kešu",
        "pistácie",
        "pistáciové",
      ],
      name: "Ořechy",
      icon: Nut,
      color: "bg-orange-100 text-orange-800",
    },
    {
      keywords: ["arašídy", "burské ořechy", "podzemnice olejná", "podzemnice"],
      name: "Arašídy",
      icon: Nut,
      color: "bg-red-100 text-red-800",
    },
    {
      keywords: ["sezam", "sezamové"],
      name: "Sezam",
      icon: AlertTriangle,
      color: "bg-purple-100 text-purple-800",
    },
    {
      keywords: ["ryby", "ryba"],
      name: "Ryby",
      icon: Fish,
      color: "bg-cyan-100 text-cyan-800",
    },
    {
      keywords: ["korýši", "krevety", "kraby"],
      name: "Korýši",
      icon: Shell,
      color: "bg-pink-100 text-pink-800",
    },
    {
      keywords: ["měkkýši", "slávky", "škeble"],
      name: "Měkkýši",
      icon: Shell,
      color: "bg-indigo-100 text-indigo-800",
    },
    {
      keywords: ["celer", "celerový"],
      name: "Celer",
      icon: AlertTriangle,
      color: "bg-lime-100 text-lime-800",
    },
    {
      keywords: ["hořčice", "hořčičné"],
      name: "Hořčice",
      icon: AlertTriangle,
      color: "bg-yellow-100 text-yellow-800",
    },
    {
      keywords: ["oxid siřičitý", "siřičitany", "sulfity", "disiřičitan", "SO2"],
      name: "Siřičitany",
      icon: AlertTriangle,
      color: "bg-gray-100 text-gray-800",
    },
    {
      keywords: ["lupin", "vlčí bob"],
      name: "Lupin",
      icon: AlertTriangle,
      color: "bg-violet-100 text-violet-800",
    },
  ];

  const foundAllergens: Array<Allergen> = [];
  const elementLower = element.toLowerCase();

  allergenKeywords.forEach((allergenGroup) => {
    const found = allergenGroup.keywords.some((keyword) =>
      elementLower.includes(keyword.toLowerCase())
    );
    if (found && !foundAllergens.find((a) => a.name === allergenGroup.name)) {
      foundAllergens.push({
        name: allergenGroup.name,
        icon: allergenGroup.icon,
        color: allergenGroup.color,
      });
    }
  });

  return foundAllergens;
}; 