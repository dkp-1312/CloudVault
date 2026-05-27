// ============================================================
// ImageKit API layer — All media operations (no backend)
// ============================================================

const URL_ENDPOINT  = import.meta.env.VITE_IMAGEKIT_URL_ENDPOINT;  // e.g. https://ik.imagekit.io/your_id
const PUBLIC_KEY    = import.meta.env.VITE_IMAGEKIT_PUBLIC_KEY;
const PRIVATE_KEY   = import.meta.env.VITE_IMAGEKIT_PRIVATE_KEY;

const API_BASE = 'https://api.imagekit.io/v1';

/** Build Basic Auth header from private key (username = privateKey, password = empty) */
function getAuthHeader() {
  const credentials = btoa(`${PRIVATE_KEY}:`);
  return `Basic ${credentials}`;
}

/** Detect resource_type from file MIME type (kept compatible with Cloudinary naming) */
export function getResourceType(file) {
  const mime = file.type || '';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/') || mime.startsWith('audio/')) return 'video';
  return 'raw'; // PDFs, docs, etc.
}

/** Get a human-readable label for resource type */
export function getResourceLabel(resourceType) {
  if (resourceType === 'image') return 'Image';
  if (resourceType === 'video') return 'Video';
  if (resourceType === 'raw') return 'Document';
  return 'File';
}

// ─────────────────────────────────────────────
// UPLOAD
// ─────────────────────────────────────────────

/**
 * Upload a file to ImageKit.
 * Calls onProgress(percent) as the upload progresses.
 *
 * ImageKit unsigned upload requires:
 *   - file       : the binary
 *   - fileName   : desired file name
 *   - publicKey  : your ImageKit public key
 *
 * Returns a normalised resource object compatible with the rest of the app.
 */
export function uploadFile(file, optionsOrOnProgress, onProgressCb) {
  return new Promise((resolve, reject) => {
    let options = {};
    let onProgress = () => {};
    
    if (typeof optionsOrOnProgress === 'function') {
      onProgress = optionsOrOnProgress;
    } else if (typeof optionsOrOnProgress === 'object') {
      options = optionsOrOnProgress;
      if (typeof onProgressCb === 'function') onProgress = onProgressCb;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('fileName', options.fileName || file.name);
    
    if (options.useUniqueFileName !== undefined) {
      formData.append('useUniqueFileName', options.useUniqueFileName);
    }
    if (options.folder) {
      formData.append('folder', options.folder);
    }

    const xhr = new XMLHttpRequest();
    xhr.open('POST', 'https://upload.imagekit.io/api/v1/files/upload');
    xhr.setRequestHeader('Authorization', getAuthHeader());

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const raw = JSON.parse(xhr.responseText);
        resolve(normaliseUploadResponse(raw));
      } else {
        reject(new Error(`Upload failed: ${xhr.status} ${xhr.responseText}`));
      }
    });

    xhr.addEventListener('error', () => reject(new Error('Network error during upload')));
    xhr.send(formData);
  });
}

/**
 * Normalise an ImageKit upload response into the shape the app expects.
 * Maps ImageKit fields → Cloudinary-compatible field names.
 */
function normaliseUploadResponse(raw) {
  const format = raw.name.split('.').pop()?.toLowerCase() || '';
  const audioVideoFormats = ['mp3', 'wav', 'ogg', 'aac', 'm4a', 'flac', 'mp4', 'webm', 'mov', 'avi', 'mkv'];
  let resourceType = raw.fileType === 'image' ? 'image' : raw.fileType === 'video' ? 'video' : 'raw';
  
  if (resourceType === 'raw' && audioVideoFormats.includes(format)) {
    resourceType = 'video';
  }

  return {
    fileId:        raw.fileId,
    public_id:     raw.name,          // use 'name' as the public identifier
    secure_url:    raw.url,
    resource_type: resourceType,
    format:        format,
    bytes:         raw.size,
    created_at:    raw.createdAt,
    tags:          raw.tags || [],
    width:         raw.width,
    height:        raw.height,
  };
}

/**
 * Normalise an ImageKit list-file entry into the same shape.
 */
function normaliseListEntry(raw) {
  const format = raw.name.split('.').pop()?.toLowerCase() || '';
  const audioVideoFormats = ['mp3', 'wav', 'ogg', 'aac', 'm4a', 'flac', 'mp4', 'webm', 'mov', 'avi', 'mkv'];
  let resourceType = raw.fileType === 'image' ? 'image' : raw.fileType === 'video' ? 'video' : 'raw';
  
  if (resourceType === 'raw' && audioVideoFormats.includes(format)) {
    resourceType = 'video';
  }

  return {
    fileId:        raw.fileId,
    public_id:     raw.name,
    secure_url:    raw.url,
    resource_type: resourceType,
    format:        format,
    bytes:         raw.size,
    created_at:    raw.createdAt,
    tags:          raw.tags || [],
    width:         raw.width,
    height:        raw.height,
  };
}

// ─────────────────────────────────────────────
// LIST RESOURCES
// ─────────────────────────────────────────────

/**
 * List all files in the ImageKit Media Library.
 * Returns up to 1000 files, sorted by date descending.
 */
export async function listResources() {
  const url = new URL(`${API_BASE}/files`);
  url.searchParams.set('limit', '1000');
  url.searchParams.set('sort', 'DESC_CREATED');

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Authorization: getAuthHeader(),
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err?.message || 'Failed to list resources');
  }

  const data = await res.json();
  return (Array.isArray(data) ? data : []).map(normaliseListEntry);
}

// ─────────────────────────────────────────────
// DELETE
// ─────────────────────────────────────────────

/**
 * Delete a resource by its fileId.
 * The `_resourceType` param is kept for API compatibility with Cloudinary callers.
 */
export async function deleteResource(publicId, _resourceType = 'image') {
  // We need the fileId — it is stored on the resource object. When called from
  // MediaGrid we pass the whole resource; fall back to fetching by name.
  const fileId = await resolveFileId(publicId);

  const res = await fetch(`${API_BASE}/files/${fileId}`, {
    method: 'DELETE',
    headers: {
      Authorization: getAuthHeader(),
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err?.message || 'Failed to delete resource');
  }

  return { deleted: publicId };
}

// ─────────────────────────────────────────────
// RENAME
// ─────────────────────────────────────────────

/**
 * Rename a file (update its name / path in ImageKit).
 * ImageKit uses PATCH /files/:fileId to update metadata.
 */
export async function renameResource(fromPublicId, toPublicId, _resourceType = 'image') {
  const fileId = await resolveFileId(fromPublicId);

  const res = await fetch(`${API_BASE}/files/${fileId}`, {
    method: 'PATCH',
    headers: {
      Authorization: getAuthHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: toPublicId }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err?.message || 'Failed to rename resource');
  }

  const updated = await res.json();
  return normaliseListEntry(updated);
}

// ─────────────────────────────────────────────
// UPDATE TAGS
// ─────────────────────────────────────────────

/**
 * Replace all tags on a resource.
 * tagString is a comma-separated string of tags.
 */
export async function updateTags(publicId, tagString, _resourceType = 'image') {
  const tags = tagString
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

  const fileId = await resolveFileId(publicId);

  const res = await fetch(`${API_BASE}/files/${fileId}`, {
    method: 'PATCH',
    headers: {
      Authorization: getAuthHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ tags }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err?.message || 'Failed to update tags');
  }

  return { success: true, tags };
}

// ─────────────────────────────────────────────
// REPLACE MEDIA (delete old + upload new)
// ─────────────────────────────────────────────

/**
 * Replace a resource's file by uploading a new one and deleting the old.
 * Returns the new resource data.
 */
export async function replaceResource(oldPublicId, oldResourceType, newFile, onProgress = () => {}) {
  // 1. Upload new file
  const newResource = await uploadFile(newFile, onProgress);

  // 2. Delete the old resource
  try {
    await deleteResource(oldPublicId, oldResourceType);
  } catch (err) {
    console.warn('Could not delete old resource after replace:', err.message);
  }

  return newResource;
}

// ─────────────────────────────────────────────
// URL HELPERS
// ─────────────────────────────────────────────

/**
 * Build an ImageKit optimised thumbnail URL for images.
 * Returns null for non-image types.
 *
 * ImageKit transformation syntax: /tr:w-400,h-300,c-maintain_ratio/
 */
export function getThumbnailUrl(resource, width = 400, height = 300) {
  if (resource.resource_type !== 'image') return null;
  const base = resource.secure_url;
  // Insert transformation before the file path segment
  return base.replace(
    URL_ENDPOINT,
    `${URL_ENDPOINT}/tr:w-${width},h-${height},c-maintain_ratio,q-auto,f-auto`
  );
}

/**
 * Build an ImageKit video thumbnail (poster) URL.
 */
export function getVideoThumbnailUrl(resource) {
  if (resource.resource_type !== 'video') return null;
  const base = resource.secure_url;
  // ImageKit generates a thumbnail from video using ik-thumbnail.jpg
  return base.replace(
    URL_ENDPOINT,
    `${URL_ENDPOINT}/tr:w-400,h-300,c-maintain_ratio`
  ) + '/ik-thumbnail.jpg';
}

/**
 * Get custom uploaded thumbnail URL if available via tags.
 */
export function getCustomThumbnailUrl(resource) {
  if (resource.tags && resource.tags.includes('has_custom_thumb')) {
    return `${resource.secure_url}_custom_thumb.jpg`;
  }
  return null;
}

// ─────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────

/** Resolve an ImageKit fileId from a public_id (name).
 *  ImageKit APIs mostly need fileId. We search by name.
 */
async function resolveFileId(publicId) {
  const url = new URL(`${API_BASE}/files`);
  url.searchParams.set('searchQuery', `name = "${publicId}"`);
  url.searchParams.set('limit', '1');

  const res = await fetch(url.toString(), {
    headers: { Authorization: getAuthHeader() },
  });

  if (!res.ok) {
    throw new Error('Could not resolve file ID for: ' + publicId);
  }

  const files = await res.json();
  if (!files || files.length === 0) {
    throw new Error(`File not found in ImageKit: ${publicId}`);
  }

  return files[0].fileId;
}
