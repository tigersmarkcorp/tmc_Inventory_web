import { useState, useRef } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Plus,
  Minus,
  Edit,
  Trash2,
  LogOut,
  Package,
  Filter,
  Camera,
  FileDown,
  DollarSign,
} from "lucide-react";
import { jsPDF } from "jspdf";
import inventoryPlaceholder from "@/assets/inventory-placeholder.jpg";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useActivityLog } from "@/hooks/useActivityLog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const Inventory = () => {
  const { signOut } = useAuth();
  const { toast } = useToast();
  const { logActivity } = useActivityLog();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [addQuantities, setAddQuantities] = useState<Record<string, number>>({});
  const [subtractQuantities, setSubtractQuantities] = useState<Record<string, number>>({});
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterCondition, setFilterCondition] = useState<string>("all");
  const [newItem, setNewItem] = useState({
    name: "",
    category: "",
    quantity: 0,
    location: "",
    description: "",
    reorder_point: 20,
    image: null as File | null,
    condition: "Brand New",
    unit_price: 0,
  });
  const [editImage, setEditImage] = useState<File | null>(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['inventory-items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
  });

  const addItemMutation = useMutation({
    mutationFn: async (item: typeof newItem) => {
      const status = item.quantity === 0 ? "Out of Stock" : item.quantity < 30 ? "Low Stock" : "In Stock";
      
      let imageUrl = null;
      
      // Upload image if provided
      if (item.image) {
        const fileExt = item.image.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('item-images')
          .upload(filePath, item.image);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('item-images')
          .getPublicUrl(filePath);

        imageUrl = publicUrl;
      }
      
      const { data, error } = await supabase
        .from('inventory_items')
        .insert([{ 
          name: item.name,
          category: item.category,
          quantity: item.quantity,
          total_items: item.quantity, // Set total_items equal to initial quantity
          location: item.location,
          description: item.description,
          condition: item.condition,
          reorder_point: item.reorder_point,
          unit_price: item.unit_price,
          image_url: imageUrl,
          status 
        }])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-stats'] });
      logActivity('ADD', `Added inventory item: ${data.name}`, 'inventory_items', data.id);
      toast({
        title: "Success",
        description: "Item added successfully",
      });
      setIsAddDialogOpen(false);
      setNewItem({
        name: "",
        category: "",
        quantity: 0,
        location: "",
        description: "",
        reorder_point: 20,
        image: null,
        condition: "Brand New",
        unit_price: 0,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add item",
        variant: "destructive",
      });
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: async ({ id, updates, image }: { id: string; updates: any; image?: File | null }) => {
      const status = updates.quantity === 0 ? "Out of Stock" : updates.quantity < 30 ? "Low Stock" : "In Stock";
      
      let imageUrl = updates.image_url;
      
      // Upload new image if provided
      if (image) {
        // Delete old image if exists
        if (updates.image_url) {
          const oldPath = updates.image_url.split('/').pop();
          await supabase.storage.from('item-images').remove([oldPath]);
        }

        const fileExt = image.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('item-images')
          .upload(filePath, image);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('item-images')
          .getPublicUrl(filePath);

        imageUrl = publicUrl;
      }
      
      const { data, error } = await supabase
        .from('inventory_items')
        .update({ 
          name: updates.name,
          category: updates.category,
          quantity: updates.quantity,
          location: updates.location,
          description: updates.description,
          condition: updates.condition,
          reorder_point: updates.reorder_point,
          unit_price: updates.unit_price,
          image_url: imageUrl,
          status 
        })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-stats'] });
      logActivity('UPDATE', `Updated inventory item: ${data.name}`, 'inventory_items', data.id);
      toast({
        title: "Success",
        description: "Item updated successfully",
      });
      setIsEditDialogOpen(false);
      setEditingItem(null);
      setEditImage(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update item",
        variant: "destructive",
      });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (id: string) => {
      // Get the item to find image URL
      const { data: item } = await supabase
        .from('inventory_items')
        .select('image_url')
        .eq('id', id)
        .single();

      // Delete image from storage if exists
      if (item?.image_url) {
        const imagePath = item.image_url.split('/').pop();
        await supabase.storage.from('item-images').remove([imagePath]);
      }

      const { error } = await supabase
        .from('inventory_items')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-stats'] });
      toast({
        title: "Success",
        description: "Item deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete item",
        variant: "destructive",
      });
    },
  });

  const updateQuantityMutation = useMutation({
    mutationFn: async ({ id, newQuantity }: { id: string; newQuantity: number }) => {
      const status = newQuantity === 0 ? "Out of Stock" : newQuantity < 30 ? "Low Stock" : "In Stock";
      
      const { data, error } = await supabase
        .from('inventory_items')
        .update({ quantity: newQuantity, status })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-stats'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update quantity",
        variant: "destructive",
      });
    },
  });

  const handleQuantityChange = (id: string, currentQuantity: number, delta: number) => {
    const newQuantity = Math.max(0, currentQuantity + delta);
    updateQuantityMutation.mutate({ id, newQuantity });
  };

  const handleAddQuantity = (id: string, currentQuantity: number) => {
    const addAmount = addQuantities[id] || 0;
    if (addAmount > 0) {
      const newQuantity = currentQuantity + addAmount;
      updateQuantityMutation.mutate({ id, newQuantity });
      setAddQuantities(prev => ({ ...prev, [id]: 0 }));
    }
  };

  const handleSubtractQuantity = (id: string, currentQuantity: number) => {
    const subtractAmount = subtractQuantities[id] || 0;
    if (subtractAmount > 0) {
      const newQuantity = Math.max(0, currentQuantity - subtractAmount);
      updateQuantityMutation.mutate({ id, newQuantity });
      setSubtractQuantities(prev => ({ ...prev, [id]: 0 }));
    }
  };

  const handleAddItem = () => {
    if (!newItem.name || !newItem.category || !newItem.location) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    addItemMutation.mutate(newItem);
  };

  const handleEditItem = () => {
    if (!editingItem) return;

    updateItemMutation.mutate({
      id: editingItem.id,
      updates: {
        name: editingItem.name,
        category: editingItem.category,
        quantity: editingItem.quantity,
        location: editingItem.location,
        description: editingItem.description,
        condition: editingItem.condition,
        reorder_point: editingItem.reorder_point,
        unit_price: editingItem.unit_price,
        image_url: editingItem.image_url,
      },
      image: editImage,
    });
  };

  const handleDeleteItem = (id: string, name: string) => {
    if (window.confirm("Are you sure you want to delete this item?")) {
      deleteItemMutation.mutate(id, {
        onSuccess: () => {
          logActivity('DELETE', `Deleted inventory item: ${name}`, 'inventory_items', id);
        }
      });
    }
  };

  const handleCameraCapture = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "In Stock":
        return "bg-success text-success-foreground";
      case "Low Stock":
        return "bg-warning text-warning-foreground";
      case "Out of Stock":
        return "bg-destructive text-destructive-foreground";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getDaysSinceAdded = (createdAt: string) => {
    const created = new Date(createdAt);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - created.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const filteredItems = items.filter((item: any) => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === "all" || item.category === filterCategory;
    const matchesStatus = filterStatus === "all" || item.status === filterStatus;
    const matchesCondition = filterCondition === "all" || item.condition === filterCondition;
    return matchesSearch && matchesCategory && matchesStatus && matchesCondition;
  });

  // Calculate total value based on total_items (original stock) × unit_price
  const totalValue = items.reduce((sum: number, item: any) => {
    const totalItems = item.total_items || item.quantity || 0;
    return sum + ((item.unit_price || 0) * totalItems);
  }, 0);

  const filteredTotalValue = filteredItems.reduce((sum: number, item: any) => {
    const totalItems = item.total_items || item.quantity || 0;
    return sum + ((item.unit_price || 0) * totalItems);
  }, 0);

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2,
    }).format(value);
  };

  // Generate PDF report - Excel-like table format
  const handleDownloadPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 10;
    let yPos = margin;

    // Title
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('INVENTORY REPORT', pageWidth / 2, yPos + 8, { align: 'center' });
    
    yPos += 14;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    doc.text(`Generated: ${new Date().toLocaleDateString('en-PH', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })}`, margin, yPos);
    doc.text(`Total Items: ${filteredItems.length}`, pageWidth - margin, yPos, { align: 'right' });

    yPos += 8;

    // Excel-like table configuration
    const colWidths = [12, 52, 38, 22, 22, 22, 28]; // No., Item Name, Category, Unit Price, Curr Qty, Total, Value
    const headers = ['No.', 'Item Name', 'Category', 'Unit Price', 'Curr Qty', 'Total', 'Value'];
    const tableWidth = colWidths.reduce((a, b) => a + b, 0);
    const tableStartX = (pageWidth - tableWidth) / 2;
    const rowHeight = 7;
    const headerHeight = 8;

    // Function to draw table header
    const drawTableHeader = (startY: number) => {
      // Header background - dark green like Excel
      doc.setFillColor(56, 142, 60);
      doc.rect(tableStartX, startY, tableWidth, headerHeight, 'F');
      
      // Header border
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.3);
      doc.rect(tableStartX, startY, tableWidth, headerHeight, 'S');
      
      // Draw vertical lines for header cells
      let xPos = tableStartX;
      colWidths.forEach((width, i) => {
        if (i > 0) {
          doc.line(xPos, startY, xPos, startY + headerHeight);
        }
        xPos += width;
      });
      
      // Header text
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      
      xPos = tableStartX;
      headers.forEach((header, i) => {
        const textWidth = doc.getTextWidth(header);
        const cellCenterX = xPos + (colWidths[i] - textWidth) / 2;
        doc.text(header, cellCenterX, startY + 5.5);
        xPos += colWidths[i];
      });
      
      return startY + headerHeight;
    };

    // Draw initial header
    yPos = drawTableHeader(yPos);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);

    // Table rows
    filteredItems.forEach((item: any, index: number) => {
      // Check if we need a new page
      if (yPos + rowHeight > pageHeight - 25) {
        doc.addPage();
        yPos = margin;
        yPos = drawTableHeader(yPos);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
      }

      // Alternate row colors - light green/white like Excel
      if (index % 2 === 0) {
        doc.setFillColor(232, 245, 233);
      } else {
        doc.setFillColor(255, 255, 255);
      }
      doc.rect(tableStartX, yPos, tableWidth, rowHeight, 'F');

      // Row border
      doc.setDrawColor(180, 180, 180);
      doc.setLineWidth(0.1);
      doc.rect(tableStartX, yPos, tableWidth, rowHeight, 'S');
      
      // Draw vertical cell borders
      let xPos = tableStartX;
      colWidths.forEach((width, i) => {
        if (i > 0) {
          doc.line(xPos, yPos, xPos, yPos + rowHeight);
        }
        xPos += width;
      });

      // Row data
      doc.setTextColor(0, 0, 0);
      xPos = tableStartX;
      
      const totalItems = item.total_items || item.quantity || 0;
      const itemValue = (item.unit_price || 0) * totalItems;
      const rowData = [
        (index + 1).toString(),
        item.name.length > 26 ? item.name.substring(0, 26) + '...' : item.name,
        item.category.length > 18 ? item.category.substring(0, 18) + '...' : item.category,
        formatCurrency(item.unit_price || 0).replace('₱', 'P'),
        item.quantity.toString(),
        totalItems.toString(),
        formatCurrency(itemValue).replace('₱', 'P'),
      ];

      rowData.forEach((text, i) => {
        // Center numeric columns, left-align text columns
        if (i === 0 || i >= 3) {
          const textWidth = doc.getTextWidth(text);
          const cellCenterX = xPos + (colWidths[i] - textWidth) / 2;
          doc.text(text, cellCenterX, yPos + 4.8);
        } else {
          doc.text(text, xPos + 2, yPos + 4.8);
        }
        xPos += colWidths[i];
      });

      yPos += rowHeight;
    });

    // Total row - dark background
    doc.setFillColor(33, 33, 33);
    doc.rect(tableStartX, yPos, tableWidth, rowHeight + 2, 'F');
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.3);
    doc.rect(tableStartX, yPos, tableWidth, rowHeight + 2, 'S');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('TOTAL INVENTORY VALUE:', tableStartX + 4, yPos + 5.5);
    
    const totalText = formatCurrency(filteredTotalValue).replace('₱', 'PHP ');
    doc.text(totalText, tableStartX + tableWidth - 4, yPos + 5.5, { align: 'right' });

    // Footer
    doc.setTextColor(120, 120, 120);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text('Inventory Management System', pageWidth / 2, pageHeight - 8, { align: 'center' });

    // Save the PDF
    doc.save(`Inventory_Report_${new Date().toISOString().split('T')[0]}.pdf`);
    
    toast({
      title: "Success",
      description: "PDF report downloaded successfully",
    });
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex">
          <div className="flex-1 flex flex-col">
            <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-border bg-card px-6 shadow-sm">
              <div className="flex items-center gap-4">
                <SidebarTrigger />
                <h1 className="text-xl font-bold text-foreground">Inventory Management</h1>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={signOut}
                className="gap-2"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </Button>
            </header>

          <main className="flex-1 p-6 overflow-y-auto">
            <div className="max-w-7xl mx-auto space-y-6">
              {/* Total Value Summary Card */}
              <Card className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-primary/20">
                <CardContent className="p-6">
                 <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="h-14 w-14 rounded-2xl bg-primary/20 flex items-center justify-center">
                        <span className="inline-flex items-center justify-center h-7 w-7 text-primary text-5xl font-bold">
  ₱
</span>

                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Total Inventory Value</p>
                        <p className="text-3xl font-bold text-foreground">{formatCurrency(totalValue)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">
                        {filteredItems.length !== items.length && (
                          <>Filtered: <span className="font-semibold text-primary">{formatCurrency(filteredTotalValue)}</span></>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {items.length} items total • {filteredItems.length} shown
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                <div className="relative w-full sm:w-96">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    placeholder="Search inventory..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="flex gap-2 w-full sm:w-auto flex-wrap">
                  <Select value={filterCategory} onValueChange={setFilterCategory}>
                    <SelectTrigger className="w-[140px]">
                      <Filter className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      <SelectItem value="Construction Materials">Construction Materials</SelectItem>
                      <SelectItem value="Safety Equipment">Safety Equipment</SelectItem>
                      <SelectItem value="Tools">Tools</SelectItem>
                      <SelectItem value="Finishing Materials">Finishing Materials</SelectItem>
                      <SelectItem value="Equipment">Equipment</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-[130px]">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="In Stock">In Stock</SelectItem>
                      <SelectItem value="Low Stock">Low Stock</SelectItem>
                      <SelectItem value="Out of Stock">Out of Stock</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={filterCondition} onValueChange={setFilterCondition}>
                    <SelectTrigger className="w-[130px]">
                      <SelectValue placeholder="Condition" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Conditions</SelectItem>
                      <SelectItem value="Brand New">Brand New</SelectItem>
                      <SelectItem value="Good">Good</SelectItem>
                      <SelectItem value="Fair">Fair</SelectItem>
                      <SelectItem value="Defected">Defected</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button 
                    variant="outline" 
                    className="gap-2"
                    onClick={handleDownloadPDF}
                    disabled={filteredItems.length === 0}
                  >
                    <FileDown className="h-4 w-4" />
                    Download PDF
                  </Button>
                  <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                    <DialogTrigger asChild>
                      <Button className="gap-2 bg-primary hover:bg-primary-hover flex-1 sm:flex-initial">
                        <Plus className="h-4 w-4" />
                        Add Item
                      </Button>
                    </DialogTrigger>
   <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col border-border/60 shadow-elegant bg-card !fixed !left-1/2 !top-1/2 !-translate-x-1/2 !-translate-y-1/2">
                      <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/40 bg-muted/30">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-xl bg-gradient-hero flex items-center justify-center shadow-md">
                            <Package className="h-5 w-5 text-primary-foreground" />
                          </div>
                          <div>
                            <DialogTitle className="text-xl font-bold text-foreground">Add New Inventory Item</DialogTitle>
                            <p className="text-xs text-muted-foreground mt-0.5">Fill in the details below</p>
                          </div>
                        </div>
                      </DialogHeader>
                      <div className="space-y-5 px-6 py-5 overflow-y-auto flex-1">
                        <div className="space-y-2">
                          <Label htmlFor="name" className="text-sm font-medium text-foreground">Item Name <span className="text-destructive">*</span></Label>
                          <Input
                            id="name"
                            value={newItem.name}
                            onChange={(e) =>
                              setNewItem({ ...newItem, name: e.target.value })
                            }
                            placeholder="Enter item name"
                            className="h-11 rounded-xl border-border/60 bg-background focus:ring-2 focus:ring-primary/30 transition-all"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="category" className="text-sm font-medium text-foreground">Category <span className="text-destructive">*</span></Label>
                          <Select
                            value={newItem.category}
                            onValueChange={(value) =>
                              setNewItem({ ...newItem, category: value })
                            }
                          >
                            <SelectTrigger className="h-11 rounded-xl border-border/60 bg-background focus:ring-2 focus:ring-primary/30">
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-border/60 shadow-elegant">
                              <SelectItem value="Construction Materials">
                                Construction Materials
                              </SelectItem>
                              <SelectItem value="Safety Equipment">
                                Safety Equipment
                              </SelectItem>
                              <SelectItem value="Tools">Tools</SelectItem>
                              <SelectItem value="Finishing Materials">
                                Finishing Materials
                              </SelectItem>
                              <SelectItem value="Equipment">Equipment</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="quantity" className="text-sm font-medium text-foreground">Quantity</Label>
                            <Input
                              id="quantity"
                              type="number"
                              value={newItem.quantity}
                              onChange={(e) =>
                                setNewItem({
                                  ...newItem,
                                  quantity: parseInt(e.target.value) || 0,
                                })
                              }
                              placeholder="0"
                              className="h-11 rounded-xl border-border/60 bg-background focus:ring-2 focus:ring-primary/30"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="unit_price" className="text-sm font-medium text-foreground">Unit Price</Label>
                            <Input
                              id="unit_price"
                              type="number"
                              step="0.01"
                              value={newItem.unit_price}
                              onChange={(e) =>
                                setNewItem({
                                  ...newItem,
                                  unit_price: parseFloat(e.target.value) || 0,
                                })
                              }
                              placeholder="0.00"
                              className="h-11 rounded-xl border-border/60 bg-background focus:ring-2 focus:ring-primary/30"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="location" className="text-sm font-medium text-foreground">Location <span className="text-destructive">*</span></Label>
                          <Input
                            id="location"
                            value={newItem.location}
                            onChange={(e) =>
                              setNewItem({ ...newItem, location: e.target.value })
                            }
                            placeholder="Warehouse, Storage, etc."
                            className="h-11 rounded-xl border-border/60 bg-background focus:ring-2 focus:ring-primary/30"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="condition" className="text-sm font-medium text-foreground">Item Condition <span className="text-destructive">*</span></Label>
                          <Select
                            value={newItem.condition}
                            onValueChange={(value) =>
                              setNewItem({ ...newItem, condition: value })
                            }
                          >
                            <SelectTrigger className="h-11 rounded-xl border-border/60 bg-background focus:ring-2 focus:ring-primary/30">
                              <SelectValue placeholder="Select condition" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-border/60 shadow-elegant">
                              <SelectItem value="Brand New">Brand New</SelectItem>
                              <SelectItem value="Fair">Fair</SelectItem>
                              <SelectItem value="Defected">Defected</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="description" className="text-sm font-medium text-foreground">Additional Notes</Label>
                          <Textarea
                            id="description"
                            value={newItem.description}
                            onChange={(e) =>
                              setNewItem({ ...newItem, description: e.target.value })
                            }
                            placeholder="Enter any additional details"
                            rows={2}
                            className="rounded-xl border-border/60 bg-background focus:ring-2 focus:ring-primary/30 resize-none"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="image" className="text-sm font-medium text-foreground">Item Image</Label>
                          <div className="flex gap-2">
                            <Input
                              ref={fileInputRef}
                              id="image"
                              type="file"
                              accept="image/*"
                              capture="environment"
                              onChange={(e) => {
                                const file = e.target.files?.[0] || null;
                                setNewItem({ ...newItem, image: file });
                              }}
                              className="flex-1 h-11 rounded-xl border-border/60 bg-background file:bg-primary file:text-primary-foreground file:border-0 file:rounded-lg file:px-3 file:py-1 file:mr-3 file:text-sm file:font-medium"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={handleCameraCapture}
                              className="h-11 w-11 rounded-xl border-border/60 hover:bg-primary/10 hover:border-primary/50"
                            >
                              <Camera className="h-4 w-4" />
                            </Button>
                          </div>
                          {newItem.image && (
                            <p className="text-xs text-muted-foreground bg-muted/50 px-3 py-2 rounded-lg">
                              📎 Selected: {newItem.image.name}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-3 justify-end px-6 pb-6 pt-4 border-t border-border/40 bg-muted/20">
                        <Button
                          variant="outline"
                          onClick={() => setIsAddDialogOpen(false)}
                          className="rounded-xl border-border/60 hover:bg-muted"
                        >
                          Cancel
                        </Button>
                        <Button onClick={handleAddItem} disabled={addItemMutation.isPending} className="rounded-xl bg-gradient-hero shadow-md hover:shadow-lg transition-all">
                          {addItemMutation.isPending ? "Adding..." : "Add Item"}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>

              {/* Edit Dialog */}
              <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                  <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col border-border/60 shadow-elegant bg-card !fixed !left-1/2 !top-1/2 !-translate-x-1/2 !-translate-y-1/2">
                  <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/40 bg-muted/30">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-gradient-hero flex items-center justify-center shadow-md">
                        <Edit className="h-5 w-5 text-primary-foreground" />
                      </div>
                      <div>
                        <DialogTitle className="text-xl font-bold text-foreground">Edit Inventory Item</DialogTitle>
                        <p className="text-xs text-muted-foreground mt-0.5">Update item details</p>
                      </div>
                    </div>
                  </DialogHeader>
                  {editingItem && (
                    <div className="space-y-5 px-6 py-5 overflow-y-auto flex-1">
                      <div className="space-y-2">
                        <Label htmlFor="edit-name" className="text-sm font-medium text-foreground">Item Name <span className="text-destructive">*</span></Label>
                        <Input
                          id="edit-name"
                          value={editingItem.name}
                          onChange={(e) =>
                            setEditingItem({ ...editingItem, name: e.target.value })
                          }
                          className="h-11 rounded-xl border-border/60 bg-background focus:ring-2 focus:ring-primary/30 transition-all"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit-category">Category *</Label>
                        <Select
                          value={editingItem.category}
                          onValueChange={(value) =>
                            setEditingItem({ ...editingItem, category: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Construction Materials">
                              Construction Materials
                            </SelectItem>
                            <SelectItem value="Safety Equipment">
                              Safety Equipment
                            </SelectItem>
                            <SelectItem value="Tools">Tools</SelectItem>
                            <SelectItem value="Finishing Materials">
                              Finishing Materials
                            </SelectItem>
                            <SelectItem value="Equipment">Equipment</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit-quantity">Quantity</Label>
                        <Input
                          id="edit-quantity"
                          type="number"
                          value={editingItem.quantity}
                          onChange={(e) =>
                            setEditingItem({
                              ...editingItem,
                              quantity: parseInt(e.target.value) || 0,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit-location">Location *</Label>
                        <Input
                          id="edit-location"
                          value={editingItem.location}
                          onChange={(e) =>
                            setEditingItem({ ...editingItem, location: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit-condition">Item Condition *</Label>
                        <Select
                          value={editingItem.condition || "Brand New"}
                          onValueChange={(value) =>
                            setEditingItem({ ...editingItem, condition: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select condition" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Brand New">Brand New</SelectItem>
                            <SelectItem value="Good">Good</SelectItem>
                            <SelectItem value="Fair">Fair</SelectItem>
                            <SelectItem value="Defected">Defected</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit-unit-price">Unit Price</Label>
                        <Input
                          id="edit-unit-price"
                          type="number"
                          step="0.01"
                          value={editingItem.unit_price || 0}
                          onChange={(e) =>
                            setEditingItem({
                              ...editingItem,
                              unit_price: parseFloat(e.target.value) || 0,
                            })
                          }
                          placeholder="0.00"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit-description">Description</Label>
                        <Textarea
                          id="edit-description"
                          value={editingItem.description || ""}
                          onChange={(e) =>
                            setEditingItem({ ...editingItem, description: e.target.value })
                          }
                          rows={3}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit-image">Item Image</Label>
                        <Input
                          id="edit-image"
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0] || null;
                            setEditImage(file);
                          }}
                        />
                        {editingItem.image_url && !editImage && (
                          <img src={editingItem.image_url} alt="Current" className="mt-2 h-20 w-20 object-cover rounded" />
                        )}
                      </div>
                    </div>
                  )}
                  <div className="flex gap-2 justify-end px-6 pb-6 pt-4 border-t">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsEditDialogOpen(false);
                        setEditingItem(null);
                        setEditImage(null);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button onClick={handleEditItem} disabled={updateItemMutation.isPending}>
                      {updateItemMutation.isPending ? "Saving..." : "Save Changes"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {isLoading ? (
                  <div className="col-span-full text-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                  </div>
                ) : filteredItems.length === 0 ? (
                  <div className="col-span-full text-center py-12">
                    <Package className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-foreground mb-2">
                      No items found
                    </h3>
                    <p className="text-muted-foreground">
                      Try adjusting your search or add a new item
                    </p>
                  </div>
                ) : (
                  filteredItems.map((item: any) => (
                    <Card key={item.id} className="shadow-card hover:shadow-elegant transition-all group">
                      <div className="aspect-video w-full overflow-hidden rounded-t-lg bg-muted">
                        <img
                          src={item.image_url || inventoryPlaceholder}
                          alt={item.name}
                          className="h-full w-full object-cover transition-transform group-hover:scale-105"
                        />
                      </div>
                      <CardContent className="p-5 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <h3 className="font-semibold text-lg text-foreground mb-1">
                              {item.name}
                            </h3>
                            <div className="flex flex-wrap gap-2 mt-2">
                              {item.condition === "Brand New" && (
                                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800">
                                  Brand New • Day {getDaysSinceAdded(item.created_at)}
                                </Badge>
                              )}
                              {item.condition === "Defected" && (
                                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800">
                                  Defected
                                </Badge>
                              )}
                              {item.condition === "Good" && (
                                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800">
                                  Good
                                </Badge>
                              )}
                              {item.condition === "Fair" && (
                                <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-300 dark:border-yellow-800">
                                  Fair
                                </Badge>
                              )}
                            </div>
                          </div>
                          <Badge className={getStatusColor(item.status)}>
                            {item.status}
                          </Badge>
                        </div>

                        <div className="space-y-3 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Category:</span>
                            <span className="font-medium text-foreground">
                              {item.category}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Current Quantity:</span>
                            <span className="font-medium text-foreground">
                              {item.quantity}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Total Items:</span>
                            <span className="font-medium text-foreground">
                              {item.total_items || item.quantity}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Unit Price:</span>
                            <span className="font-medium text-foreground">
                              {formatCurrency(item.unit_price || 0)}
                            </span>
                          </div>
                          <div className="flex justify-between bg-primary/10 -mx-5 px-5 py-2 rounded">
                            <span className="text-primary font-medium">Item Value:</span>
                            <span className="font-bold text-primary">
                              {formatCurrency((item.unit_price || 0) * (item.quantity || 0))}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-3 pt-2">
                            <div className="space-y-1">
                              <span className="text-muted-foreground text-xs">Add</span>
                              <div className="flex items-center gap-1">
                                <Input
                                  type="number"
                                  min="0"
                                  value={addQuantities[item.id] || 0}
                                  onChange={(e) => setAddQuantities(prev => ({ ...prev, [item.id]: parseInt(e.target.value) || 0 }))}
                                  className="h-9 text-center"
                                />
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-9 w-9 shrink-0"
                                  onClick={() => handleAddQuantity(item.id, item.quantity)}
                                  disabled={updateQuantityMutation.isPending || !addQuantities[item.id]}
                                >
                                  <Plus className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                            <div className="space-y-1">
                              <span className="text-muted-foreground text-xs">Subtract</span>
                              <div className="flex items-center gap-1">
                                <Input
                                  type="number"
                                  min="0"
                                  value={subtractQuantities[item.id] || 0}
                                  onChange={(e) => setSubtractQuantities(prev => ({ ...prev, [item.id]: parseInt(e.target.value) || 0 }))}
                                  className="h-9 text-center"
                                />
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-9 w-9 shrink-0"
                                  onClick={() => handleSubtractQuantity(item.id, item.quantity)}
                                  disabled={updateQuantityMutation.isPending || !subtractQuantities[item.id] || item.quantity === 0}
                                >
                                  <Minus className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                          <div className="flex justify-between pt-1">
                            <span className="text-muted-foreground">Location:</span>
                            <span className="font-medium text-foreground">
                              {item.location}
                            </span>
                          </div>
                        </div>

                        {item.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2 pt-2 border-t border-border">
                            {item.description}
                          </p>
                        )}

                        <div className="flex gap-2 pt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 gap-2"
                            onClick={() => {
                              setEditingItem(item);
                              setIsEditDialogOpen(true);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 gap-2 text-destructive hover:text-destructive"
                            onClick={() => handleDeleteItem(item.id, item.name)}
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>
          </main>
        </div>
      </div>
      </div>
    </SidebarProvider>
  );
};

export default Inventory;
