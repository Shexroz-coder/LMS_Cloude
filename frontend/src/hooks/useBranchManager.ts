import { useAuthStore } from '../store/auth.store';
import { usePermissionStore } from '../store/permission.store';

/**
 * Filial mas'uli (menejer) holatini bir joydan aniqlash.
 * managedBranchId permission store (async /permissions/my) yoki
 * auth user (login'dan sync) dan olinadi.
 */
export function useBranchManager() {
  const user = useAuthStore(s => s.user);
  const pmManagedBranchId = usePermissionStore(s => s.managedBranchId);
  const managedBranchId = pmManagedBranchId ?? user?.managedBranchId ?? null;
  const isManager = user?.role === 'TEACHER' && !!managedBranchId;
  return { isManager, managedBranchId };
}
