import { Home, FileText, Package, TrendingUp, Archive, Clock, AlertTriangle, BarChart3, Settings as SettingsIcon, Shield, Sparkles, Gift } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const menuItems = [
  { title: "Dashboard", url: "/dashboard", icon: Home, section: "OVERVIEW" },
  { title: "Inventory", url: "/inventory", icon: Package, section: "MANAGEMENT" },
  { title: "Stock Levels", url: "/stock-levels", icon: TrendingUp, section: "MANAGEMENT" },
  { title: "Borrowed Items", url: "/borrowed-items", icon: Archive, section: "MANAGEMENT" },
  { title: "Used/Given Items", url: "/used-given-items", icon: Gift, section: "MANAGEMENT" },
  { title: "Defected Items", url: "/defected-items", icon: AlertTriangle, section: "MANAGEMENT" },
  { title: "Reports", url: "/reports", icon: BarChart3, section: "ANALYTICS" },
  { title: "Users", url: "/users", icon: Shield, section: "ADMINISTRATION", requiresSuperadmin: true },
  { title: "Settings", url: "/settings", icon: SettingsIcon, section: "ADMINISTRATION" },
];

const sections = ["OVERVIEW", "MANAGEMENT", "ANALYTICS", "ADMINISTRATION"];

const sectionIcons: Record<string, any> = {
  "OVERVIEW": Sparkles,
  "MANAGEMENT": Package,
  "ANALYTICS": BarChart3,
  "ADMINISTRATION": Shield,
};

export function AppSidebar() {
  const { open } = useSidebar();
  const { userRole } = useAuth();
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit',
      hour12: true 
    }).toUpperCase();
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const filteredSections = sections.filter(section => {
    const sectionItems = menuItems.filter(item => item.section === section);
    return sectionItems.some(item => !item.requiresSuperadmin || userRole === 'superadmin');
  });

  return (
    <Sidebar className="border-r-0">
      <SidebarContent className="bg-sidebar">
        {/* Logo Section */}
        <div className="px-4 py-6 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-hero text-primary-foreground font-bold text-lg shadow-lg">
                TM
              </div>
              <div className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-success border-2 border-sidebar animate-pulse" />
            </div>
            {open && (
              <div className="flex flex-col">
                <h2 className="text-base font-bold text-sidebar-foreground tracking-tight">TIGER'S MARK</h2>
                <p className="text-xs text-sidebar-foreground/60 font-medium">CORPORATION</p>
              </div>
            )}
          </div>
        </div>

        {/* Navigation Sections */}
        <div className="flex-1 py-4 space-y-2 px-3 overflow-y-auto">
          {filteredSections.map((section) => {
            const sectionItems = menuItems
              .filter((item) => item.section === section)
              .filter((item) => !item.requiresSuperadmin || userRole === 'superadmin');

            if (sectionItems.length === 0) return null;

            return (
              <div key={section} className="space-y-1">
                {open && (
                  <div className="flex items-center gap-2 px-3 py-2">
                    <div className="h-1 w-1 rounded-full bg-primary" />
                    <span className="text-[10px] font-bold text-sidebar-foreground/40 tracking-widest uppercase">
                      {section}
                    </span>
                  </div>
                )}
                <div className="space-y-0.5">
                  {sectionItems.map((item) => (
                    <NavLink
                      key={item.title}
                      to={item.url}
                      className={({ isActive }) =>
                        `group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-200 ${
                          isActive
                            ? "bg-primary text-primary-foreground shadow-md"
                            : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                        }`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <div className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                            isActive ? "bg-primary-foreground/20" : "bg-sidebar-accent group-hover:bg-sidebar-accent"
                          }`}>
                            <item.icon className="h-4 w-4" />
                          </div>
                          {open && (
                            <span className="text-sm font-medium">{item.title}</span>
                          )}
                        </>
                      )}
                    </NavLink>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Time Display */}
        {open && (
          <div className="px-3 pb-4">
            <div className="rounded-2xl bg-gradient-hero p-4 text-center shadow-elegant relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
              <div className="relative z-10">
                <Clock className="h-5 w-5 mx-auto mb-2 text-primary-foreground/80" />
                <div className="text-2xl font-bold tracking-wider text-primary-foreground">
                  {formatTime(currentTime)}
                </div>
                <div className="text-xs mt-1 font-medium text-primary-foreground/80">
                  {formatDate(currentTime)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Version */}
        {open && (
          <div className="px-4 pb-4 text-center">
            <span className="text-[10px] text-sidebar-foreground/30 font-mono">
              v2.0.0 Enterprise
            </span>
          </div>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
