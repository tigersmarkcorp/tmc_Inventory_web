import { useState, useRef, useEffect } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, User, Clock, Package, Plus, Trash2, Camera, Edit, PenTool, Download } from "lucide-react";
import inventoryPlaceholder from "@/assets/inventory-placeholder.jpg";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useActivityLog } from "@/hooks/useActivityLog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SignaturePad } from "@/components/SignaturePad";
import jsPDF from "jspdf";

const BorrowedItems = () => {
  const { toast } = useToast();
  const { logActivity } = useActivityLog();
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);
  const [editImage, setEditImage] = useState<File | null>(null);
  const [selectedInventoryItem, setSelectedInventoryItem] = useState<any>(null);
  const [isSignatureDialogOpen, setIsSignatureDialogOpen] = useState(false);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [newBorrow, setNewBorrow] = useState({
    item_id: "",
    item_name: "",
    borrower_name: "",
    borrower_department: "",
    quantity: 1,
    borrow_date: new Date().toISOString().split('T')[0],
    return_date: "",
    description: "",
    image: null as File | null,
    unit_price: 0,
  });

  // Fetch inventory items for selection
  const { data: inventoryItems = [] } = useQuery({
    queryKey: ['inventory-items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('*')
        .gt('quantity', 0) // Only show items with available stock
        .order('name', { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
  });

  const { data: borrowedItems = [] } = useQuery({
    queryKey: ['borrowed-items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('borrowed_items')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
  });

  // When inventory item is selected, update form fields
  useEffect(() => {
    if (selectedInventoryItem) {
      setNewBorrow(prev => ({
        ...prev,
        item_id: selectedInventoryItem.id,
        item_name: selectedInventoryItem.name,
        unit_price: selectedInventoryItem.unit_price || 0,
        quantity: 1, // Reset to 1
      }));
    }
  }, [selectedInventoryItem]);

  const addBorrowMutation = useMutation({
    mutationFn: async ({ borrow, signature }: { borrow: typeof newBorrow; signature: string | null }) => {
      // First, check if inventory has enough quantity
      const { data: inventoryItem, error: fetchError } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('id', borrow.item_id)
        .single();
      
      if (fetchError) throw new Error("Failed to fetch inventory item");
      if (!inventoryItem) throw new Error("Inventory item not found");
      if (inventoryItem.quantity < borrow.quantity) {
        throw new Error(`Only ${inventoryItem.quantity} items available in stock`);
      }

      let imageUrl = inventoryItem.image_url; // Use inventory image by default
      let signatureUrl = null;
      
      // Upload custom image if provided
      if (borrow.image) {
        const fileExt = borrow.image.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('item-images')
          .upload(filePath, borrow.image);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('item-images')
          .getPublicUrl(filePath);

        imageUrl = publicUrl;
      }

      // Upload signature if provided
      if (signature) {
        // Convert data URL to blob
        const response = await fetch(signature);
        const blob = await response.blob();
        const signatureFileName = `signature_${Date.now()}.png`;

        const { error: signatureUploadError } = await supabase.storage
          .from('item-images')
          .upload(signatureFileName, blob, { contentType: 'image/png' });

        if (signatureUploadError) throw signatureUploadError;

        const { data: { publicUrl: signaturePublicUrl } } = supabase.storage
          .from('item-images')
          .getPublicUrl(signatureFileName);

        signatureUrl = signaturePublicUrl;
      }

      // Deduct from inventory
      const newQuantity = inventoryItem.quantity - borrow.quantity;
      const newStatus = newQuantity === 0 ? "Out of Stock" : newQuantity < 30 ? "Low Stock" : "In Stock";
      
      const { error: updateError } = await supabase
        .from('inventory_items')
        .update({ quantity: newQuantity, status: newStatus })
        .eq('id', borrow.item_id);
      
      if (updateError) throw updateError;

      // Create borrowed item record
      const { data, error } = await supabase
        .from('borrowed_items')
        .insert([{ 
          item_id: borrow.item_id,
          item_name: borrow.item_name,
          borrower_name: borrow.borrower_name,
          borrower_department: borrow.borrower_department,
          quantity: borrow.quantity,
          borrow_date: borrow.borrow_date,
          return_date: borrow.return_date,
          description: borrow.description,
          unit_price: borrow.unit_price,
          image_url: imageUrl,
          signature_url: signatureUrl,
          status: 'Active' 
        }])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['borrowed-items'] });
      queryClient.invalidateQueries({ queryKey: ['borrowed-stats'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-stats'] });
      logActivity('ADD', `Added borrowed item: ${data.item_name} for ${data.borrower_name} (Qty: ${data.quantity})`, 'borrowed_items', data.id);
      toast({
        title: "Success",
        description: "Borrowed item added and inventory updated",
      });
      setIsAddDialogOpen(false);
      setSelectedInventoryItem(null);
      setSignatureDataUrl(null);
      setNewBorrow({
        item_id: "",
        item_name: "",
        borrower_name: "",
        borrower_department: "",
        quantity: 1,
        borrow_date: new Date().toISOString().split('T')[0],
        return_date: "",
        description: "",
        image: null,
        unit_price: 0,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add borrowed item",
        variant: "destructive",
      });
    },
  });

  const markReturnedMutation = useMutation({
    mutationFn: async (id: string) => {
      // Get the borrowed item to find quantity and item_id
      const { data: borrowedItem, error: fetchError } = await supabase
        .from('borrowed_items')
        .select('*')
        .eq('id', id)
        .single();
      
      if (fetchError) throw fetchError;
      if (!borrowedItem) throw new Error("Borrowed item not found");

      // Restore quantity to inventory if item_id exists
      if (borrowedItem.item_id) {
        const { data: inventoryItem } = await supabase
          .from('inventory_items')
          .select('quantity')
          .eq('id', borrowedItem.item_id)
          .single();

        if (inventoryItem) {
          const newQuantity = inventoryItem.quantity + borrowedItem.quantity;
          const newStatus = newQuantity === 0 ? "Out of Stock" : newQuantity < 30 ? "Low Stock" : "In Stock";
          
          await supabase
            .from('inventory_items')
            .update({ quantity: newQuantity, status: newStatus })
            .eq('id', borrowedItem.item_id);
        }
      }

      // Mark as returned
      const { data, error } = await supabase
        .from('borrowed_items')
        .update({ 
          status: 'Returned',
          actual_return_date: new Date().toISOString().split('T')[0]
        })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['borrowed-items'] });
      queryClient.invalidateQueries({ queryKey: ['borrowed-stats'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-stats'] });
      logActivity('UPDATE', `Marked item as returned: ${data.item_name} (Qty: ${data.quantity} restored to inventory)`, 'borrowed_items', data.id);
      toast({
        title: "Success",
        description: "Item marked as returned and inventory updated",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to mark item as returned",
        variant: "destructive",
      });
    },
  });

  const extendBorrowMutation = useMutation({
    mutationFn: async (id: string) => {
      const item = borrowedItems.find((b: any) => b.id === id);
      if (!item) throw new Error("Item not found");

      const currentReturnDate = new Date(item.return_date);
      const newReturnDate = new Date(currentReturnDate);
      newReturnDate.setDate(newReturnDate.getDate() + 7);

      const { data, error } = await supabase
        .from('borrowed_items')
        .update({ return_date: newReturnDate.toISOString().split('T')[0] })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['borrowed-items'] });
      logActivity('UPDATE', `Extended return date for: ${data.item_name}`, 'borrowed_items', data.id);
      toast({
        title: "Success",
        description: "Return date extended by 7 days",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to extend borrow period",
        variant: "destructive",
      });
    },
  });

  const updateBorrowMutation = useMutation({
    mutationFn: async ({ id, updates, image }: { id: string; updates: any; image?: File | null }) => {
      let imageUrl = updates.image_url;
      
      // Upload new image if provided
      if (image) {
        // Delete old image if exists
        if (updates.image_url) {
          const oldPath = updates.image_url.split('/').pop();
          await supabase.storage.from('item-images').remove([oldPath]);
        }

        const fileExt = image.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('item-images')
          .upload(filePath, image);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('item-images')
          .getPublicUrl(filePath);

        imageUrl = publicUrl;
      }
      
      const { data, error } = await supabase
        .from('borrowed_items')
        .update({ 
          item_name: updates.item_name,
          borrower_name: updates.borrower_name,
          borrower_department: updates.borrower_department,
          quantity: updates.quantity,
          borrow_date: updates.borrow_date,
          return_date: updates.return_date,
          description: updates.description,
          unit_price: updates.unit_price,
          image_url: imageUrl,
        })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['borrowed-items'] });
      queryClient.invalidateQueries({ queryKey: ['borrowed-stats'] });
      logActivity('UPDATE', `Updated borrowed item: ${data.item_name}`, 'borrowed_items', data.id);
      toast({
        title: "Success",
        description: "Borrowed item updated successfully",
      });
      setIsEditDialogOpen(false);
      setEditingItem(null);
      setEditImage(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update borrowed item",
        variant: "destructive",
      });
    },
  });

  const deleteBorrowMutation = useMutation({
    mutationFn: async (id: string) => {
      // Get the borrowed item to find quantity and item_id
      const { data: borrowedItem, error: fetchError } = await supabase
        .from('borrowed_items')
        .select('*')
        .eq('id', id)
        .single();
      
      if (fetchError) throw fetchError;
      if (!borrowedItem) throw new Error("Borrowed item not found");

      // If item is not returned and has item_id, restore quantity to inventory
      if (borrowedItem.status !== 'Returned' && borrowedItem.item_id) {
        const { data: inventoryItem } = await supabase
          .from('inventory_items')
          .select('quantity')
          .eq('id', borrowedItem.item_id)
          .single();

        if (inventoryItem) {
          const newQuantity = inventoryItem.quantity + borrowedItem.quantity;
          const newStatus = newQuantity === 0 ? "Out of Stock" : newQuantity < 30 ? "Low Stock" : "In Stock";
          
          await supabase
            .from('inventory_items')
            .update({ quantity: newQuantity, status: newStatus })
            .eq('id', borrowedItem.item_id);
        }
      }

      // Delete image from storage if exists
      if (borrowedItem.image_url) {
        const imagePath = borrowedItem.image_url.split('/').pop();
        await supabase.storage.from('item-images').remove([imagePath]);
      }

      const { error } = await supabase
        .from('borrowed_items')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      return borrowedItem;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['borrowed-items'] });
      queryClient.invalidateQueries({ queryKey: ['borrowed-stats'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-stats'] });
      
      const restoredMsg = data.status !== 'Returned' && data.item_id 
        ? ` (Qty: ${data.quantity} restored to inventory)` 
        : '';
      
      toast({
        title: "Success",
        description: `Borrowed item deleted${restoredMsg}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete borrowed item",
        variant: "destructive",
      });
    },
  });

  const handleAddBorrow = () => {
    if (!newBorrow.item_id || !newBorrow.borrower_name || !newBorrow.return_date) {
      toast({
        title: "Error",
        description: "Please select an item, enter borrower name, and return date",
        variant: "destructive",
      });
      return;
    }

    if (!signatureDataUrl) {
      toast({
        title: "Error",
        description: "Please add borrower's signature",
        variant: "destructive",
      });
      return;
    }

    if (selectedInventoryItem && newBorrow.quantity > selectedInventoryItem.quantity) {
      toast({
        title: "Error",
        description: `Only ${selectedInventoryItem.quantity} items available in stock`,
        variant: "destructive",
      });
      return;
    }

    addBorrowMutation.mutate({ borrow: newBorrow, signature: signatureDataUrl });
  };

  const handleEditBorrow = () => {
    if (!editingItem) return;

    updateBorrowMutation.mutate({
      id: editingItem.id,
      updates: {
        item_name: editingItem.item_name,
        borrower_name: editingItem.borrower_name,
        borrower_department: editingItem.borrower_department,
        quantity: editingItem.quantity,
        borrow_date: editingItem.borrow_date,
        return_date: editingItem.return_date,
        description: editingItem.description,
        unit_price: editingItem.unit_price,
        image_url: editingItem.image_url,
      },
      image: editImage,
    });
  };

  const handleDeleteBorrow = (id: string, itemName: string) => {
    if (window.confirm("Are you sure you want to delete this borrowed item? If active, the quantity will be restored to inventory.")) {
      deleteBorrowMutation.mutate(id, {
        onSuccess: () => {
          logActivity('DELETE', `Deleted borrowed item: ${itemName}`, 'borrowed_items', id);
        }
      });
    }
  };

  const handleCameraCapture = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleEditCameraCapture = () => {
    if (editFileInputRef.current) {
      editFileInputRef.current.click();
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Active":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "Overdue":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      case "Returned":
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  };

  const handleDownloadPDF = async () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginLeft = 12;
    const marginRight = 12;
    const marginTop = 10;
    let yPos = marginTop;

    // Title
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('BORROWED ITEMS REPORT', pageWidth / 2, yPos + 8, { align: 'center' });
    
    yPos += 14;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    doc.text(`Generated: ${new Date().toLocaleDateString('en-PH', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })}`, marginLeft, yPos);
    doc.text(`Total Records: ${borrowedItems.length}`, pageWidth - marginRight, yPos, { align: 'right' });

    yPos += 8;

    // Excel-like table configuration with Signature column
    // NOTE: widths are in mm; we keep the table within margins and auto-scale if needed.
    const availableWidth = pageWidth - marginLeft - marginRight;
    const baseColWidths = [8, 28, 24, 18, 10, 16, 18, 15, 15, 13, 16]; // No., Item, Borrower, Dept, Qty, Price, Total, Borrow, Return, Status, Signature
    const baseTableWidth = baseColWidths.reduce((a, b) => a + b, 0);
    const scale = Math.min(1, availableWidth / baseTableWidth);
    const colWidths = baseColWidths.map((w) => w * scale);
    const headers = ['No.', 'Item Name', 'Borrower', 'Dept', 'Qty', 'Price', 'Total', 'Borrow', 'Return', 'Status', 'Signature'];
    const tableWidth = colWidths.reduce((a, b) => a + b, 0);
    const tableStartX = marginLeft + (availableWidth - tableWidth) / 2;
    const rowHeight = 8; // compact, Excel-like
    const headerHeight = 8;
    const signatureColOffset = colWidths.slice(0, headers.length - 1).reduce((a, b) => a + b, 0);

    // Sort borrowed items alphabetically by item name
    const sortedItems = [...borrowedItems].sort((a: any, b: any) => 
      a.item_name.localeCompare(b.item_name)
    );

    // Pre-load all signature images
    const signatureImages: { [key: string]: string | null } = {};
    for (const item of sortedItems) {
      if (item.signature_url) {
        try {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          await new Promise<void>((resolve) => {
            img.onload = () => {
              try {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                  ctx.drawImage(img, 0, 0);
                  signatureImages[item.id] = canvas.toDataURL('image/png');
                }
              } catch {
                signatureImages[item.id] = null;
              }
              resolve();
            };
            img.onerror = () => {
              signatureImages[item.id] = null;
              resolve();
            };
            img.src = item.signature_url;
          });
        } catch {
          signatureImages[item.id] = null;
        }
      } else {
        signatureImages[item.id] = null;
      }
    }

    // Function to draw table header
    const drawTableHeader = (startY: number) => {
      // Header background - dark green like Excel
      doc.setFillColor(56, 142, 60);
      doc.rect(tableStartX, startY, tableWidth, headerHeight, 'F');
      
      // Header border
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.3);
      doc.rect(tableStartX, startY, tableWidth, headerHeight, 'S');
      
      // Draw vertical lines for header cells
      let xPos = tableStartX;
      colWidths.forEach((width, i) => {
        if (i > 0) {
          doc.line(xPos, startY, xPos, startY + headerHeight);
        }
        xPos += width;
      });
      
      // Header text
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      
      xPos = tableStartX;
      headers.forEach((header, i) => {
        const textWidth = doc.getTextWidth(header);
        const cellCenterX = xPos + (colWidths[i] - textWidth) / 2;
        doc.text(header, cellCenterX, startY + 5.5);
        xPos += colWidths[i];
      });
      
      return startY + headerHeight;
    };

    // Draw initial header
    yPos = drawTableHeader(yPos);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);

    // Format currency
    const formatCurrency = (value: number) => {
      return `P${value.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    // Table rows
    for (let index = 0; index < sortedItems.length; index++) {
      const item = sortedItems[index];
      
      // Check if we need a new page
      if (yPos + rowHeight > pageHeight - 22) {
        doc.addPage();
        yPos = marginTop;
        yPos = drawTableHeader(yPos);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6);
      }

      // Alternate row colors - light green/white like Excel
      if (index % 2 === 0) {
        doc.setFillColor(232, 245, 233);
      } else {
        doc.setFillColor(255, 255, 255);
      }
      doc.rect(tableStartX, yPos, tableWidth, rowHeight, 'F');

      // Row border
      doc.setDrawColor(180, 180, 180);
      doc.setLineWidth(0.1);
      doc.rect(tableStartX, yPos, tableWidth, rowHeight, 'S');
      
      // Draw vertical cell borders
      let xPos = tableStartX;
      colWidths.forEach((width, i) => {
        if (i > 0) {
          doc.line(xPos, yPos, xPos, yPos + rowHeight);
        }
        xPos += width;
      });

      // Row data
      doc.setTextColor(0, 0, 0);
      xPos = tableStartX;

      const textY = yPos + rowHeight / 2 + 2;
      
      const unitPrice = item.unit_price || 0;
      const totalValue = unitPrice * item.quantity;
      
      const rowData = [
        (index + 1).toString(),
        item.item_name.length > 14 ? item.item_name.substring(0, 12) + '..' : item.item_name,
        item.borrower_name.length > 12 ? item.borrower_name.substring(0, 10) + '..' : item.borrower_name,
        (item.borrower_department || '-').length > 10 ? item.borrower_department.substring(0, 8) + '..' : (item.borrower_department || '-'),
        item.quantity.toString(),
        formatCurrency(unitPrice),
        formatCurrency(totalValue),
        new Date(item.borrow_date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: '2-digit' }),
        new Date(item.return_date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: '2-digit' }),
        item.status
      ];

      // Draw text for each column except signature
      rowData.forEach((text, i) => {
        // Center numeric columns (0, 4, 5, 6) and status (9), left-align text columns
        if (i === 0 || i === 4 || i === 5 || i === 6 || i === 9) {
          const textWidth = doc.getTextWidth(text);
          const cellCenterX = xPos + (colWidths[i] - textWidth) / 2;
          doc.text(text, cellCenterX, textY);
        } else {
          doc.text(text, xPos + 1, textY);
        }
        xPos += colWidths[i];
      });

      // Add signature or N/A in the last column
      const signatureColX = tableStartX + signatureColOffset;
      const signatureColWidth = colWidths[headers.length - 1];
      
      const sigDataUrl = signatureImages[item.id];
      if (sigDataUrl) {
        // Add signature image centered in cell
        const sigPadding = 1;
        const sigWidth = Math.max(0, signatureColWidth - sigPadding * 2);
        const sigHeight = Math.max(0, rowHeight - sigPadding * 2);
        try {
          doc.addImage(sigDataUrl, 'PNG', signatureColX + sigPadding, yPos + sigPadding, sigWidth, sigHeight);
        } catch {
          // Fallback to N/A if image fails
          doc.setFontSize(6);
          doc.setTextColor(150, 150, 150);
          const naText = 'N/A';
          const naWidth = doc.getTextWidth(naText);
          doc.text(naText, signatureColX + (signatureColWidth - naWidth) / 2, textY);
          doc.setFontSize(6);
          doc.setTextColor(0, 0, 0);
        }
      } else {
        // Show N/A centered
        doc.setFontSize(6);
        doc.setTextColor(150, 150, 150);
        const naText = 'N/A';
        const naWidth = doc.getTextWidth(naText);
        doc.text(naText, signatureColX + (signatureColWidth - naWidth) / 2, textY);
        doc.setFontSize(6);
        doc.setTextColor(0, 0, 0);
      }

      yPos += rowHeight;
    }

    // Summary row - dark background
    const totalBorrowed = borrowedItems.reduce((sum: number, item: any) => sum + item.quantity, 0);
    const grandTotal = borrowedItems.reduce((sum: number, item: any) => sum + (item.unit_price || 0) * item.quantity, 0);
    const activeCount = borrowedItems.filter((item: any) => item.status === 'Active').length;
    const returnedCount = borrowedItems.filter((item: any) => item.status === 'Returned').length;

    if (yPos + 10 > pageHeight - 18) {
      doc.addPage();
      yPos = marginTop;
    }

    doc.setFillColor(33, 33, 33);
    doc.rect(tableStartX, yPos, tableWidth, 9, 'F');
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.3);
    doc.rect(tableStartX, yPos, tableWidth, 9, 'S');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(6);
    doc.setFont('helvetica', 'bold');
    doc.text(`TOTAL: ${borrowedItems.length} Records | ${totalBorrowed} Items | Active: ${activeCount} | Returned: ${returnedCount}`, tableStartX + 3, yPos + 6);
    
    const totalText = formatCurrency(grandTotal);
    doc.text(totalText, tableStartX + tableWidth - 3, yPos + 6, { align: 'right' });

    // Footer
    doc.setTextColor(120, 120, 120);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text('Inventory Management System - Borrowed Items', pageWidth / 2, pageHeight - 8, { align: 'center' });

    // Save the PDF
    doc.save(`Borrowed_Items_Report_${new Date().toISOString().split('T')[0]}.pdf`);
    
    toast({
      title: "Success",
      description: "PDF report downloaded successfully",
    });
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-border bg-card px-6 shadow-sm">
            <div className="flex items-center gap-4">
              <SidebarTrigger />
              <h1 className="text-xl font-bold text-foreground">Borrowed Items</h1>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={handleDownloadPDF} className="gap-2">
                <Download className="h-4 w-4" />
                Download PDF
              </Button>
            <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
              setIsAddDialogOpen(open);
              if (!open) {
                setSelectedInventoryItem(null);
                setSignatureDataUrl(null);
                setNewBorrow({
                  item_id: "",
                  item_name: "",
                  borrower_name: "",
                  borrower_department: "",
                  quantity: 1,
                  borrow_date: new Date().toISOString().split('T')[0],
                  return_date: "",
                  description: "",
                  image: null,
                  unit_price: 0,
                });
              }
            }}>

            {/* Signature Pad Dialog */}
            <SignaturePad
              open={isSignatureDialogOpen}
              onOpenChange={setIsSignatureDialogOpen}
              onSave={(dataUrl) => setSignatureDataUrl(dataUrl)}
              existingSignature={signatureDataUrl}
            />
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Borrow
                </Button>
              </DialogTrigger>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col border-border/60 shadow-elegant bg-card !fixed !left-1/2 !top-1/2 !-translate-x-1/2 !-translate-y-1/2">
                <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/40 bg-muted/30">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-gradient-hero flex items-center justify-center shadow-md">
                      <Package className="h-5 w-5 text-primary-foreground" />
                    </div>
                    <div>
                      <DialogTitle className="text-xl font-bold text-foreground">Add Borrowed Item</DialogTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">Select from available inventory items</p>
                    </div>
                  </div>
                </DialogHeader>
                <div className="space-y-5 px-6 py-5 overflow-y-auto flex-1">
                  {/* Inventory Item Selection */}
                  <div className="space-y-2">
                    <Label htmlFor="inventory_item" className="text-sm font-medium text-foreground">Select Item from Inventory <span className="text-destructive">*</span></Label>
                    <Select
                      value={newBorrow.item_id}
                      onValueChange={(value) => {
                        const item = inventoryItems.find((i: any) => i.id === value);
                        setSelectedInventoryItem(item);
                      }}
                    >
                      <SelectTrigger className="h-11 rounded-xl border-border/60 bg-background focus:ring-2 focus:ring-primary/30">
                        <SelectValue placeholder="Choose an inventory item" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-border/60 shadow-elegant max-h-60">
                        {inventoryItems.map((item: any) => (
                          <SelectItem key={item.id} value={item.id}>
                            <div className="flex items-center gap-2">
                              <span>{item.name}</span>
                              <Badge variant="outline" className="text-xs">
                                {item.quantity} available
                              </Badge>
                            </div>
                          </SelectItem>
                        ))}
                        {inventoryItems.length === 0 && (
                          <div className="px-2 py-4 text-center text-muted-foreground text-sm">
                            No items available in inventory
                          </div>
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Show selected item details */}
                  {selectedInventoryItem && (
                    <div className="p-4 rounded-xl bg-muted/50 border border-border/40 space-y-2">
                      <div className="flex items-center gap-3">
                        <img 
                          src={selectedInventoryItem.image_url || inventoryPlaceholder} 
                          alt={selectedInventoryItem.name}
                          className="h-16 w-16 rounded-lg object-cover"
                        />
                        <div className="flex-1">
                          <h4 className="font-semibold text-foreground">{selectedInventoryItem.name}</h4>
                          <p className="text-sm text-muted-foreground">{selectedInventoryItem.category}</p>
                          <div className="flex gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">
                              {selectedInventoryItem.quantity} in stock
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              ₱{selectedInventoryItem.unit_price?.toFixed(2) || '0.00'}/unit
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="borrower_name" className="text-sm font-medium text-foreground">Borrower Name <span className="text-destructive">*</span></Label>
                      <Input
                        id="borrower_name"
                        value={newBorrow.borrower_name}
                        onChange={(e) =>
                          setNewBorrow({ ...newBorrow, borrower_name: e.target.value })
                        }
                        placeholder="Enter name"
                        className="h-11 rounded-xl border-border/60 bg-background focus:ring-2 focus:ring-primary/30"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="borrower_department" className="text-sm font-medium text-foreground">Department</Label>
                      <Input
                        id="borrower_department"
                        value={newBorrow.borrower_department}
                        onChange={(e) =>
                          setNewBorrow({ ...newBorrow, borrower_department: e.target.value })
                        }
                        placeholder="Enter department"
                        className="h-11 rounded-xl border-border/60 bg-background focus:ring-2 focus:ring-primary/30"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="quantity" className="text-sm font-medium text-foreground">
                        Quantity {selectedInventoryItem && <span className="text-muted-foreground">(max: {selectedInventoryItem.quantity})</span>}
                      </Label>
                      <Input
                        id="quantity"
                        type="number"
                        value={newBorrow.quantity}
                        onChange={(e) =>
                          setNewBorrow({
                            ...newBorrow,
                            quantity: parseInt(e.target.value) || 1,
                          })
                        }
                        min="1"
                        max={selectedInventoryItem?.quantity || undefined}
                        className="h-11 rounded-xl border-border/60 bg-background focus:ring-2 focus:ring-primary/30"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="unit_price" className="text-sm font-medium text-foreground">Unit Price</Label>
                      <Input
                        id="unit_price"
                        type="number"
                        step="0.01"
                        value={newBorrow.unit_price}
                        onChange={(e) =>
                          setNewBorrow({
                            ...newBorrow,
                            unit_price: parseFloat(e.target.value) || 0,
                          })
                        }
                        placeholder="0.00"
                        className="h-11 rounded-xl border-border/60 bg-background focus:ring-2 focus:ring-primary/30"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="borrow_date" className="text-sm font-medium text-foreground">Borrow Date</Label>
                      <Input
                        id="borrow_date"
                        type="date"
                        value={newBorrow.borrow_date}
                        onChange={(e) =>
                          setNewBorrow({ ...newBorrow, borrow_date: e.target.value })
                        }
                        className="h-11 rounded-xl border-border/60 bg-background focus:ring-2 focus:ring-primary/30"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="return_date" className="text-sm font-medium text-foreground">Return Date <span className="text-destructive">*</span></Label>
                      <Input
                        id="return_date"
                        type="date"
                        value={newBorrow.return_date}
                        onChange={(e) =>
                          setNewBorrow({ ...newBorrow, return_date: e.target.value })
                        }
                        className="h-11 rounded-xl border-border/60 bg-background focus:ring-2 focus:ring-primary/30"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description" className="text-sm font-medium text-foreground">Notes</Label>
                    <Textarea
                      id="description"
                      value={newBorrow.description}
                      onChange={(e) =>
                        setNewBorrow({ ...newBorrow, description: e.target.value })
                      }
                      placeholder="Enter any additional information"
                      rows={2}
                      className="rounded-xl border-border/60 bg-background focus:ring-2 focus:ring-primary/30 resize-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="image" className="text-sm font-medium text-foreground">Custom Image (Optional)</Label>
                    <div className="flex gap-2">
                      <Input
                        ref={fileInputRef}
                        id="image"
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null;
                          setNewBorrow({ ...newBorrow, image: file });
                        }}
                        className="flex-1 h-11 rounded-xl border-border/60 bg-background file:bg-primary file:text-primary-foreground file:border-0 file:rounded-lg file:px-3 file:py-1 file:mr-3 file:text-sm file:font-medium"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={handleCameraCapture}
                        className="h-11 w-11 rounded-xl border-border/60 hover:bg-primary/10 hover:border-primary/50"
                      >
                        <Camera className="h-4 w-4" />
                      </Button>
                    </div>
                    {newBorrow.image && (
                      <p className="text-xs text-muted-foreground bg-muted/50 px-3 py-2 rounded-lg">
                        📎 Selected: {newBorrow.image.name}
                      </p>
                    )}
                    {!newBorrow.image && selectedInventoryItem?.image_url && (
                      <p className="text-xs text-muted-foreground bg-muted/50 px-3 py-2 rounded-lg">
                        ℹ️ Will use inventory item's image
                      </p>
                    )}
                  </div>

                  {/* Signature Section */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-foreground">
                      Borrower Signature <span className="text-destructive">*</span>
                    </Label>
                    <div 
                      onClick={() => setIsSignatureDialogOpen(true)}
                      className={`border-2 border-dashed rounded-xl p-4 cursor-pointer transition-all hover:border-primary/50 hover:bg-primary/5 ${
                        signatureDataUrl 
                          ? 'border-green-500/50 bg-green-50 dark:bg-green-900/20' 
                          : 'border-border/60'
                      }`}
                    >
                      {signatureDataUrl ? (
                        <div className="flex items-center gap-3">
                          <img 
                            src={signatureDataUrl} 
                            alt="Signature" 
                            className="h-12 max-w-[150px] object-contain bg-white rounded-lg border"
                          />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-green-700 dark:text-green-400">Signature captured</p>
                            <p className="text-xs text-muted-foreground">Click to change</p>
                          </div>
                          <PenTool className="h-5 w-5 text-muted-foreground" />
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-3 py-2">
                          <PenTool className="h-5 w-5 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">Click to add signature</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex gap-3 justify-end px-6 pb-6 pt-4 border-t border-border/40 bg-muted/20">
                  <Button
                    variant="outline"
                    onClick={() => setIsAddDialogOpen(false)}
                    className="rounded-xl border-border/60 hover:bg-muted"
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleAddBorrow} disabled={addBorrowMutation.isPending} className="rounded-xl bg-gradient-hero shadow-md hover:shadow-lg transition-all">
                    {addBorrowMutation.isPending ? "Adding..." : "Add Borrow"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* Edit Dialog */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                 <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col border-border/60 shadow-elegant bg-card !fixed !left-1/2 !top-1/2 !-translate-x-1/2 !-translate-y-1/2">
                <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/40 bg-muted/30">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-gradient-hero flex items-center justify-center shadow-md">
                      <Edit className="h-5 w-5 text-primary-foreground" />
                    </div>
                    <div>
                      <DialogTitle className="text-xl font-bold text-foreground">Edit Borrowed Item</DialogTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">Update borrowing details</p>
                    </div>
                  </div>
                </DialogHeader>
                  {editingItem && (
                    <div className="space-y-5 px-6 py-5 overflow-y-auto flex-1">
                      <div className="space-y-2">
                        <Label htmlFor="edit_item_name" className="text-sm font-medium text-foreground">Item Name <span className="text-destructive">*</span></Label>
                        <Input
                          id="edit_item_name"
                          value={editingItem.item_name}
                          onChange={(e) =>
                            setEditingItem({ ...editingItem, item_name: e.target.value })
                          }
                          placeholder="Enter item name"
                          className="h-11 rounded-xl border-border/60 bg-background focus:ring-2 focus:ring-primary/30 transition-all"
                          disabled // Can't change item name since it's linked to inventory
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit_borrower_name" className="text-sm font-medium text-foreground">Borrower Name <span className="text-destructive">*</span></Label>
                        <Input
                          id="edit_borrower_name"
                          value={editingItem.borrower_name}
                          onChange={(e) =>
                            setEditingItem({ ...editingItem, borrower_name: e.target.value })
                          }
                          placeholder="Enter borrower name"
                          className="h-11 rounded-xl border-border/60 bg-background focus:ring-2 focus:ring-primary/30 transition-all"
                        />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit_borrower_department">Department</Label>
                      <Input
                        id="edit_borrower_department"
                        value={editingItem.borrower_department || ""}
                        onChange={(e) =>
                          setEditingItem({ ...editingItem, borrower_department: e.target.value })
                        }
                        placeholder="Enter department"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit_quantity">Quantity</Label>
                      <Input
                        id="edit_quantity"
                        type="number"
                        value={editingItem.quantity}
                        onChange={(e) =>
                          setEditingItem({
                            ...editingItem,
                            quantity: parseInt(e.target.value) || 1,
                          })
                        }
                        min="1"
                        disabled // Can't change quantity after borrow
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="edit_borrow_date">Borrow Date</Label>
                        <Input
                          id="edit_borrow_date"
                          type="date"
                          value={editingItem.borrow_date}
                          onChange={(e) =>
                            setEditingItem({ ...editingItem, borrow_date: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit_return_date">Return Date *</Label>
                        <Input
                          id="edit_return_date"
                          type="date"
                          value={editingItem.return_date}
                          onChange={(e) =>
                            setEditingItem({ ...editingItem, return_date: e.target.value })
                          }
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit_unit_price">Unit Price</Label>
                      <Input
                        id="edit_unit_price"
                        type="number"
                        step="0.01"
                        value={editingItem.unit_price || 0}
                        onChange={(e) =>
                          setEditingItem({
                            ...editingItem,
                            unit_price: parseFloat(e.target.value) || 0,
                          })
                        }
                        placeholder="0.00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit_description">Notes</Label>
                      <Textarea
                        id="edit_description"
                        value={editingItem.description || ""}
                        onChange={(e) =>
                          setEditingItem({ ...editingItem, description: e.target.value })
                        }
                        placeholder="Enter any additional information"
                        rows={2}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit_image">Item Image</Label>
                      <div className="flex gap-2">
                        <Input
                          ref={editFileInputRef}
                          id="edit_image"
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={(e) => {
                            const file = e.target.files?.[0] || null;
                            setEditImage(file);
                          }}
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={handleEditCameraCapture}
                        >
                          <Camera className="h-4 w-4" />
                        </Button>
                      </div>
                      {editImage && (
                        <p className="text-sm text-muted-foreground">
                          New image: {editImage.name}
                        </p>
                      )}
                      {!editImage && editingItem.image_url && (
                        <p className="text-sm text-muted-foreground">
                          Current image uploaded
                        </p>
                      )}
                    </div>
                  </div>
                )}
                <div className="flex gap-2 justify-end px-6 pb-6 pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsEditDialogOpen(false);
                      setEditingItem(null);
                      setEditImage(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleEditBorrow} disabled={updateBorrowMutation.isPending}>
                    {updateBorrowMutation.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            </div>
          </header>

          <main className="flex-1 p-6">
            <div className="max-w-7xl mx-auto space-y-6">
              <div className="bg-gradient-hero rounded-xl p-6 text-primary-foreground shadow-elegant">
                <h2 className="text-2xl font-bold mb-2">
                  Track All Borrowed Items
                </h2>
                <p className="text-primary-foreground/90">
                  Monitor equipment and materials borrowed by employees and contractors. Items are automatically linked to inventory.
                </p>
              </div>

              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {borrowedItems.map((item: any) => (
                  <Card key={item.id} className="shadow-card hover:shadow-elegant transition-shadow overflow-hidden">
                    <div className="relative h-48 w-full overflow-hidden bg-muted">
                      <img
                        src={item.image_url || inventoryPlaceholder}
                        alt={item.item_name}
                        className="h-full w-full object-cover"
                      />
                      <Badge className={`absolute top-2 right-2 ${getStatusColor(item.status)}`}>
                        {item.status}
                      </Badge>
                      {item.item_id && (
                        <Badge className="absolute top-2 left-2 bg-primary/90 text-primary-foreground">
                          Linked to Inventory
                        </Badge>
                      )}
                    </div>
                    <CardHeader>
                      <CardTitle className="text-lg text-foreground">{item.item_name}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {item.description && (
                        <p className="text-sm text-muted-foreground">{item.description}</p>
                      )}
                      
                      <div className="flex items-center gap-2 text-sm">
                        <User className="h-4 w-4 text-primary" />
                        <span className="font-medium text-foreground">Borrower:</span>
                        <span className="text-muted-foreground">{item.borrower_name}</span>
                      </div>

                      {item.borrower_department && (
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-medium text-foreground">Department:</span>
                          <span className="text-muted-foreground">{item.borrower_department}</span>
                        </div>
                      )}

                      <div className="flex items-center gap-2 text-sm">
                        <Package className="h-4 w-4 text-primary" />
                        <span className="font-medium text-foreground">Quantity:</span>
                        <span className="text-muted-foreground">{item.quantity}</span>
                      </div>

                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4 text-primary" />
                        <span className="font-medium text-foreground">Borrowed:</span>
                        <span className="text-muted-foreground">{item.borrow_date}</span>
                      </div>

                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="h-4 w-4 text-primary" />
                        <span className="font-medium text-foreground">Return By:</span>
                        <span className="text-muted-foreground">{item.return_date}</span>
                      </div>

                      <div className="pt-3 flex flex-wrap gap-2">
                        {item.status !== 'Returned' && (
                          <>
                            <Button 
                              size="sm" 
                              className="flex-1 min-w-[100px]"
                              onClick={() => markReturnedMutation.mutate(item.id)}
                              disabled={markReturnedMutation.isPending}
                            >
                              Mark Returned
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="flex-1 min-w-[100px]"
                              onClick={() => extendBorrowMutation.mutate(item.id)}
                              disabled={extendBorrowMutation.isPending}
                            >
                              Extend
                            </Button>
                          </>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingItem(item);
                            setIsEditDialogOpen(true);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDeleteBorrow(item.id, item.item_name)}
                          disabled={deleteBorrowMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {borrowedItems.length === 0 && (
                <div className="text-center py-12">
                  <Package className="mx-auto h-12 w-12 text-muted-foreground" />
                  <h3 className="mt-4 text-lg font-semibold text-foreground">No borrowed items</h3>
                  <p className="text-muted-foreground">
                    Start tracking borrowed items by clicking the "Add Borrow" button.
                  </p>
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default BorrowedItems;
