import { useState, type FormEvent, type ReactNode } from 'react'
import PageHeading from '../../components/ui/PageHeading'
import DataState from '../../components/ui/DataState'
import { useAuth } from '../../auth/useAuth'
import { useGreenhouse } from '../../hooks/useValeriaData'
import { greenhouseService } from '../../services/greenhouseService'
import type { EnvironmentalThresholds, NotificationPreferences } from '../../types/domain'

type SettingsState = EnvironmentalThresholds & NotificationPreferences & {
}

type ProfileDraft = {
  fullName?: string
  email?: string
  greenhouseName?: string
  location?: string
  description?: string
}

const initialSettings: SettingsState = {
  temperatureMin: 18,
  temperatureMax: 30,
  humidityMin: 50,
  humidityMax: 80,
  soilMin: 60,
  soilMax: 85,
  lightMin: 300,
  lightMax: 1200,
  alertNotifications: true,
  sensorNotifications: true,
  irrigationNotifications: false,
}

export default function Settings() {
  const profile = useAuth()
  const greenhouse = useGreenhouse()
  const [settings, setSettings] = useState(initialSettings)
  const [thresholdsEdited, setThresholdsEdited] = useState(false)
  const [profileDraft, setProfileDraft] = useState<ProfileDraft>({})
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordSubmitting, setPasswordSubmitting] = useState(false)
  const [passwordSaved, setPasswordSaved] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const displayedSettings = thresholdsEdited || !greenhouse.data
    ? settings
    : { ...settings, ...greenhouse.data.thresholds }
  const fullName = profileDraft.fullName ?? profile.user?.name ?? ''
  const email = profileDraft.email ?? profile.user?.email ?? ''
  const greenhouseName = profileDraft.greenhouseName ?? greenhouse.data?.name ?? ''
  const location = profileDraft.location ?? greenhouse.data?.location ?? ''
  const description = profileDraft.description ?? greenhouse.data?.description ?? ''

  function update<K extends keyof SettingsState>(key: K, value: SettingsState[K]) {
    setSettings((current) => ({ ...current, [key]: value }))
    if (key in initialSettings && key !== 'alertNotifications' && key !== 'sensorNotifications' && key !== 'irrigationNotifications') {
      setThresholdsEdited(true)
    }
    setSaved(false)
  }

  function updateProfile<K extends keyof ProfileDraft>(key: K, value: string) {
    setProfileDraft((current) => ({ ...current, [key]: value }))
    setSaved(false)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaved(false)
    setSaveError('')
    setSaving(true)
    try {
      await Promise.all([
        profile.updateProfile({ name: fullName, email }),
        greenhouseService.updateGreenhouse({
          name: greenhouseName,
          location,
          description,
          thresholds: {
            temperatureMin: displayedSettings.temperatureMin,
            temperatureMax: displayedSettings.temperatureMax,
            humidityMin: displayedSettings.humidityMin,
            humidityMax: displayedSettings.humidityMax,
            soilMin: displayedSettings.soilMin,
            soilMax: displayedSettings.soilMax,
            lightMin: displayedSettings.lightMin,
            lightMax: displayedSettings.lightMax,
          },
        }),
      ])
      setSaved(true)
    } catch {
      setSaveError('Profile or greenhouse details could not be saved. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPasswordSaved(false)
    setPasswordError('')
    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match.')
      return
    }
    setPasswordSubmitting(true)
    try {
      await profile.changePassword({ currentPassword, newPassword })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordSaved(true)
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : 'Password could not be changed. Please try again.')
    } finally {
      setPasswordSubmitting(false)
    }
  }

  return (
    <div className="page-content settings-page">
      <PageHeading
        eyebrow="YOUR VALERIA WORKSPACE"
        title="Settings"
        description="Keep your greenhouse details and preferred conditions up to date."
      />
      {greenhouse.loading || greenhouse.error || !profile.user || !greenhouse.data ? <DataState loading={greenhouse.loading} error={greenhouse.error} empty={!greenhouse.loading && !greenhouse.error && (!profile.user || !greenhouse.data)} emptyMessage="Profile and greenhouse settings are not available in this session." onRetry={greenhouse.refresh} /> : <>
      <form className="settings-form" onSubmit={handleSubmit}>
        <SettingsSection title="Profile" description="The details associated with this workspace.">
          <div className="settings-fields">
            <SettingsField label="Full name"><input autoComplete="name" value={fullName} onChange={(event) => updateProfile('fullName', event.target.value)} required /></SettingsField>
            <SettingsField label="Email"><input type="email" autoComplete="email" value={email} onChange={(event) => updateProfile('email', event.target.value)} required /></SettingsField>
          </div>
        </SettingsSection>

        <SettingsSection title="Greenhouse" description="A few details about the place you are monitoring.">
          <div className="settings-fields">
            <SettingsField label="Greenhouse name"><input value={greenhouseName} onChange={(event) => updateProfile('greenhouseName', event.target.value)} /></SettingsField>
            <SettingsField label="Location"><input value={location} onChange={(event) => updateProfile('location', event.target.value)} /></SettingsField>
            <SettingsField label="Description" wide><textarea rows={3} value={description} onChange={(event) => updateProfile('description', event.target.value)} /></SettingsField>
          </div>
        </SettingsSection>

        <SettingsSection title="Environmental thresholds" description="Choose the ranges you want VALERIA to use when highlighting conditions.">
          <div className="threshold-grid">
            <Threshold label="Temperature" unit="°C" minValue={displayedSettings.temperatureMin} maxValue={displayedSettings.temperatureMax} onMin={(value) => update('temperatureMin', value)} onMax={(value) => update('temperatureMax', value)} />
            <Threshold label="Humidity" unit="%" minValue={displayedSettings.humidityMin} maxValue={displayedSettings.humidityMax} onMin={(value) => update('humidityMin', value)} onMax={(value) => update('humidityMax', value)} />
            <Threshold label="Soil moisture" unit="%" minValue={displayedSettings.soilMin} maxValue={displayedSettings.soilMax} onMin={(value) => update('soilMin', value)} onMax={(value) => update('soilMax', value)} />
            <Threshold label="Light" unit="lux" minValue={displayedSettings.lightMin} maxValue={displayedSettings.lightMax} onMin={(value) => update('lightMin', value)} onMax={(value) => update('lightMax', value)} />
          </div>
        </SettingsSection>

        <SettingsSection title="Notification preferences" description="Session-only interface preferences. VALERIA does not send email or push notifications.">
          <div className="notification-options">
            <NotificationOption label="Alert updates" description="Display preference only; no message is sent." checked={displayedSettings.alertNotifications} onChange={(value) => update('alertNotifications', value)} />
            <NotificationOption label="Sensor status" description="Display preference only; no message is sent." checked={displayedSettings.sensorNotifications} onChange={(value) => update('sensorNotifications', value)} />
            <NotificationOption label="Irrigation recommendations" description="Recommendations only; there are no physical irrigation cycles or device commands." checked={displayedSettings.irrigationNotifications} onChange={(value) => update('irrigationNotifications', value)} />
          </div>
        </SettingsSection>

        <div className="settings-submit-row">
          {saved && <span className="settings-saved" role="status">Your profile, greenhouse details, and thresholds have been saved.</span>}
          {saveError && <span className="form-error" role="alert">{saveError}</span>}
          <button className="settings-save-button" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save settings'}</button>
        </div>
      </form>
      <SettingsSection title="Security" description="Change the password for your VALERIA account.">
        <form className="password-change-form" onSubmit={handlePasswordSubmit}>
          <div className="settings-fields security-fields">
            <SettingsField label="Current password">
              <input type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} minLength={8} maxLength={72} required />
            </SettingsField>
            <SettingsField label="New password">
              <input type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength={8} maxLength={72} required />
            </SettingsField>
            <SettingsField label="Confirm new password">
              <input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={8} maxLength={72} required />
            </SettingsField>
          </div>
          <div className="password-change-actions">
            {passwordSaved && <span className="settings-saved" role="status">Your password has been changed.</span>}
            {passwordError && <span className="form-error" role="alert">{passwordError}</span>}
            <button className="settings-save-button" type="submit" disabled={passwordSubmitting}>
              {passwordSubmitting ? 'Changing password…' : 'Change password'}
            </button>
          </div>
          <p className="session-note"><span aria-hidden="true">i</span><span>Use 8–72 characters. Your password is securely hashed and never returned by the API.</span></p>
        </form>
      </SettingsSection>
      <p className="data-disclaimer">Profile, greenhouse details, and environmental thresholds are stored in PostgreSQL. Alert rules use these thresholds for future readings; notification preferences are currently session-only.</p>
      </>}
    </div>
  )
}

function SettingsSection({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="surface-card settings-section">
      <div className="settings-section-heading"><h2>{title}</h2><p>{description}</p></div>
      <div className="settings-section-content">{children}</div>
    </section>
  )
}

function SettingsField({ label, wide = false, children }: { label: string; wide?: boolean; children: ReactNode }) {
  return <label className={`settings-field${wide ? ' settings-field-wide' : ''}`}><span>{label}</span>{children}</label>
}

function Threshold({ label, unit, minValue, maxValue, onMin, onMax }: { label: string; unit: string; minValue: number; maxValue: number; onMin: (value: number) => void; onMax: (value: number) => void }) {
  return (
    <fieldset className="threshold-item">
      <legend>{label}</legend>
      <label><span>Minimum</span><span className="threshold-input"><input type="number" value={minValue} onChange={(event) => onMin(Number(event.target.value))} /><small>{unit}</small></span></label>
      <label><span>Maximum</span><span className="threshold-input"><input type="number" value={maxValue} onChange={(event) => onMax(Number(event.target.value))} /><small>{unit}</small></span></label>
    </fieldset>
  )
}

function NotificationOption({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="notification-option">
      <span><strong>{label}</strong><small>{description}</small></span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  )
}
