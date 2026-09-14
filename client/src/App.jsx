import { Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import DevTools from './components/DevTools';
import Landing from './pages/Landing';
import Gallery from './pages/Gallery';
import Register from './pages/Register';
import PendingApproval from './pages/PendingApproval';
import MemberLogin from './pages/MemberLogin';
import MemberDashboard from './pages/MemberDashboard';
import AuthorityLogin from './pages/AuthorityLogin';
import AuthorityDashboard from './pages/AuthorityDashboard';
import IDCardPreview from './pages/IDCardPreview';
import ApplicationPDFPreview from './pages/ApplicationPDFPreview';
import { useAuth } from './context/AuthContext';

function MemberOnly({ children }) {
  const { user } = useAuth();
  if (!user || user.role !== 'MEMBER' || user.status !== 'APPROVED') {
    return <Navigate to="/member-login" replace />;
  }
  return children;
}

function AdminOnly({ children }) {
  const { user } = useAuth();
  if (!user || user.role !== 'SUPER_ADMIN') {
    return <Navigate to="/authority-zone" replace />;
  }
  return children;
}

export default function App() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/gallery" element={<Gallery />} />
          <Route path="/register" element={<Register />} />
          {/* Dev aliases */}
          <Route path="/signup" element={<Register />} />
          <Route path="/pending" element={<PendingApproval />} />
          <Route path="/pending-status" element={<PendingApproval />} />
          <Route path="/member-login" element={<MemberLogin />} />
          <Route
            path="/member/dashboard"
            element={
              <MemberOnly>
                <MemberDashboard />
              </MemberOnly>
            }
          />
          <Route
            path="/member"
            element={
              <MemberOnly>
                <Navigate to="/member/dashboard" replace />
              </MemberOnly>
            }
          />
          <Route
            path="/dashboard"
            element={
              <MemberOnly>
                <Navigate to="/member/dashboard" replace />
              </MemberOnly>
            }
          />
          <Route path="/authority-zone" element={<AuthorityLogin />} />
          <Route
            path="/authority/dashboard"
            element={
              <AdminOnly>
                <AuthorityDashboard />
              </AdminOnly>
            }
          />
          {/* Component previews */}
          <Route path="/id-card-preview" element={<IDCardPreview />} />
          <Route path="/application-pdf-preview" element={<ApplicationPDFPreview />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <Footer />
      <DevTools />
    </div>
  );
}