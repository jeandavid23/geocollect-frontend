import { useEffect, useRef, useState } from 'react'
import { KeyRound, Eye, EyeOff, CheckCircle2, AlertTriangle, Camera, Save, Loader2, IdCard, Mail, Phone, User as UserIcon } from 'lucide-react'
import Header from '../../components/layout/Header'
import { useAuthStore } from '../../store/authStore'
import { authApi } from '../../api/auth'

// Réduit une image en base64 (max 400px) pour un stockage léger
function fileToResizedDataUrl(file: File, max = 400): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height))
        const w = Math.round(img.width * scale)
        const h = Math.round(img.height * scale)
        const canvas = document.createElement('canvas')
        canvas.width = w; canvas.height = h
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/jpeg', 0.8))
      }
      img.onerror = reject
      img.src = reader.result as string
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export default function AccountPage() {
  const { user, updateUser } = useAuthStore()
  const fileRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({ full_name: '', email: '', phone: '', national_id: '' })
  const [photo, setPhoto] = useState<string>('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileMsg, setProfileMsg] = useState<{ t: 'ok' | 'err'; m: string } | null>(null)

  const [oldPwd, setOldPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [savingPwd, setSavingPwd] = useState(false)
  const [pwdMsg, setPwdMsg] = useState<{ t: 'ok' | 'err'; m: string } | null>(null)

  const roleLabel = user?.role === 'super_admin' ? 'Super Administrateur'
    : user?.role === 'cooperative' ? 'Coopérative' : 'Agent Mappeur'

  // Charge le profil complet depuis le backend
  useEffect(() => {
    authApi.me().then(({ data }) => {
      const d = data as Record<string, unknown>
      setForm({
        full_name: String(d.full_name ?? ''),
        email: String(d.email ?? ''),
        phone: String(d.phone ?? ''),
        national_id: String(d.national_id ?? ''),
      })
      setPhoto(String(d.photo_data ?? ''))
    }).catch(() => {
      // fallback : infos du store
      setForm((f) => ({ ...f, full_name: user?.fullName ?? '', email: user?.email ?? '' }))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setField = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try { setPhoto(await fileToResizedDataUrl(file)) } catch { /* ignore */ }
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setProfileMsg(null); setSavingProfile(true)
    try {
      const { data } = await authApi.updateProfile({ ...form, photo_data: photo })
      const d = data as Record<string, unknown>
      updateUser({ fullName: String(d.full_name ?? form.full_name), email: String(d.email ?? form.email) })
      setProfileMsg({ t: 'ok', m: 'Profil enregistré avec succès.' })
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: Record<string, unknown> } })?.response?.data
      const msg = detail?.email ? 'Cet email est déjà utilisé.' : 'Échec de l\'enregistrement (vérifiez la connexion).'
      setProfileMsg({ t: 'err', m: msg })
    } finally { setSavingProfile(false) }
  }

  const handleChangePwd = async (e: React.FormEvent) => {
    e.preventDefault()
    setPwdMsg(null)
    if (newPwd.length < 6) { setPwdMsg({ t: 'err', m: 'Le mot de passe doit faire au moins 6 caractères.' }); return }
    if (newPwd !== confirm) { setPwdMsg({ t: 'err', m: 'Les deux mots de passe ne correspondent pas.' }); return }
    setSavingPwd(true)
    try {
      await authApi.changePassword(oldPwd, newPwd)
      setPwdMsg({ t: 'ok', m: 'Mot de passe modifié avec succès.' })
      setOldPwd(''); setNewPwd(''); setConfirm('')
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: Record<string, unknown> } })?.response?.data
      setPwdMsg({ t: 'err', m: detail?.old_password ? 'Mot de passe actuel incorrect.' : 'Échec (vérifiez la connexion au serveur).' })
    } finally { setSavingPwd(false) }
  }

  const inputCls = "w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-5">
      <Header title="Mon profil" subtitle="Gérez vos informations et votre mot de passe" />

      {/* Profil */}
      <form onSubmit={handleSaveProfile} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-4">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-20 h-20 rounded-2xl overflow-hidden bg-primary-100 flex items-center justify-center text-primary-700 font-black text-2xl">
              {photo ? <img src={photo} alt="" className="w-full h-full object-cover" /> : (user?.fullName?.charAt(0) ?? <UserIcon className="w-8 h-8" />)}
            </div>
            <button type="button" onClick={() => fileRef.current?.click()}
              className="absolute -bottom-1 -right-1 w-7 h-7 bg-primary-600 hover:bg-primary-700 rounded-full flex items-center justify-center text-white shadow" title="Changer la photo">
              <Camera className="w-3.5 h-3.5" />
            </button>
            <input ref={fileRef} type="file" accept="image/*" onChange={handlePhoto} className="hidden" />
          </div>
          <div>
            <p className="font-bold text-gray-900">{form.full_name || user?.fullName}</p>
            <p className="text-sm text-gray-500">{roleLabel}</p>
            <p className="text-xs font-mono text-gray-400">Identifiant : {user?.username}</p>
          </div>
        </div>

        {profileMsg && (
          <div className={`rounded-xl p-3 flex items-center gap-2 text-sm ${profileMsg.t === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {profileMsg.t === 'ok' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}{profileMsg.m}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nom complet</label>
          <input value={form.full_name} onChange={(e) => setField('full_name', e.target.value)} className={inputCls} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-1"><Mail className="w-3.5 h-3.5" /> Email</label>
            <input type="email" value={form.email} onChange={(e) => setField('email', e.target.value)} className={inputCls} placeholder="email@..." />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> Téléphone</label>
            <input value={form.phone} onChange={(e) => setField('phone', e.target.value)} className={inputCls} placeholder="+225 ..." />
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-1"><IdCard className="w-3.5 h-3.5" /> Pièce d'identité (CNI / passeport)</label>
          <input value={form.national_id} onChange={(e) => setField('national_id', e.target.value)} className={inputCls} placeholder="N° de pièce" />
        </div>

        <button type="submit" disabled={savingProfile}
          className="w-full flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 text-white font-semibold py-2.5 rounded-xl transition">
          {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {savingProfile ? 'Enregistrement...' : 'Enregistrer le profil'}
        </button>
      </form>

      {/* Mot de passe */}
      <form onSubmit={handleChangePwd} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-4">
        <div className="flex items-center gap-2 text-gray-800">
          <KeyRound className="w-5 h-5 text-primary-600" />
          <h3 className="font-semibold">Changer mon mot de passe</h3>
        </div>
        {pwdMsg && (
          <div className={`rounded-xl p-3 flex items-center gap-2 text-sm ${pwdMsg.t === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {pwdMsg.t === 'ok' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}{pwdMsg.m}
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe actuel</label>
          <input type={show ? 'text' : 'password'} value={oldPwd} onChange={(e) => setOldPwd(e.target.value)} required className={inputCls} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nouveau</label>
            <div className="relative">
              <input type={show ? 'text' : 'password'} value={newPwd} onChange={(e) => setNewPwd(e.target.value)} required className={inputCls + ' pr-10'} />
              <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirmer</label>
            <input type={show ? 'text' : 'password'} value={confirm} onChange={(e) => setConfirm(e.target.value)} required className={inputCls} />
          </div>
        </div>
        <button type="submit" disabled={savingPwd}
          className="w-full flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-900 disabled:bg-gray-300 text-white font-semibold py-2.5 rounded-xl transition">
          {savingPwd ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
          {savingPwd ? 'Modification...' : 'Modifier le mot de passe'}
        </button>
      </form>
    </div>
  )
}
