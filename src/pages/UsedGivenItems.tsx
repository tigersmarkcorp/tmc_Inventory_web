import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { Plus, Search, Gift, Wrench, Calendar, User, Building, Trash2, Edit } from "lucide-react";
import { format } from "date-fns";

interface UsedGivenItem {
  id: string;
  item_id: string | null;
  item_name: string;
  quantity: number;
  type: "used" | "given";
  recipient_name: string | null;
  recipient_department: string | null;
  reason: string | null;
  date: string;
  image_url: string | null;
  unit_price: number | null;
  description: string | null;
  created_at: string;
}

interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  image_url: string | null;
  unit_price: number | null;
}

export default function UsedGivenItems() {
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedInventoryItem, setSelectedInventoryItem] = useState<string>("");
  const [editingItem, setEditingItem] = useState<UsedGivenItem | null>(null);
  const [formData, setFormData] = useState({
    quantity: 1,
    type: "used" as "used" | "given",
    recipient_name: "",
    recipient_department: "",
    reason: "",
    date: format(new Date(), "yyyy-MM-dd"),
  });

  const { toast } = useToast();
  const { userRole } = useAuth();
  const { logActivity } = useActivityLog();
  const queryClient = useQueryClient();

  const canModify = userRole === "superadmin" || userRole === "admin";

  // Fetch used/given items
  const { data: usedGivenItems = [], isLoading } = useQuery({
    queryKey: ["used-given-items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("used_given_items")
        .select("*")
        .order("date", { ascending: false });
      if (error) throw error;
      return data as UsedGivenItem[];
    },
  });

  // Fetch inventory items for selection
  const { data: inventoryItems = [] } = useQuery({
    queryKey: ["inventory-items-for-selection"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_items")
        .select("id, name, quantity, image_url, unit_price")
        .gt("quantity", 0)
        .order("name");
      if (error) throw error;
      return data as InventoryItem[];
    },
  });

  // Add used/given item mutation
  const addMutation = useMutation({
    mutationFn: async (data: typeof formData & { item_id: string }) => {
      const inventoryItem = inventoryItems.find((i) => i.id === data.item_id);
      if (!inventoryItem) throw new Error("Item not found");

      if (data.quantity > inventoryItem.quantity) {
        throw new Error(`Only ${inventoryItem.quantity} items available`);
      }

      // Insert record
      const { data: insertedData, error: insertError } = await supabase
        .from("used_given_items")
        .insert({
          item_id: data.item_id,
          item_name: inventoryItem.name,
          quantity: data.quantity,
          type: data.type,
          recipient_name: data.recipient_name || null,
          recipient_department: data.recipient_department || null,
          reason: data.reason || null,
          date: data.date,
          image_url: inventoryItem.image_url,
          unit_price: inventoryItem.unit_price,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Update inventory quantity
      const { error: updateError } = await supabase
        .from("inventory_items")
        .update({ quantity: inventoryItem.quantity - data.quantity })
        .eq("id", data.item_id);

      if (updateError) throw updateError;

      return insertedData;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["used-given-items"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-items-for-selection"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      logActivity(
        data.type === "used" ? "ITEM_USED" : "ITEM_GIVEN",
        `${data.type === "used" ? "Used" : "Gave"} ${data.quantity} ${data.item_name}`,
        "used_given_items",
        data.id
      );
      toast({
        title: "Success",
        description: `Item ${data.type === "used" ? "used" : "given"} successfully`,
      });
      setIsAddDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (item: UsedGivenItem) => {
      // Return quantity to inventory if item still exists
      if (item.item_id) {
        const { data: inventoryItem } = await supabase
          .from("inventory_items")
          .select("quantity")
          .eq("id", item.item_id)
          .maybeSingle();

        if (inventoryItem) {
          await supabase
            .from("inventory_items")
            .update({ quantity: inventoryItem.quantity + item.quantity })
            .eq("id", item.item_id);
        }
      }

      const { error } = await supabase
        .from("used_given_items")
        .delete()
        .eq("id", item.id);

      if (error) throw error;
      return item;
    },
    onSuccess: (item) => {
      queryClient.invalidateQueries({ queryKey: ["used-given-items"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-items-for-selection"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      logActivity(
        "ITEM_RESTORED",
        `Restored ${item.quantity} ${item.item_name} to inventory`,
        "used_given_items",
        item.id
      );
      toast({
        title: "Success",
        description: "Record deleted and quantity restored to inventory",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete record",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setSelectedInventoryItem("");
    setFormData({
      quantity: 1,
      type: "used",
      recipient_name: "",
      recipient_department: "",
      reason: "",
      date: format(new Date(), "yyyy-MM-dd"),
    });
  };

  const handleSubmit = () => {
    if (!selectedInventoryItem) {
      toast({
        title: "Error",
        description: "Please select an item",
        variant: "destructive",
      });
      return;
    }
    addMutation.mutate({ ...formData, item_id: selectedInventoryItem });
  };

  const filteredItems = usedGivenItems.filter((item) => {
    const matchesSearch =
      item.item_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.recipient_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.recipient_department?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === "all" || item.type === typeFilter;
    return matchesSearch && matchesType;
  });

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <main className="flex-1 p-6 overflow-auto">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <SidebarTrigger />
                <div>
                  <h1 className="text-2xl font-bold text-foreground">Used / Given Items</h1>
                  <p className="text-muted-foreground text-sm">
                    Track items used or given away from inventory
                  </p>
                </div>
              </div>

              {canModify && (
                <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="gap-2">
                      <Plus className="h-4 w-4" />
                      Record Usage
                    </Button>
                  </DialogTrigger>
                    <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col border-border/60 shadow-elegant bg-card !fixed !left-1/2 !top-1/2 !-translate-x-1/2 !-translate-y-1/2">
                    <DialogHeader>
                      <DialogTitle>Record Item Usage</DialogTitle>
                      <DialogDescription>
                        Record an item as used or given from inventory.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                      <div className="space-y-2">
                        <Label>Select Item *</Label>
                        <Select
                          value={selectedInventoryItem}
                          onValueChange={setSelectedInventoryItem}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Choose an item" />
                          </SelectTrigger>
                          <SelectContent>
                            {inventoryItems.map((item) => (
                              <SelectItem key={item.id} value={item.id}>
                                {item.name} ({item.quantity} available)
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Quantity *</Label>
                          <Input
                            type="number"
                            min={1}
                            value={formData.quantity}
                            onChange={(e) =>
                              setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Type *</Label>
                          <Select
                            value={formData.type}
                            onValueChange={(v: "used" | "given") =>
                              setFormData({ ...formData, type: v })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="used">Used</SelectItem>
                              <SelectItem value="given">Given</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Date *</Label>
                        <Input
                          type="date"
                          value={formData.date}
                          onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                        />
                      </div>

                      {formData.type === "given" && (
                        <>
                          <div className="space-y-2">
                            <Label>Recipient Name</Label>
                            <Input
                              value={formData.recipient_name}
                              onChange={(e) =>
                                setFormData({ ...formData, recipient_name: e.target.value })
                              }
                              placeholder="Who received the item?"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Recipient Department</Label>
                            <Input
                              value={formData.recipient_department}
                              onChange={(e) =>
                                setFormData({ ...formData, recipient_department: e.target.value })
                              }
                              placeholder="Department"
                            />
                          </div>
                        </>
                      )}

                      <div className="space-y-2">
                        <Label>Reason / Notes</Label>
                        <Textarea
                          value={formData.reason}
                          onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                          placeholder="Why was this item used or given?"
                        />
                      </div>

                      <div className="flex justify-end gap-2 pt-4">
                        <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button onClick={handleSubmit} disabled={addMutation.isPending}>
                          {addMutation.isPending ? "Saving..." : "Save Record"}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search items, recipients..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="used">Used</SelectItem>
                  <SelectItem value="given">Given</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Items Grid */}
            {isLoading ? (
              <div className="text-center py-12 text-muted-foreground">Loading...</div>
            ) : filteredItems.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No records found. Start by recording item usage.
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredItems.map((item) => (
                  <Card key={item.id} className="overflow-hidden">
                    <div className="aspect-video relative bg-muted">
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.item_name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          {item.type === "used" ? (
                            <Wrench className="h-12 w-12 text-muted-foreground/50" />
                          ) : (
                            <Gift className="h-12 w-12 text-muted-foreground/50" />
                          )}
                        </div>
                      )}
                      <Badge
                        className="absolute top-2 right-2"
                        variant={item.type === "used" ? "secondary" : "default"}
                      >
                        {item.type === "used" ? "Used" : "Given"}
                      </Badge>
                    </div>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg">{item.item_name}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        Quantity: {item.quantity}
                        {item.unit_price && ` • ₱${item.unit_price.toLocaleString()}`}
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        {format(new Date(item.date), "MMM dd, yyyy")}
                      </div>
                      {item.recipient_name && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <User className="h-4 w-4" />
                          {item.recipient_name}
                        </div>
                      )}
                      {item.recipient_department && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Building className="h-4 w-4" />
                          {item.recipient_department}
                        </div>
                      )}
                      {item.reason && (
                        <p className="text-sm text-muted-foreground line-clamp-2">{item.reason}</p>
                      )}
                      {canModify && (
                        <div className="flex justify-end pt-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => deleteMutation.mutate(item)}
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Delete & Restore
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
