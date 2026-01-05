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
  type?: string;
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
      } else if ((item.isPerfumeRefill || item.type === "perfume") && item.totalMl) {
        // Deduct from individual scent stock_ml values
        console.log(`🧴 Deducting perfume refill stock: ${item.totalMl}ml total from ${item.selectedScents?.length || 0} scents`);
        console.log("Selected scents:", JSON.stringify(item.selectedScents));
        
        if (item.selectedScents && item.selectedScents.length > 0) {
          // Deduct from each selected scent
          for (const scent of item.selectedScents) {
            console.log(`Processing scent: ${scent.scent}, scentId: ${scent.scentId}, ml: ${scent.ml}`);
            
            if (scent.scentId && scent.ml > 0) {
              const { data: scentData, error: fetchError } = await supabase
                .from("perfume_scents")
                .select("id, name, stock_ml")
                .eq("id", scent.scentId)
                .single();
              
              if (fetchError) {
                console.error(`❌ Error fetching scent by ID ${scent.scentId}:`, fetchError);
                // Fallback to name search
                console.log(`Trying fallback search by name: ${scent.scent}`);
              }
              
              if (scentData) {
                const currentMl = scentData.stock_ml ?? 0;
                const newMl = Math.max(0, currentMl - scent.ml);
                console.log(`✅ Scent ${scentData.name}: Current=${currentMl}ml, Deducting=${scent.ml}ml, New=${newMl}ml`);
                
                const { error: updateError } = await supabase
                  .from("perfume_scents")
                  .update({ stock_ml: newMl })
                  .eq("id", scent.scentId);
                
                if (updateError) {
                  console.error(`❌ Error updating scent ${scentData.name}:`, updateError);
                } else {
                  console.log(`✅ Scent ${scentData.name} stock updated to ${newMl}ml`);
                }
                continue; // Move to next scent
              }
            }
            
            // Fallback: Try to find scent by name (case-insensitive) - ONLY in current department
            if (scent.ml > 0 && departmentId && departmentId !== 'null' && departmentId !== 'undefined') {
              console.log(`🔍 Searching for scent by name: "${scent.scent}" in department ${departmentId}`);
              
              // ONLY search in the department - each department is independent
              const { data: scentByName, error: nameError } = await supabase
                .from("perfume_scents")
                .select("id, name, stock_ml, department_id")
                .ilike("name", scent.scent)
                .eq("department_id", departmentId)
                .limit(1)
                .maybeSingle();
              
              if (nameError) {
                console.error(`❌ Error searching scent by name:`, nameError);
              }
              
              if (scentByName) {
                const currentMl = scentByName.stock_ml ?? 0;
                const newMl = Math.max(0, currentMl - scent.ml);
                console.log(`✅ Found scent by name "${scentByName.name}": Current=${currentMl}ml, Deducting=${scent.ml}ml, New=${newMl}ml`);
                
                const { error: updateError } = await supabase
                  .from("perfume_scents")
                  .update({ stock_ml: newMl })
                  .eq("id", scentByName.id);
                  
                if (updateError) {
                  console.error(`❌ Error updating scent:`, updateError);
                } else {
                  console.log(`✅ Scent ${scentByName.name} stock updated to ${newMl}ml`);
                }
              } else {
                console.warn(`⚠️ Scent "${scent.scent}" not found in department - stock not deducted`);
              }
            } else if (!departmentId || departmentId === 'null' || departmentId === 'undefined') {
              console.error(`❌ Cannot deduct stock: No valid department ID provided`);
            }
          }
        } else {
          console.warn("⚠️ No selectedScents provided for perfume refill, cannot deduct individual scent stock");
        }
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
  console.log(`🔄 STOCK REDUCTION: productId=${productId}, quantity=${quantity}, trackingType=${trackingType}, totalMl=${totalMl}`);
  
  const { data: product, error: fetchError } = await supabase
    .from("products")
    .select("stock, total_ml, tracking_type, name")
    .eq("id", productId)
    .single();

  if (fetchError) {
    console.error("❌ Error fetching product for stock reduction:", fetchError);
    throw fetchError;
  }
  if (!product) {
    console.error("❌ Product not found for stock reduction:", productId);
    throw new Error("Product not found");
  }

  console.log(`📦 Found product: ${product.name}, current stock=${product.stock}, tracking_type=${product.tracking_type}`);

  const isMlTracking = product.tracking_type === "ml" || trackingType === "ml" || trackingType === "milliliter";
  
  if (isMlTracking && totalMl) {
    const currentMl = product.total_ml ?? 0;
    const newMl = Math.max(0, currentMl - totalMl);
    console.log(`📦 Product ${product.name} (ml): Current=${currentMl}ml, Deducting=${totalMl}ml, New=${newMl}ml`);
    
    const { data: updateData, error: updateError } = await supabase
      .from("products")
      .update({ total_ml: newMl })
      .eq("id", productId)
      .select();
      
    if (updateError) {
      console.error("❌ Error updating product ml:", updateError);
      throw updateError;
    }
    console.log(`✅ ML update result:`, updateData);
  } else {
    const currentStock = product.stock ?? 0;
    const newStock = Math.max(0, currentStock - quantity);
    console.log(`📦 Product ${product.name}: Current stock=${currentStock}, Deducting=${quantity}, New stock=${newStock}`);
    
    const { data: updateData, error: updateError } = await supabase
      .from("products")
      .update({ stock: newStock })
      .eq("id", productId)
      .select();
      
    if (updateError) {
      console.error("❌ Error updating product stock:", updateError);
      throw updateError;
    }
    console.log(`✅ Stock update result:`, updateData);
  }
  
  console.log(`✅ Product stock updated successfully for: ${product.name}`);
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
