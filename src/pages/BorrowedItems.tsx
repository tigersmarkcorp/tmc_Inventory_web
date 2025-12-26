import { useState, useRef } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, User, Clock, Package, Plus, Trash2, Edit } from "lucide-react";
import inventoryPlaceholder from "@/assets/inventory-placeholder.jpg";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useActivityLog } from "@/hooks/useActivityLog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const BorrowedItems = () => {
  const { toast } = useToast();
  const { logActivity } = useActivityLog();
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);
  const [editImage, setEditImage] = useState<File | null>(null);

  const [newBorrow, setNewBorrow] = useState({
    item_id: "",
    borrower_name: "",
    borrower_department: "",
    quantity: 1,
    borrow_date: new Date().toISOString().split('T')[0],
    return_date: "",
    description: "",
  });

  // Fetch borrowed items
  const { data: borrowedItems = [], isLoading: borrowedLoading } = useQuery({
    queryKey: ['borrowed-items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('borrowed_items')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch inventory items for selection
  const { data: inventoryItems = [], isLoading: inventoryLoading } = useQuery({
    queryKey: ['inventory-items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('id, name, quantity, image_url, category')
        .gte('quantity', 1)
        .order('name', { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
  });

  // Add Borrow Mutation
  const addBorrowMutation = useMutation({
    mutationFn: async (borrow: typeof newBorrow) => {
      const selectedItem = inventoryItems.find(i => i.id === borrow.item_id);
      if (!selectedItem) {
        throw new Error("Selected inventory item not found");
      }

      const { data: borrowData, error: insertError } = await supabase
        .from('borrowed_items')
        .insert([{
          item_id: selectedItem.id,
          item_name: selectedItem.name,
          borrower_name: borrow.borrower_name,
          borrower_department: borrow.borrower_department,
          quantity: borrow.quantity,
          borrow_date: borrow.borrow_date,
          return_date: borrow.return_date,
          description: borrow.description,
          image_url: selectedItem.image_url,
          status: 'Active',
          unit_price: 0,
        }])
        .select()
        .single();

      if (insertError) throw insertError;

      const newQty = selectedItem.quantity - borrow.quantity;
      const { error: updateError } = await supabase
        .from('inventory_items')
        .update({
          quantity: newQty,
          status: newQty === 0
            ? "Out of Stock"
            : newQty < 30
              ? "Low Stock"
              : "In Stock"
        })
        .eq('id', selectedItem.id);

      if (updateError) {
        await supabase.from('borrowed_items').delete().eq('id', borrowData.id);
        throw updateError;
      }

      return borrowData;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['borrowed-items'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      queryClient.invalidateQueries({ queryKey: ['borrowed-stats'] });
      logActivity('ADD', `Borrowed: ${data.item_name} (x${data.quantity})`, 'borrowed_items', data.id);
      toast({ title: "Success", description: "Item borrowed successfully" });
      setIsAddDialogOpen(false);
      setNewBorrow({
        item_id: "",
        borrower_name: "",
        borrower_department: "",
        quantity: 1,
        borrow_date: new Date().toISOString().split('T')[0],
        return_date: "",
        description: "",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to borrow item",
        variant: "destructive",
      });
    },
  });

  // ✅ FIXED: Restore inventory BEFORE marking as returned
  const markReturnedMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data: item, error: fetchError } = await supabase
        .from('borrowed_items')
        .select('item_id, quantity, item_name')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      // ✅ FIRST: Restore inventory
      if (item?.item_id) {
        const { error: restoreError } = await supabase.rpc('restore_borrowed_quantity', {
          item_id: item.item_id,
          qty_to_add: item.quantity
        });

        if (restoreError) {
          throw new Error(`Failed to restore inventory: ${restoreError.message}`);
        }
      }

      // ✅ THEN: Mark as returned
      const { data, error: updateError } = await supabase
        .from('borrowed_items')
        .update({
          status: 'Returned',
          actual_return_date: new Date().toISOString().split('T')[0]
        })
        .eq('id', id)
        .select()
        .single();

      if (updateError) throw updateError;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['borrowed-items'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      logActivity('UPDATE', `Returned: ${data.item_name}`, 'borrowed_items', data.id);
      toast({ title: "Success", description: "Item marked as returned" });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to mark as returned",
        variant: "destructive",
      });
    },
  });

  // Extend Borrow
  const extendBorrowMutation = useMutation({
    mutationFn: async (id: string) => {
      const item = borrowedItems.find((b: any) => b.id === id);
      if (!item) throw new Error("Item not found");

      const currentReturnDate = new Date(item.return_date);
      const newReturnDate = new Date(currentReturnDate);
      newReturnDate.setDate(newReturnDate.getDate() + 7);

      const { data, error } = await supabase
        .from('borrowed_items')
        .update({ return_date: newReturnDate.toISOString().split('T')[0] })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['borrowed-items'] });
      logActivity('UPDATE', `Extended return for: ${data.item_name}`, 'borrowed_items', data.id);
      toast({ title: "Success", description: "Return date extended by 7 days" });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to extend borrow period",
        variant: "destructive",
      });
    },
  });

  // ✅ FIXED: Restore inventory BEFORE deleting borrowed record
  const deleteBorrowMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data: item } = await supabase
        .from('borrowed_items')
        .select('item_id, quantity, item_name, image_url')
        .eq('id', id)
        .single();

      // ✅ FIRST: Restore inventory
      if (item?.item_id) {
        const { error: restoreError } = await supabase.rpc('restore_borrowed_quantity', {
          item_id: item.item_id,
          qty_to_add: item.quantity
        });

        if (restoreError) {
          console.error("Failed to restore inventory:", restoreError);
          throw new Error("Failed to restore inventory");
        }
      }

      // ✅ THEN: Clean up image (if any)
      if (item?.image_url && item.image_url.includes('item-images')) {
        const imagePath = item.image_url.split('/').pop();
        await supabase.storage.from('item-images').remove([imagePath]);
      }

      // ✅ THEN: Delete borrowed record
      const { error: deleteError } = await supabase
        .from('borrowed_items')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;

      return item;
    },
    onSuccess: (item) => {
      queryClient.invalidateQueries({ queryKey: ['borrowed-items'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      if (item) {
        logActivity('DELETE', `Deleted borrowed item: ${item.item_name}`, 'borrowed_items', item.id);
      }
      toast({ title: "Success", description: "Borrowed item deleted" });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete borrowed item",
        variant: "destructive",
      });
    },
  });

  // Update Borrow
  const updateBorrowMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const { data, error } = await supabase
        .from('borrowed_items')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['borrowed-items'] });
      logActivity('UPDATE', `Updated borrow: ${data.item_name}`, 'borrowed_items', data.id);
      toast({ title: "Success", description: "Borrow updated" });
      setIsEditDialogOpen(false);
      setEditingItem(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update borrow",
        variant: "destructive",
      });
    },
  });

  const handleAddBorrow = () => {
    const selectedItem = inventoryItems.find(i => i.id === newBorrow.item_id);
    
    if (!newBorrow.item_id || !newBorrow.borrower_name || !newBorrow.return_date) {
      toast({ title: "Error", description: "Please fill all required fields", variant: "destructive" });
      return;
    }
    if (newBorrow.quantity <= 0) {
      toast({ title: "Error", description: "Quantity must be at least 1", variant: "destructive" });
      return;
    }
    if (selectedItem && newBorrow.quantity > selectedItem.quantity) {
      toast({
        title: "Error",
        description: `Only ${selectedItem.quantity} available.`,
        variant: "destructive"
      });
      return;
    }
    if (new Date(newBorrow.return_date) <= new Date(newBorrow.borrow_date)) {
      toast({ title: "Error", description: "Return date must be after borrow date", variant: "destructive" });
      return;
    }

    addBorrowMutation.mutate(newBorrow);
  };

  const handleEditBorrow = () => {
    if (!editingItem) return;

    if (!editingItem.borrower_name || !editingItem.return_date) {
      toast({ title: "Error", description: "Borrower name and return date are required", variant: "destructive" });
      return;
    }
    if (new Date(editingItem.return_date) <= new Date(editingItem.borrow_date)) {
      toast({ title: "Error", description: "Return date must be after borrow date", variant: "destructive" });
      return;
    }
    if (editingItem.quantity <= 0) {
      toast({ title: "Error", description: "Quantity must be at least 1", variant: "destructive" });
      return;
    }

    updateBorrowMutation.mutate({
      id: editingItem.id,
      updates: {
        borrower_name: editingItem.borrower_name,
        borrower_department: editingItem.borrower_department,
        quantity: editingItem.quantity,
        borrow_date: editingItem.borrow_date,
        return_date: editingItem.return_date,
        description: editingItem.description,
      }
    });
  };

  const handleDeleteBorrow = (id: string, itemName: string) => {
    if (window.confirm(`Delete borrowed record for "${itemName}"? Inventory will be restored.`)) {
      deleteBorrowMutation.mutate(id);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Active":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "Overdue":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      case "Returned":
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  };

  const computeStatus = (item: any) => {
    if (item.status === 'Returned') return 'Returned';
    const returnDate = new Date(item.return_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    returnDate.setHours(0, 0, 0, 0);
    return returnDate < today ? 'Overdue' : 'Active';
  };

  const selectedItem = inventoryItems.find(i => i.id === newBorrow.item_id);
  const maxQuantity = selectedItem ? selectedItem.quantity : 0;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-border bg-card px-6 shadow-sm">
            <div className="flex items-center gap-4">
              <SidebarTrigger />
              <h1 className="text-xl font-bold text-foreground">Borrowed Items</h1>
            </div>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Borrow
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col border-border/60 shadow-elegant bg-card !fixed !left-1/2 !top-1/2 !-translate-x-1/2 !-translate-y-1/2">
                <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/40 bg-muted/30">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-gradient-hero flex items-center justify-center shadow-md">
                      <Package className="h-5 w-5 text-primary-foreground" />
                    </div>
                    <div>
                      <DialogTitle className="text-xl font-bold text-foreground">Add Borrowed Item</DialogTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">Select from available inventory</p>
                    </div>
                  </div>
                </DialogHeader>
                <div className="space-y-5 px-6 py-5 overflow-y-auto flex-1">
                  <div className="space-y-2">
                    <Label htmlFor="inventory_item" className="text-sm font-medium text-foreground">
                      Select Inventory Item <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={newBorrow.item_id}
                      onValueChange={(value) => {
                        const item = inventoryItems.find(i => i.id === value);
                        setNewBorrow({
                          ...newBorrow,
                          item_id: value,
                          quantity: item ? Math.min(1, item.quantity) : 1,
                        });
                      }}
                    >
                      <SelectTrigger className="h-11 rounded-xl border-border/60 bg-background focus:ring-2 focus:ring-primary/30">
                        <SelectValue placeholder="Choose an item" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-border/60 shadow-elegant max-h-60">
                        {inventoryLoading ? (
                          <SelectItem value="" disabled>Loading items...</SelectItem>
                        ) : inventoryItems.length === 0 ? (
                          <SelectItem value="" disabled>No items in stock</SelectItem>
                        ) : (
                          inventoryItems.map((item: any) => (
                            <SelectItem key={item.id} value={item.id} className="py-2">
                              <div className="flex justify-between w-full">
                                <span>{item.name}</span>
                                <Badge variant="secondary" className="ml-2">
                                  Qty: {item.quantity}
                                </Badge>
                              </div>
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="borrower_name">Borrower Name <span className="text-destructive">*</span></Label>
                      <Input
                        id="borrower_name"
                        value={newBorrow.borrower_name}
                        onChange={(e) =>
                          setNewBorrow({ ...newBorrow, borrower_name: e.target.value })
                        }
                        placeholder="Enter name"
                        className="h-11 rounded-xl border-border/60 bg-background focus:ring-2 focus:ring-primary/30"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="borrower_department">Department</Label>
                      <Input
                        id="borrower_department"
                        value={newBorrow.borrower_department}
                        onChange={(e) =>
                          setNewBorrow({ ...newBorrow, borrower_department: e.target.value })
                        }
                        placeholder="Enter department"
                        className="h-11 rounded-xl border-border/60 bg-background focus:ring-2 focus:ring-primary/30"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="quantity">Quantity <span className="text-destructive">*</span></Label>
                      <Input
                        id="quantity"
                        type="number"
                        min="1"
                        max={maxQuantity || 1}
                        value={newBorrow.quantity}
                        onChange={(e) =>
                          setNewBorrow({
                            ...newBorrow,
                            quantity: Math.min(maxQuantity, parseInt(e.target.value) || 1),
                          })
                        }
                        className="h-11 rounded-xl border-border/60 bg-background focus:ring-2 focus:ring-primary/30"
                      />
                      {selectedItem && (
                        <p className="text-xs text-muted-foreground">
                          Available: {selectedItem.quantity}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="borrow_date">Borrow Date</Label>
                      <Input
                        id="borrow_date"
                        type="date"
                        value={newBorrow.borrow_date}
                        onChange={(e) =>
                          setNewBorrow({ ...newBorrow, borrow_date: e.target.value })
                        }
                        className="h-11 rounded-xl border-border/60 bg-background focus:ring-2 focus:ring-primary/30"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="return_date">Return Date <span className="text-destructive">*</span></Label>
                      <Input
                        id="return_date"
                        type="date"
                        value={newBorrow.return_date}
                        onChange={(e) =>
                          setNewBorrow({ ...newBorrow, return_date: e.target.value })
                        }
                        className="h-11 rounded-xl border-border/60 bg-background focus:ring-2 focus:ring-primary/30"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Notes</Label>
                    <Textarea
                      id="description"
                      value={newBorrow.description}
                      onChange={(e) =>
                        setNewBorrow({ ...newBorrow, description: e.target.value })
                      }
                      placeholder="Enter any additional information"
                      rows={2}
                      className="rounded-xl border-border/60 bg-background focus:ring-2 focus:ring-primary/30 resize-none"
                    />
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
                  <Button
                    onClick={handleAddBorrow}
                    disabled={addBorrowMutation.isPending || !newBorrow.item_id}
                    className="rounded-xl bg-gradient-hero shadow-md hover:shadow-lg transition-all"
                  >
                    {addBorrowMutation.isPending ? "Borrowing..." : "Add Borrow"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </header>

          <main className="flex-1 p-6">
            <div className="max-w-7xl mx-auto space-y-6">
              <div className="bg-gradient-hero rounded-xl p-6 text-primary-foreground shadow-elegant">
                <h2 className="text-2xl font-bold mb-2">Track Borrowed Inventory</h2>
                <p className="text-primary-foreground/90">
                  All borrowed items are deducted from live inventory stock
                </p>
              </div>

              {borrowedLoading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                </div>
              ) : borrowedItems.length === 0 ? (
                <div className="text-center py-12">
                  <Package className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">No borrowed items</h3>
                  <p className="text-muted-foreground">Start by adding a borrowed item</p>
                </div>
              ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {borrowedItems.map((item: any) => {
                    const displayStatus = computeStatus(item);
                    return (
                      <Card key={item.id} className="shadow-card hover:shadow-elegant transition-shadow overflow-hidden">
                        <div className="relative h-48 w-full overflow-hidden bg-muted">
                          <img
                            src={item.image_url || inventoryPlaceholder}
                            alt={item.item_name}
                            className="h-full w-full object-cover"
                          />
                          <Badge className={`absolute top-2 right-2 ${getStatusColor(displayStatus)}`}>
                            {displayStatus}
                          </Badge>
                        </div>
                        <CardHeader>
                          <CardTitle className="text-lg text-foreground">{item.item_name}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {item.description && (
                            <p className="text-sm text-muted-foreground">{item.description}</p>
                          )}
                          
                          <div className="flex items-center gap-2 text-sm">
                            <User className="h-4 w-4 text-primary" />
                            <span className="font-medium text-foreground">Borrower:</span>
                            <span className="text-muted-foreground">{item.borrower_name}</span>
                          </div>

                          {item.borrower_department && (
                            <div className="flex items-center gap-2 text-sm">
                              <span className="font-medium text-foreground">Department:</span>
                              <span className="text-muted-foreground">{item.borrower_department}</span>
                            </div>
                          )}

                          <div className="flex items-center gap-2 text-sm">
                            <Package className="h-4 w-4 text-primary" />
                            <span className="font-medium text-foreground">Quantity:</span>
                            <span className="text-muted-foreground">{item.quantity}</span>
                          </div>

                          <div className="flex items-center gap-2 text-sm">
                            <Calendar className="h-4 w-4 text-primary" />
                            <span className="font-medium text-foreground">Borrowed:</span>
                            <span className="text-muted-foreground">{item.borrow_date}</span>
                          </div>

                          <div className="flex items-center gap-2 text-sm">
                            <Clock className="h-4 w-4 text-primary" />
                            <span className="font-medium text-foreground">Return By:</span>
                            <span className="text-muted-foreground">{item.return_date}</span>
                          </div>

                          <div className="pt-3 flex flex-wrap gap-2">
                            {displayStatus !== 'Returned' && (
                              <>
                                <Button
                                  size="sm"
                                  className="flex-1 min-w-[100px]"
                                  onClick={() => markReturnedMutation.mutate(item.id)}
                                  disabled={markReturnedMutation.isPending}
                                >
                                  Mark Returned
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="flex-1 min-w-[100px]"
                                  onClick={() => extendBorrowMutation.mutate(item.id)}
                                  disabled={extendBorrowMutation.isPending}
                                >
                                  Extend
                                </Button>
                              </>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingItem({ ...item });
                                setIsEditDialogOpen(true);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-destructive hover:text-destructive"
                              onClick={() => handleDeleteBorrow(item.id, item.item_name)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </main>

          {/* Edit Dialog */}
          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col border-border/60 shadow-elegant bg-card !fixed !left-1/2 !top-1/2 !-translate-x-1/2 !-translate-y-1/2">
              <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/40 bg-muted/30">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-gradient-hero flex items-center justify-center shadow-md">
                    <Edit className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <DialogTitle className="text-xl font-bold text-foreground">Edit Borrowed Item</DialogTitle>
                </div>
              </DialogHeader>

              {editingItem && (
                <div className="space-y-5 px-6 py-5 flex-1 overflow-y-auto">
                  <div className="flex items-center gap-4 bg-muted/50 p-4 rounded-xl">
                    <img
                      src={editingItem.image_url || inventoryPlaceholder}
                      alt={editingItem.item_name}
                      className="h-20 w-20 object-cover rounded-lg"
                    />
                    <div>
                      <h4 className="font-semibold text-foreground">{editingItem.item_name}</h4>
                      <p className="text-sm text-muted-foreground">Borrowed Quantity: {editingItem.quantity}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Borrower Name <span className="text-destructive">*</span></Label>
                      <Input
                        value={editingItem.borrower_name}
                        onChange={(e) => setEditingItem({ ...editingItem, borrower_name: e.target.value })}
                        className="h-11 rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Department</Label>
                      <Input
                        value={editingItem.borrower_department || ""}
                        onChange={(e) => setEditingItem({ ...editingItem, borrower_department: e.target.value })}
                        className="h-11 rounded-xl"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Quantity</Label>
                    <Input
                      type="number"
                      min="1"
                      value={editingItem.quantity}
                      onChange={(e) => setEditingItem({ ...editingItem, quantity: parseInt(e.target.value) || 1 })}
                      className="h-11 rounded-xl"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Borrow Date</Label>
                      <Input
                        type="date"
                        value={editingItem.borrow_date}
                        onChange={(e) => setEditingItem({ ...editingItem, borrow_date: e.target.value })}
                        className="h-11 rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Return Date <span className="text-destructive">*</span></Label>
                      <Input
                        type="date"
                        value={editingItem.return_date}
                        onChange={(e) => setEditingItem({ ...editingItem, return_date: e.target.value })}
                        className="h-11 rounded-xl"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Notes</Label>
                    <Textarea
                      value={editingItem.description || ""}
                      onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })}
                      rows={3}
                      className="rounded-xl resize-none"
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-3 justify-end px-6 pb-6 pt-4 border-t border-border/40 bg-muted/20">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsEditDialogOpen(false);
                    setEditingItem(null);
                  }}
                  className="rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleEditBorrow}
                  disabled={updateBorrowMutation.isPending}
                  className="rounded-xl bg-gradient-hero shadow-md hover:shadow-lg transition-all"
                >
                  {updateBorrowMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </DialogContent>  
          </Dialog>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default BorrowedItems;
