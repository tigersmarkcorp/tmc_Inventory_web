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
        .select('quantity, status, reorder_point, condition');
      
      if (error) throw error;

      const totalItems = data?.reduce((sum, item) => sum + item.quantity, 0) || 0;
      const inStock = data?.filter(item => item.status === 'In Stock').length || 0;
      const lowStock = data?.filter(item => item.quantity <= item.reorder_point).length || 0;
      const defected = data?.filter(item => item.condition === 'Defected').length || 0;
      const totalRecords = data?.length || 0;

      return { totalItems, inStock, lowStock, defected, totalRecords };
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
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <header className="header-pro h-16 flex items-center justify-between px-6">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="hover:bg-muted rounded-lg" />
              <div className="hidden sm:block">
                <h1 className="text-lg font-semibold text-foreground">Dashboard</h1>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/50">
                <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
                <span className="text-xs font-medium text-muted-foreground">System Online</span>
              </div>
              <Button variant="ghost" size="sm" onClick={signOut} className="gap-2 text-muted-foreground hover:text-foreground">
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </div>
          </header>

          <main className="flex-1 p-6 space-y-6 overflow-y-auto">
            {/* Welcome Section */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-hero p-6 md:p-8 text-primary-foreground shadow-elegant">
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRjMC0yLjIgMS44LTQgNC00czQgMS44IDQgNC0xLjggNC00IDQtNC0xLjgtNC00eiIvPjwvZz48L2c+PC9zdmc+')] opacity-30" />
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-5 w-5" />
                  <span className="text-sm font-medium opacity-90">Welcome back</span>
                </div>
                <h2 className="text-2xl md:text-3xl font-bold mb-2 capitalize">{userName}</h2>
                <p className="text-primary-foreground/80 text-sm md:text-base max-w-xl">
                  Here's what's happening with your inventory today. Track metrics, monitor activity, and manage your warehouse efficiently.
                </p>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 stagger-children">
              {stats.map((stat, index) => (
                <div key={stat.title} className="stat-card group">
                  <div className={`absolute inset-0 bg-gradient-to-br ${stat.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl`} />
                  <div className="relative z-10">
                    <div className="flex items-start justify-between mb-4">
                      <div className={`h-12 w-12 rounded-xl ${stat.iconBg} flex items-center justify-center shadow-lg`}>
                        <stat.icon className="h-6 w-6 text-primary-foreground" />
                      </div>
                      <Badge variant="ghost" className="text-xs">
                        {stat.trend}
                      </Badge>
                    </div>
                    <div className="space-y-1">
                      <p className="text-3xl font-bold text-foreground">{stat.value}</p>
                      <p className="text-sm text-muted-foreground">{stat.title}</p>
                      <p className="text-xs text-muted-foreground/70">{stat.subtitle}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* System Overview - Admin/Superadmin Only */}
            {(userRole === 'superadmin' || userRole === 'admin') && (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="group p-4 rounded-2xl border border-border/50 bg-card hover:shadow-elegant transition-all duration-300">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-success/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Shield className="h-5 w-5 text-success" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">System Status</p>
                      <p className="text-lg font-bold text-foreground">Operational</p>
                    </div>
                  </div>
                </div>
                <div className="group p-4 rounded-2xl border border-border/50 bg-card hover:shadow-elegant transition-all duration-300">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-info/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Database className="h-5 w-5 text-info" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Records</p>
                      <p className="text-lg font-bold text-foreground">{(inventoryStats?.totalRecords || 0) + (borrowedStats || 0)}</p>
                    </div>
                  </div>
                </div>
                <div className="group p-4 rounded-2xl border border-border/50 bg-card hover:shadow-elegant transition-all duration-300">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-warning/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Clock className="h-5 w-5 text-warning" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Last Update</p>
                      <p className="text-lg font-bold text-foreground">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  </div>
                </div>
                <div className="group p-4 rounded-2xl border border-border/50 bg-card hover:shadow-elegant transition-all duration-300">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Zap className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Sync Status</p>
                      <p className="text-lg font-bold text-foreground">Real-time</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Charts Grid */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Pie Chart */}
              <Card className="overflow-hidden">
                <CardHeader className="border-b border-border/50 bg-muted/30">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Inventory Distribution</CardTitle>
                    <Badge variant="secondary" className="text-xs">Live</Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-6">
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'In Stock', value: totalInventoryCount, color: 'hsl(24, 95%, 53%)' },
                          { name: 'Borrowed', value: borrowedCount, color: 'hsl(217, 91%, 60%)' },
                          { name: 'Defected', value: defectedCount, color: 'hsl(0, 72%, 51%)' },
                        ].filter(item => item.value > 0)}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {[
                          { name: 'In Stock', value: totalInventoryCount, color: 'hsl(24, 95%, 53%)' },
                          { name: 'Borrowed', value: borrowedCount, color: 'hsl(217, 91%, 60%)' },
                          { name: 'Defected', value: defectedCount, color: 'hsl(0, 72%, 51%)' },
                        ].filter(item => item.value > 0).map((entry, index) => (
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
                        formatter={(value) => <span className="text-foreground text-sm">{value}</span>}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Activity Feed */}
              <Card className="overflow-hidden">
                <CardHeader className="border-b border-border/50 bg-muted/30">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Recent Activity</CardTitle>
                    <Badge variant="secondary" className="text-xs">Real-time</Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="space-y-3">
                    {recentActivity.length > 0 ? (
                      recentActivity.map((activity: any, index: number) => {
                        const { icon: Icon, color } = getActivityIcon(activity.icon);
                        return (
                          <div key={index} className="flex items-center gap-4 p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors">
                            <div className={`h-10 w-10 rounded-xl bg-${color}/10 flex items-center justify-center shrink-0`}>
                              <Icon className={`h-5 w-5 text-${color}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">{activity.title}</p>
                              <p className="text-xs text-muted-foreground truncate">{activity.description}</p>
                            </div>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {getTimeAgo(activity.timestamp)}
                            </span>
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <Activity className="h-12 w-12 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">No recent activity</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Productivity Chart - Only visible to superadmin */}
            {userRole === 'superadmin' && (
              <Card className="overflow-hidden">
                <CardHeader className="border-b border-border/50 bg-muted/30">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Activity className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">Weekly Productivity</CardTitle>
                        <p className="text-xs text-muted-foreground">Team activity this week</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-xs">This Week</Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-6">
                  {weeklyProductivity.length > 0 ? (
                    <div className="space-y-6">
                      <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={weeklyProductivity} barGap={8}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                          <XAxis 
                            dataKey="name" 
                            stroke="hsl(var(--muted-foreground))" 
                            fontSize={12}
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
                              borderRadius: '12px',
                              boxShadow: 'var(--shadow-lg)',
                            }}
                            cursor={{ fill: 'hsl(var(--muted) / 0.5)' }}
                          />
                          <Legend />
                          <Bar dataKey="adds" name="Added" fill="hsl(152, 69%, 40%)" radius={[6, 6, 0, 0]} />
                          <Bar dataKey="updates" name="Updated" fill="hsl(217, 91%, 60%)" radius={[6, 6, 0, 0]} />
                          <Bar dataKey="deletes" name="Deleted" fill="hsl(0, 72%, 51%)" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                      
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {weeklyProductivity.map((user: any, index: number) => (
                          <div key={index} className="flex items-center gap-3 p-4 rounded-xl border border-border/50 bg-muted/20 hover:bg-muted/40 transition-colors">
                            <div className="h-10 w-10 rounded-full bg-gradient-hero flex items-center justify-center text-primary-foreground font-semibold text-sm">
                              {user.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">{user.name}</p>
                              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xl font-bold text-primary">{user.actions}</p>
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">actions</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <Activity className="h-16 w-16 mb-4 opacity-20" />
                      <p className="font-medium">No activity recorded</p>
                      <p className="text-sm opacity-70">Start managing inventory to see productivity stats</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </main>

          {/* Footer */}
          <footer className="px-6 py-4 border-t border-border/50 bg-background/80 backdrop-blur-sm">
            <p className="text-xs text-center text-muted-foreground">
              Tiger's Mark Corporation © {new Date().getFullYear()} • Inventory Management System
            </p>
          </footer>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default Dashboard;
