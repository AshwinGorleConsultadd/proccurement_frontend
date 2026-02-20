
import { BrowserRouter, Routes, Route } from "react-router-dom"
import { MainLayout } from "./components/MainLayout"
import { DashboardPage } from "./pages/DashboardPage"
import { BudgetPage } from "./pages/BudgetPage"
import { ProcurementPage } from "./pages/ProcurementPage"
import { VendorsPage } from "./pages/VendorsPage"
import { SettingsPage } from "./pages/SettingsPage"
import { FloorPlanPage } from "./pages/FloorPlanPage"
import { ProjectsPage } from "./pages/ProjectsPage"
import "./App.css"

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="budget" element={<BudgetPage />} />
          <Route path="procurement" element={<ProcurementPage />} />
          <Route path="vendors" element={<VendorsPage />} />
          <Route path="floor-plans" element={<FloorPlanPage />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
