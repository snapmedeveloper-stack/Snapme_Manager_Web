import { LogOut, Store } from 'lucide-react';
import { Avatar, Badge, Button, Card, Select, useConfirm } from '../components/ui';
import AppBar from '../components/layout/AppBar';
import KasirSettings from '../components/profil/KasirSettings';
import ManagerAccess from '../components/profil/ManagerAccess';
import AttendanceSettings from '../components/profil/AttendanceSettings';
import { ROLE_LABEL, ROLE_TONE } from '../constants/roles';
import './Profil.css';

/**
 * Profil akun yang sedang login, cabang yang dilihat (khusus owner), dan pengaturan organisasi yang sejak rombak
 * tanpa role hanya diubah dari Snapme Manager (docs/RENCANA_TANPA_ROLE.md): kasir & nota, absensi.
 */
export default function Profil({ user, orgId, userMeta, branches = [], viewManagerId, onViewManagerChange, onLogout }) {
  const confirm = useConfirm();
  const role = userMeta?.role;
  const canManage = role === 'owner';
  const name = userMeta?.name || user.displayName || user.email?.split('@')[0];

  const handleLogout = async () => {
    const ok = await confirm({
      title: 'Keluar dari akun?',
      message: 'Anda perlu login lagi untuk membuka Snapme Manager.',
      confirmText: 'Keluar',
      destructive: true,
    });
    if (ok) onLogout();
  };

  return (
    <>
      <AppBar title="Profil" />
      <div className="page-body">
        <Card>
          <div className="profile-head">
            <Avatar src={user.photoURL} name={name} size={56} />
            <div className="profile-info">
              <span className="profile-name">{name}</span>
              <span className="profile-email">{user.email}</span>
              {role && <Badge tone={ROLE_TONE[role] || 'neutral'}>{ROLE_LABEL[role] || role}</Badge>}
            </div>
          </div>
        </Card>

        {role === 'owner' && branches.length > 1 && (
          <Card
            title={
              <>
                <Store size={18} aria-hidden="true" />
                Cabang yang dilihat
              </>
            }
          >
            <div className="form-group">
              <label htmlFor="profile-view-branch">Cabang</label>
              <Select id="profile-view-branch" value={viewManagerId || ''} onChange={onViewManagerChange}>
                <option value="">Semua cabang</option>
                {branches.map((b) => (
                  <option key={b.managerId} value={b.managerId}>
                    {b.name}
                  </option>
                ))}
              </Select>
              <span className="form-hint">
                Timeline, Layanan, dan Tim hanya menampilkan data cabang yang dipilih. Transaksi selalu menampilkan
                semua.
              </span>
            </div>
          </Card>
        )}

        {canManage && <ManagerAccess orgId={orgId} isPrimaryOwner={!!userMeta?.isPrimaryOwner} />}
        {canManage && <KasirSettings orgId={orgId} />}
        {canManage && <AttendanceSettings orgId={orgId} />}

        <Button variant="danger" size="lg" block icon={LogOut} onClick={handleLogout}>
          Keluar
        </Button>
      </div>
    </>
  );
}
