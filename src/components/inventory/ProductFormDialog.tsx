import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useState, useEffect } from "react";
import { Barcode } from "lucide-react";
import { CustomBarcodeGenerator } from "./CustomBarcodeGenerator";

interface ProductFormData {
  name: string;
  barcode: string;
  category_id: string;
  department_id: string;
  brand: string;
  unit: string;
  quantity_per_unit: number;
  current_stock: number;
  reorder_level: number;
  cost_price: number;
  selling_price: number;
  is_bundle: boolean;
  tracking_type: string;
  volume_unit: string;
  allow_custom_price: boolean;
  min_price: number;
  max_price: number;
  supplier_id: string;
  pricing_tiers: {
    retail: number;
    wholesale: number;
    individual: number;
  };
  bottle_size_ml: number;
  total_ml: number;
  cost_per_ml: number;
  wholesale_price_per_ml: number;
  retail_price_per_ml: number;
  imei: string;
  serial_number: string;
}

interface ProductFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formData: ProductFormData;
  setFormData: (data: ProductFormData) => void;
  onSave: () => void;
  editingProduct: any;
  categories: any[];
  departments: any[];
  suppliers: any[];
  isAdmin: boolean;
  isPerfumeDepartment?: boolean;
  isMobileMoneyDepartment?: boolean;
}

export const ProductFormDialog = ({
  open,
  onOpenChange,
  formData,
  setFormData,
  onSave,
  editingProduct,
  categories,
  departments,
  suppliers,
  isAdmin,
  isPerfumeDepartment = false,
  isMobileMoneyDepartment = false
}: ProductFormDialogProps) => {
  const [showBarcodeGenerator, setShowBarcodeGenerator] = useState(false);
  const [isContainer, setIsContainer] = useState(false);
  
  const selectedCategory = categories.find(cat => cat.id === formData.category_id);
  const isFormsCategory = selectedCategory?.name?.toLowerCase() === 'forms';
  const containerCategory = categories.find(cat => cat.name?.toLowerCase() === 'container');

  // Auto-set container category when container mode is enabled
  useEffect(() => {
    if (isContainer && containerCategory && formData.category_id !== containerCategory.id) {
      setFormData({ ...formData, category_id: containerCategory.id });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isContainer, containerCategory?.id]);
  
  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingProduct ? "Edit Product" : "Add New Product"}
              {isPerfumeDepartment && !editingProduct && (
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  (Perfume - Milliliter Tracking)
                </span>
              )}
            </DialogTitle>
            <DialogDescription>
              {editingProduct 
                ? "Update product information and inventory details" 
                : "Create a new product and set initial stock levels"}
            </DialogDescription>
          </DialogHeader>

          <div className="mb-6 p-4 border rounded-lg bg-muted/20">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-base font-semibold">Container Mode</Label>
                <p className="text-sm text-muted-foreground">
                  Enable this if the product will contain multiple variants (e.g., different sizes, colors)
                </p>
              </div>
              <Switch
                checked={isContainer}
                onCheckedChange={setIsContainer}
                disabled={!!editingProduct}
              />
            </div>
            {isContainer && (
              <p className="text-sm text-primary mt-3 font-medium">
                ℹ️ Container mode: Stock and barcode will be managed at the variant level
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Product Name *</Label>
              <Input
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder={isFormsCategory ? "e.g., NIRA Form" : isContainer ? "e.g., T-Shirt (Container)" : "e.g., A4 Paper"}
              />
            </div>

            {!isContainer && (
              <div className="space-y-2">
                <Label>Barcode</Label>
                <div className="flex gap-2">
                  <Input
                    value={formData.barcode}
                    onChange={e => setFormData({ ...formData, barcode: e.target.value })}
                    placeholder={editingProduct && formData.barcode ? formData.barcode : "Scan or enter barcode"}
                    disabled={editingProduct ? false : false}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setShowBarcodeGenerator(true)}
                    title="Generate Custom Barcode"
                    disabled={editingProduct ? false : false}
                  >
                    <Barcode className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {isMobileMoneyDepartment && (
              <>
                <div className="space-y-2">
                  <Label>IMEI Number</Label>
                  <Input
                    value={formData.imei}
                    onChange={e => setFormData({ ...formData, imei: e.target.value })}
                    placeholder="For phones only (optional)"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Serial Number</Label>
                  <Input
                    value={formData.serial_number}
                    onChange={e => setFormData({ ...formData, serial_number: e.target.value })}
                    placeholder="Device serial number"
                  />
                </div>
              </>
            )}

            {!isContainer && (
              <div className="space-y-2">
                <Label>Category *</Label>
                <Select
                  value={formData.category_id}
                  onValueChange={value => setFormData({ ...formData, category_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.filter(cat => cat.type === "product").map(category => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            {isContainer && containerCategory && (
              <div className="space-y-2">
                <Label>Category</Label>
                <Input value="CONTAINER" disabled className="bg-muted" />
              </div>
            )}

            <div className="space-y-2">
              <Label>Department *</Label>
              <Select
                value={formData.department_id}
                onValueChange={value => setFormData({ ...formData, department_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map(dept => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {!isFormsCategory && !isContainer && (
              <div className="space-y-2">
                <Label>Brand</Label>
                <Input
                  value={formData.brand}
                  onChange={e => setFormData({ ...formData, brand: e.target.value })}
                  placeholder="e.g., HP"
                />
              </div>
            )}

            {!isFormsCategory && !isContainer && (
              <div className="space-y-2">
                <Label>Tracking Type</Label>
                <Select
                  value={formData.tracking_type}
                  onValueChange={value => setFormData({ ...formData, tracking_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select tracking type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unit">Unit</SelectItem>
                    <SelectItem value="milliliter">Milliliter (for perfume)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {!isFormsCategory && formData.tracking_type === "milliliter" && isPerfumeDepartment && (
              <>
                <div className="space-y-2">
                  <Label>Bottle Size (ml) *</Label>
                  <Input
                    type="number"
                    value={formData.bottle_size_ml}
                    onChange={e => setFormData({ ...formData, bottle_size_ml: parseFloat(e.target.value) || 0 })}
                    placeholder="e.g., 50"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Current Stock (ml) *</Label>
                  <Input
                    type="number"
                    value={formData.total_ml}
                    onChange={e => setFormData({ ...formData, total_ml: parseFloat(e.target.value) || 0 })}
                    placeholder="e.g., 1000"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Cost per ML *</Label>
                  <Input
                    type="number"
                    value={formData.cost_per_ml}
                    onChange={e => setFormData({ ...formData, cost_per_ml: parseFloat(e.target.value) || 0 })}
                    placeholder="e.g., 400"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Retail Price per ML *</Label>
                  <Input
                    type="number"
                    value={formData.retail_price_per_ml}
                    onChange={e => setFormData({ ...formData, retail_price_per_ml: parseFloat(e.target.value) || 0 })}
                    placeholder="e.g., 800"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Wholesale Price per ML *</Label>
                  <Input
                    type="number"
                    value={formData.wholesale_price_per_ml}
                    onChange={e => setFormData({ ...formData, wholesale_price_per_ml: parseFloat(e.target.value) || 0 })}
                    placeholder="e.g., 600"
                  />
                </div>
              </>
            )}

            {!isContainer && (
              <>
                <div className="space-y-2">
                  <Label>Unit *</Label>
                  <Select
                    value={formData.unit}
                    onValueChange={value => setFormData({ ...formData, unit: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select unit" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="piece">Piece</SelectItem>
                      <SelectItem value="box">Box</SelectItem>
                      <SelectItem value="pack">Pack</SelectItem>
                      <SelectItem value="carton">Carton</SelectItem>
                      <SelectItem value="kg">Kilogram</SelectItem>
                      <SelectItem value="liter">Liter</SelectItem>
                      <SelectItem value="meter">Meter</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {!isFormsCategory && (
                  <div className="space-y-2">
                    <Label>Quantity per Unit</Label>
                    <Input
                      type="number"
                      value={formData.quantity_per_unit}
                      onChange={e => setFormData({ ...formData, quantity_per_unit: parseInt(e.target.value) || 1 })}
                      placeholder="e.g., 500"
                    />
                  </div>
                )}
              </>
            )}

            {!isContainer && (
              <>
                <div className="space-y-2">
                  <Label>Current Stock *</Label>
                  <Input
                    type="number"
                    value={formData.current_stock}
                    onChange={e => setFormData({ ...formData, current_stock: parseInt(e.target.value) || 0 })}
                    placeholder="e.g., 50"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Reorder Level *</Label>
                  <Input
                    type="number"
                    value={formData.reorder_level}
                    onChange={e => setFormData({ ...formData, reorder_level: parseInt(e.target.value) || 10 })}
                    placeholder="e.g., 10"
                  />
                </div>
              </>
            )}

            {!isContainer && (
              <>
                <div className="space-y-2">
                  <Label>Cost Price *</Label>
                  <Input
                    type="number"
                    value={formData.cost_price}
                    onChange={e => setFormData({ ...formData, cost_price: parseFloat(e.target.value) || 0 })}
                    placeholder="e.g., 10000"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Selling Price *</Label>
                  <Input
                    type="number"
                    value={formData.selling_price}
                    onChange={e => setFormData({ ...formData, selling_price: parseFloat(e.target.value) || 0 })}
                    placeholder="e.g., 15000"
                  />
                </div>
              </>
            )}

            {isAdmin && !isFormsCategory && !isContainer && (
              <>
                <div className="space-y-2 lg:col-span-3">
                  <Label>Pricing Tiers (Optional)</Label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm">Retail Price</Label>
                      <Input
                        type="number"
                        value={formData.pricing_tiers?.retail || ""}
                        onChange={e => setFormData({
                          ...formData,
                          pricing_tiers: { ...formData.pricing_tiers, retail: parseFloat(e.target.value) || 0 }
                        })}
                        placeholder="For retail customers"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">Wholesale Price</Label>
                      <Input
                        type="number"
                        value={formData.pricing_tiers?.wholesale || ""}
                        onChange={e => setFormData({
                          ...formData,
                          pricing_tiers: { ...formData.pricing_tiers, wholesale: parseFloat(e.target.value) || 0 }
                        })}
                        placeholder="For wholesale customers"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">Individual Price</Label>
                      <Input
                        type="number"
                        value={formData.pricing_tiers?.individual || ""}
                        onChange={e => setFormData({
                          ...formData,
                          pricing_tiers: { ...formData.pricing_tiers, individual: parseFloat(e.target.value) || 0 }
                        })}
                        placeholder="For individual sales"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2 lg:col-span-3">
                  <div className="flex items-center justify-between">
                    <Label>Allow Custom Pricing</Label>
                    <Switch
                      checked={formData.allow_custom_price}
                      onCheckedChange={checked => setFormData({ ...formData, allow_custom_price: checked })}
                    />
                  </div>
                  {formData.allow_custom_price && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                      <div className="space-y-2">
                        <Label className="text-sm">Minimum Price</Label>
                        <Input
                          type="number"
                          value={formData.min_price || ""}
                          onChange={e => setFormData({ ...formData, min_price: parseFloat(e.target.value) || 0 })}
                          placeholder="Minimum allowed price"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm">Maximum Price</Label>
                        <Input
                          type="number"
                          value={formData.max_price || ""}
                          onChange={e => setFormData({ ...formData, max_price: parseFloat(e.target.value) || 0 })}
                          placeholder="Maximum allowed price"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {!isFormsCategory && !isContainer && (
              <div className="space-y-2">
                <Label>Supplier (Optional)</Label>
                <Select
                  value={formData.supplier_id}
                  onValueChange={value => setFormData({ ...formData, supplier_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map(supplier => (
                      <SelectItem key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={onSave}
              disabled={!formData.name || !formData.category_id || !formData.department_id}
            >
              {editingProduct ? "Update Product" : "Add Product"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <CustomBarcodeGenerator
        isOpen={showBarcodeGenerator}
        onClose={() => setShowBarcodeGenerator(false)}
        currentBarcode={formData.barcode}
        onGenerate={barcode => {
          setFormData({ ...formData, barcode: barcode });
        }}
      />
    </>
  );
};