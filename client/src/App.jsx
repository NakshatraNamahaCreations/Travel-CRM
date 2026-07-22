import { Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './layouts/AppLayout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import LoginPage from './pages/LoginPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import TasksPage from './pages/TasksPage.jsx';
import Placeholder from './components/Placeholder.jsx';
import NotificationsPage from './pages/NotificationsPage.jsx';
import TripsListPage from './pages/trips/TripsListPage.jsx';
import TripPlanRequestsPage from './pages/trips/TripPlanRequestsPage.jsx';
import NewQueryPage from './pages/trips/NewQueryPage.jsx';
import UploadQueriesPage from './pages/trips/UploadQueriesPage.jsx';
import QueryDetailPage from './pages/trips/QueryDetailPage.jsx';
import QuoteBuilderPage from './pages/quotes/QuoteBuilderPage.jsx';
import QuoteViewPage from './pages/quotes/QuoteViewPage.jsx';
import CreateItineraryPage from './pages/quotes/CreateItineraryPage.jsx';
import ConversionPage from './pages/quotes/ConversionPage.jsx';
import QuotationDocument from './pages/quotes/QuotationDocument.jsx';
import SalesReportPage from './pages/reports/SalesReportPage.jsx';
import OperationsReportPage from './pages/reports/OperationsReportPage.jsx';
import BookingsListPage from './pages/bookings/BookingsListPage.jsx';
import BookingDetailPage from './pages/bookings/BookingDetailPage.jsx';
import HotelBookingsPage from './pages/bookings/HotelBookingsPage.jsx';
import HotelCheckinsPage from './pages/bookings/HotelCheckinsPage.jsx';
import OperationalBookingsPage from './pages/bookings/OperationalBookingsPage.jsx';
import QuoteBookingsDiffPage from './pages/bookings/QuoteBookingsDiffPage.jsx';
import PaymentsLedgerPage from './pages/accounting/PaymentsLedgerPage.jsx';
import InvoicesPage from './pages/accounting/InvoicesPage.jsx';
import InvoiceViewPage from './pages/accounting/InvoiceViewPage.jsx';
import AccountsPage from './pages/accounting/AccountsPage.jsx';
import NewAccountPage from './pages/accounting/NewAccountPage.jsx';
import TransactionsPage from './pages/accounting/TransactionsPage.jsx';
import TripCheckInOutReportPage from './pages/accounting/TripCheckInOutReportPage.jsx';
import UsersPage from './pages/settings/UsersPage.jsx';
import OrganizationPage from './pages/settings/OrganizationPage.jsx';
import OrgProfilePage from './pages/settings/OrgProfilePage.jsx';
import ProfilePage from './pages/settings/ProfilePage.jsx';
import InclusionsExclusionsPage from './pages/settings/InclusionsExclusionsPage.jsx';
import HotelsListPage from './pages/services/HotelsListPage.jsx';
import HotelDetailPage from './pages/services/HotelDetailPage.jsx';
import HotelFormPage from './pages/services/HotelFormPage.jsx';
import HotelPricesPage from './pages/services/HotelPricesPage.jsx';
import UploadHotelPricesPage from './pages/services/UploadHotelPricesPage.jsx';
import UploadHotelsPage from './pages/services/UploadHotelsPage.jsx';
import CalculatePricePage from './pages/services/CalculatePricePage.jsx';
import HotelOptionsPage, { HOTEL_OPTION_CONFIGS, CAB_TYPES_CONFIG } from './pages/services/HotelOptionsPage.jsx';
import CitiesPage from './pages/services/CitiesPage.jsx';
import StatesPage from './pages/services/StatesPage.jsx';
import GeneralHotelNotesPage from './pages/services/GeneralHotelNotesPage.jsx';
import MergeHotelsPage from './pages/services/MergeHotelsPage.jsx';
import TransportListPage from './pages/services/TransportListPage.jsx';
import TransportDetailPage from './pages/services/TransportDetailPage.jsx';
import TransportFormPage from './pages/services/TransportFormPage.jsx';
import TransportPricesPage from './pages/services/TransportPricesPage.jsx';
import UploadTransportPricesPage from './pages/services/UploadTransportPricesPage.jsx';
import TransportCalculatePricePage from './pages/services/TransportCalculatePricePage.jsx';
import ActivitiesListPage from './pages/services/ActivitiesListPage.jsx';
import ActivityDetailPage from './pages/services/ActivityDetailPage.jsx';
import ActivityFormPage from './pages/services/ActivityFormPage.jsx';
import ActivityPricesPage from './pages/services/ActivityPricesPage.jsx';
import UploadActivityPricesPage from './pages/services/UploadActivityPricesPage.jsx';
import ActivityCalculatePricePage from './pages/services/ActivityCalculatePricePage.jsx';
import ImportPage from './pages/services/ImportPage.jsx';
import DestinationsPage from './pages/services/DestinationsPage.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      {/* Standalone print document (no app chrome) */}
      <Route path="/quotes/:id/quotation" element={<ProtectedRoute><QuotationDocument /></ProtectedRoute>} />

      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<DashboardPage />} />

        {/* Trips menu — Module 3 */}
        <Route path="/trips" element={<TripsListPage />} />
        <Route path="/trips/upload" element={<UploadQueriesPage />} />
        <Route path="/trips/new" element={<NewQueryPage />} />
        <Route path="/trips/:id/edit" element={<NewQueryPage />} />
        <Route path="/trips/:id" element={<QueryDetailPage />} />
        <Route path="/trips/:queryId/quote/new" element={<QuoteBuilderPage mode="new" />} />
        <Route path="/trips/:queryId/convert/:quoteId" element={<ConversionPage />} />
        <Route path="/quotes/:id" element={<QuoteViewPage />} />
        <Route path="/quotes/:id/edit" element={<QuoteBuilderPage mode="edit" />} />
        <Route path="/quotes/:id/itinerary" element={<CreateItineraryPage />} />
        <Route path="/sales-reports" element={<SalesReportPage />} />
        <Route path="/reports/:view" element={<OperationsReportPage />} />
        <Route path="/bookings" element={<BookingsListPage />} />
        <Route path="/bookings/hotels" element={<HotelBookingsPage />} />
        <Route path="/bookings/hotel-checkins" element={<HotelCheckinsPage />} />
        <Route path="/bookings/operational" element={<OperationalBookingsPage />} />
        <Route path="/bookings/quote-diff" element={<QuoteBookingsDiffPage />} />
        <Route path="/bookings/:id" element={<BookingDetailPage />} />
        <Route path="/trip-plan-requests" element={<TripPlanRequestsPage />} />

        {/* Accounting menu — Module 7 */}
        <Route path="/accounting/payments" element={<PaymentsLedgerPage direction="incoming" />} />
        <Route path="/accounting/invoices" element={<InvoicesPage />} />
        <Route path="/accounting/invoices/:id" element={<InvoiceViewPage />} />
        <Route path="/accounting/ledger" element={<PaymentsLedgerPage direction="outgoing" />} />
        <Route path="/accounting/accounts" element={<AccountsPage />} />
        <Route path="/accounting/accounts/new" element={<NewAccountPage />} />
        <Route path="/accounting/transactions" element={<TransactionsPage />} />
        <Route path="/accounting/trip-check-in-out" element={<TripCheckInOutReportPage />} />

        {/* Services / supplier inventory — Module 6 */}
        <Route path="/services/hotels" element={<HotelsListPage />} />
        <Route path="/services/hotels/new" element={<HotelFormPage />} />
        <Route path="/services/hotels/upload" element={<UploadHotelsPage />} />
        <Route path="/services/hotels/groups" element={<HotelOptionsPage config={HOTEL_OPTION_CONFIGS.groups} />} />
        <Route path="/services/hotels/meal-plans" element={<HotelOptionsPage config={HOTEL_OPTION_CONFIGS['meal-plans']} />} />
        <Route path="/services/hotels/room-types" element={<HotelOptionsPage config={HOTEL_OPTION_CONFIGS['room-types']} />} />
        <Route path="/services/hotels/payment-preferences" element={<HotelOptionsPage config={HOTEL_OPTION_CONFIGS['payment-preferences']} />} />
        <Route path="/services/hotels/notes" element={<GeneralHotelNotesPage />} />
        <Route path="/services/hotels/merge" element={<MergeHotelsPage />} />
        <Route path="/services/hotels/:id" element={<HotelDetailPage />} />
        <Route path="/services/hotels/:id/edit" element={<HotelFormPage />} />
        <Route path="/services/hotel-prices" element={<HotelPricesPage />} />
        <Route path="/services/hotel-prices/upload" element={<UploadHotelPricesPage />} />
        <Route path="/services/hotel-prices/calculator" element={<CalculatePricePage />} />
        <Route path="/services/transport" element={<TransportListPage />} />
        <Route path="/services/transport/new" element={<TransportFormPage />} />
        <Route path="/services/transport/cab-types" element={<HotelOptionsPage config={CAB_TYPES_CONFIG} />} />
        <Route path="/services/transport/:id" element={<TransportDetailPage />} />
        <Route path="/services/transport/:id/edit" element={<TransportFormPage />} />
        <Route path="/services/transport-prices" element={<TransportPricesPage />} />
        <Route path="/services/transport-prices/upload" element={<UploadTransportPricesPage />} />
        <Route path="/services/transport-prices/calculator" element={<TransportCalculatePricePage />} />
        <Route path="/services/activities" element={<ActivitiesListPage />} />
        <Route path="/services/activities/new" element={<ActivityFormPage />} />
        <Route path="/services/activities/:id/edit" element={<ActivityFormPage />} />
        <Route path="/services/activities/:id" element={<ActivityDetailPage />} />
        <Route path="/services/activity-prices" element={<ActivityPricesPage />} />
        <Route path="/services/activity-prices/upload" element={<UploadActivityPricesPage />} />
        <Route path="/services/activity-prices/calculator" element={<ActivityCalculatePricePage />} />
        <Route path="/services/import" element={<ImportPage />} />

        {/* Settings / admin */}
        <Route path="/settings/users" element={<ProtectedRoute roles={['admin', 'manager']}><UsersPage /></ProtectedRoute>} />
        <Route path="/settings/organization" element={<ProtectedRoute roles={['admin', 'manager']}><OrganizationPage /></ProtectedRoute>} />
        <Route path="/settings/org-profile" element={<ProtectedRoute roles={['admin', 'manager']}><OrgProfilePage /></ProtectedRoute>} />
        <Route path="/settings/destinations" element={<ProtectedRoute roles={['admin', 'manager']}><DestinationsPage /></ProtectedRoute>} />
        <Route path="/settings/cities" element={<ProtectedRoute roles={['admin', 'manager']}><CitiesPage /></ProtectedRoute>} />
        <Route path="/settings/states" element={<ProtectedRoute roles={['admin', 'manager']}><StatesPage /></ProtectedRoute>} />
        <Route path="/settings/inclusions-exclusions" element={<ProtectedRoute roles={['admin', 'manager']}><InclusionsExclusionsPage /></ProtectedRoute>} />
        <Route path="/settings/profile" element={<ProfilePage />} />
        <Route path="/tasks" element={<TasksPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/whats-new" element={<Placeholder title="What's New" />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
