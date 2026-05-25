import { logout } from '../lib/auth';
import styles from './Navbar.module.css';

export default function Navbar({ onUploadClick, onLogout }) {
  function handleLogout() {
    logout();
    onLogout();
  }

  return (
    <header className={styles.navbar}>
      <div className={`page-container ${styles.inner}`}>
        {/* Logo */}
        <div className={styles.brand}>
          <div className={styles.logoIcon}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <defs>
                <linearGradient id="navGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#6366f1" />
                  <stop offset="100%" stopColor="#ec4899" />
                </linearGradient>
              </defs>
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="url(#navGrad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span className={styles.brandName}>
            Cloud<span className="gradient-text">Vault</span>
          </span>
        </div>

        {/* Actions */}
        <div className={styles.actions}>
          <button className={`btn btn-primary ${styles.uploadBtn}`} onClick={onUploadClick} id="nav-upload-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="16 16 12 12 8 16"/>
              <line x1="12" y1="12" x2="12" y2="21"/>
              <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
            </svg>
            <span className={styles.uploadLabel}>Upload Media</span>
          </button>

          <button
            className={`btn btn-ghost ${styles.logoutBtn}`}
            onClick={handleLogout}
            title="Logout"
            id="nav-logout-btn"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            <span className={styles.logoutLabel}>Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
}
