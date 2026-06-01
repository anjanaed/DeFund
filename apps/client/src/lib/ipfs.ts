import { apiFetch } from './api'

const IPFS_GATEWAY = import.meta.env.VITE_IPFS_GATEWAY || 'https://ipfs.io/ipfs/'

/** Build a gateway URL from an IPFS CID. Passes through values that are already URLs. */
export function ipfsUrl(cid: string): string {
  if (!cid) return ''
  if (/^https?:\/\//i.test(cid)) return cid
  return `${IPFS_GATEWAY}${cid.trim()}`
}

/** Result returned by the /uploads/file endpoint after pinning to IPFS. */
export interface UploadedMedia {
  cid: string
  url: string
  name: string
  mimetype: string
  size: number
}

export function isImageMime(mimetype?: string): boolean {
  return !!mimetype && mimetype.startsWith('image/')
}

/**
 * Pin a single file to IPFS via the backend and return its CID + gateway URL.
 * Called at submit time (not on file selection) so abandoned drafts never pin.
 */
export async function uploadFileToIpfs(file: File): Promise<UploadedMedia> {
  const form = new FormData()
  form.append('file', file)
  const res = await apiFetch('/uploads/file', { method: 'POST', body: form })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const msg = Array.isArray(err.message) ? err.message.join(', ') : err.message
    throw new Error(msg || `Upload failed for ${file.name}`)
  }
  return (await res.json()) as UploadedMedia
}
