import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/hooks/useAuthStore';
import { useBrandingStore, monogram } from '@/hooks/useBranding';
import {
  List,
  X,
  SignOut,
  CaretDown,
  Gauge,
  FileText,
  ChartBar,
  UsersThree,
  CheckCircle,
  ShieldCheck,
  Pulse,
  UserCircle,
  PaintBrush,
} from '@phosphor-icons/react';
import clsx from 'clsx';

interface NavItem {
  label: string;
  studentLabel?: string;
  path: string;
  icon: React.ReactNode;
  roles: string[];
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', path: '/dashboard', icon: <Gauge size={20} />, roles: ['superadmin', 'admin', 'student'] },
  { label: 'Exams', studentLabel: 'My Exams', path: '/exams', icon: <FileText size={20} />, roles: ['superadmin', 'admin', 'student'] },
  { label: 'Results', studentLabel: 'My Results', path: '/results', icon: <CheckCircle size={20} />, roles: ['superadmin', 'admin', 'student'] },
  { label: 'Analytics', path: '/analytics', icon: <ChartBar size={20} />, roles: ['superadmin', 'admin'] },
  { label: 'Candidates', path: '/students', icon: <UsersThree size={20} />, roles: ['superadmin', 'admin'] },
  { label: 'Admins', path: '/admins', icon: <ShieldCheck size={20} />, roles: ['superadmin'] },
  { label: 'Audit Trail', path: '/audit', icon: <Pulse size={20} />, roles: ['superadmin'] },
  { label: 'Branding', path: '/settings', icon: <PaintBrush size={20} />, roles: ['superadmin'] },
  { label: 'My Profile', path: '/profile', icon: <UserCircle size={20} />, roles: ['superadmin', 'admin', 'student'] },
];

const ROLE_LABEL: Record<string, string> = { superadmin: 'Super Admin', admin: 'Department Admin', student: 'Candidate' };

export const BrandMark: React.FC<{ size?: 'sm' | 'lg'; light?: boolean; onPrimary?: boolean }> = ({ size = 'sm', light = false, onPrimary = false }) => {
  const { branding } = useBrandingStore();
  const box = size === 'lg' ? 'w-14 h-14 text-xl rounded-2xl' : 'w-10 h-10 text-base rounded-xl';
  return (
    <div className="flex items-center gap-3">
      {branding.logo_url ? (
        <img
          src={branding.logo_url}
          alt={`${branding.org_name} logo`}
          className={clsx(size === 'lg' ? 'h-14 max-w-[9rem] rounded-2xl' : 'h-12 max-w-[7.5rem] rounded-xl', 'w-auto object-contain bg-white p-1.5')}
        />
      ) : (
        <div className={clsx(box, 'flex items-center justify-center font-bold text-white shadow-sm', onPrimary ? 'bg-white/15 ring-1 ring-white/20' : 'bg-primary')}>
          {monogram(branding.org_name)}
        </div>
      )}
      <div className="leading-tight">
        <p className={clsx('font-semibold', size === 'lg' ? 'text-2xl' : 'text-lg', light ? 'text-white' : 'text-dark')}>
          {branding.org_name}
        </p>
        {branding.org_tagline && (
          <p className={clsx('text-xs', onPrimary ? 'text-primary-100' : light ? 'text-gray-400' : 'text-gray-500')}>{branding.org_tagline}</p>
        )}
      </div>
    </div>
  );
};

export const Sidebar: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const filteredItems = NAV_ITEMS.filter((item) => item.roles.includes(user?.role || ''));

  // Close the mobile drawer whenever the route changes.
  useEffect(() => setIsOpen(false), [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label={isOpen ? 'Close menu' : 'Open menu'}
        className="fixed top-3.5 left-4 z-50 lg:hidden rounded-lg bg-white p-2 shadow-soft border border-gray-200 no-print"
      >
        {isOpen ? <X size={22} /> : <List size={22} />}
      </button>

      <aside
        className={clsx(
          'fixed left-0 top-0 z-40 h-screen w-64 bg-dark text-white transition-transform duration-300',
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <div className="flex h-full flex-col px-4 py-6">
          <Link to="/dashboard" className="mb-8 mt-10 px-2 lg:mt-0">
            <BrandMark light />
          </Link>

          <nav className="flex-1 space-y-1 overflow-y-auto">
            {filteredItems.map((item) => {
              const active = location.pathname === item.path || (item.path !== '/dashboard' && location.pathname.startsWith(item.path + '/'));
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={clsx(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                    active ? 'bg-primary text-white shadow-sm' : 'text-gray-300 hover:bg-white/5 hover:text-white'
                  )}
                >
                  {item.icon}
                  {user?.role === 'student' && item.studentLabel ? item.studentLabel : item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-4 border-t border-white/10 pt-4">
            <div className="mb-3 flex items-center gap-3 px-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-500 text-sm font-semibold">
                {user?.name?.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{user?.name}</p>
                <p className="text-xs text-gray-400">{ROLE_LABEL[user?.role || ''] || user?.role}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-300 hover:bg-white/5 hover:text-white"
            >
              <SignOut size={18} />
              Sign out
            </button>
          </div>
        </div>
      </aside>

      {isOpen && <div className="fixed inset-0 z-30 bg-dark/50 lg:hidden" onClick={() => setIsOpen(false)} />}
    </>
  );
};

export const Header: React.FC<{ title?: string }> = ({ title }) => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowUserMenu(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-20 border-b border-gray-200 bg-white/90 backdrop-blur no-print">
      <div className="flex items-center justify-between px-6 py-3.5 pl-16 lg:pl-8">
        <p className="text-sm font-medium text-gray-500">{title || 'Dashboard'}</p>

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-gray-100"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <span className="hidden text-sm font-medium text-dark sm:block">{user?.name}</span>
            <CaretDown size={14} className="text-gray-500" />
          </button>

          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-56 rounded-xl border border-gray-200 bg-white py-2 shadow-medium">
              <div className="border-b border-gray-100 px-4 py-2">
                <p className="text-sm font-medium text-dark">{user?.name}</p>
                <p className="truncate text-xs text-gray-500">{user?.email}</p>
              </div>
              <Link
                to="/profile"
                onClick={() => setShowUserMenu(false)}
                className="flex items-center gap-2 px-4 py-2 text-sm text-dark hover:bg-light"
              >
                <UserCircle size={16} />
                My profile
              </Link>
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-600 hover:bg-light"
              >
                <SignOut size={16} />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
