import { supabase } from "@/integrations/supabase/client";

/**
 * Check stock availability for a product
 */
export const checkStockAvailability = async (
  productId: string,
  requestedQuantity: number,
  trackingType?: string,
  mlAmount?: number
): Promise<{ available: boolean; currentStock: number; message?: string }> => {
  const { data: product } = await supabase
    .from("products")
    .select("stock, total_ml, tracking_type, name")
    .eq("id", productId)
    .single();

  if (!product) return { available: false, currentStock: 0, message: "Product not found" };

  const isMlTracking = (trackingType === "ml" || trackingType === "milliliter" || product.tracking_type === "ml");
  const currentStock = isMlTracking 
    ? (product.total_ml || 0) 
    : (product.stock || 0);
  
  const requiredAmount = isMlTracking && mlAmount ? mlAmount : requestedQuantity;
  const available = currentStock >= requiredAmount;
  
  return {
    available,
    currentStock,
    message: available ? undefined : `Insufficient stock for ${product.name}. Available: ${currentStock}`,
  };
};

/**
 * Check stock availability for a product variant
 */
export const checkVariantStockAvailability = async (
  variantId: string,
  requestedQuantity: number
): Promise<{ available: boolean; currentStock: number; message?: string }> => {
  const { data: variant } = await supabase
    .from("product_variants")
    .select("stock, name")
    .eq("id", variantId)
    .single();

  if (!variant) return { available: false, currentStock: 0, message: "Variant not found" };

  const currentStock = variant.stock || 0;
  const available = currentStock >= requestedQuantity;
  
  return {
    available,
    currentStock,
    message: available ? undefined : `Insufficient stock for ${variant.name}. Available: ${currentStock}`,
  };
};

interface ScentUsage {
  scent: string;
  scentId?: string | null;
  ml: number;
}

interface CartItem {
  id: string;
  name?: string;
  productId?: string;
  serviceId?: string;
  variantId?: string;
  quantity: number;
  trackingType?: string;
  volumeUnit?: string;
  isPerfumeRefill?: boolean;
  totalMl?: number;
  selectedScents?: ScentUsage[];
}

/**
 * Reduce stock for all items in cart after successful sale
 */
export const reduceStock = async (
  cartItems: CartItem[],
  departmentId: string,
  isDemoMode: boolean = false
): Promise<{ success: boolean; error?: string }> => {
  try {
    if (isDemoMode) {
      console.log("DEMO MODE: Simulating stock reduction without saving");
      return { success: true };
    }

    console.log("Starting stock reduction for", cartItems.length, "items");

    for (const item of cartItems) {
      console.log("Processing cart item:", {
        id: item.id,
        name: item.name,
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
        trackingType: item.trackingType,
        totalMl: item.totalMl,
        isPerfumeRefill: item.isPerfumeRefill
      });

      // Skip services (no stock to deduct)
      if (!item.productId && !item.variantId && !item.isPerfumeRefill) {
        console.log("Skipping item (service or no productId):", item.name);
        continue;
      }

      if (item.variantId) {
        console.log(`Deducting variant stock for: ${item.name}, quantity: ${item.quantity}`);
        await reduceVariantStock(item.variantId, item.quantity);
      } else if (item.isPerfumeRefill) {
        // Scent stock is managed manually - no automatic deduction
        console.log(`Perfume refill sale recorded (stock managed manually): ${item.totalMl || 0}ml`);
      } else if (item.productId) {
        console.log(`Deducting product stock for: ${item.name}, quantity: ${item.quantity}`);
        await reduceProductStock(item.productId, item.quantity, item.trackingType, item.totalMl);
      }
    }

    console.log("Stock reduction completed successfully");
    return { success: true };
  } catch (error) {
    console.error("Stock reduction error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to reduce stock",
    };
  }
};

/**
 * Reduce stock for a specific product variant
 */
const reduceVariantStock = async (variantId: string, quantity: number): Promise<void> => {
  console.log(`Reducing variant stock: variantId=${variantId}, quantity=${quantity}`);
  
  const { data: variant, error: fetchError } = await supabase
    .from("product_variants")
    .select("stock, name")
    .eq("id", variantId)
    .single();

  if (fetchError) {
    console.error("Error fetching variant:", fetchError);
    throw fetchError;
  }
  if (!variant) throw new Error("Variant not found");

  const currentStock = variant.stock ?? 0;
  const newStock = Math.max(0, currentStock - quantity);
  
  console.log(`Variant ${variant.name}: Current stock=${currentStock}, Deducting=${quantity}, New stock=${newStock}`);

  const { error: updateError } = await supabase
    .from("product_variants")
    .update({ stock: newStock })
    .eq("id", variantId);

  if (updateError) {
    console.error("Error updating variant stock:", updateError);
    throw updateError;
  }
  
  console.log(`Variant stock updated successfully: ${variant.name} now has ${newStock} units`);
};

/**
 * Reduce stock for a specific product
 */
const reduceProductStock = async (
  productId: string,
  quantity: number,
  trackingType?: string,
  totalMl?: number
): Promise<void> => {
  console.log(`Reducing product stock: productId=${productId}, quantity=${quantity}, trackingType=${trackingType}, totalMl=${totalMl}`);
  
  const { data: product, error: fetchError } = await supabase
    .from("products")
    .select("stock, total_ml, tracking_type, name")
    .eq("id", productId)
    .single();

  if (fetchError) {
    console.error("Error fetching product:", fetchError);
    throw fetchError;
  }
  if (!product) throw new Error("Product not found");

  const isMlTracking = product.tracking_type === "ml" || trackingType === "ml" || trackingType === "milliliter";
  
  if (isMlTracking && totalMl) {
    const currentMl = product.total_ml ?? 0;
    const newMl = Math.max(0, currentMl - totalMl);
    console.log(`Product ${product.name} (ml): Current=${currentMl}ml, Deducting=${totalMl}ml, New=${newMl}ml`);
    
    const { error: updateError } = await supabase
      .from("products")
      .update({ total_ml: newMl })
      .eq("id", productId);
      
    if (updateError) {
      console.error("Error updating product ml:", updateError);
      throw updateError;
    }
  } else {
    const currentStock = product.stock ?? 0;
    const newStock = Math.max(0, currentStock - quantity);
    console.log(`Product ${product.name}: Current stock=${currentStock}, Deducting=${quantity}, New stock=${newStock}`);
    
    const { error: updateError } = await supabase
      .from("products")
      .update({ stock: newStock })
      .eq("id", productId);
      
    if (updateError) {
      console.error("Error updating product stock:", updateError);
      throw updateError;
    }
  }
  
  console.log(`Product stock updated successfully for: ${product.name}`);
};

/**
 * Restore stock when voiding a sale
 */
export const restoreStock = async (
  saleId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { data: saleItems } = await supabase
      .from("sale_items")
      .select("*, products(id, stock, total_ml, tracking_type), product_variants(id, stock)")
      .eq("sale_id", saleId);

    if (!saleItems) return { success: true };

    for (const item of saleItems as any[]) {
      if (item.variant_id && item.product_variants) {
        const variant = item.product_variants;
        await supabase
          .from("product_variants")
          .update({ stock: (variant.stock || 0) + item.quantity } as any)
          .eq("id", item.variant_id);
      } else if (item.product_id && item.products) {
        const product = item.products;
        if (product.tracking_type === "ml") {
          await supabase
            .from("products")
            .update({ total_ml: (product.total_ml || 0) + (item.ml_amount || item.quantity) } as any)
            .eq("id", item.product_id);
        } else {
          await supabase
            .from("products")
            .update({ stock: (product.stock || 0) + item.quantity } as any)
            .eq("id", item.product_id);
        }
      }
    }

    return { success: true };
  } catch (error) {
    console.error("Stock restore error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to restore stock",
    };
  }
};
