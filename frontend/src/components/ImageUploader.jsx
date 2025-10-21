import { useCallback, useRef, useState } from 'react'
import apiClient from '../app/apiClient.js'

export default function ImageUploader({ imageUrl, onUploaded, disabled }) {
  const inputRef = useRef(null)
  const [isDrag, setIsDrag] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)

  const handlePick = () => inputRef.current?.click()

  const uploadFile = useCallback(
    async (file) => {
      if (!file) return
      setError(null)
      if (!file.type.startsWith('image/')) {
        setError('Please choose an image file')
        return
      }
      if (file.size > 5 * 1024 * 1024) {
        setError('Max file size is 5MB')
        return
      }
      setUploading(true)
      try {
        const form = new FormData()
        form.append('image', file)
        const { data } = await apiClient.post('/users/me/profile/image', form, {
          headers: { 'Content-Type': 'multipart/form-data' },
          skipErrorToast: true
        })
        onUploaded?.(data.user?.profile?.imageUrl)
      } finally {
        setUploading(false)
      }
    },
    [onUploaded]
  )

  const onInputChange = (e) => uploadFile(e.target.files?.[0])

  const onDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDrag(false)
    const file = e.dataTransfer.files?.[0]
    uploadFile(file)
  }

  const onDragOver = (e) => {
    e.preventDefault()
    setIsDrag(true)
  }

  const onDragLeave = () => setIsDrag(false)

  return (
    <div style={container}>
      <div
        style={{
          ...dropzone,
          borderColor: isDrag ? '#0ea5e9' : '#cbd5f5',
          background: isDrag ? 'rgba(14,165,233,0.08)' : '#f8fafc',
          opacity: disabled ? 0.6 : 1
        }}
        onClick={disabled ? undefined : handlePick}
        onDrop={disabled ? undefined : onDrop}
        onDragOver={disabled ? undefined : onDragOver}
        onDragLeave={disabled ? undefined : onDragLeave}
      >
        <div style={avatarWrapper}>
          {imageUrl ? (
            <img src={imageUrl} alt="Profile" style={avatarImg} />
          ) : (
            <div style={avatarPlaceholder}>👤</div>
          )}
        </div>
        <div>
          <div style={{ fontWeight: 600 }}>Upload profile image</div>
          <div style={{ fontSize: '0.85rem', color: '#64748b' }}>PNG/JPG up to 5MB. Click or drop.</div>
        </div>
        <button type="button" style={button} disabled={disabled || uploading}>
          {uploading ? 'Uploading…' : 'Choose file'}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={onInputChange}
          disabled={disabled}
        />
      </div>
      {error ? <div style={errorText}>{error}</div> : null}
    </div>
  )
}

const container = { display: 'flex', flexDirection: 'column', gap: '0.5rem' }
const dropzone = {
  display: 'grid',
  gridTemplateColumns: 'auto 1fr auto',
  alignItems: 'center',
  gap: '1rem',
  border: '2px dashed',
  borderRadius: '0.75rem',
  padding: '0.75rem 1rem',
  cursor: 'pointer'
}
const avatarWrapper = { width: 56, height: 56, borderRadius: '50%', overflow: 'hidden', background: '#e2e8f0', display: 'grid', placeItems: 'center' }
const avatarImg = { width: '100%', height: '100%', objectFit: 'cover' }
const avatarPlaceholder = { fontSize: '1.5rem', opacity: 0.7 }
const button = { border: 'none', borderRadius: '9999px', padding: '0.5rem 1rem', background: '#0ea5e9', color: '#fff' }
const errorText = { color: '#b91c1c' }

