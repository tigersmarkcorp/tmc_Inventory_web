import { useEffect } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { Package, AlertCircle, PackageOpen, LogOut } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

const Dashboard = () => {
  const { signOut } = useAuth();
  const queryClient = useQueryClient();

  const { data: inventoryStats } = useQuery({
    queryKey: ['inventory-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('quantity, status, reorder_point, condition');
      
      if (error) throw error;

      const totalItems = data?.reduce((sum, item) => sum + item.quantity, 0) || 0;
      const inStock = data?.filter(item => item.status === 'In Stock').length || 0;
      const lowStock = data?.filter(item => item.quantity <= item.reorder_point).length || 0;
      const defected = data?.filter(item => item.condition === 'Defected').length || 0;

      return { totalItems, inStock, lowStock, defected };
    },
  });

  const { data: borrowedStats } = useQuery({
    queryKey: ['borrowed-stats'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('borrowed_items')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'Active');
      
      if (error) throw error;
      return count || 0;
    },
  });

  const { data: recentActivity = [] } = useQuery({
    queryKey: ['recent-activity'],
    queryFn: async () => {
      // Get recent inventory items
      const { data: inventoryData } = await supabase
        .from('inventory_items')
        .select('name, created_at, status')
        .order('created_at', { ascending: false })
        .limit(5);

      // Get recent borrowed items
      const { data: borrowedData } = await supabase
        .from('borrowed_items')
        .select('item_name, created_at, status, updated_at')
        .order('updated_at', { ascending: false })
        .limit(5);

      const activities = [];

      // Add inventory activities
      if (inventoryData) {
        activities.push(...inventoryData.map(item => ({
          type: 'inventory',
          title: 'New inventory item added',
          description: item.name,
          timestamp: new Date(item.created_at),
          icon: 'package',
        })));
      }

      // Add borrowed activities
      if (borrowedData) {
        activities.push(...borrowedData.map(item => ({
          type: item.status === 'Returned' ? 'returned' : 'borrowed',
          title: item.status === 'Returned' ? 'Item returned' : 'Item borrowed',
          description: item.item_name,
          timestamp: new Date(item.updated_at || item.created_at),
          icon: item.status === 'Returned' ? 'returned' : 'borrowed',
        })));
      }

      // Sort by timestamp and limit to 5
      return activities
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, 5);
    },
    refetchInterval: 5000, // Refetch every 5 seconds for real-time updates
  });

  // Set up real-time subscriptions
  useEffect(() => {
    const inventoryChannel = supabase
      .channel('inventory-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'inventory_items' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['recent-activity'] });
          queryClient.invalidateQueries({ queryKey: ['inventory-stats'] });
        }
      )
      .subscribe();

    const borrowedChannel = supabase
      .channel('borrowed-changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'borrowed_items' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['recent-activity'] });
          queryClient.invalidateQueries({ queryKey: ['borrowed-stats'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(inventoryChannel);
      supabase.removeChannel(borrowedChannel);
    };
  }, [queryClient]);

  const getActivityIcon = (iconType: string) => {
    switch (iconType) {
      case 'package':
        return { icon: Package, color: 'primary' };
      case 'returned':
        return { icon: PackageOpen, color: 'green-500' };
      case 'borrowed':
        return { icon: PackageOpen, color: 'blue-500' };
      default:
        return { icon: AlertCircle, color: 'destructive' };
    }
  };

  const getTimeAgo = (timestamp: Date) => {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return 'Just now';
  };

  const totalInventoryCount = inventoryStats?.inStock || 0;
  const defectedCount = inventoryStats?.defected || 0;
  const borrowedCount = borrowedStats || 0;
  const grandTotal = totalInventoryCount + defectedCount + borrowedCount;

  const inventoryPercentage = grandTotal > 0 ? ((totalInventoryCount / grandTotal) * 100).toFixed(1) : "0";
  const borrowedPercentage = grandTotal > 0 ? ((borrowedCount / grandTotal) * 100).toFixed(1) : "0";
  const defectedPercentage = grandTotal > 0 ? ((defectedCount / grandTotal) * 100).toFixed(1) : "0";

  const stats = [
    {
      title: "Total Items",
      value: inventoryStats?.totalItems?.toString() || "0",
      icon: Package,
      trend: `${inventoryPercentage}%`,
      trendUp: true,
      bgColor: "bg-primary/10",
      iconColor: "text-primary",
      subtitle: "of total inventory",
    },
    {
      title: "Borrowed Items",
      value: borrowedStats?.toString() || "0",
      icon: PackageOpen,
      trend: `${borrowedPercentage}%`,
      trendUp: false,
      bgColor: "bg-blue-500/10",
      iconColor: "text-blue-500",
      subtitle: "of total inventory",
    },
    {
      title: "Defected Items",
      value: defectedCount?.toString() || "0",
      icon: AlertCircle,
      trend: `${defectedPercentage}%`,
      trendUp: false,
      bgColor: "bg-destructive/10",
      iconColor: "text-destructive",
      subtitle: "of total inventory",
    },
    {
      title: "Low Stock",
      value: inventoryStats?.lowStock?.toString() || "0",
      icon: AlertCircle,
      trend: "Alert",
      trendUp: false,
      bgColor: "bg-warning/10",
      iconColor: "text-warning",
      subtitle: "needs restocking",
    },
  ];

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-border bg-card px-6 shadow-sm">
            <div className="flex items-center gap-4">
              <SidebarTrigger />
              <h1 className="text-xl font-bold text-foreground">Dashboard</h1>
            </div>
            <Button variant="outline" size="sm" onClick={signOut} className="gap-2">
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </header>

          <main className="flex-1 p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-foreground">Welcome Back!</h2>
                <p className="text-muted-foreground">Here's what's happening with your inventory today.</p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {stats.map((stat) => (
                <Card key={stat.title}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {stat.title}
                    </CardTitle>
                    <div className={`h-10 w-10 rounded-lg ${stat.bgColor} flex items-center justify-center`}>
                      <stat.icon className={`h-5 w-5 ${stat.iconColor}`} />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-foreground">{stat.value}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      <span className="font-semibold text-foreground">{stat.trend}</span> {stat.subtitle}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Inventory Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'In Stock', value: totalInventoryCount, color: 'hsl(var(--primary))' },
                          { name: 'Borrowed', value: borrowedCount, color: 'hsl(217, 91%, 60%)' },
                          { name: 'Defected', value: defectedCount, color: 'hsl(var(--destructive))' },
                        ]}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {[
                          { name: 'In Stock', value: totalInventoryCount, color: 'hsl(var(--primary))' },
                          { name: 'Borrowed', value: borrowedCount, color: 'hsl(217, 91%, 60%)' },
                          { name: 'Defected', value: defectedCount, color: 'hsl(var(--destructive))' },
                        ].map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value: number) => [`${value} items`, '']}
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Recent Activity</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {recentActivity.length > 0 ? (
                      recentActivity.map((activity: any, index: number) => {
                        const { icon: Icon, color } = getActivityIcon(activity.icon);
                        return (
                          <div key={index} className="flex items-center gap-4">
                            <div className={`h-10 w-10 rounded-full bg-${color}/10 flex items-center justify-center`}>
                              <Icon className={`h-5 w-5 text-${color}`} />
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-medium text-foreground">{activity.title}</p>
                              <p className="text-xs text-muted-foreground">
                                {activity.description} - {getTimeAgo(activity.timestamp)}
                              </p>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-sm text-muted-foreground">No recent activity</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default Dashboard;
