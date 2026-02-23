import { BrowserRouter, Routes, Route } from "react-router-dom";

// Layout
import { MainLayout } from "./components/layout/MainLayout";

// Pages — organised by domain
import { DashboardPage } from "./pages/dashboard/DashboardPage";
import { BudgetPage } from "./pages/budget/BudgetPage";
import { ProcurementPage } from "./pages/procurement/ProcurementPage";
import { VendorsPage } from "./pages/vendors/VendorsPage";
import { SettingsPage } from "./pages/settings/SettingsPage";
import { FloorPlanPage } from "./pages/floorplan/FloorPlanPage";
import { ProjectsPage } from "./pages/project/ProjectsPage";
import { ProjectEditorPage } from "./pages/project/ProjectEditorPage";
import EditorLayout from "./components/editor/EditorLayout";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* All main pages share the AppSidebar via MainLayout */}
        <Route path="/" element={<MainLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="budget" element={<BudgetPage />} />
          <Route path="procurement" element={<ProcurementPage />} />
          <Route path="vendors" element={<VendorsPage />} />
          <Route path="floor-plans" element={<FloorPlanPage />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="editor" element={<EditorLayout />} />
        </Route>

        {/* Project editor — full screen, own sidebar only */}
        <Route path="/projects/:id" element={<ProjectEditorPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
