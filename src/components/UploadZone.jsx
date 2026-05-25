import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { uploadFile, getResourceType } from '../lib/imagekit';
import styles from './UploadZone.module.css';

export default function UploadZone({ onComplete, onClose, showToast }) {
  const [files, setFiles] = useState([]); // { file, progress, status, error }
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef(null);
  const dragCounter = useRef(0);

  function addFiles(newFiles) {
    const entries = Array.from(newFiles).map((file) => ({
      id: Math.random().toString(36).slice(2),
      file,
      progress: 0,
      status: 'pending', // pending | uploading | done | error
      error: null,
    }));
    setFiles((prev) => [...prev, ...entries]);
  }

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

  async function uploadAll() {
    const pending = files.filter((f) => f.status === 'pending');
    if (!pending.length) return;

    const uploads = pending.map(async (entry) => {
      setFiles((prev) => prev.map((f) => f.id === entry.id ? { ...f, status: 'uploading' } : f));
      try {
        await uploadFile(entry.file, (progress) => {
          setFiles((prev) => prev.map((f) => f.id === entry.id ? { ...f, progress } : f));
        });
        setFiles((prev) => prev.map((f) => f.id === entry.id ? { ...f, status: 'done', progress: 100 } : f));
      } catch (err) {
        setFiles((prev) => prev.map((f) => f.id === entry.id ? { ...f, status: 'error', error: err.message } : f));
      }
    });

    await Promise.all(uploads);

    const allDone = files.every((f) => f.status === 'done') ||
      pending.every((_, i) => true); // check after state updates

    setTimeout(() => {
      if (files.some((f) => f.status !== 'error')) onComplete();
    }, 800);
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

  const hasPending = files.some((f) => f.status === 'pending');
  const allUploading = files.length > 0 && files.every((f) => f.status === 'uploading' || f.status === 'done');

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>Upload Media</h2>
        <button className={`btn btn-ghost btn-icon`} onClick={onClose} id="upload-close-btn">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      {/* Drop zone */}
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

      {/* File list */}
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
                    <button className={`btn btn-ghost btn-icon btn-sm`} onClick={() => removeFile(entry.id)}>
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

      {/* Upload button */}
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
          Upload {files.filter((f) => f.status === 'pending').length} File{files.filter((f) => f.status === 'pending').length > 1 ? 's' : ''}
        </button>
      )}
    </div>
  );
}
