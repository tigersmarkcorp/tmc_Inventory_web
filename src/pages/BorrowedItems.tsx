import { useState, useRef } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, User, Clock, Package, Plus, Trash2, Camera, Edit } from "lucide-react";
import inventoryPlaceholder from "@/assets/inventory-placeholder.jpg";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
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

const BorrowedItems = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);
  const [editImage, setEditImage] = useState<File | null>(null);
  const [newBorrow, setNewBorrow] = useState({
    item_name: "",
    borrower_name: "",
    borrower_department: "",
    quantity: 1,
    borrow_date: new Date().toISOString().split('T')[0],
    return_date: "",
    description: "",
    image: null as File | null,
    unit_price: 0,
  });

  const { data: borrowedItems = [] } = useQuery({
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

  const addBorrowMutation = useMutation({
    mutationFn: async (borrow: typeof newBorrow) => {
      let imageUrl = null;
      
      // Upload image if provided
      if (borrow.image) {
        const fileExt = borrow.image.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('item-images')
          .upload(filePath, borrow.image);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('item-images')
          .getPublicUrl(filePath);

        imageUrl = publicUrl;
      }

      const { data, error } = await supabase
        .from('borrowed_items')
        .insert([{ 
          item_name: borrow.item_name,
          borrower_name: borrow.borrower_name,
          borrower_department: borrow.borrower_department,
          quantity: borrow.quantity,
          borrow_date: borrow.borrow_date,
          return_date: borrow.return_date,
          description: borrow.description,
          unit_price: borrow.unit_price,
          image_url: imageUrl,
          status: 'Active' 
        }])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['borrowed-items'] });
      queryClient.invalidateQueries({ queryKey: ['borrowed-stats'] });
      toast({
        title: "Success",
        description: "Borrowed item added successfully",
      });
      setIsAddDialogOpen(false);
      setNewBorrow({
        item_name: "",
        borrower_name: "",
        borrower_department: "",
        quantity: 1,
        borrow_date: new Date().toISOString().split('T')[0],
        return_date: "",
        description: "",
        image: null,
        unit_price: 0,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add borrowed item",
        variant: "destructive",
      });
    },
  });

  const markReturnedMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from('borrowed_items')
        .update({ 
          status: 'Returned',
          actual_return_date: new Date().toISOString().split('T')[0]
        })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['borrowed-items'] });
      queryClient.invalidateQueries({ queryKey: ['borrowed-stats'] });
      toast({
        title: "Success",
        description: "Item marked as returned",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to mark item as returned",
        variant: "destructive",
      });
    },
  });

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['borrowed-items'] });
      toast({
        title: "Success",
        description: "Return date extended by 7 days",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to extend borrow period",
        variant: "destructive",
      });
    },
  });

  const updateBorrowMutation = useMutation({
    mutationFn: async ({ id, updates, image }: { id: string; updates: any; image?: File | null }) => {
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
        .from('borrowed_items')
        .update({ 
          item_name: updates.item_name,
          borrower_name: updates.borrower_name,
          borrower_department: updates.borrower_department,
          quantity: updates.quantity,
          borrow_date: updates.borrow_date,
          return_date: updates.return_date,
          description: updates.description,
          unit_price: updates.unit_price,
          image_url: imageUrl,
        })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['borrowed-items'] });
      queryClient.invalidateQueries({ queryKey: ['borrowed-stats'] });
      toast({
        title: "Success",
        description: "Borrowed item updated successfully",
      });
      setIsEditDialogOpen(false);
      setEditingItem(null);
      setEditImage(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update borrowed item",
        variant: "destructive",
      });
    },
  });

  const deleteBorrowMutation = useMutation({
    mutationFn: async (id: string) => {
      // Get the item to find image URL
      const { data: item } = await supabase
        .from('borrowed_items')
        .select('image_url')
        .eq('id', id)
        .single();

      // Delete image from storage if exists
      if (item?.image_url) {
        const imagePath = item.image_url.split('/').pop();
        await supabase.storage.from('item-images').remove([imagePath]);
      }

      const { error } = await supabase
        .from('borrowed_items')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['borrowed-items'] });
      queryClient.invalidateQueries({ queryKey: ['borrowed-stats'] });
      toast({
        title: "Success",
        description: "Borrowed item deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete borrowed item",
        variant: "destructive",
      });
    },
  });

  const handleAddBorrow = () => {
    if (!newBorrow.item_name || !newBorrow.borrower_name || !newBorrow.return_date) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    addBorrowMutation.mutate(newBorrow);
  };

  const handleEditBorrow = () => {
    if (!editingItem) return;

    updateBorrowMutation.mutate({
      id: editingItem.id,
      updates: {
        item_name: editingItem.item_name,
        borrower_name: editingItem.borrower_name,
        borrower_department: editingItem.borrower_department,
        quantity: editingItem.quantity,
        borrow_date: editingItem.borrow_date,
        return_date: editingItem.return_date,
        description: editingItem.description,
        unit_price: editingItem.unit_price,
        image_url: editingItem.image_url,
      },
      image: editImage,
    });
  };

  const handleDeleteBorrow = (id: string) => {
    if (window.confirm("Are you sure you want to delete this borrowed item?")) {
      deleteBorrowMutation.mutate(id);
    }
  };

  const handleCameraCapture = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleEditCameraCapture = () => {
    if (editFileInputRef.current) {
      editFileInputRef.current.click();
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
              <DialogContent className="max-w-md max-h-[90vh] overflow-hidden flex flex-col">
                <DialogHeader className="px-6 pt-6 pb-2">
                  <DialogTitle className="text-2xl">Add Borrowed Item</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 px-6 py-4 overflow-y-auto flex-1">
                  <div className="space-y-2">
                    <Label htmlFor="item_name">Item Name *</Label>
                    <Input
                      id="item_name"
                      value={newBorrow.item_name}
                      onChange={(e) =>
                        setNewBorrow({ ...newBorrow, item_name: e.target.value })
                      }
                      placeholder="Enter item name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="borrower_name">Borrower Name *</Label>
                    <Input
                      id="borrower_name"
                      value={newBorrow.borrower_name}
                      onChange={(e) =>
                        setNewBorrow({ ...newBorrow, borrower_name: e.target.value })
                      }
                      placeholder="Enter borrower name"
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
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="quantity">Quantity</Label>
                    <Input
                      id="quantity"
                      type="number"
                      value={newBorrow.quantity}
                      onChange={(e) =>
                        setNewBorrow({
                          ...newBorrow,
                          quantity: parseInt(e.target.value) || 1,
                        })
                      }
                      min="1"
                    />
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
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="return_date">Return Date *</Label>
                      <Input
                        id="return_date"
                        type="date"
                        value={newBorrow.return_date}
                        onChange={(e) =>
                          setNewBorrow({ ...newBorrow, return_date: e.target.value })
                        }
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="unit_price">Unit Price</Label>
                    <Input
                      id="unit_price"
                      type="number"
                      step="0.01"
                      value={newBorrow.unit_price}
                      onChange={(e) =>
                        setNewBorrow({
                          ...newBorrow,
                          unit_price: parseFloat(e.target.value) || 0,
                        })
                      }
                      placeholder="0.00"
                    />
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
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="image">Item Image</Label>
                    <div className="flex gap-2">
                      <Input
                        ref={fileInputRef}
                        id="image"
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null;
                          setNewBorrow({ ...newBorrow, image: file });
                        }}
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={handleCameraCapture}
                      >
                        <Camera className="h-4 w-4" />
                      </Button>
                    </div>
                    {newBorrow.image && (
                      <p className="text-sm text-muted-foreground">
                        Selected: {newBorrow.image.name}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 justify-end px-6 pb-6 pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => setIsAddDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleAddBorrow} disabled={addBorrowMutation.isPending}>
                    {addBorrowMutation.isPending ? "Adding..." : "Add Borrow"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* Edit Dialog */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
              <DialogContent className="max-w-md max-h-[90vh] overflow-hidden flex flex-col">
                <DialogHeader className="px-6 pt-6 pb-2">
                  <DialogTitle className="text-2xl">Edit Borrowed Item</DialogTitle>
                </DialogHeader>
                {editingItem && (
                  <div className="space-y-4 px-6 py-4 overflow-y-auto flex-1">
                    <div className="space-y-2">
                      <Label htmlFor="edit_item_name">Item Name *</Label>
                      <Input
                        id="edit_item_name"
                        value={editingItem.item_name}
                        onChange={(e) =>
                          setEditingItem({ ...editingItem, item_name: e.target.value })
                        }
                        placeholder="Enter item name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit_borrower_name">Borrower Name *</Label>
                      <Input
                        id="edit_borrower_name"
                        value={editingItem.borrower_name}
                        onChange={(e) =>
                          setEditingItem({ ...editingItem, borrower_name: e.target.value })
                        }
                        placeholder="Enter borrower name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit_borrower_department">Department</Label>
                      <Input
                        id="edit_borrower_department"
                        value={editingItem.borrower_department || ""}
                        onChange={(e) =>
                          setEditingItem({ ...editingItem, borrower_department: e.target.value })
                        }
                        placeholder="Enter department"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit_quantity">Quantity</Label>
                      <Input
                        id="edit_quantity"
                        type="number"
                        value={editingItem.quantity}
                        onChange={(e) =>
                          setEditingItem({
                            ...editingItem,
                            quantity: parseInt(e.target.value) || 1,
                          })
                        }
                        min="1"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="edit_borrow_date">Borrow Date</Label>
                        <Input
                          id="edit_borrow_date"
                          type="date"
                          value={editingItem.borrow_date}
                          onChange={(e) =>
                            setEditingItem({ ...editingItem, borrow_date: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit_return_date">Return Date *</Label>
                        <Input
                          id="edit_return_date"
                          type="date"
                          value={editingItem.return_date}
                          onChange={(e) =>
                            setEditingItem({ ...editingItem, return_date: e.target.value })
                          }
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit_unit_price">Unit Price</Label>
                      <Input
                        id="edit_unit_price"
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
                      <Label htmlFor="edit_description">Notes</Label>
                      <Textarea
                        id="edit_description"
                        value={editingItem.description || ""}
                        onChange={(e) =>
                          setEditingItem({ ...editingItem, description: e.target.value })
                        }
                        placeholder="Enter any additional information"
                        rows={2}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit_image">Item Image</Label>
                      <div className="flex gap-2">
                        <Input
                          ref={editFileInputRef}
                          id="edit_image"
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={(e) => {
                            const file = e.target.files?.[0] || null;
                            setEditImage(file);
                          }}
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={handleEditCameraCapture}
                        >
                          <Camera className="h-4 w-4" />
                        </Button>
                      </div>
                      {editImage && (
                        <p className="text-sm text-muted-foreground">
                          New image: {editImage.name}
                        </p>
                      )}
                      {!editImage && editingItem.image_url && (
                        <p className="text-sm text-muted-foreground">
                          Current image uploaded
                        </p>
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
                  <Button onClick={handleEditBorrow} disabled={updateBorrowMutation.isPending}>
                    {updateBorrowMutation.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </header>

          <main className="flex-1 p-6">
            <div className="max-w-7xl mx-auto space-y-6">
              <div className="bg-gradient-hero rounded-xl p-6 text-primary-foreground shadow-elegant">
                <h2 className="text-2xl font-bold mb-2">
                  Track All Borrowed Items
                </h2>
                <p className="text-primary-foreground/90">
                  Monitor equipment and materials borrowed by employees and contractors
                </p>
              </div>

              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {borrowedItems.map((item: any) => (
                  <Card key={item.id} className="shadow-card hover:shadow-elegant transition-shadow overflow-hidden">
                    <div className="relative h-48 w-full overflow-hidden bg-muted">
                      <img
                        src={item.image_url || inventoryPlaceholder}
                        alt={item.item_name}
                        className="h-full w-full object-cover"
                      />
                      <Badge className={`absolute top-2 right-2 ${getStatusColor(item.status)}`}>
                        {item.status}
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
                        {item.status !== 'Returned' && (
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
                            setEditingItem(item);
                            setIsEditDialogOpen(true);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDeleteBorrow(item.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {borrowedItems.length === 0 && (
                <div className="text-center py-12">
                  <Package className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    No borrowed items
                  </h3>
                  <p className="text-muted-foreground">
                    Start by adding a borrowed item
                  </p>
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default BorrowedItems;
