import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { uploadFile, getResourceType, listFolders, createFolder, deleteFolder, checkFolderHasFiles } from '../lib/imagekit';
import styles from './UploadZone.module.css';

export default function UploadZone({ onComplete, onClose, showToast }) {
  const [files, setFiles] = useState([]); // { id, file, progress, status, error }
  const [dragging, setDragging] = useState(false);

  // Folder state
  const [folders, setFolders] = useState([]); // existing folders from ImageKit
  const [foldersLoading, setFoldersLoading] = useState(true);
  const [selectedFolder, setSelectedFolder] = useState('/'); // '/' = root
  const [newFolderMode, setNewFolderMode] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [deletingFolder, setDeletingFolder] = useState(false);
  const [folderToDelete, setFolderToDelete] = useState(null); // { path, name }
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const fileInputRef = useRef(null);
  const dragCounter = useRef(0);

  const MAX_SIZES = {
    image: 25 * 1024 * 1024,
    video: 100 * 1024 * 1024,
    raw: 100 * 1024 * 1024,
  };

  // Load folders on mount
  useEffect(() => {
    async function load() {
      setFoldersLoading(true);
      try {
        const data = await listFolders('/');
        console.log('listFolders returned:', data);
        
        // Merge with locally cached folders to handle ImageKit API delay
        const localFolders = JSON.parse(localStorage.getItem('ik_local_folders') || '[]');
        const merged = [...data];
        for (const lf of localFolders) {
          if (!merged.find(f => f.folderPath === lf.folderPath)) {
            merged.push(lf);
          }
        }
        
        setFolders(merged);
      } catch (err) {
        console.error('listFolders error:', err);
        showToast('Failed to load folders', 'error');
      } finally {
        setFoldersLoading(false);
      }
    }
    load();
  }, []);

  // ── File helpers ──────────────────────────────────────

  function addFiles(newFiles) {
    const entries = Array.from(newFiles).map((file) => {
      const type = getResourceType(file);
      const maxSize = MAX_SIZES[type] || MAX_SIZES.raw;
      let status = 'pending';
      let error = null;
      if (file.size > maxSize) {
        status = 'error';
        error = `Size limit exceeded (Max ${maxSize / (1024 * 1024)}MB)`;
      }
      return { id: Math.random().toString(36).slice(2), file, progress: 0, status, error };
    });
    setFiles((prev) => [...prev, ...entries]);
  }

  function removeFile(id) {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }

  function getFileIcon(file) {
    const type = file.type || '';
    if (type.startsWith('image/')) return '🖼️';
    if (type.startsWith('video/')) return '🎬';
    if (type.startsWith('audio/')) return '🎵';
    if (type === 'application/pdf') return '📄';
    return '📁';
  }

  function formatSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  // ── Drag events ───────────────────────────────────────

  function handleDragEnter(e) {
    e.preventDefault();
    dragCounter.current++;
    setDragging(true);
  }
  function handleDragLeave(e) {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current === 0) setDragging(false);
  }
  function handleDragOver(e) { e.preventDefault(); }
  function handleDrop(e) {
    e.preventDefault();
    dragCounter.current = 0;
    setDragging(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  }

  // ── Create folder ─────────────────────────────────────

  async function handleCreateFolder() {
    const name = newFolderName.trim().replace(/[/\\]/g, '-');
    if (!name) return;

    // If folder already exists, just select it instead of calling create API
    const existing = folders.find((f) => f.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      setSelectedFolder(existing.folderPath);
      setNewFolderMode(false);
      setNewFolderName('');
      showToast(`Selected existing folder "${existing.name}"`, 'success');
      return;
    }

    setCreatingFolder(true);
    try {
      const created = await createFolder(name, '/');
      
      // Update state and cache locally
      setFolders((prev) => {
        const next = [...prev, created];
        localStorage.setItem('ik_local_folders', JSON.stringify(next.filter(f => f.folderPath !== '/')));
        return next;
      });
      
      setSelectedFolder(created.folderPath);
      setNewFolderMode(false);
      setNewFolderName('');
      showToast(`Folder "${name}" created!`, 'success');
    } catch (err) {
      // If ImageKit says it already exists, just use it
      if (err.message && err.message.toLowerCase().includes('already exists')) {
        const fakeFolder = { name, folderPath: '/' + name };
        setFolders((prev) => {
          const next = [...prev, fakeFolder];
          localStorage.setItem('ik_local_folders', JSON.stringify(next.filter(f => f.folderPath !== '/')));
          return next;
        });
        setSelectedFolder(fakeFolder.folderPath);
        setNewFolderMode(false);
        setNewFolderName('');
        showToast(`Selected existing folder "${name}"`, 'success');
      } else {
        showToast(err.message || 'Failed to create folder', 'error');
      }
    } finally {
      setCreatingFolder(false);
    }
  }

  // ── Delete folder ─────────────────────────────────────

  async function initiateFolderDelete() {
    if (!selectedFolder || selectedFolder === '/') return;
    setDeletingFolder(true);
    const name = folders.find(f => f.folderPath === selectedFolder)?.name || selectedFolder;
    try {
      const hasFiles = await checkFolderHasFiles(selectedFolder);
      if (hasFiles) {
        setFolderToDelete({ path: selectedFolder, name });
        setShowDeleteConfirm(true);
      } else {
        // Empty folder, delete immediately
        await executeFolderDelete(selectedFolder, name);
      }
    } catch (err) {
      showToast(err.message || 'Failed to check folder', 'error');
    } finally {
      setDeletingFolder(false);
    }
  }

  async function executeFolderDelete(path, name) {
    setDeletingFolder(true);
    try {
      await deleteFolder(path);
      // Remove from state and local cache
      setFolders((prev) => {
        const next = prev.filter(f => f.folderPath !== path);
        localStorage.setItem('ik_local_folders', JSON.stringify(next.filter(f => f.folderPath !== '/')));
        return next;
      });
      setSelectedFolder('/');
      setShowDeleteConfirm(false);
      setFolderToDelete(null);
      showToast(`Folder "${name}" deleted!`, 'success');
    } catch (err) {
      showToast(err.message || 'Failed to delete folder', 'error');
    } finally {
      setDeletingFolder(false);
    }
  }

  // ── Upload all ────────────────────────────────────────

  async function uploadAll() {
    const folder = selectedFolder === '/' ? '' : selectedFolder;
    const pending = files.filter((f) => f.status === 'pending');
    if (!pending.length) return;

    const uploads = pending.map(async (entry) => {
      setFiles((prev) => prev.map((f) => f.id === entry.id ? { ...f, status: 'uploading' } : f));
      try {
        await uploadFile(
          entry.file,
          { folder: folder || undefined },
          (progress) => {
            setFiles((prev) => prev.map((f) => f.id === entry.id ? { ...f, progress } : f));
          }
        );
        setFiles((prev) => prev.map((f) => f.id === entry.id ? { ...f, status: 'done', progress: 100 } : f));
      } catch (err) {
        setFiles((prev) => prev.map((f) => f.id === entry.id ? { ...f, status: 'error', error: err.message } : f));
      }
    });

    await Promise.all(uploads);
    setTimeout(() => {
      if (files.some((f) => f.status !== 'error')) onComplete();
    }, 800);
  }

  const hasPending = files.some((f) => f.status === 'pending');
  const displayFolder = selectedFolder === '/' ? 'Root (/)' : selectedFolder;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>Upload Media</h2>
        <button className="btn btn-ghost btn-icon" onClick={onClose} id="upload-close-btn">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      {/* ── Folder Picker ── */}
      <div className={styles.folderSection}>
        <div className={styles.folderHeader}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
          </svg>
          <span className={styles.folderLabel}>Upload to folder</span>
        </div>

        {newFolderMode ? (
          <div className={styles.newFolderRow}>
            <div className={styles.newFolderInputWrap}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
              </svg>
              <input
                className={styles.newFolderInput}
                type="text"
                placeholder="New folder name…"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreateFolder(); if (e.key === 'Escape') setNewFolderMode(false); }}
                autoFocus
                id="new-folder-input"
              />
            </div>
            {(() => {
              const name = newFolderName.trim().replace(/[/\\]/g, '-');
              const exists = folders.some((f) => f.name.toLowerCase() === name.toLowerCase());
              
              return (
                <button
                  className={`btn btn-primary btn-sm ${styles.createBtn}`}
                  onClick={handleCreateFolder}
                  disabled={creatingFolder || !name}
                  id="create-folder-confirm-btn"
                >
                  {creatingFolder ? (
                    <div className={styles.miniSpinner} />
                  ) : exists ? (
                    <>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                      Add Media
                    </>
                  ) : (
                    <>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                      </svg>
                      Create
                    </>
                  )}
                </button>
              );
            })()}
            <button className="btn btn-ghost btn-sm" onClick={() => { setNewFolderMode(false); setNewFolderName(''); }}>
              Cancel
            </button>
          </div>
        ) : (
          <div className={styles.folderPickerRow}>
            <div className={styles.folderSelectWrap}>
              <svg className={styles.folderSelectIcon} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
              </svg>
              <select
                className={styles.folderSelect}
                value={selectedFolder}
                onChange={(e) => setSelectedFolder(e.target.value)}
                disabled={foldersLoading || deletingFolder}
                id="folder-select"
              >
                <option value="/">📂 Root (/)</option>
                {folders.map((f) => (
                  <option key={f.folderPath} value={f.folderPath}>
                    📁 {f.name}
                  </option>
                ))}
              </select>
              {foldersLoading && <div className={styles.miniSpinner} />}
            </div>
            {selectedFolder !== '/' && (
              <button
                className={`btn btn-ghost btn-sm btn-icon ${styles.deleteFolderBtn}`}
                onClick={initiateFolderDelete}
                disabled={deletingFolder}
                title="Delete this folder"
                id="delete-folder-btn"
              >
                {deletingFolder && !showDeleteConfirm ? (
                  <div className={styles.miniSpinner} />
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-danger)" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6l-1 14H6L5 6"/>
                    <path d="M10 11v6M14 11v6"/>
                    <path d="M9 6V4h6v2"/>
                  </svg>
                )}
              </button>
            )}
            <button
              className={`btn btn-ghost btn-sm ${styles.newFolderBtn}`}
              onClick={() => setNewFolderMode(true)}
              title="Create new folder"
              id="new-folder-btn"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                <line x1="12" y1="11" x2="12" y2="17"/>
                <line x1="9" y1="14" x2="15" y2="14"/>
              </svg>
              New Folder
            </button>
          </div>
        )}

        <div className={styles.folderBadge}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
          Files will be uploaded to: <strong>{displayFolder}</strong>
        </div>
      </div>

      {/* ── Drop zone ── */}
      <div
        className={`${styles.dropzone} ${dragging ? styles.dropzoneDragging : ''}`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
        id="upload-dropzone"
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar"
          onChange={(e) => addFiles(e.target.files)}
          style={{ display: 'none' }}
          id="upload-file-input"
        />
        <div className={styles.dropzoneContent}>
          <div className={`${styles.dropIcon} ${dragging ? styles.dropIconActive : ''}`}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <polyline points="16 16 12 12 8 16"/>
              <line x1="12" y1="12" x2="12" y2="21"/>
              <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
            </svg>
          </div>
          <p className={styles.dropText}>
            {dragging ? 'Drop files here!' : 'Drag & drop or click to browse'}
          </p>
          <p className={styles.dropSub}>Supports images, videos, audio, PDFs, documents & more</p>
        </div>
      </div>

      {/* ── File list ── */}
      <AnimatePresence>
        {files.length > 0 && (
          <motion.div className={styles.fileList} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {files.map((entry) => (
              <motion.div
                key={entry.id}
                className={styles.fileItem}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
              >
                <span className={styles.fileEmoji}>{getFileIcon(entry.file)}</span>
                <div className={styles.fileInfo}>
                  <span className={styles.fileName}>{entry.file.name}</span>
                  <span className={styles.fileSize}>{formatSize(entry.file.size)}</span>
                  {entry.status === 'uploading' && (
                    <div className={styles.progressBar}>
                      <div className={styles.progressFill} style={{ width: `${entry.progress}%` }} />
                    </div>
                  )}
                  {entry.status === 'error' && (
                    <span className={styles.fileError}>{entry.error}</span>
                  )}
                </div>
                <div className={styles.fileStatus}>
                  {entry.status === 'done' && (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-success)" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  )}
                  {entry.status === 'error' && (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-danger)" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
                    </svg>
                  )}
                  {entry.status === 'uploading' && (
                    <span className={styles.pct}>{entry.progress}%</span>
                  )}
                  {entry.status === 'pending' && (
                    <button className="btn btn-ghost btn-icon btn-sm" onClick={() => removeFile(entry.id)}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Upload button ── */}
      {hasPending && (
        <button
          className={`btn btn-primary ${styles.uploadBtn}`}
          onClick={uploadAll}
          id="upload-start-btn"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="16 16 12 12 8 16"/>
            <line x1="12" y1="12" x2="12" y2="21"/>
            <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
          </svg>
          Upload {files.filter((f) => f.status === 'pending').length} File
          {files.filter((f) => f.status === 'pending').length > 1 ? 's' : ''} to {displayFolder}
        </button>
      )}

      {/* ── Delete confirmation modal ── */}
      <AnimatePresence>
        {showDeleteConfirm && folderToDelete && (
          <motion.div
            className={styles.modalOverlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !deletingFolder && setShowDeleteConfirm(false)}
          >
            <motion.div
              className={styles.deleteModal}
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.deleteIcon}>⚠️</div>
              <h3 className={styles.deleteTitle}>Delete Folder?</h3>
              <p className={styles.deleteSub}>
                The folder <strong>{folderToDelete.name}</strong> is not empty. Deleting it will permanently remove all files and subfolders inside it.
              </p>
              <div className={styles.deleteActions}>
                <button
                  className="btn btn-ghost"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={deletingFolder}
                  id="delete-folder-cancel-btn"
                >
                  Cancel
                </button>
                <button
                  className="btn btn-danger"
                  onClick={() => executeFolderDelete(folderToDelete.path, folderToDelete.name)}
                  disabled={deletingFolder}
                  id="delete-folder-confirm-btn"
                >
                  {deletingFolder ? (
                    <><div style={{ width:14,height:14,border:'2px solid rgba(239,68,68,0.3)',borderTopColor:'var(--color-danger)',borderRadius:'50%',animation:'spin 0.7s linear infinite' }} /> Deleting…</>
                  ) : (
                    <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg> Delete Everything</>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
