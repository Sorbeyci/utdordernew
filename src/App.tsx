import { Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Dashboard } from "@/pages/Dashboard";
import { CreateOrder } from "@/pages/CreateOrder";
import { Orders } from "@/pages/Orders";
import { OrderDetail } from "@/pages/OrderDetail";
import { EditOrder } from "@/pages/EditOrder";
import { Customers } from "@/pages/Customers";
import { CustomerDetail } from "@/pages/CustomerDetail";
import { Products } from "@/pages/Products";
import { Reports } from "@/pages/Reports";
import { ImportBackup } from "@/pages/ImportBackup";
import { AdminUsers } from "@/pages/AdminUsers";
import { EmptyState } from "@/components/ui";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />

      <Route path="/orders/new" element={<ProtectedRoute min="worker"><CreateOrder /></ProtectedRoute>} />
      <Route path="/orders" element={<ProtectedRoute><Orders /></ProtectedRoute>} />
      <Route path="/orders/:id" element={<ProtectedRoute><OrderDetail /></ProtectedRoute>} />
      <Route path="/orders/:id/edit" element={<ProtectedRoute min="worker"><EditOrder /></ProtectedRoute>} />

      <Route path="/customers" element={<ProtectedRoute><Customers /></ProtectedRoute>} />
      <Route path="/customers/:id" element={<ProtectedRoute><CustomerDetail /></ProtectedRoute>} />

      <Route path="/products" element={<ProtectedRoute><Products /></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />

      <Route path="/import" element={<ProtectedRoute min="manager"><ImportBackup /></ProtectedRoute>} />
      <Route path="/admin/users" element={<ProtectedRoute min="admin"><AdminUsers /></ProtectedRoute>} />

      <Route
        path="*"
        element={
          <ProtectedRoute>
            <EmptyState title="Page not found" message="Use the navigation to get back on track." />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
