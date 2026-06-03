import { useEffect, useState } from 'react'
import type { UserProfile, UserRole, UserStatus } from '../types'
import { deleteUserProfileAdmin, listUserProfiles, updateUserProfileAdmin } from '../services/userAdmin'
import { DangerZoneConfirmDialog } from './DangerZoneConfirmDialog'

interface Props {
  actorUid: string
  canDeleteUsers: boolean
}

function isPermissionDenied(error: unknown) {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'code' in error &&
      ((error as { code: unknown }).code === 'permission-denied' ||
        (error as { code: unknown }).code === 'PERMISSION_DENIED'),
  )
}

export function AdminUsersPanel({ actorUid, canDeleteUsers }: Props) {
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<UserProfile | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const refresh = async () => {
    setLoading(true)
    try {
      setUsers(await listUserProfiles())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  const update = async (
    user: UserProfile,
    patch: Partial<Pick<UserProfile, 'role' | 'status' | 'annotator_code' | 'training_completed' | 'confidentiality_agreement'>>,
  ) => {
    await updateUserProfileAdmin(user.uid, {
      role: patch.role ?? user.role,
      status: patch.status ?? user.status,
      annotator_code: patch.annotator_code ?? user.annotator_code,
      training_completed: patch.training_completed ?? user.training_completed,
      confidentiality_agreement: patch.confidentiality_agreement ?? user.confidentiality_agreement,
      approved_by_uid: actorUid,
    })
    await refresh()
  }

  const deleteUser = async () => {
    if (!deleteTarget || !canDeleteUsers) return
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteUserProfileAdmin(deleteTarget.uid, actorUid)
      setDeleteTarget(null)
      await refresh()
    } catch (error) {
      console.warn('No se pudo eliminar el perfil de usuario.', error)
      setDeleteError(
        isPermissionDenied(error)
          ? 'Firestore rechazo la eliminacion. Verifica que las reglas actualizadas esten publicadas para el proyecto.'
          : 'No se pudo eliminar el perfil. Revisa tu conexion.',
      )
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="compact-panel">
      <div className="panel-header">
        <h3>Usuarios</h3>
        <button className="ghost" onClick={() => void refresh()} disabled={loading}>
          Actualizar
        </button>
      </div>
      <div className="admin-user-list">
        {users.map((user) => (
          <div className="admin-user-row" key={user.uid}>
            <div>
              <strong>{user.full_name || user.email}</strong>
              <small>{user.email}</small>
            </div>
            <select value={user.role} onChange={(e) => void update(user, { role: e.target.value as UserRole })}>
              <option value="annotator">annotator</option>
              <option value="reviewer">reviewer</option>
              <option value="supervisor">supervisor</option>
              <option value="admin">admin</option>
            </select>
            <select value={user.status} onChange={(e) => void update(user, { status: e.target.value as UserStatus })}>
              <option value="pending">pending</option>
              <option value="active">active</option>
              <option value="suspended">suspended</option>
            </select>
            <input
              defaultValue={user.annotator_code}
              onBlur={(e) => {
                if (e.target.value !== user.annotator_code) {
                  void update(user, { annotator_code: e.target.value })
                }
              }}
              placeholder="ANN001"
            />
            <label className="inline-check">
              <input
                type="checkbox"
                checked={user.training_completed}
                onChange={(e) => void update(user, { training_completed: e.target.checked })}
              />
              Training
            </label>
            <label className="inline-check">
              <input
                type="checkbox"
                checked={user.confidentiality_agreement}
                onChange={(e) => void update(user, { confidentiality_agreement: e.target.checked })}
              />
              Conf.
            </label>
            {canDeleteUsers && (
              <button
                className="danger-outline"
                type="button"
                disabled={user.uid === actorUid}
                title={user.uid === actorUid ? 'No puedes eliminar tu propio perfil.' : 'Eliminar perfil de usuario'}
                onClick={() => {
                  setDeleteError(null)
                  setDeleteTarget(user)
                }}
              >
                Eliminar
              </button>
            )}
          </div>
        ))}
      </div>
      {deleteTarget && (
        <DangerZoneConfirmDialog
          key={deleteTarget.uid}
          title="Eliminar usuario"
          targetLabel={deleteTarget.full_name || deleteTarget.email || deleteTarget.uid}
          warning="Se eliminara el perfil de DIANA en Firestore. Sus anotaciones existentes permaneceran y su cuenta de Firebase Auth no sera eliminada, porque eso requiere un servicio backend con Admin SDK. Esta accion no se puede deshacer desde la app."
          busy={deleting}
          error={deleteError}
          onCancel={() => {
            setDeleteTarget(null)
            setDeleteError(null)
          }}
          onConfirm={() => void deleteUser()}
        />
      )}
    </div>
  )
}
