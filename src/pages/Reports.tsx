import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { LogOut, Download, Search, Pencil, Trash2 } from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { useRef, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useActivityLog } from "@/hooks/useActivityLog";

const Reports = () => {
  const navigate = useNavigate();
  const reportRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { logActivity } = useActivityLog();
  const [inventoryData, setInventoryData] = useState<any[]>([]);
  const [borrowedData, setBorrowedData] = useState<any[]>([]);
  const [inventorySearch, setInventorySearch] = useState("");
  const [borrowedSearch, setBorrowedSearch] = useState("");
  const [defectedSearch, setDefectedSearch] = useState("");
  
  // Edit/Delete state for Inventory
  const [editInventoryOpen, setEditInventoryOpen] = useState(false);
  const [deleteInventoryOpen, setDeleteInventoryOpen] = useState(false);
  const [selectedInventory, setSelectedInventory] = useState<any>(null);
  const [editInventoryForm, setEditInventoryForm] = useState({ name: "", category: "", quantity: 0, status: "", location: "" });
  
  // Edit/Delete state for Borrowed
  const [editBorrowedOpen, setEditBorrowedOpen] = useState(false);
  const [deleteBorrowedOpen, setDeleteBorrowedOpen] = useState(false);
  const [selectedBorrowed, setSelectedBorrowed] = useState<any>(null);
  const [editBorrowedForm, setEditBorrowedForm] = useState({ item_name: "", borrower_name: "", borrower_department: "", borrow_date: "", return_date: "" });
  
  // Edit/Delete state for Defected
  const [deleteDefectedOpen, setDeleteDefectedOpen] = useState(false);
  const [selectedDefected, setSelectedDefected] = useState<any>(null);

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

  // Filter and sort inventory data
  const filteredInventory = inventoryData
    .filter(item => 
      item.name.toLowerCase().includes(inventorySearch.toLowerCase()) ||
      item.category.toLowerCase().includes(inventorySearch.toLowerCase()) ||
      item.location.toLowerCase().includes(inventorySearch.toLowerCase())
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  // Filter and sort borrowed data
  const filteredBorrowed = borrowedData
    .filter(item =>
      item.item_name.toLowerCase().includes(borrowedSearch.toLowerCase()) ||
      item.borrower_name.toLowerCase().includes(borrowedSearch.toLowerCase()) ||
      (item.borrower_department || '').toLowerCase().includes(borrowedSearch.toLowerCase())
    )
    .sort((a, b) => a.item_name.localeCompare(b.item_name));

  // Filter and sort defected items
  const defectedItems = inventoryData
    .filter(item => item.condition === "Defected")
    .filter(item =>
      item.name.toLowerCase().includes(defectedSearch.toLowerCase()) ||
      item.category.toLowerCase().includes(defectedSearch.toLowerCase()) ||
      item.location.toLowerCase().includes(defectedSearch.toLowerCase())
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  // Handler functions for Inventory CRUD
  const handleEditInventory = (item: any) => {
    setSelectedInventory(item);
    setEditInventoryForm({ name: item.name, category: item.category, quantity: item.quantity, status: item.status, location: item.location });
    setEditInventoryOpen(true);
  };

  const handleUpdateInventory = async () => {
    if (!selectedInventory) return;
    const { error } = await supabase.from("inventory_items").update(editInventoryForm).eq("id", selectedInventory.id);
    if (error) {
      toast({ title: "Error", description: "Failed to update inventory item", variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Inventory item updated" });
      logActivity("UPDATE", `Updated inventory item: ${editInventoryForm.name}`, "inventory_items", selectedInventory.id);
      setEditInventoryOpen(false);
    }
  };

  const handleDeleteInventory = async () => {
    if (!selectedInventory) return;
    const { error } = await supabase.from("inventory_items").delete().eq("id", selectedInventory.id);
    if (error) {
      toast({ title: "Error", description: "Failed to delete inventory item", variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Inventory item deleted" });
      logActivity("DELETE", `Deleted inventory item: ${selectedInventory.name}`, "inventory_items", selectedInventory.id);
      setDeleteInventoryOpen(false);
    }
  };

  // Handler functions for Borrowed CRUD
  const handleEditBorrowed = (item: any) => {
    setSelectedBorrowed(item);
    setEditBorrowedForm({ item_name: item.item_name, borrower_name: item.borrower_name, borrower_department: item.borrower_department || "", borrow_date: item.borrow_date, return_date: item.return_date });
    setEditBorrowedOpen(true);
  };

  const handleUpdateBorrowed = async () => {
    if (!selectedBorrowed) return;
    const { error } = await supabase.from("borrowed_items").update(editBorrowedForm).eq("id", selectedBorrowed.id);
    if (error) {
      toast({ title: "Error", description: "Failed to update borrowed item", variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Borrowed item updated" });
      logActivity("UPDATE", `Updated borrowed item: ${editBorrowedForm.item_name}`, "borrowed_items", selectedBorrowed.id);
      setEditBorrowedOpen(false);
    }
  };

  const handleDeleteBorrowed = async () => {
    if (!selectedBorrowed) return;
    const { error } = await supabase.from("borrowed_items").delete().eq("id", selectedBorrowed.id);
    if (error) {
      toast({ title: "Error", description: "Failed to delete borrowed item", variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Borrowed item deleted" });
      logActivity("DELETE", `Deleted borrowed item: ${selectedBorrowed.item_name}`, "borrowed_items", selectedBorrowed.id);
      setDeleteBorrowedOpen(false);
    }
  };

  // Handler for Defected (uses inventory_items table)
  const handleDeleteDefected = async () => {
    if (!selectedDefected) return;
    const { error } = await supabase.from("inventory_items").delete().eq("id", selectedDefected.id);
    if (error) {
      toast({ title: "Error", description: "Failed to delete defected item", variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Defected item deleted" });
      logActivity("DELETE", `Deleted defected item: ${selectedDefected.name}`, "inventory_items", selectedDefected.id);
      setDeleteDefectedOpen(false);
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
                  <div className="relative mt-4">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search inventory by name, category, or location..."
                      value={inventorySearch}
                      onChange={(e) => setInventorySearch(e.target.value)}
                      className="pl-10"
                    />
                  </div>
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
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredInventory.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center text-muted-foreground">
                            {inventorySearch ? "No matching inventory items found" : "No inventory items found"}
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredInventory.map((item) => (
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
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button variant="outline" size="sm" onClick={() => handleEditInventory(item)}>
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <Button variant="destructive" size="sm" onClick={() => { setSelectedInventory(item); setDeleteInventoryOpen(true); }}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </TableCell>
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
                  <div className="relative mt-4">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search borrowed items by name, borrower, or department..."
                      value={borrowedSearch}
                      onChange={(e) => setBorrowedSearch(e.target.value)}
                      className="pl-10"
                    />
                  </div>
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
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredBorrowed.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center text-muted-foreground">
                            {borrowedSearch ? "No matching borrowed items found" : "No borrowed items found"}
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredBorrowed.map((item) => (
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
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button variant="outline" size="sm" onClick={() => handleEditBorrowed(item)}>
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <Button variant="destructive" size="sm" onClick={() => { setSelectedBorrowed(item); setDeleteBorrowedOpen(true); }}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
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
                  <div className="relative mt-4">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search defected items by name, category, or location..."
                      value={defectedSearch}
                      onChange={(e) => setDefectedSearch(e.target.value)}
                      className="pl-10"
                    />
                  </div>
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
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {defectedItems.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground">
                            {defectedSearch ? "No matching defected items found" : "No defected items found"}
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
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button variant="outline" size="sm" onClick={() => handleEditInventory(item)}>
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <Button variant="destructive" size="sm" onClick={() => { setSelectedDefected(item); setDeleteDefectedOpen(true); }}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </TableCell>
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

      {/* Edit Inventory Dialog */}
      <Dialog open={editInventoryOpen} onOpenChange={setEditInventoryOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col border-border/60 shadow-elegant bg-card !fixed !left-1/2 !top-1/2 !-translate-x-1/2 !-translate-y-1/2">
          <DialogHeader>
            <DialogTitle>Edit Inventory Item</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Name</Label>
              <Input value={editInventoryForm.name} onChange={(e) => setEditInventoryForm({...editInventoryForm, name: e.target.value})} />
            </div>
            <div className="grid gap-2">
              <Label>Category</Label>
              <Input value={editInventoryForm.category} onChange={(e) => setEditInventoryForm({...editInventoryForm, category: e.target.value})} />
            </div>
            <div className="grid gap-2">
              <Label>Quantity</Label>
              <Input type="number" value={editInventoryForm.quantity} onChange={(e) => setEditInventoryForm({...editInventoryForm, quantity: parseInt(e.target.value) || 0})} />
            </div>
            <div className="grid gap-2">
              <Label>Status</Label>
              <Select value={editInventoryForm.status} onValueChange={(val) => setEditInventoryForm({...editInventoryForm, status: val})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="In Stock">In Stock</SelectItem>
                  <SelectItem value="Low Stock">Low Stock</SelectItem>
                  <SelectItem value="Out of Stock">Out of Stock</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Location</Label>
              <Input value={editInventoryForm.location} onChange={(e) => setEditInventoryForm({...editInventoryForm, location: e.target.value})} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditInventoryOpen(false)}>Cancel</Button>
            <Button onClick={handleUpdateInventory}>Update</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Inventory Dialog */}
      <AlertDialog open={deleteInventoryOpen} onOpenChange={setDeleteInventoryOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Inventory Item</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete "{selectedInventory?.name}"? This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteInventory}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Borrowed Dialog */}
      <Dialog open={editBorrowedOpen} onOpenChange={setEditBorrowedOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col border-border/60 shadow-elegant bg-card !fixed !left-1/2 !top-1/2 !-translate-x-1/2 !-translate-y-1/2">
          <DialogHeader>
            <DialogTitle>Edit Borrowed Item</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Item Name</Label>
              <Input value={editBorrowedForm.item_name} onChange={(e) => setEditBorrowedForm({...editBorrowedForm, item_name: e.target.value})} />
            </div>
            <div className="grid gap-2">
              <Label>Borrower Name</Label>
              <Input value={editBorrowedForm.borrower_name} onChange={(e) => setEditBorrowedForm({...editBorrowedForm, borrower_name: e.target.value})} />
            </div>
            <div className="grid gap-2">
              <Label>Department</Label>
              <Input value={editBorrowedForm.borrower_department} onChange={(e) => setEditBorrowedForm({...editBorrowedForm, borrower_department: e.target.value})} />
            </div>
            <div className="grid gap-2">
              <Label>Borrow Date</Label>
              <Input type="date" value={editBorrowedForm.borrow_date} onChange={(e) => setEditBorrowedForm({...editBorrowedForm, borrow_date: e.target.value})} />
            </div>
            <div className="grid gap-2">
              <Label>Return Date</Label>
              <Input type="date" value={editBorrowedForm.return_date} onChange={(e) => setEditBorrowedForm({...editBorrowedForm, return_date: e.target.value})} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditBorrowedOpen(false)}>Cancel</Button>
            <Button onClick={handleUpdateBorrowed}>Update</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Borrowed Dialog */}
      <AlertDialog open={deleteBorrowedOpen} onOpenChange={setDeleteBorrowedOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Borrowed Item</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete the borrowed record for "{selectedBorrowed?.item_name}"? This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteBorrowed}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Defected Dialog */}
      <AlertDialog open={deleteDefectedOpen} onOpenChange={setDeleteDefectedOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Defected Item</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete "{selectedDefected?.name}"? This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteDefected}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarProvider>
  );
};

export default Reports;
