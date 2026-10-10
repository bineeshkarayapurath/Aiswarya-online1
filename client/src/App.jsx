import { Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Landing from './pages/Landing';
import Gallery from './pages/Gallery';
import Register from './pages/Register';
import PendingApproval from './pages/PendingApproval';
import MemberLogin from './pages/MemberLogin';
import MemberDashboard from './pages/MemberDashboard';
import AuthorityLogin from './pages/AuthorityLogin';
import AuthorityDashboard from './pages/AuthorityDashboard';
import { useAuth } from './context/AuthContext';
import { isAuthorityUser } from './lib/permissions';

function MemberOnly({ children }) {
  const { user } = useAuth();
  // Every approved account (MEMBER, and ADMIN / SUPER_ADMIN authority accounts
  // who are also club members) can view their own member dashboard via
  // /member/dashboard ("My Profile" in the navbar).
  if (!user || user.status !== 'APPROVED') {
    return <Navigate to="/member-login" replace />;
  }
  return children;
}

function AdminOnly({ children }) {
  const { user } = useAuth();
  // Any authority account may open the dashboard: ADMIN / SUPER_ADMIN, or an
  // executive designation (President, Vice President, Secretary, Joint
  // Secretary, Executive Committee Member), which keeps its module access even
  // without the top-level ADMIN role.
  if (!isAuthorityUser(user)) {
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
          {/* Admin Management Panel – same authority dashboard, accessible to
              ADMIN-role accounts (Executive Committee admins). */}
          <Route
            path="/admin/dashboard"
            element={
              <AdminOnly>
                <AuthorityDashboard />
              </AdminOnly>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}