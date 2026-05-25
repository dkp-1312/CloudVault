// ============================================================
// Cloudinary API layer — All media operations (no backend)
// ============================================================

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const API_KEY = import.meta.env.VITE_CLOUDINARY_API_KEY;
const API_SECRET = import.meta.env.VITE_CLOUDINARY_API_SECRET;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

const BASE_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}`;

/** Build Basic Auth header from API key + secret */
function getAuthHeader() {
  const credentials = btoa(`${API_KEY}:${API_SECRET}`);
  return `Basic ${credentials}`;
}

/** Detect Cloudinary resource_type from file MIME type */
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
 * Upload a file to Cloudinary using unsigned upload preset.
 * Calls onProgress(percent) as the upload progresses.
 */
export function uploadFile(file, onProgress = () => {}) {
  return new Promise((resolve, reject) => {
    const resourceType = getResourceType(file);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', UPLOAD_PRESET);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${BASE_URL}/${resourceType}/upload`);

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        reject(new Error(`Upload failed: ${xhr.status} ${xhr.responseText}`));
      }
    });

    xhr.addEventListener('error', () => reject(new Error('Network error during upload')));
    xhr.send(formData);
  });
}

// ─────────────────────────────────────────────
// LIST RESOURCES
// ─────────────────────────────────────────────

/**
 * List all resources in the Cloudinary account using the Search API.
 * Fetches up to 500 resources, sorted by created_at descending.
 */
export async function listResources() {
  const res = await fetch(`${BASE_URL}/resources/search`, {
    method: 'POST',
    headers: {
      Authorization: getAuthHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      expression: '',
      sort_by: [{ created_at: 'desc' }],
      max_results: 500,
      with_field: ['tags', 'context'],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
    throw new Error(err?.error?.message || 'Failed to list resources');
  }

  const data = await res.json();
  return data.resources || [];
}

// ─────────────────────────────────────────────
// DELETE
// ─────────────────────────────────────────────

/**
 * Delete a resource by its public_id and resource_type.
 */
export async function deleteResource(publicId, resourceType = 'image') {
  const url = new URL(`${BASE_URL}/resources/${resourceType}/upload`);
  url.searchParams.set('public_ids[]', publicId);

  const res = await fetch(url.toString(), {
    method: 'DELETE',
    headers: {
      Authorization: getAuthHeader(),
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
    throw new Error(err?.error?.message || 'Failed to delete resource');
  }

  return await res.json();
}

// ─────────────────────────────────────────────
// RENAME
// ─────────────────────────────────────────────

/**
 * Rename a resource (change its public_id).
 */
export async function renameResource(fromPublicId, toPublicId, resourceType = 'image') {
  const res = await fetch(`${BASE_URL}/resources/${resourceType}/upload/rename`, {
    method: 'POST',
    headers: {
      Authorization: getAuthHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from_public_id: fromPublicId,
      to_public_id: toPublicId,
      overwrite: false,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
    throw new Error(err?.error?.message || 'Failed to rename resource');
  }

  return await res.json();
}

// ─────────────────────────────────────────────
// UPDATE TAGS
// ─────────────────────────────────────────────

/**
 * Replace all tags on a resource.
 * tagString is a comma-separated string of tags.
 */
export async function updateTags(publicId, tagString, resourceType = 'image') {
  const tags = tagString
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

  // First, remove all existing tags
  await fetch(`${BASE_URL}/resources/tags`, {
    method: 'POST',
    headers: {
      Authorization: getAuthHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      command: 'remove_all',
      public_ids: [publicId],
      resource_type: resourceType,
    }),
  });

  // Then add the new tags (if any)
  if (tags.length > 0) {
    const res = await fetch(`${BASE_URL}/resources/tags`, {
      method: 'POST',
      headers: {
        Authorization: getAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        command: 'add',
        tag: tags[0],   // Cloudinary only supports one tag per call for 'add'
        public_ids: [publicId],
        resource_type: resourceType,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
      throw new Error(err?.error?.message || 'Failed to update tags');
    }

    // Add remaining tags
    for (const tag of tags.slice(1)) {
      await fetch(`${BASE_URL}/resources/tags`, {
        method: 'POST',
        headers: {
          Authorization: getAuthHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          command: 'add',
          tag,
          public_ids: [publicId],
          resource_type: resourceType,
        }),
      });
    }
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
 * Build a Cloudinary optimized thumbnail URL for images.
 * Returns null for non-image types.
 */
export function getThumbnailUrl(resource, width = 400, height = 300) {
  if (resource.resource_type !== 'image') return null;
  const { secure_url, public_id } = resource;
  // Use URL transformation
  return secure_url.replace(
    `/image/upload/`,
    `/image/upload/w_${width},h_${height},c_fill,q_auto,f_auto/`
  );
}

/**
 * Build a Cloudinary video thumbnail URL.
 */
export function getVideoThumbnailUrl(resource) {
  if (resource.resource_type !== 'video') return null;
  const { public_id } = resource;
  // Generate a poster thumbnail from the video (first frame)
  return `https://res.cloudinary.com/${CLOUD_NAME}/video/upload/w_400,h_300,c_fill,q_auto,so_0/${public_id}.jpg`;
}
