import {
  LayoutDashboard,
  Gavel,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useEffect } from 'react';
import CreateAuctionModal from './CreateAuctionModal';

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  useEffect(() => {
    const openModal = () => setCreateModalOpen(true);
    window.addEventListener('open-create-auction', openModal);
    return () => window.removeEventListener('open-create-auction', openModal);
  }, []);

  function openCreateModal() {
    setMenuOpen(false);
    setCreateModalOpen(true);
  }

  return (
    <div className="dashboard-shell">
      <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
        <div className="brand">
          <div className="brand-mark">
            <Gavel size={20} />
          </div>
          <span>LiveAuction</span>
          <button
            type="button"
            className="icon-button sidebar-close"
            onClick={() => setMenuOpen(false)}
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="sidebar-nav">
          <NavLink to="/" end onClick={() => setMenuOpen(false)}>
            <LayoutDashboard size={19} />
            Dashboard
          </NavLink>
          <NavLink to="/auctions/my" onClick={() => setMenuOpen(false)}>
            <Gavel size={19} />
            My auctions
          </NavLink>
        </nav>

        <div className="sidebar-user">
          <div className="avatar">{user?.name?.charAt(0).toUpperCase()}</div>
          <div>
            <strong>{user?.name}</strong>
            <span>{user?.email}</span>
          </div>
          <button type="button" className="icon-button" onClick={logout} aria-label="Logout">
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      {menuOpen && (
        <button
          type="button"
          className="sidebar-overlay"
          onClick={() => setMenuOpen(false)}
          aria-label="Close menu"
        />
      )}

      <main className="dashboard-main">
        <header className="mobile-header">
          <button
            type="button"
            className="icon-button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
          <span>LiveAuction</span>
        </header>
        <Outlet />
      </main>
      {createModalOpen && (
        <CreateAuctionModal
          onClose={() => setCreateModalOpen(false)}
          onCreated={(auction) => {
            setCreateModalOpen(false);
            window.location.assign(`/auctions/${auction.id}`);
          }}
        />
      )}
    </div>
  );
}
