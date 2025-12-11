import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AlertCircle, Trash2, Package } from "lucide-react";
import { toast } from "sonner";

const DefectedItems = () => {
  const queryClient = useQueryClient();

  const { data: defectedItems = [], isLoading } = useQuery({
    queryKey: ['defected-items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('condition', 'Defected')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('inventory_items')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['defected-items'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-stats'] });
      toast.success("Defected item removed successfully");
    },
    onError: (error) => {
      toast.error("Failed to remove item: " + error.message);
    },
  });

  const totalDefectedValue = defectedItems.reduce((sum, item) => 
    sum + (item.quantity * (item.unit_price || 0)), 0
  );

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-border bg-card px-6 shadow-sm">
            <div className="flex items-center gap-4">
              <SidebarTrigger />
              <h1 className="text-xl font-bold text-foreground">Defected Items</h1>
            </div>
            <Badge variant="destructive" className="text-sm">
              {defectedItems.length} Defected Items
            </Badge>
          </header>

          <main className="flex-1 p-6 space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Defected</CardTitle>
                  <AlertCircle className="h-4 w-4 text-destructive" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{defectedItems.length}</div>
                  <p className="text-xs text-muted-foreground">Items marked as defected</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Quantity</CardTitle>
                  <Package className="h-4 w-4 text-destructive" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {defectedItems.reduce((sum, item) => sum + item.quantity, 0)}
                  </div>
                  <p className="text-xs text-muted-foreground">Defected units</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Value</CardTitle>
                  <AlertCircle className="h-4 w-4 text-destructive" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">₱{totalDefectedValue.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">Lost value</p>
                </CardContent>
              </Card>
            </div>

            {isLoading ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Loading defected items...</p>
              </div>
            ) : defectedItems.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-lg font-medium text-foreground">No Defected Items</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    All items are in good condition
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {defectedItems.map((item) => (
                  <Card key={item.id} className="border-destructive/20">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg">{item.name}</CardTitle>
                          <Badge variant="destructive" className="mt-2">
                            Defected
                          </Badge>
                        </div>
                        {item.image_url && (
                          <img 
                            src={item.image_url} 
                            alt={item.name}
                            className="h-16 w-16 rounded-lg object-cover border border-border"
                          />
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-muted-foreground">Category</p>
                          <p className="font-medium">{item.category}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Location</p>
                          <p className="font-medium">{item.location}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Quantity</p>
                          <p className="font-medium">{item.quantity}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Unit Price</p>
                          <p className="font-medium">₱{item.unit_price?.toLocaleString() || 0}</p>
                        </div>
                      </div>
                      {item.description && (
                        <div className="text-sm">
                          <p className="text-muted-foreground">Description</p>
                          <p className="text-foreground">{item.description}</p>
                        </div>
                      )}
                      <Button
                        variant="destructive"
                        size="sm"
                        className="w-full mt-4"
                        onClick={() => deleteItemMutation.mutate(item.id)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Remove from Inventory
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default DefectedItems;
