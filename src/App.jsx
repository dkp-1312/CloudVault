import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { isAuthenticated } from './lib/auth';
import PasswordGate from './components/PasswordGate';
import Navbar from './components/Navbar';
import MediaGrid from './components/MediaGrid';
import UploadZone from './components/UploadZone';
import Toast from './components/Toast';

export default function App() {
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [toast, setToast] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [showUpload, setShowUpload] = useState(false);

  useEffect(() => {
    setAuthed(isAuthenticated());
    setChecking(false);
  }, []);

  function showToast(message, type = 'success') {
    setToast({ message, type, id: Date.now() });
  }

  function handleUploadComplete() {
    setRefreshTrigger((n) => n + 1);
    setShowUpload(false);
    showToast('Files uploaded successfully!', 'success');
  }

  if (checking) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div className="spinner" />
      </div>
    );
  }

  if (!authed) {
    return <PasswordGate onAuth={() => setAuthed(true)} />;
  }

  return (
    <>
      <Navbar onUploadClick={() => setShowUpload(true)} onLogout={() => setAuthed(false)} />

      <main className="main-content">
        <div className="page-container">
          <AnimatePresence>
            {showUpload && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.25 }}
              >
                <UploadZone
                  onComplete={handleUploadComplete}
                  onClose={() => setShowUpload(false)}
                  showToast={showToast}
                />
              </motion.div>
            )}
          </AnimatePresence>

          <MediaGrid
            refreshTrigger={refreshTrigger}
            showToast={showToast}
            onResourcesChange={() => setRefreshTrigger((n) => n + 1)}
          />
        </div>
      </main>

      <AnimatePresence>
        {toast && (
          <Toast key={toast.id} message={toast.message} type={toast.type} onDone={() => setToast(null)} />
        )}
      </AnimatePresence>
    </>
  );
}
