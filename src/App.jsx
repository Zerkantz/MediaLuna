import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppProvider } from './context/AppContext'
import { PanelLayout, PublicLayout, Toast } from './components/AppShell'
import {
  BookingDatePage,
  BookingServicesPage,
  BookingSummaryPage,
  HomePage,
  LoginPage,
  RegisterPage,
  SalonDetailPage,
  SalonesPage,
} from './pages/PublicPages'
import {
  AdminAvailabilityPage,
  AdminDashboard,
  AdminPaymentsPage,
  AdminReportsPage,
  AdminReservationsPage,
  AdminSalonsPage,
  AdminServicesPage,
  AdminUsersPage,
  ClientDashboard,
  ClientProfilePage,
  ClientReservationDetailPage,
  ClientReservationsPage,
  OwnerChatsPage,
  OwnerDashboard,
  OwnerReservationsPage,
  OwnerSalonsPage,
} from './pages/WorkspacePages'
import './App.css'

function App() {
  return <BrowserRouter><AppProvider><Routes>
    <Route element={<PublicLayout />}>
      <Route path="/" element={<HomePage />} />
      <Route path="/salones" element={<SalonesPage />} />
      <Route path="/salones/:id" element={<SalonDetailPage />} />
      <Route path="/reservar/:id/fecha" element={<BookingDatePage />} />
      <Route path="/reservar/:id/servicios" element={<BookingServicesPage />} />
      <Route path="/reservar/:id/resumen" element={<BookingSummaryPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/registro" element={<RegisterPage />} />
    </Route>
    <Route path="/cliente" element={<PanelLayout role="cliente" />}>
      <Route index element={<ClientDashboard />} />
      <Route path="reservaciones" element={<ClientReservationsPage />} />
      <Route path="reservaciones/:id" element={<ClientReservationDetailPage />} />
      <Route path="perfil" element={<ClientProfilePage />} />
    </Route>
    <Route path="/dueno" element={<PanelLayout role="dueno" />}>
      <Route index element={<OwnerDashboard />} />
      <Route path="salones" element={<OwnerSalonsPage />} />
      <Route path="reservaciones" element={<OwnerReservationsPage />} />
      <Route path="chats" element={<OwnerChatsPage />} />
    </Route>
    <Route path="/admin" element={<PanelLayout role="administrador" />}>
      <Route index element={<AdminDashboard />} />
      <Route path="usuarios" element={<AdminUsersPage />} />
      <Route path="salones" element={<AdminSalonsPage />} />
      <Route path="servicios" element={<AdminServicesPage />} />
      <Route path="disponibilidad" element={<AdminAvailabilityPage />} />
      <Route path="reservaciones" element={<AdminReservationsPage />} />
      <Route path="pagos" element={<AdminPaymentsPage />} />
      <Route path="reportes" element={<AdminReportsPage />} />
    </Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes><Toast /></AppProvider></BrowserRouter>
}

export default App
