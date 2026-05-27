import { useState } from 'react';
import { motion } from 'framer-motion';
import { getThumbnailUrl, getVideoThumbnailUrl } from '../lib/imagekit';
import styles from './MediaCard.module.css';

function getFileTypeLabel(resource) {
  const { resource_type, format } = resource;
  const audioFormats = ['mp3', 'wav', 'ogg', 'aac', 'm4a', 'flac'];
  if (resource_type === 'video' && audioFormats.includes(format)) return 'audio';
  return resource_type;
}

function getTypeIcon(type, format) {
  const audioFormats = ['mp3', 'wav', 'ogg', 'aac', 'm4a', 'flac'];
  if (type === 'video' && audioFormats.includes(format)) {
    return (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
      </svg>
    );
  }
  if (type === 'video') {
    return (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
      </svg>
    );
  }
  if (type === 'raw') {
    return (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
        <polyline points="10 9 9 9 8 9"/>
      </svg>
    );
  }
  return null;
}

export default function MediaCard({ resource, index, onEdit, onDelete, showToast }) {
  const [imgError, setImgError] = useState(false);
  const [copied, setCopied] = useState(false);
  const [lightbox, setLightbox] = useState(false);

  const typeLabel = getFileTypeLabel(resource);
  let thumbnailUrl = resource.customThumbUrl || null;
  
  if (!thumbnailUrl && !imgError) {
    thumbnailUrl = resource.resource_type === 'image'
      ? getThumbnailUrl(resource, 480, 360)
      : resource.resource_type === 'video'
        ? getVideoThumbnailUrl(resource)
        : null;
  }

  if (!thumbnailUrl || imgError) {
    if (typeLabel === 'audio') {
      thumbnailUrl = '/Audio.png';
    } else if (typeLabel === 'video') {
      thumbnailUrl = '/Video.png';
    }
  }

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(resource.secure_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast('Failed to copy URL', 'error');
    }
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function formatBytes(bytes) {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  }

  return (
    <>
      <motion.div
        className={styles.card}
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.25, delay: Math.min(index * 0.04, 0.3) }}
        whileHover={{ y: -4 }}
      >
        {/* Thumbnail */}
        <div className={styles.thumb} onClick={() => resource.resource_type === 'image' && setLightbox(true)}>
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt={resource.public_id}
              className={styles.thumbImg}
              onError={() => setImgError(true)}
              loading="lazy"
            />
          ) : (
            <div className={`${styles.thumbPlaceholder} ${styles[`thumb_${typeLabel}`]}`}>
              {getTypeIcon(resource.resource_type, resource.format)}
              <span className={styles.formatLabel}>.{resource.format?.toUpperCase()}</span>
            </div>
          )}

          {/* Hover overlay */}
          <div className={styles.overlay}>
            {resource.resource_type === 'image' && (
              <button className={styles.overlayBtn} title="Preview" onClick={(e) => { e.stopPropagation(); setLightbox(true); }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              </button>
            )}
            <button className={styles.overlayBtn} title={copied ? 'Copied!' : 'Copy URL'} onClick={copyUrl}>
              {copied ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-success)" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
              )}
            </button>
          </div>

          {/* Type badge */}
          <div className={styles.typeBadge}>
            <span className={`badge badge-${typeLabel}`}>{typeLabel}</span>
          </div>
        </div>

        {/* Info */}
        <div className={styles.info}>
          <p className={styles.name} title={resource.public_id}>
            {resource.public_id.split('/').pop()}
          </p>
          <div className={styles.meta}>
            <span>{formatDate(resource.created_at)}</span>
            {resource.bytes && <span>{formatBytes(resource.bytes)}</span>}
          </div>
          {resource.tags?.length > 0 && (
            <div className={styles.tags}>
              {resource.tags.slice(0, 3).map((tag) => (
                <span key={tag} className={styles.tag}>#{tag}</span>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className={styles.actions}>
          <button
            className={`btn btn-ghost btn-sm ${styles.actionBtn}`}
            onClick={onEdit}
            title="Edit"
            id={`edit-${resource.public_id.replace(/\//g, '-')}`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            Edit
          </button>
          <button
            className={`btn btn-danger btn-sm ${styles.actionBtn}`}
            onClick={onDelete}
            title="Delete"
            id={`delete-${resource.public_id.replace(/\//g, '-')}`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14H6L5 6"/>
              <path d="M10 11v6M14 11v6"/>
              <path d="M9 6V4h6v2"/>
            </svg>
            Delete
          </button>
        </div>
      </motion.div>

      {/* Lightbox */}
      {lightbox && resource.resource_type === 'image' && (
        <div className={styles.lightbox} onClick={() => setLightbox(false)}>
          <button className={styles.lightboxClose} onClick={() => setLightbox(false)}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
          <img
            src={resource.secure_url}
            alt={resource.public_id}
            className={styles.lightboxImg}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
