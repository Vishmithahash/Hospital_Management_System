import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuthStore } from '../../app/store.js'
import apiClient from '../../app/apiClient.js'
import { toastSuccess } from '../../app/toastHelpers.js'
import ImageUploader from '../../components/ImageUploader.jsx'

const schema = z.object({
  imageUrl: z.string().trim().url('Image URL must be valid').optional().or(z.literal(''))
})

export default function ProfilePage() {
  const { user, setUser } = useAuthStore()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting }
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      imageUrl: user?.profile?.imageUrl || ''
    }
  })

  useEffect(() => {
    reset({
      imageUrl: user?.profile?.imageUrl || ''
    })
  }, [user, reset])

  const onSubmit = async (values) => {
    const payload = {
      imageUrl: values.imageUrl || undefined
    }

    const { data } = await apiClient.put('/users/me/profile', payload)
    setUser(data.user)
    toastSuccess('Profile updated')
  }

  return (
    <main style={layout}>
      <header>
        <h2 style={{ marginBottom: '0.5rem' }}>Your Profile</h2>
        <p style={{ color: '#64748b' }}>View and edit your account details.</p>
      </header>

      <section style={card}>
        <div style={grid}>
          <div>
            <p style={label}>Role</p>
            <p style={value}>{user?.role}</p>
          </div>
          <div>
            <p style={label}>Email</p>
            <p style={value}>{user?.email}</p>
          </div>
          <div>
            <p style={label}>Linked Patient</p>
            <p style={value}>{user?.linkedPatientId || 'Not linked'}</p>
          </div>
        </div>
      </section>

      <form style={card} onSubmit={handleSubmit(onSubmit)}>
        <h3 style={{ marginTop: 0 }}>Profile Image</h3>
        <p style={{ color: '#64748b', marginTop: '0.35rem', marginBottom: '1rem' }}>
          Upload a new profile picture or paste the direct image link you want to use.
        </p>
        <div style={{ marginBottom: '1.25rem' }}>
          <ImageUploader
            imageUrl={user?.profile?.imageUrl}
            disabled={isSubmitting}
            onUploaded={(url) => {
              if (user) {
                setUser({
                  ...user,
                  profile: { ...(user.profile || {}), imageUrl: url }
                })
              }
              reset({ imageUrl: url || '' })
              toastSuccess('Profile image updated')
            }}
          />
        </div>
        <label style={formLabel}>
          Image URL
          <input
            style={input}
            placeholder="https://example.com/profile.jpg"
            {...register('imageUrl')}
          />
          {errors.imageUrl ? <span style={errorText}>{errors.imageUrl.message}</span> : null}
        </label>
        <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: '0.35rem' }}>
          Save changes after pasting a new link to see it reflected everywhere.
        </p>
        <div>
          <button type="submit" style={primaryButton} disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      </form>
    </main>
  )
}

const layout = {
  padding: '2rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '1.5rem'
}

const card = {
  background: '#fff',
  borderRadius: '1rem',
  padding: '1.5rem',
  boxShadow: '0 20px 45px rgba(15, 23, 42, 0.08)'
}

const grid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: '1rem'
}

const label = { color: '#64748b', marginBottom: '0.35rem' }
const value = { marginTop: 0 }

const formLabel = { display: 'flex', flexDirection: 'column', gap: '0.35rem' }
const input = { border: '1px solid #cbd5f5', borderRadius: '0.65rem', padding: '0.5rem 0.75rem' }
const primaryButton = { border: 'none', borderRadius: '9999px', padding: '0.6rem 1.25rem', background: '#0ea5e9', color: '#fff', cursor: 'pointer' }
const errorText = { color: '#ef4444', fontSize: '0.8rem' }
