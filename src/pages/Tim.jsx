import { useRef, useState } from 'react';
import { CalendarCheck, CalendarClock, KeyRound, Store, Users } from 'lucide-react';
import { Card, EmptyState, Select, Spinner } from '../components/ui';
import AppBar from '../components/layout/AppBar';
import { getLocalDateString } from '../utils/format';
import { monthKeyOf, monthRange } from '../utils/attendance';
import { useAttendanceSettings, useTimData } from '../components/tim/useTimData';
import AbsensiSection from '../components/tim/AbsensiSection';
import JadwalSection from '../components/tim/JadwalSection';
import StaffSection from '../components/tim/StaffSection';
import AkunStudioSection from '../components/tim/AkunStudioSection';
import './Tim.css';

const SECTIONS = [
  { value: 'absensi', label: 'Absensi', icon: CalendarCheck },
  { value: 'jadwal', label: 'Jadwal', icon: CalendarClock },
  { value: 'staff', label: 'Staff', icon: Users },
  { value: 'akun', label: 'Akun Studio', icon: KeyRound },
];

/**
 * Tim (docs/RENCANA_TANPA_ROLE.md §5 W2–W5): absensi & rekap performa, jadwal mingguan, daftar staff (nama saja, tanpa
 * akun), dan akun studio yang dipakai login di Snapme Desktop. Absensi, jadwal, dan staff berlaku per cabang
 * (managerId); akun studio berlaku untuk seluruh organisasi.
 */
export default function Tim({ user, orgId, managerId, branches, onViewManagerChange, studio }) {
  const [section, setSection] = useState('absensi');
  const today = getLocalDateString(new Date());
  const [month, setMonth] = useState(() => monthKeyOf(today));
  const data = useTimData(orgId, managerId, monthRange(month));
  const { lateToleranceMin } = useAttendanceSettings(orgId);
  const addStaffRef = useRef(null);
  const branchName = branches.find((b) => b.managerId === managerId)?.name;
  const needsBranch = section !== 'akun' && !managerId;

  const goToStaff = () => {
    setSection('staff');
    requestAnimationFrame(() => addStaffRef.current?.focus());
  };

  const shared = { orgId, user, managerId, today, data };

  return (
    <>
      <AppBar title="Tim" />
      <div className="tim-toolbar">
        <div className="chip-row" role="group" aria-label="Bagian Tim">
          {SECTIONS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              className={`chip${section === value ? ' is-active' : ''}`}
              aria-pressed={section === value}
              onClick={() => setSection(value)}
            >
              <Icon size={14} aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
        {section !== 'akun' && branches.length > 1 && (
          <Select value={managerId || ''} onChange={onViewManagerChange} aria-label="Cabang">
            <option value="" disabled>
              Pilih cabang
            </option>
            {branches.map((b) => (
              <option key={b.managerId} value={b.managerId}>
                {b.name}
              </option>
            ))}
          </Select>
        )}
        {section !== 'akun' && branches.length === 1 && branchName && <p className="tim-branch">Cabang {branchName}</p>}
      </div>

      <div className="page-body">
        {needsBranch ? (
          <Card>
            <EmptyState
              icon={Store}
              title={branches.length ? 'Pilih cabang' : 'Belum ada cabang'}
              description={
                branches.length
                  ? 'Absensi, jadwal, dan staff diatur per cabang. Pilih cabang di atas.'
                  : 'Tambahkan akun studio dulu di bagian Akun Studio.'
              }
            />
          </Card>
        ) : section === 'akun' ? (
          <AkunStudioSection orgId={orgId} user={user} branches={branches} {...studio} />
        ) : data.loading ? (
          <div className="page-loading">
            <Spinner size="lg" />
          </div>
        ) : section === 'absensi' ? (
          <AbsensiSection {...shared} month={month} onMonthChange={setMonth} toleranceMin={lateToleranceMin} />
        ) : section === 'jadwal' ? (
          <JadwalSection {...shared} onAddStaff={goToStaff} />
        ) : (
          <StaffSection {...shared} addInputRef={addStaffRef} />
        )}
      </div>
    </>
  );
}
