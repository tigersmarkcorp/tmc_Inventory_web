import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useNavigate } from "react-router-dom";
import { LogOut, Download } from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { useRef, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const Reports = () => {
  const navigate = useNavigate();
  const reportRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const [inventoryData, setInventoryData] = useState<any[]>([]);
  const [borrowedData, setBorrowedData] = useState<any[]>([]);

  const handleLogout = () => {
    localStorage.removeItem("isAuthenticated");
    navigate("/");
  };

  const handleDownloadPDF = async () => {
    if (!reportRef.current) return;

    const pdf = new jsPDF("p", "mm", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    
    // Add title
    pdf.setFontSize(20);
    pdf.text("Tiger's Mark Corporation - Inventory Report", pageWidth / 2, 15, { align: "center" });
    pdf.setFontSize(10);
    pdf.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, 22, { align: "center" });

    // Capture the report content
    const canvas = await html2canvas(reportRef.current, {
      scale: 2,
      useCORS: true,
      logging: false,
    });

    const imgData = canvas.toDataURL("image/png");
    const imgWidth = pageWidth - 20;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    
    let heightLeft = imgHeight;
    let position = 30;

    pdf.addImage(imgData, "PNG", 10, position, imgWidth, imgHeight);
    heightLeft -= (pageHeight - position);

    while (heightLeft > 0) {
      position = heightLeft - imgHeight + 10;
      pdf.addPage();
      pdf.addImage(imgData, "PNG", 10, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    pdf.save(`TigersMarkCorp_Report_${new Date().toISOString().split("T")[0]}.pdf`);
  };

  // Fetch inventory data
  useEffect(() => {
    const fetchInventory = async () => {
      const { data, error } = await supabase
        .from("inventory_items")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        toast({
          title: "Error",
          description: "Failed to fetch inventory data",
          variant: "destructive",
        });
        return;
      }

      setInventoryData(data || []);
    };

    fetchInventory();

    // Set up real-time subscription for inventory
    const inventoryChannel = supabase
      .channel("inventory-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "inventory_items",
        },
        () => {
          fetchInventory();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(inventoryChannel);
    };
  }, [toast]);

  // Fetch borrowed items data
  useEffect(() => {
    const fetchBorrowed = async () => {
      const { data, error } = await supabase
        .from("borrowed_items")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        toast({
          title: "Error",
          description: "Failed to fetch borrowed items data",
          variant: "destructive",
        });
        return;
      }

      setBorrowedData(data || []);
    };

    fetchBorrowed();

    // Set up real-time subscription for borrowed items
    const borrowedChannel = supabase
      .channel("borrowed-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "borrowed_items",
        },
        () => {
          fetchBorrowed();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(borrowedChannel);
    };
  }, [toast]);

  // Calculate summary data from real data
  const summaryData = {
    totalItems: inventoryData.reduce((sum, item) => sum + (item.quantity || 0), 0),
    inStock: inventoryData.filter(item => item.status === "In Stock").length,
    lowStock: inventoryData.filter(item => item.status === "Low Stock").length,
    borrowed: borrowedData.filter(item => item.status === "borrowed" || !item.actual_return_date).length,
    defected: inventoryData.filter(item => item.condition === "Defected").length,
    totalValue: "₱" + inventoryData.reduce((sum, item) => sum + ((item.unit_price || 0) * (item.quantity || 0)), 0).toLocaleString(),
  };

  const defectedItems = inventoryData.filter(item => item.condition === "Defected");

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-border bg-card px-6 shadow-sm">
            <div className="flex items-center gap-4">
              <SidebarTrigger />
              <h1 className="text-xl font-bold text-foreground">Reports</h1>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={handleDownloadPDF} className="gap-2">
                <Download className="h-4 w-4" />
                Download PDF
              </Button>
              <Button variant="outline" size="sm" onClick={handleLogout} className="gap-2">
                <LogOut className="h-4 w-4" />
                Logout
              </Button>
            </div>
          </header>

          <main className="flex-1 p-6">
            <div ref={reportRef} className="space-y-6 bg-background">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Total Items</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold text-foreground">{summaryData.totalItems}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">In Stock</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold text-primary">{summaryData.inStock}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Low Stock</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold text-destructive">{summaryData.lowStock}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Borrowed</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold text-foreground">{summaryData.borrowed}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Defected</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold text-destructive">{summaryData.defected}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Inventory Report */}
              <Card>
                <CardHeader>
                  <CardTitle>Inventory Report</CardTitle>
                  <CardDescription>Complete inventory listing with current status</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item ID</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Last Updated</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {inventoryData.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground">
                            No inventory items found
                          </TableCell>
                        </TableRow>
                      ) : (
                        inventoryData.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.id.slice(0, 8)}</TableCell>
                            <TableCell>{item.name}</TableCell>
                            <TableCell>{item.category}</TableCell>
                            <TableCell>{item.quantity}</TableCell>
                            <TableCell>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                item.status === "In Stock" 
                                  ? "bg-primary/10 text-primary" 
                                  : "bg-destructive/10 text-destructive"
                              }`}>
                                {item.status}
                              </span>
                            </TableCell>
                            <TableCell>{item.location}</TableCell>
                            <TableCell>{new Date(item.updated_at).toLocaleDateString()}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Borrowed Items Report */}
              <Card>
                <CardHeader>
                  <CardTitle>Borrowed Items Report</CardTitle>
                  <CardDescription>Currently borrowed inventory items</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Reference ID</TableHead>
                        <TableHead>Item</TableHead>
                        <TableHead>Borrower</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Borrow Date</TableHead>
                        <TableHead>Return Date</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {borrowedData.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground">
                            No borrowed items found
                          </TableCell>
                        </TableRow>
                      ) : (
                        borrowedData.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.id.slice(0, 8)}</TableCell>
                            <TableCell>{item.item_name}</TableCell>
                            <TableCell>{item.borrower_name}</TableCell>
                            <TableCell>{item.borrower_department || "N/A"}</TableCell>
                            <TableCell>{new Date(item.borrow_date).toLocaleDateString()}</TableCell>
                            <TableCell>{new Date(item.return_date).toLocaleDateString()}</TableCell>
                            <TableCell>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                !item.actual_return_date 
                                  ? "bg-primary/10 text-primary" 
                                  : "bg-muted/10 text-muted-foreground"
                              }`}>
                                {!item.actual_return_date ? "Active" : "Returned"}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Defected Items Report */}
              <Card>
                <CardHeader>
                  <CardTitle>Defected Items Report</CardTitle>
                  <CardDescription>Items marked as defected requiring attention</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item ID</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Reported Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {defectedItems.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground">
                            No defected items found
                          </TableCell>
                        </TableRow>
                      ) : (
                        defectedItems.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.id.slice(0, 8)}</TableCell>
                            <TableCell>{item.name}</TableCell>
                            <TableCell>{item.category}</TableCell>
                            <TableCell>{item.quantity}</TableCell>
                            <TableCell>{item.location}</TableCell>
                            <TableCell>{new Date(item.updated_at).toLocaleDateString()}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default Reports;
