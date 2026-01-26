import { useEffect } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { Package, AlertCircle, PackageOpen, LogOut, Users, Activity, TrendingUp, Sparkles, Shield, Clock, Database, Zap } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

const Dashboard = () => {
  const { signOut, user, userRole } = useAuth();
  const queryClient = useQueryClient();

  const { data: inventoryStats } = useQuery({
    queryKey: ['inventory-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('quantity, status, reorder_point, condition, category');
      
      if (error) throw error;

      const totalItems = data?.reduce((sum, item) => sum + item.quantity, 0) || 0;
      const inStockQuantity = data?.filter(item => item.status === 'In Stock').reduce((sum, item) => sum + item.quantity, 0) || 0;
      const lowStock = data?.filter(item => item.quantity <= (item.reorder_point || 0)).length || 0;
      const defectedQuantity = data?.filter(item => item.condition === 'Defected').reduce((sum, item) => sum + item.quantity, 0) || 0;
      const totalRecords = data?.length || 0;

      // Get category distribution
      const categoryDistribution: Record<string, number> = {};
      data?.forEach(item => {
        const category = item.category || 'Uncategorized';
        categoryDistribution[category] = (categoryDistribution[category] || 0) + item.quantity;
      });

      return { totalItems, inStockQuantity, lowStock, defectedQuantity, totalRecords, categoryDistribution };
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

  const { data: weeklyProductivity = [] } = useQuery({
    queryKey: ['weekly-productivity'],
    queryFn: async () => {
      const startOfWeek = new Date();
      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
      startOfWeek.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from('activity_logs')
        .select('user_email, action_type, created_at')
        .gte('created_at', startOfWeek.toISOString());
      
      if (error) {
        console.log('Activity logs not accessible:', error.message);
        return [];
      }

      const userStats: Record<string, { email: string; actions: number; adds: number; updates: number; deletes: number }> = {};
      
      data?.forEach((log: any) => {
        const email = log.user_email || 'Unknown';
        if (!userStats[email]) {
          userStats[email] = { email, actions: 0, adds: 0, updates: 0, deletes: 0 };
        }
        userStats[email].actions++;
        if (log.action_type === 'ADD') userStats[email].adds++;
        if (log.action_type === 'UPDATE') userStats[email].updates++;
        if (log.action_type === 'DELETE') userStats[email].deletes++;
      });

      return Object.values(userStats).map(user => ({
        name: user.email.split('@')[0],
        email: user.email,
        actions: user.actions,
        adds: user.adds,
        updates: user.updates,
        deletes: user.deletes,
      }));
    },
    refetchInterval: 10000,
  });

  const { data: recentActivity = [] } = useQuery({
    queryKey: ['recent-activity'],
    queryFn: async () => {
      const { data: inventoryData } = await supabase
        .from('inventory_items')
        .select('name, created_at, status')
        .order('created_at', { ascending: false })
        .limit(5);

      const { data: borrowedData } = await supabase
        .from('borrowed_items')
        .select('item_name, created_at, status, updated_at')
        .order('updated_at', { ascending: false })
        .limit(5);

      const activities = [];

      if (inventoryData) {
        activities.push(...inventoryData.map(item => ({
          type: 'inventory',
          title: 'New inventory item added',
          description: item.name,
          timestamp: new Date(item.created_at),
          icon: 'package',
        })));
      }

      if (borrowedData) {
        activities.push(...borrowedData.map(item => ({
          type: item.status === 'Returned' ? 'returned' : 'borrowed',
          title: item.status === 'Returned' ? 'Item returned' : 'Item borrowed',
          description: item.item_name,
          timestamp: new Date(item.updated_at || item.created_at),
          icon: item.status === 'Returned' ? 'returned' : 'borrowed',
        })));
      }

      return activities
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, 5);
    },
    refetchInterval: 5000,
  });

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
        return { icon: PackageOpen, color: 'success' };
      case 'borrowed':
        return { icon: PackageOpen, color: 'info' };
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

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  const totalInventoryCount = inventoryStats?.inStockQuantity || 0;
  const defectedCount = inventoryStats?.defectedQuantity || 0;
  const borrowedCount = borrowedStats || 0;
  const grandTotal = totalInventoryCount + defectedCount + borrowedCount;

  const inventoryPercentage = grandTotal > 0 ? ((totalInventoryCount / grandTotal) * 100).toFixed(1) : "0";
  const borrowedPercentage = grandTotal > 0 ? ((borrowedCount / grandTotal) * 100).toFixed(1) : "0";
  const defectedPercentage = grandTotal > 0 ? ((defectedCount / grandTotal) * 100).toFixed(1) : "0";

  // Generate category-based pie chart data with distinct colors
  const categoryColors = [
    'hsl(24, 95%, 53%)',   // primary/orange
    'hsl(217, 91%, 60%)',  // blue
    'hsl(142, 76%, 36%)',  // green
    'hsl(262, 83%, 58%)',  // purple
    'hsl(43, 96%, 56%)',   // yellow
    'hsl(0, 72%, 51%)',    // red
    'hsl(186, 94%, 41%)',  // cyan
    'hsl(330, 81%, 60%)',  // pink
  ];

  const categoryData = inventoryStats?.categoryDistribution 
    ? Object.entries(inventoryStats.categoryDistribution).map(([name, value], index) => ({
        name,
        value,
        color: categoryColors[index % categoryColors.length],
      }))
    : [];

  const stats = [
    {
      title: "Total Items",
      value: inventoryStats?.totalItems?.toString() || "0",
      icon: Package,
      trend: `${inventoryPercentage}%`,
      trendUp: true,
      gradient: "from-primary/20 via-primary/10 to-transparent",
      iconBg: "bg-primary",
      subtitle: "of inventory",
    },
    {
      title: "Borrowed",
      value: borrowedStats?.toString() || "0",
      icon: PackageOpen,
      trend: `${borrowedPercentage}%`,
      trendUp: false,
      gradient: "from-info/20 via-info/10 to-transparent",
      iconBg: "bg-info",
      subtitle: "currently out",
    },
    {
      title: "Defected",
      value: defectedCount?.toString() || "0",
      icon: AlertCircle,
      trend: `${defectedPercentage}%`,
      trendUp: false,
      gradient: "from-destructive/20 via-destructive/10 to-transparent",
      iconBg: "bg-destructive",
      subtitle: "need attention",
    },
    {
      title: "Low Stock",
      value: inventoryStats?.lowStock?.toString() || "0",
      icon: TrendingUp,
      trend: "Alert",
      trendUp: false,
      gradient: "from-warning/20 via-warning/10 to-transparent",
      iconBg: "bg-warning",
      subtitle: "needs restock",
    },
  ];

  const userName = user?.email?.split('@')[0] || 'User';

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gradient-to-br from-background via-background to-muted/30">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          {/* Enhanced Header */}
          <header className="header-pro h-16 flex items-center justify-between px-6 lg:px-8">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="hover:bg-muted rounded-lg transition-colors" />
              <div className="hidden sm:flex items-center gap-3">
                <div className="h-8 w-1 rounded-full bg-gradient-to-b from-primary to-primary/50" />
                <div>
                  <h1 className="text-lg font-bold text-foreground tracking-tight">Command Center</h1>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Dashboard Overview</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden lg:flex items-center gap-3 px-4 py-2 rounded-xl bg-card border border-border/50 shadow-sm">
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full bg-success animate-pulse shadow-[0_0_8px_hsl(var(--success))]" />
                  <span className="text-xs font-semibold text-success">ONLINE</span>
                </div>
                <div className="h-4 w-px bg-border" />
                <span className="text-xs text-muted-foreground font-medium">{new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
              </div>
              <Button variant="outline" size="sm" onClick={signOut} className="gap-2 border-border/50 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/50 transition-all">
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline font-medium">Sign Out</span>
              </Button>
            </div>
          </header>

          <main className="flex-1 p-6 lg:p-8 space-y-8 overflow-y-auto">
            {/* Welcome Hero Section */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-hero p-8 lg:p-10 text-primary-foreground shadow-elegant">
              {/* Background Pattern */}
              <div className="absolute inset-0 opacity-20">
                <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-black/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
              </div>
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0YzAtMi4yIDEuOC00IDQtNHM0IDEuOCA0IDQtMS44IDQtNCA0LTQtMS44LTQtNHoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-50" />
              
              <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                <div className="space-y-4">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/20 backdrop-blur-sm border border-white/20">
                    <Sparkles className="h-4 w-4" />
                    <span className="text-xs font-semibold tracking-wide">WELCOME BACK</span>
                  </div>
                  <div>
                    <h2 className="text-3xl lg:text-4xl font-bold mb-2 capitalize tracking-tight">{userName}</h2>
                    <p className="text-primary-foreground/80 text-sm lg:text-base max-w-lg leading-relaxed">
                      Your inventory command center is ready. Monitor metrics, track activity, and manage operations efficiently.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="hidden md:flex flex-col items-center justify-center px-6 py-4 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20">
                    <span className="text-3xl font-bold">{inventoryStats?.totalItems || 0}</span>
                    <span className="text-xs uppercase tracking-wider opacity-80">Total Units</span>
                  </div>
                  <div className="hidden lg:flex flex-col items-center justify-center px-6 py-4 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20">
                    <span className="text-3xl font-bold">{inventoryStats?.totalRecords || 0}</span>
                    <span className="text-xs uppercase tracking-wider opacity-80">SKUs</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Stats Grid - Enhanced Enterprise Cards */}
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4 stagger-children">
              {stats.map((stat, index) => (
                <div key={stat.title} className="group relative overflow-hidden bg-card border border-border/50 rounded-2xl p-6 transition-all duration-500 hover:shadow-xl hover:border-primary/30 hover:-translate-y-1">
                  {/* Decorative gradient background */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${stat.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                  <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-primary/5 to-transparent rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500" />
                  
                  <div className="relative z-10">
                    <div className="flex items-start justify-between mb-6">
                      <div className={`h-14 w-14 rounded-2xl ${stat.iconBg} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                        <stat.icon className="h-7 w-7 text-primary-foreground" />
                      </div>
                      <Badge variant="outline" className="text-xs font-bold border-border/50 bg-background/80 backdrop-blur-sm">
                        {stat.trend}
                      </Badge>
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-4xl font-bold text-foreground tracking-tight">{stat.value}</p>
                      <p className="text-sm font-semibold text-foreground/80">{stat.title}</p>
                      <p className="text-xs text-muted-foreground">{stat.subtitle}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* System Overview - Admin/Superadmin Only */}
            {(userRole === 'superadmin' || userRole === 'admin') && (
              <div className="relative">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-6 w-1 rounded-full bg-gradient-to-b from-info to-info/50" />
                  <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">System Metrics</h3>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="group flex items-center gap-4 p-5 rounded-2xl border border-border/50 bg-card hover:shadow-lg hover:border-success/30 transition-all duration-300">
                    <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-success/20 to-success/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Shield className="h-6 w-6 text-success" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">System Status</p>
                      <p className="text-xl font-bold text-success">Operational</p>
                    </div>
                  </div>
                  <div className="group flex items-center gap-4 p-5 rounded-2xl border border-border/50 bg-card hover:shadow-lg hover:border-info/30 transition-all duration-300">
                    <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-info/20 to-info/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Database className="h-6 w-6 text-info" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Total Records</p>
                      <p className="text-xl font-bold text-foreground">{(inventoryStats?.totalRecords || 0) + (borrowedStats || 0)}</p>
                    </div>
                  </div>
                  <div className="group flex items-center gap-4 p-5 rounded-2xl border border-border/50 bg-card hover:shadow-lg hover:border-warning/30 transition-all duration-300">
                    <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-warning/20 to-warning/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Clock className="h-6 w-6 text-warning" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Last Update</p>
                      <p className="text-xl font-bold text-foreground">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  </div>
                  <div className="group flex items-center gap-4 p-5 rounded-2xl border border-border/50 bg-card hover:shadow-lg hover:border-primary/30 transition-all duration-300">
                    <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Zap className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Sync Status</p>
                      <p className="text-xl font-bold text-foreground">Real-time</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Charts Grid - Premium Design */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Pie Chart */}
              <Card className="overflow-hidden border-border/50 shadow-lg">
                <CardHeader className="border-b border-border/30 bg-gradient-to-r from-muted/50 to-transparent px-6 py-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Package className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-lg font-bold">Inventory Distribution</CardTitle>
                        <p className="text-xs text-muted-foreground">By category breakdown</p>
                      </div>
                    </div>
                    <Badge className="bg-success/10 text-success border-success/30 font-semibold">
                      <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-success animate-pulse inline-block" />
                      Live
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-6 px-6 pb-6">
                  {categoryData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={280}>
                      <PieChart>
                        <Pie
                          data={categoryData}
                          cx="50%"
                          cy="50%"
                          innerRadius={70}
                          outerRadius={110}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {categoryData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
                          ))}
                        </Pie>
                        <Tooltip 
                          formatter={(value: number, name: string) => [`${value} items`, name]}
                          contentStyle={{
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '12px',
                            boxShadow: 'var(--shadow-lg)',
                          }}
                        />
                        <Legend 
                          formatter={(value) => <span className="text-foreground text-sm font-medium">{value}</span>}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[280px] flex items-center justify-center text-muted-foreground">
                      <div className="text-center">
                        <Package className="h-16 w-16 mx-auto mb-3 opacity-20" />
                        <p className="text-sm font-medium">No inventory data available</p>
                        <p className="text-xs opacity-70">Add items to see distribution</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Activity Feed - Enhanced */}
              <Card className="overflow-hidden border-border/50 shadow-lg">
                <CardHeader className="border-b border-border/30 bg-gradient-to-r from-muted/50 to-transparent px-6 py-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-info/10 flex items-center justify-center">
                        <Activity className="h-5 w-5 text-info" />
                      </div>
                      <div>
                        <CardTitle className="text-lg font-bold">Recent Activity</CardTitle>
                        <p className="text-xs text-muted-foreground">Latest inventory changes</p>
                      </div>
                    </div>
                    <Badge className="bg-info/10 text-info border-info/30 font-semibold">
                      <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-info animate-pulse inline-block" />
                      Real-time
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-4 px-4 pb-4">
                  <div className="space-y-2">
                    {recentActivity.length > 0 ? (
                      recentActivity.map((activity: any, index: number) => {
                        const { icon: Icon, color } = getActivityIcon(activity.icon);
                        return (
                          <div key={index} className="flex items-center gap-4 p-4 rounded-xl bg-muted/20 hover:bg-muted/40 border border-transparent hover:border-border/50 transition-all duration-200">
                            <div className={`h-11 w-11 rounded-xl bg-${color}/10 flex items-center justify-center shrink-0`}>
                              <Icon className={`h-5 w-5 text-${color}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-foreground truncate">{activity.title}</p>
                              <p className="text-xs text-muted-foreground truncate">{activity.description}</p>
                            </div>
                            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap px-2 py-1 rounded-md bg-muted/50">
                              {getTimeAgo(activity.timestamp)}
                            </span>
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-center py-12 text-muted-foreground">
                        <Activity className="h-16 w-16 mx-auto mb-3 opacity-20" />
                        <p className="font-medium">No recent activity</p>
                        <p className="text-xs opacity-70">Changes will appear here</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Productivity Chart - Only visible to superadmin */}
            {userRole === 'superadmin' && (
              <Card className="overflow-hidden border-border/50 shadow-lg">
                <CardHeader className="border-b border-border/30 bg-gradient-to-r from-muted/50 to-transparent px-6 py-5">
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                        <Users className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-xl font-bold">Team Productivity</CardTitle>
                        <p className="text-sm text-muted-foreground">Weekly performance metrics</p>
                      </div>
                    </div>
                    <Badge className="bg-primary/10 text-primary border-primary/30 font-semibold px-3 py-1">
                      This Week
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-8 px-6 pb-6">
                  {weeklyProductivity.length > 0 ? (
                    <div className="space-y-8">
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={weeklyProductivity} barGap={12}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                          <XAxis 
                            dataKey="name" 
                            stroke="hsl(var(--muted-foreground))" 
                            fontSize={12}
                            fontWeight={600}
                            tickLine={false}
                            axisLine={false}
                          />
                          <YAxis 
                            stroke="hsl(var(--muted-foreground))" 
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                          />
                          <Tooltip 
                            contentStyle={{
                              backgroundColor: 'hsl(var(--card))',
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '16px',
                              boxShadow: 'var(--shadow-xl)',
                              padding: '12px 16px',
                            }}
                            cursor={{ fill: 'hsl(var(--muted) / 0.3)' }}
                          />
                          <Legend 
                            formatter={(value) => <span className="text-foreground text-sm font-medium">{value}</span>}
                          />
                          <Bar dataKey="adds" name="Added" fill="hsl(152, 69%, 40%)" radius={[8, 8, 0, 0]} />
                          <Bar dataKey="updates" name="Updated" fill="hsl(217, 91%, 60%)" radius={[8, 8, 0, 0]} />
                          <Bar dataKey="deletes" name="Deleted" fill="hsl(0, 72%, 51%)" radius={[8, 8, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                      
                      <div>
                        <div className="flex items-center gap-3 mb-4">
                          <div className="h-5 w-1 rounded-full bg-gradient-to-b from-primary to-primary/50" />
                          <h4 className="text-sm font-bold text-foreground uppercase tracking-wider">Team Members</h4>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                          {weeklyProductivity.map((user: any, index: number) => (
                            <div key={index} className="group flex items-center gap-4 p-5 rounded-2xl border border-border/50 bg-card hover:shadow-lg hover:border-primary/30 transition-all duration-300">
                              <div className="h-12 w-12 rounded-2xl bg-gradient-hero flex items-center justify-center text-primary-foreground font-bold text-lg shadow-lg group-hover:scale-110 transition-transform">
                                {user.name.charAt(0).toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-foreground truncate capitalize">{user.name}</p>
                                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-2xl font-bold text-primary">{user.actions}</p>
                                <p className="text-[9px] text-muted-foreground uppercase tracking-widest font-semibold">actions</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                      <Users className="h-20 w-20 mb-4 opacity-15" />
                      <p className="text-lg font-semibold">No activity recorded</p>
                      <p className="text-sm opacity-70">Start managing inventory to see productivity stats</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </main>

          {/* Enhanced Footer */}
          <footer className="px-6 lg:px-8 py-5 border-t border-border/30 bg-card/50 backdrop-blur-xl">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-gradient-hero flex items-center justify-center text-primary-foreground font-bold text-xs shadow-md">
                  TM
                </div>
                <p className="text-xs font-semibold text-muted-foreground">
                  Tiger's Mark Corporation © {new Date().getFullYear()}
                </p>
              </div>
              <div className="flex items-center gap-4 text-[10px] text-muted-foreground/70 uppercase tracking-wider font-semibold">
                <span>Inventory Management System</span>
                <div className="h-3 w-px bg-border" />
                <span>v2.0 Enterprise</span>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default Dashboard;
