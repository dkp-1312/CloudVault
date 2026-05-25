import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { renameResource, updateTags, replaceResource, uploadFile } from '../lib/imagekit';
import styles from './EditModal.module.css';

export default function EditModal({ resource, onClose, onSave, onReplaced, showToast }) {
  const [name, setName] = useState(resource.public_id);
  const [tags, setTags] = useState((resource.tags || []).join(', '));
  const [replaceFile, setReplaceFile] = useState(null);
  const [replacePreview, setReplacePreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [replaceProgress, setReplaceProgress] = useState(0);
  const fileInputRef = useRef(null);

  function handleReplaceSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setReplaceFile(file);
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setReplacePreview(url);
    } else {
      setReplacePreview(null);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      let updatedResource = { ...resource };

      // 1. Replace media file if selected
      if (replaceFile) {
        const newResource = await replaceResource(
          resource.public_id,
          resource.resource_type,
          replaceFile,
          setReplaceProgress
        );
        onReplaced(resource.public_id, newResource);
        return;
      }

      // 2. Rename if name changed
      if (name !== resource.public_id) {
        const renamed = await renameResource(resource.public_id, name, resource.resource_type);
        updatedResource = { ...updatedResource, ...renamed, public_id: name };
      }

      // 3. Update tags
      const currentTags = (resource.tags || []).join(', ');
      if (tags !== currentTags) {
        await updateTags(updatedResource.public_id, tags, resource.resource_type);
        updatedResource.tags = tags.split(',').map((t) => t.trim()).filter(Boolean);
      }

      onSave(updatedResource);
    } catch (err) {
      showToast(err.message || 'Failed to save changes.', 'error');
    } finally {
      setSaving(false);
    }
  }

  const hasChanges = name !== resource.public_id
    || tags !== (resource.tags || []).join(', ')
    || replaceFile;

  return (
    <motion.div
      className={styles.overlay}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={() => !saving && onClose()}
    >
      <motion.div
        className={styles.modal}
        initial={{ scale: 0.9, opacity: 0, y: 30 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 30 }}
        transition={{ duration: 0.25 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={styles.header}>
          <div>
            <h2 className={styles.title}>Edit Media</h2>
            <p className={styles.subtitle}>{resource.public_id.split('/').pop()}</p>
          </div>
          <button className={`btn btn-ghost btn-icon`} onClick={onClose} disabled={saving} id="edit-modal-close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Current preview */}
        {resource.resource_type === 'image' && (
          <div className={styles.preview}>
            <img
              src={replacePreview || resource.secure_url}
              alt={resource.public_id}
              className={styles.previewImg}
            />
            {replacePreview && (
              <div className={styles.previewBadge}>New file selected</div>
            )}
          </div>
        )}

        {/* Form fields */}
        <div className={styles.form}>
          {/* Rename */}
          <div className={styles.field}>
            <label className={styles.label} htmlFor="edit-name">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
              Public ID (Filename)
            </label>
            <input
              id="edit-name"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. my-folder/photo-name"
              disabled={saving}
            />
            <span className={styles.hint}>Use forward slashes for folders, e.g. folder/name</span>
          </div>

          {/* Tags */}
          <div className={styles.field}>
            <label className={styles.label} htmlFor="edit-tags">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
                <line x1="7" y1="7" x2="7.01" y2="7"/>
              </svg>
              Tags
            </label>
            <input
              id="edit-tags"
              className="input"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="tag1, tag2, tag3"
              disabled={saving}
            />
            <span className={styles.hint}>Separate tags with commas</span>
          </div>

          {/* Replace media */}
          <div className={styles.field}>
            <label className={styles.label}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="1 4 1 10 7 10"/>
                <path d="M3.51 15a9 9 0 1 0 .49-3.51"/>
              </svg>
              Replace Media File
            </label>
            <div
              className={styles.replaceZone}
              onClick={() => fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
              id="edit-replace-zone"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.zip"
                onChange={handleReplaceSelect}
                style={{ display: 'none' }}
              />
              {replaceFile ? (
                <div className={styles.replaceSelected}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-success)" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  <span>{replaceFile.name}</span>
                </div>
              ) : (
                <div className={styles.replacePrompt}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <polyline points="16 16 12 12 8 16"/>
                    <line x1="12" y1="12" x2="12" y2="21"/>
                    <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
                  </svg>
                  <span>Click to select a new file</span>
                </div>
              )}
            </div>
            {replaceFile && (
              <button
                className={`btn btn-ghost btn-sm`}
                onClick={() => { setReplaceFile(null); setReplacePreview(null); }}
                style={{ marginTop: 8 }}
              >
                Remove selection
              </button>
            )}
            <span className={styles.hint}>Uploading a new file will replace and delete the original.</span>
          </div>
        </div>

        {/* Progress bar for replace */}
        {saving && replaceFile && (
          <div className={styles.progressWrap}>
            <div className={styles.progressBar}>
              <div className={styles.progressFill} style={{ width: `${replaceProgress}%` }} />
            </div>
            <span className={styles.progressLabel}>{replaceProgress}% uploading…</span>
          </div>
        )}

        {/* Footer buttons */}
        <div className={styles.footer}>
          <button className="btn btn-ghost" onClick={onClose} disabled={saving} id="edit-cancel-btn">
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving || !hasChanges}
            id="edit-save-btn"
          >
            {saving ? (
              <><div className={styles.spinner} /> Saving…</>
            ) : (
              <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg> Save Changes</>
            )}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
