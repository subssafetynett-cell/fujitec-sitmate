import Home from './pages/Home'
import { Routes, Route, Navigate } from "react-router-dom";
import SignupPage from "./pages/Signup";
import Client from "./pages/Clients";
import ErrorBoundary from './components/ErrorBoundary';
import UsersPage from './pages/Users';
import LoginPage from './pages/Login';
import RequireAuth from './components/RequireAuth';
import RoleGuard from './components/RoleGuard';
import ClientsPage from './pages/Clients';
import EnableUserAccessPage from './pages/EnableUserAccess';
import FormBuilderPage from './pages/FormBuilderPage';
import UserClients from './pages/UserClients';
import ViewForms from './pages/ViewForms';
import ViewSingleForm from './pages/ViewSingleForm';
import UseForm from './pages/UseForm';

import ProfilePage from './pages/ProfilePage';
import AccountSettings from './pages/AccountSettings';

import ResetPassword from "./pages/ResetPassword";
import Setup2FA from "./pages/Setup2FA";

import GenericReportPage from './pages/GenericReportPage';
import UnauthorizedPage from './pages/UnauthorizedPage';

import CreateSitesPage from './pages/CreateSitesPage';
import SitepackManagement from './pages/SitepackManagement';
import ConcernReportDashboard from './pages/ConcernReportDashboard';
import AuditReportDashboard from './pages/AuditReportDashboard';
import GeneralFormsList from './pages/GeneralFormsList';
import ToolBoxTalkForm from './pages/ToolBoxTalkForm';
import RamsBriefingForm from './pages/RamsBriefingForm';
import SiteInductionForm from './pages/SiteInductionForm';
import ManagementSiteInspectionForm from './pages/ManagementSiteInspectionForm';
import DailySafeStartBriefingForm from './pages/DailySafeStartBriefingForm';
import AuditActionForm from './pages/AuditActionForm';
import SiteInductionRecordForm from './pages/SiteInductionRecordForm';
import LolerInspectionForm from './pages/LolerInspectionForm';
import PuwerInspectionForm from './pages/PuwerInspectionForm';
import CreateForm from './pages/CreateForm';
import AdstoneSiteInductionForm from './pages/AdstoneSiteInductionForm';
import SheqInstallationForm from './pages/SheqInstallationForm';
import SheqInspectionSelectionPage from './pages/SheqInspectionSelectionPage';
import ShqInstallationSelectionPage from './pages/ShqInstallationSelectionPage';


import { ThemeProvider } from './context/ThemeContext';

// ─── Role shorthand arrays ─────────────────────────────────────────────────────
const ADMIN_PLUS    = ["superadmin", "company_admin"];
const MANAGER_PLUS  = ["superadmin", "company_admin", "site_manager"];
const SUPERVISOR_PLUS = ["superadmin", "company_admin", "site_manager", "supervisor"];
const ALL_ROLES     = ["superadmin", "company_admin", "site_manager", "supervisor", "worker"];

function App() {

  return (
    <ThemeProvider>
      <ErrorBoundary>

        <Routes>
          {/* ── Public routes ─────────────────────────────────────── */}
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/reset-password/:token" element={<ResetPassword />} />
          <Route path="/setup-2fa" element={<Setup2FA />} />
          <Route path="/unauthorized" element={<UnauthorizedPage />} />

          {/* ── Superadmin only ───────────────────────────────────── */}
          <Route path="/clients" element={
            <RequireAuth>
              <RoleGuard allowedRoles={["superadmin"]}>
                <ClientsPage />
              </RoleGuard>
            </RequireAuth>
          } />

          {/* ── Admin+ (superadmin, company_admin) ───────────────── */}
          <Route path="/users" element={
            <RequireAuth>
              <RoleGuard allowedRoles={ADMIN_PLUS}>
                <UsersPage />
              </RoleGuard>
            </RequireAuth>
          } />
          <Route path="/clients/:id/users" element={
            <RequireAuth>
              <RoleGuard allowedRoles={ADMIN_PLUS}>
                <UsersPage />
              </RoleGuard>
            </RequireAuth>
          } />
          <Route path="/enable-user" element={
            <RequireAuth>
              <RoleGuard allowedRoles={ADMIN_PLUS}>
                <EnableUserAccessPage />
              </RoleGuard>
            </RequireAuth>
          } />

          {/* ── Manager+ (superadmin, company_admin, site_manager) ── */}
          <Route path="/forms" element={
            <RequireAuth>
              <RoleGuard allowedRoles={MANAGER_PLUS}>
                <ViewForms />
              </RoleGuard>
            </RequireAuth>
          } />
          <Route path="/form-build" element={
            <RequireAuth>
              <RoleGuard allowedRoles={MANAGER_PLUS}>
                <FormBuilderPage />
              </RoleGuard>
            </RequireAuth>
          } />
          <Route path="/forms/:id" element={
            <RequireAuth>
              <RoleGuard allowedRoles={MANAGER_PLUS}>
                <ViewSingleForm />
              </RoleGuard>
            </RequireAuth>
          } />
          <Route path="/create-sites" element={
            <RequireAuth>
              <RoleGuard allowedRoles={MANAGER_PLUS}>
                <CreateSitesPage />
              </RoleGuard>
            </RequireAuth>
          } />
          <Route path="/sitepack-management" element={
            <RequireAuth>
              <RoleGuard allowedRoles={MANAGER_PLUS}>
                <SitepackManagement />
              </RoleGuard>
            </RequireAuth>
          } />
          <Route path="/create-form" element={
            <RequireAuth>
              <RoleGuard allowedRoles={MANAGER_PLUS}>
                <CreateForm />
              </RoleGuard>
            </RequireAuth>
          } />

          {/* ── All authenticated users ───────────────────────────── */}
          <Route path="/company" element={<UserClients />} />
          <Route path="/forms/:id/use" element={<UseForm />} />
          <Route path="/profile" element={<RequireAuth><ProfilePage /></RequireAuth>} />
          <Route path="/account-settings" element={<RequireAuth><AccountSettings /></RequireAuth>} />

          {/* Report routes — all roles */}
          <Route path="/report-health-safety" element={<RequireAuth><GenericReportPage pageTitle="Health & Safety concern" /></RequireAuth>} />
          <Route path="/report-environmental" element={<RequireAuth><GenericReportPage pageTitle="Sustainability concern" /></RequireAuth>} />
          <Route path="/report-quality" element={<RequireAuth><GenericReportPage pageTitle="Quality concern" /></RequireAuth>} />
          <Route path="/report-positive" element={<RequireAuth><GenericReportPage pageTitle="Positive observation" /></RequireAuth>} />
          <Route path="/concern-positive-report" element={<RequireAuth><GenericReportPage pageTitle="Concern and positive feedback report" /></RequireAuth>} />

          {/* Supervisor+ inspection routes */}
          <Route path="/weekly-supervisor" element={<RequireAuth><RoleGuard allowedRoles={SUPERVISOR_PLUS}><GenericReportPage pageTitle="Weekly supervisor health & safety inspection" /></RoleGuard></RequireAuth>} />
          <Route path="/weekly-reports" element={<RequireAuth><RoleGuard allowedRoles={SUPERVISOR_PLUS}><GenericReportPage pageTitle="Weekly supervisor reports" /></RoleGuard></RequireAuth>} />

          {/* Manager+ SHEQ / lift routes */}
          <Route path="/sheq-report" element={<RequireAuth><RoleGuard allowedRoles={MANAGER_PLUS}><GenericReportPage pageTitle="SHEQ Inspection" /></RoleGuard></RequireAuth>} />
          <Route path="/sheq-inspection" element={<RequireAuth><RoleGuard allowedRoles={MANAGER_PLUS}><SheqInspectionSelectionPage /></RoleGuard></RequireAuth>} />
          <Route path="/sheq-install-form" element={<RequireAuth><RoleGuard allowedRoles={MANAGER_PLUS}><SheqInstallationForm /></RoleGuard></RequireAuth>} />
          <Route path="/sheq-install-form/:id" element={<RequireAuth><RoleGuard allowedRoles={MANAGER_PLUS}><SheqInstallationForm /></RoleGuard></RequireAuth>} />

          <Route path="/shq-installation" element={<RequireAuth><RoleGuard allowedRoles={MANAGER_PLUS}><ShqInstallationSelectionPage /></RoleGuard></RequireAuth>} />
          
          {/* Redirects for old routes */}
          <Route path="/sheq-install" element={<Navigate to="/sheq-inspection" replace />} />
          <Route path="/sheq-install-report" element={<Navigate to="/shq-installation" replace />} />
          <Route path="/lift-sector-client" element={<RequireAuth><RoleGuard allowedRoles={ADMIN_PLUS}><GenericReportPage pageTitle="Client level analysis" /></RoleGuard></RequireAuth>} />
          <Route path="/lift-sector-site" element={<RequireAuth><RoleGuard allowedRoles={ADMIN_PLUS}><GenericReportPage pageTitle="Site level analysis" /></RoleGuard></RequireAuth>} />

          {/* General forms — all authenticated */}
          <Route path="/general-forms" element={<RequireAuth><GeneralFormsList /></RequireAuth>} />
          <Route path="/general-forms/tool-box-talk" element={<RequireAuth><ToolBoxTalkForm /></RequireAuth>} />
          <Route path="/general-forms/tool-box-talk/:id" element={<RequireAuth><ToolBoxTalkForm /></RequireAuth>} />
          <Route path="/general-forms/rams-briefing" element={<RequireAuth><RamsBriefingForm /></RequireAuth>} />
          <Route path="/general-forms/rams-briefing/:id" element={<RequireAuth><RamsBriefingForm /></RequireAuth>} />
          <Route path="/general-forms/site-induction" element={<RequireAuth><SiteInductionForm /></RequireAuth>} />
          <Route path="/general-forms/site-induction/:id" element={<RequireAuth><SiteInductionForm /></RequireAuth>} />
          <Route path="/general-forms/daily-safe-start-briefing" element={<RequireAuth><DailySafeStartBriefingForm /></RequireAuth>} />
          <Route path="/general-forms/daily-safe-start-briefing/:id" element={<RequireAuth><DailySafeStartBriefingForm /></RequireAuth>} />
          <Route path="/general-forms/audit-action-form" element={<RequireAuth><AuditActionForm /></RequireAuth>} />
          <Route path="/general-forms/audit-action-form/:id" element={<RequireAuth><AuditActionForm /></RequireAuth>} />
          <Route path="/general-forms/site-induction-form" element={<RequireAuth><SiteInductionRecordForm /></RequireAuth>} />
          <Route path="/general-forms/site-induction-form/:id" element={<RequireAuth><SiteInductionRecordForm /></RequireAuth>} />
          <Route path="/general-forms/management-site-inspection" element={<RequireAuth><ManagementSiteInspectionForm /></RequireAuth>} />
          <Route path="/general-forms/management-site-inspection/:id" element={<RequireAuth><ManagementSiteInspectionForm /></RequireAuth>} />
          <Route path="/general-forms/loler-inspection-form" element={<RequireAuth><LolerInspectionForm /></RequireAuth>} />
          <Route path="/general-forms/loler-inspection-form/:id" element={<RequireAuth><LolerInspectionForm /></RequireAuth>} />
          <Route path="/general-forms/puwer-inspection-form" element={<RequireAuth><PuwerInspectionForm /></RequireAuth>} />
          <Route path="/general-forms/puwer-inspection-form/:id" element={<RequireAuth><PuwerInspectionForm /></RequireAuth>} />
          <Route path="/general-forms/adstone-site-induction" element={<RequireAuth><AdstoneSiteInductionForm /></RequireAuth>} />
          <Route path="/general-forms/adstone-site-induction/:id" element={<RequireAuth><AdstoneSiteInductionForm /></RequireAuth>} />
          <Route path="/frida-forms" element={<RequireAuth><GenericReportPage pageTitle="Friday pack forms" /></RequireAuth>} />

          {/* Dashboards */}
          <Route path="/dashboard" element={<RequireAuth><ConcernReportDashboard /></RequireAuth>} />
          <Route path="/concern-reports" element={<RequireAuth><ConcernReportDashboard /></RequireAuth>} />
          <Route path="/audit-reports" element={<RequireAuth><AuditReportDashboard /></RequireAuth>} />

        </Routes>
      </ErrorBoundary>
    </ThemeProvider>


  )
}

export default App

