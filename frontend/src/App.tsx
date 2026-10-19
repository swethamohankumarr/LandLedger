import { Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import Register from "./pages/Register";
import Registrar from "./pages/Registrar";
import Transfers from "./pages/Transfers";
import Explorer from "./pages/Explorer";
import PropertyDetail from "./pages/PropertyDetail";
import Analytics from "./pages/Analytics";
import FraudAlerts from "./pages/FraudAlerts";
import PublicVerify from "./pages/PublicVerify";
import About from "./pages/About";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route element={<AppLayout />}>
        <Route path="/app" element={<Dashboard />} />
        <Route path="/register" element={<Register />} />
        <Route path="/registrar" element={<Registrar />} />
        <Route path="/transfers" element={<Transfers />} />
        <Route path="/explorer" element={<Explorer />} />
        <Route path="/property/:id" element={<PropertyDetail />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/fraud" element={<FraudAlerts />} />
        <Route path="/verify" element={<PublicVerify />} />
        <Route path="/about" element={<About />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
