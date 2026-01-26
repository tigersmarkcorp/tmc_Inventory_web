import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Inventory from "./pages/Inventory";
import Reports from "./pages/Reports";
import Users from "./pages/Users";
import Settings from "./pages/Settings";
import Forms from "./pages/Forms";
import LeaveForm from "./pages/LeaveForm";
import JobListings from "./pages/JobListings";
import JobApplication from "./pages/JobApplication";
import Employees from "./pages/Employees";
import StockLevels from "./pages/StockLevels";
import BorrowedItems from "./pages/BorrowedItems";
import DefectedItems from "./pages/DefectedItems";
import UsedGivenItems from "./pages/UsedGivenItems";
import NotFound from "./pages/NotFound";
import Install from "./pages/Install";
import { ProtectedRoute } from "./components/ProtectedRoute";

const App = () => (
  <TooltipProvider>
    <Toaster />
    <Sonner />
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/install" element={<Install />} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/forms" element={<ProtectedRoute><Forms /></ProtectedRoute>} />
      <Route path="/leave-form" element={<ProtectedRoute><LeaveForm /></ProtectedRoute>} />
      <Route path="/job-listings" element={<ProtectedRoute><JobListings /></ProtectedRoute>} />
      <Route path="/job-application" element={<ProtectedRoute><JobApplication /></ProtectedRoute>} />
      <Route path="/employees" element={<ProtectedRoute><Employees /></ProtectedRoute>} />
      <Route path="/inventory" element={<ProtectedRoute><Inventory /></ProtectedRoute>} />
      <Route path="/stock-levels" element={<ProtectedRoute><StockLevels /></ProtectedRoute>} />
      <Route path="/borrowed-items" element={<ProtectedRoute><BorrowedItems /></ProtectedRoute>} />
      <Route path="/used-given-items" element={<ProtectedRoute><UsedGivenItems /></ProtectedRoute>} />
      <Route path="/defected-items" element={<ProtectedRoute><DefectedItems /></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
      <Route path="/users" element={<ProtectedRoute><Users /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  </TooltipProvider>
);

export default App;
