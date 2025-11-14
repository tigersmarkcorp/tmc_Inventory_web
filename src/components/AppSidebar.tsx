import { Home, FileText, Package, TrendingUp, Archive, Clock, AlertTriangle, BarChart3, Settings as SettingsIcon, Shield } from "lucide-react";
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
  { title: "Dashboard", url: "/dashboard", icon: Home, section: "GENERAL" },
  { title: "Inventory", url: "/inventory", icon: Package, section: "INVENTORY MANAGEMENT" },
  { title: "Stock Levels", url: "/stock-levels", icon: TrendingUp, section: "INVENTORY MANAGEMENT" },
  { title: "Borrowed Items", url: "/borrowed-items", icon: Archive, section: "INVENTORY MANAGEMENT" },
  { title: "Defected Items", url: "/defected-items", icon: AlertTriangle, section: "INVENTORY MANAGEMENT" },
  { title: "Reports", url: "/reports", icon: BarChart3, section: "INVENTORY MANAGEMENT" },
  { title: "Users", url: "/users", icon: Shield, section: "GENERAL", requiresSuperadmin: true },
  { title: "Settings", url: "/settings", icon: SettingsIcon, section: "GENERAL" },
];

const sections = ["GENERAL", "INVENTORY MANAGEMENT"];

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
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <Sidebar className="border-r-0">
      <SidebarContent className="bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950">
        <div className="px-4 py-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary via-orange-500 to-orange-600 text-white font-bold text-lg shadow-lg">
              TM
            </div>
            {open && (
              <div>
                <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200">TIGER'S MARK</h2>
                <p className="text-xs text-slate-600 dark:text-slate-400">CORPORATION</p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4 px-3">
          {sections.map((section) => (
            <div key={section} className="rounded-2xl overflow-hidden border-2 border-primary shadow-md">
              <div className="bg-primary px-4 py-2">
                <h3 className="text-xs font-bold text-white tracking-wide uppercase">
                  {section}
                </h3>
              </div>
              <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm p-2">
                {menuItems
                  .filter((item) => item.section === section)
                  .filter((item) => !item.requiresSuperadmin || userRole === 'superadmin')
                  .map((item) => (
                    <NavLink
                      key={item.title}
                      to={item.url}
                      className={({ isActive }) =>
                        `flex items-center gap-3 rounded-lg px-3 py-2.5 mb-1 transition-all ${
                          isActive
                            ? "bg-primary/10 text-primary font-semibold"
                            : "text-slate-700 dark:text-slate-300 hover:bg-primary/5"
                        }`
                      }
                    >
                      <item.icon className="h-5 w-5 shrink-0" />
                      {open && <span className="text-sm">{item.title}</span>}
                    </NavLink>
                  ))}
              </div>
            </div>
          ))}
        </div>

        {open && (
          <div className="mt-auto px-3 pb-4">
            <div className="rounded-2xl bg-primary text-white p-4 text-center shadow-lg">
              <Clock className="h-6 w-6 mx-auto mb-2" />
              <div className="text-2xl font-bold tracking-wider">
                {formatTime(currentTime)}
              </div>
              <div className="text-xs mt-1 font-medium opacity-90">
                {formatDate(currentTime)}
              </div>
            </div>
          </div>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
