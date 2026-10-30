// Label staff (field staff.labels) yang memberi tunjangan di Gaji. Nominalnya diatur per cabang di Gaji → Atur
// (payrollSettings.adminAllowance / csAllowance). Admin dihitung tetap per bulan, CS per hari hadir.

export const STAFF_LABELS = [
  { key: 'admin', label: 'Admin', settingKey: 'adminAllowance', perDay: false, basis: 'per bulan' },
  { key: 'cs', label: 'CS', settingKey: 'csAllowance', perDay: true, basis: 'per hari hadir' },
];

/** Label yang terpasang pada staff, urut STAFF_LABELS (label yang tidak dikenal diabaikan). */
export const labelsOf = (person) => STAFF_LABELS.filter((l) => person.labels?.includes(l.key));
