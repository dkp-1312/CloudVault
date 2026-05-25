import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { listResources, deleteResource, getThumbnailUrl, getVideoThumbnailUrl } from '../lib/imagekit';
import MediaCard from './MediaCard';
import EditModal from './EditModal';
import styles from './MediaGrid.module.css';

const FILTER_OPTIONS = [
  { label: 'All', value: 'all' },
  { label: 'Images', value: 'image' },
  { label: 'Videos', value: 'video' },
  { label: 'Audio', value: 'audio' },
  { label: 'Documents', value: 'raw' },
];

export default function MediaGrid({ refreshTrigger, showToast, onResourcesChange }) {
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchResources = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await listResources();
      setResources(data);
    } catch (err) {
      setError(err.message || 'Failed to load media. Check your ImageKit credentials.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchResources(); }, [fetchResources, refreshTrigger]);

  // Filter by type and search
  const filtered = resources.filter((r) => {
    const isAudio = r.resource_type === 'video' && ['mp3', 'wav', 'ogg', 'aac', 'm4a', 'flac'].includes(r.format);
    const matchesType = filter === 'all'
      ? true
      : filter === 'audio'
        ? isAudio
        : filter === 'video'
          ? r.resource_type === 'video' && !isAudio
          : r.resource_type === filter;
    const matchesSearch = search
      ? r.public_id.toLowerCase().includes(search.toLowerCase()) ||
        (r.tags || []).some((t) => t.toLowerCase().includes(search.toLowerCase()))
      : true;
    return matchesType && matchesSearch;
  });

  async function handleDelete(resource) {
    setDeleting(true);
    try {
      await deleteResource(resource.public_id, resource.resource_type);
      setResources((prev) => prev.filter((r) => r.public_id !== resource.public_id));
      showToast('File deleted successfully.', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to delete.', 'error');
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  function handleEditSave(updatedResource) {
    setResources((prev) =>
      prev.map((r) => r.public_id === editTarget.public_id ? { ...r, ...updatedResource } : r)
    );
    setEditTarget(null);
    showToast('Changes saved!', 'success');
  }

  function handleResourceReplaced(oldPublicId, newResource) {
    setResources((prev) => {
      const next = prev.filter((r) => r.public_id !== oldPublicId);
      return [newResource, ...next];
    });
    setEditTarget(null);
    showToast('Media replaced successfully!', 'success');
  }

  return (
    <div>
      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.filters} role="tablist">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              className={`${styles.filterBtn} ${filter === opt.value ? styles.filterBtnActive : ''}`}
              onClick={() => setFilter(opt.value)}
              role="tab"
              aria-selected={filter === opt.value}
              id={`filter-${opt.value}`}
            >
              {opt.label}
              {opt.value !== 'all' && (
                <span className={styles.filterCount}>
                  {resources.filter((r) => {
                    const isAudio = r.resource_type === 'video' && ['mp3','wav','ogg','aac','m4a','flac'].includes(r.format);
                    if (opt.value === 'audio') return isAudio;
                    if (opt.value === 'video') return r.resource_type === 'video' && !isAudio;
                    return r.resource_type === opt.value;
                  }).length}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className={styles.searchWrap}>
          <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            className={`input ${styles.searchInput}`}
            type="text"
            placeholder="Search by name or tag…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            id="media-search"
          />
          {search && (
            <button className={styles.clearSearch} onClick={() => setSearch('')}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className={styles.stats}>
        <span className={styles.statText}>
          {loading ? 'Loading…' : `${filtered.length} of ${resources.length} files`}
        </span>
        <button className={`btn btn-ghost btn-sm ${styles.refreshBtn}`} onClick={fetchResources} title="Refresh" id="refresh-btn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="23 4 23 10 17 10"/>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
          </svg>
          Refresh
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className={styles.loadingState}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className={styles.skeleton} />
          ))}
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className={styles.errorState}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--color-danger)" strokeWidth="1.5">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <p>{error}</p>
          <button className="btn btn-ghost btn-sm" onClick={fetchResources}>Try Again</button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && filtered.length === 0 && (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>🗂️</div>
          <p className={styles.emptyTitle}>{resources.length === 0 ? 'No media yet' : 'No results found'}</p>
          <p className={styles.emptySub}>
            {resources.length === 0 ? 'Upload your first file using the button above.' : 'Try adjusting your search or filter.'}
          </p>
        </div>
      )}

      {/* Grid */}
      {!loading && !error && filtered.length > 0 && (
        <motion.div
          className={styles.grid}
          layout
        >
          <AnimatePresence>
            {filtered.map((resource, i) => (
              <MediaCard
                key={resource.public_id}
                resource={resource}
                index={i}
                onEdit={() => setEditTarget(resource)}
                onDelete={() => setDeleteTarget(resource)}
                showToast={showToast}
              />
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Delete confirmation modal */}
      <AnimatePresence>
        {deleteTarget && (
          <motion.div
            className={styles.modalOverlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !deleting && setDeleteTarget(null)}
          >
            <motion.div
              className={styles.deleteModal}
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.deleteIcon}>🗑️</div>
              <h3 className={styles.deleteTitle}>Delete File?</h3>
              <p className={styles.deleteSub}>
                <strong>{deleteTarget.public_id}</strong> will be permanently removed from ImageKit.
              </p>
              <div className={styles.deleteActions}>
                <button
                  className="btn btn-ghost"
                  onClick={() => setDeleteTarget(null)}
                  disabled={deleting}
                  id="delete-cancel-btn"
                >
                  Cancel
                </button>
                <button
                  className="btn btn-danger"
                  onClick={() => handleDelete(deleteTarget)}
                  disabled={deleting}
                  id="delete-confirm-btn"
                >
                  {deleting ? (
                    <><div style={{ width:14,height:14,border:'2px solid rgba(239,68,68,0.3)',borderTopColor:'var(--color-danger)',borderRadius:'50%',animation:'spin 0.7s linear infinite' }} /> Deleting…</>
                  ) : (
                    <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg> Delete</>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Modal */}
      <AnimatePresence>
        {editTarget && (
          <EditModal
            resource={editTarget}
            onClose={() => setEditTarget(null)}
            onSave={handleEditSave}
            onReplaced={handleResourceReplaced}
            showToast={showToast}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
