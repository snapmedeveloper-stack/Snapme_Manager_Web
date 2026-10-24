import { Eye, LogOut, Settings, SlidersHorizontal } from 'lucide-react';
import { Avatar, Badge, Button, Card, EmptyState, Select, useConfirm } from '../components/ui';
import AppBar from '../components/layout/AppBar';
import { ROLE_LABEL, ROLE_TONE } from '../constants/roles';
import './Profil.css';

/**
 * Profil akun yang sedang login, pilihan manager yang dilihat (khusus owner, sama dengan "Lihat Timeline" di menu atas
 * Snapme_Desktop), dan (nanti) pengaturan Snapme Manager.
 */
export default function Profil({ user, userMeta, managers = [], viewManagerId, onViewManagerChange, onLogout }) {
  const confirm = useConfirm();
  const role = userMeta?.role;
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

        {role === 'owner' && (
          <Card
            title={
              <>
                <Eye size={18} aria-hidden="true" />
                Data yang dilihat
              </>
            }
          >
            <div className="form-group">
              <label htmlFor="profile-view-manager">Manager</label>
              <Select id="profile-view-manager" value={viewManagerId || ''} onChange={onViewManagerChange}>
                <option value="">Semua manager</option>
                {managers.map((m) => (
                  <option key={m.uid} value={m.uid}>
                    {m.displayName || m.name || m.email || m.uid}
                  </option>
                ))}
              </Select>
              <span className="form-hint">
                Timeline dan Layanan hanya menampilkan data tim manager yang dipilih. Transaksi selalu menampilkan semua,
                sama dengan Snapme Desktop.
              </span>
            </div>
          </Card>
        )}

        <Card
          title={
            <>
              <Settings size={18} aria-hidden="true" />
              Pengaturan
            </>
          }
        >
          <EmptyState
            icon={SlidersHorizontal}
            title="Belum ada pengaturan"
            description="Pengaturan Snapme Manager akan ditambahkan di versi berikutnya."
          />
        </Card>

        <Button variant="danger" size="lg" block icon={LogOut} onClick={handleLogout}>
          Keluar
        </Button>
      </div>
    </>
  );
}
