import { useRef, useState } from 'react'
import { HiArrowUpTray } from 'react-icons/hi2'

const MAX_FILE_BYTES = 10 * 1024 * 1024 // 10 MB — mirrors the server limit

interface FileUploadProps {
  label: string
  accept?: string
  multiple?: boolean
  disabled?: boolean
  hint?: string
  /**
   * Called with the chosen File objects. Files are NOT uploaded here — the parent
   * holds them locally and pins them to IPFS at submit time, so abandoned drafts
   * never reach IPFS.
   */
  onSelect: (files: File[]) => void
}

/**
 * A plain file picker. Selecting files does no network work; it just hands the
 * raw File objects to the parent.
 */
export default function FileUpload({
  label,
  accept,
  multiple = false,
  disabled,
  hint,
  onSelect,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return
    setError(null)
    const files = Array.from(fileList)
    const tooBig = files.find(f => f.size > MAX_FILE_BYTES)
    if (tooBig) {
      setError(`${tooBig.name} exceeds the 10 MB limit.`)
      if (inputRef.current) inputRef.current.value = ''
      return
    }
    onSelect(files)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        style={{ display: 'none' }}
        onChange={e => handleFiles(e.target.files)}
        disabled={disabled}
      />
      <button
        type="button"
        className="btn btn-ghost"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
      >
        <HiArrowUpTray />
        {label}
      </button>
      {hint && (
        <p
          className="form-hint"
          style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 6 }}
        >
          {hint}
        </p>
      )}
      {error && (
        <p style={{ fontSize: 12, color: 'var(--color-error)', marginTop: 6 }}>{error}</p>
      )}
    </div>
  )
}
