import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LogOut, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const StockLevels = () => {
  const { signOut } = useAuth();

  const { data: items = [] } = useQuery({
    queryKey: ['inventory-items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('*')
        .order('quantity', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
  });

  // Group items by category for bar chart
  const categoryStats = items.reduce((acc: any, item: any) => {
    if (!acc[item.category]) {
      acc[item.category] = { quantity: 0, threshold: 0 };
    }
    acc[item.category].quantity += item.quantity;
    acc[item.category].threshold += item.reorder_point || 20;
    return acc;
  }, {});

  const stockData = Object.keys(categoryStats).map(category => ({
    category,
    quantity: categoryStats[category].quantity,
    threshold: categoryStats[category].threshold,
  }));

  // Calculate status distribution for pie chart
  const inStockCount = items.filter((item: any) => item.status === 'In Stock').length;
  const lowStockCount = items.filter((item: any) => item.status === 'Low Stock').length;
  const outOfStockCount = items.filter((item: any) => item.status === 'Out of Stock').length;
  const total = items.length || 1;

  const statusData = [
    { name: "In Stock", value: Math.round((inStockCount / total) * 100), color: "hsl(142, 76%, 36%)" },
    { name: "Low Stock", value: Math.round((lowStockCount / total) * 100), color: "hsl(var(--destructive))" },
    { name: "Out of Stock", value: Math.round((outOfStockCount / total) * 100), color: "hsl(var(--muted))" },
  ];

  const highStockItems = items
    .filter((item: any) => item.quantity > (item.reorder_point || 20) * 2)
    .slice(0, 4);

  const lowStockItems = items
    .filter((item: any) => item.quantity <= (item.reorder_point || 20))
    .slice(0, 4);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-border bg-card px-6 shadow-sm">
            <div className="flex items-center gap-4">
              <SidebarTrigger />
              <h1 className="text-xl font-bold text-foreground">Stock Levels</h1>
            </div>
            <Button variant="outline" size="sm" onClick={signOut} className="gap-2">
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </header>

          <main className="flex-1 p-6 space-y-6">
            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Bar Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Stock Levels by Category</CardTitle>
                  <CardDescription>Current inventory quantities vs minimum thresholds</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={stockData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="category" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="quantity" fill="hsl(var(--primary))" name="Current Stock" />
                      <Bar dataKey="threshold" fill="hsl(var(--muted))" name="Min Threshold" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Pie Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Stock Status Distribution</CardTitle>
                  <CardDescription>Overall inventory health status</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={statusData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, value }) => `${name}: ${value}%`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {statusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* High Stock Items */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  High Stock Items
                </CardTitle>
                <CardDescription>Items with sufficient inventory levels</CardDescription>
              </CardHeader>
              <CardContent>
                {highStockItems.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No high stock items</p>
                ) : (
                  <div className="space-y-3">
                    {highStockItems.map((item: any) => (
                      <div key={item.id} className="flex items-center justify-between p-4 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors">
                        <div className="flex-1">
                          <h4 className="font-semibold text-foreground">{item.name}</h4>
                          <p className="text-sm text-muted-foreground">{item.category}</p>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-2xl font-bold text-primary">{item.quantity}</p>
                            <p className="text-xs text-muted-foreground">units</p>
                          </div>
                          <div className="px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
                            High
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Low Stock Items */}
            <Card className="border-destructive/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <TrendingDown className="h-5 w-5" />
                  Low Stock Items - Action Required
                </CardTitle>
                <CardDescription>Items that need immediate restocking</CardDescription>
              </CardHeader>
              <CardContent>
                {lowStockItems.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No low stock items</p>
                ) : (
                  <div className="space-y-3">
                    {lowStockItems.map((item: any) => (
                      <div key={item.id} className="flex items-center justify-between p-4 rounded-lg border border-destructive/30 bg-destructive/5">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-destructive" />
                            <h4 className="font-semibold text-foreground">{item.name}</h4>
                          </div>
                          <p className="text-sm text-muted-foreground ml-6">{item.category}</p>
                          <p className="text-xs text-destructive font-medium ml-6 mt-1">
                            ⚠️ Stock below {item.reorder_point || 20} units - Need to add stock immediately
                          </p>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-2xl font-bold text-destructive">{item.quantity}</p>
                            <p className="text-xs text-muted-foreground">units left</p>
                          </div>
                          <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                            item.quantity === 0
                              ? "bg-destructive text-destructive-foreground" 
                              : "bg-destructive/20 text-destructive"
                          }`}>
                            {item.quantity === 0 ? "Critical" : "Low"}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default StockLevels;
