// Diambil dari Snapme_Desktop/src/components/setting/KasirSection.jsx + ReceiptPreview.jsx. Sejak rombak tanpa role
// (docs/RENCANA_TANPA_ROLE.md) pengaturan nota hanya diubah dari sini; Desktop hanya membacanya untuk mencetak.
import { useEffect, useId, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { ReceiptText, Save, Undo2 } from 'lucide-react';
import { db } from '../../firebase';
import { Badge, Button, Card, Select, useToast } from '../ui';
import { writeInBackground } from '../../utils/firestoreWrite';
import { formatRupiah } from '../../utils/format';
import { receiptSettings } from '../../utils/receipt';
import logo from '../../assets/logo.png';

/** Nilai bawaan field (dokumen organizations/{orgId}/settings/kasir, dipakai semua komputer). */
const KASIR_DEFAULTS = {
  businessName: '',
  address: '',
  phone: '',
  footerNote: '',
  paperSize: '80mm',
};
const kasirSettingsRef = (orgId) => doc(db, 'organizations', orgId, 'settings', 'kasir');

const PAPER_SIZES = [
  { value: '80mm', label: 'Thermal 80 mm' },
  { value: '58mm', label: 'Thermal 58 mm' },
  { value: 'A5', label: 'Kertas A5' },
];

// Isi nota PDF dibuat Snapme Desktop (electron/main.js, generate-receipt-pdf): alamat & telepon kosong diganti alamat
// studio Singaraja, dan logo dicetak menggantikan nama bisnis.
const PRINTED_ADDRESS = 'Jl. Nusa Indah No. 8, Singaraja';
const PRINTED_PHONE = '0859-2422-6805';
const SAMPLE_ITEMS = [
  { name: 'Paket Reguler', qty: 1, price: 150000 },
  { name: 'Extra Cetak 4R', qty: 2, price: 20000 },
];

// Draft hanya berisi field yang diubah; sama = semua field itu bernilai sama dengan yang tersimpan
const sameAsSaved = (draft, saved) => Object.keys(draft).every((key) => (draft[key] ?? '') === (saved[key] ?? ''));

function ReceiptPreview({ values }) {
  const s = receiptSettings(values);
  const total = SAMPLE_ITEMS.reduce((sum, item) => sum + item.qty * item.price, 0);
  return (
    <div className="profile-receipt-stage">
      <div className={`profile-receipt profile-receipt-${s.paperSize.toLowerCase()}`} aria-label="Pratinjau nota">
        <img className="profile-receipt-logo" src={logo} alt="Snap Me" />
        <div>{values.address || PRINTED_ADDRESS}</div>
        <div>WA: {values.phone || PRINTED_PHONE}</div>
        <div className="profile-receipt-line" />
        {SAMPLE_ITEMS.map((item) => (
          <div key={item.name} className="profile-receipt-item">
            <span>{item.name}</span>
            <span>{item.qty}x</span>
            <span>{formatRupiah(item.qty * item.price)}</span>
          </div>
        ))}
        <div className="profile-receipt-line" />
        <div className="profile-receipt-total">
          <span>Total</span>
          <span>{formatRupiah(total)}</span>
        </div>
        <div className="profile-receipt-thanks">Terima kasih telah berkunjung!</div>
        <div className="profile-receipt-note">{s.footerNote}</div>
      </div>
    </div>
  );
}

/**
 * Data bisnis yang dicetak di nota (Kasir, Transaksi, nota PDF via WhatsApp). Berlaku untuk semua komputer.
 * Draft hanya menyimpan field yang diubah, dan Simpan hanya menulis field itu (merge), jadi tidak menimpa perubahan
 * dari perangkat lain.
 */
export default function KasirSettings({ orgId }) {
  const formId = useId();
  const toast = useToast();
  const [saved, setSaved] = useState(KASIR_DEFAULTS);
  const [draft, setDraft] = useState(null); // null = belum ada perubahan
  const [seenSaved, setSeenSaved] = useState(saved);

  useEffect(() => {
    if (!orgId) return undefined;
    return onSnapshot(kasirSettingsRef(orgId), (snap) => {
      if (snap.exists()) setSaved({ ...KASIR_DEFAULTS, ...snap.data() });
    });
  }, [orgId]);

  // Snapshot baru (mis. setelah menyimpan): buang draft yang isinya sudah sama dengan yang tersimpan
  if (seenSaved !== saved) {
    setSeenSaved(saved);
    if (draft && sameAsSaved(draft, saved)) setDraft(null);
  }

  const values = draft ? { ...saved, ...draft } : saved;
  const dirty = draft !== null && !sameAsSaved(draft, saved);
  const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));
  const field = (key, label, placeholder, hint) => (
    <div className="form-group">
      <label htmlFor={`${formId}-${key}`}>{label}</label>
      <input
        id={`${formId}-${key}`}
        className="input"
        placeholder={placeholder}
        value={values[key] || ''}
        onChange={(e) => set(key)(e.target.value)}
      />
      {hint && <span className="form-hint">{hint}</span>}
    </div>
  );

  const handleSave = (e) => {
    e.preventDefault();
    if (!orgId || !dirty) return;
    writeInBackground(
      () => setDoc(kasirSettingsRef(orgId), draft, { merge: true }),
      (err) =>
        toast.error('Gagal menyimpan pengaturan nota', err.message, {
          persistent: true,
        }),
    );
    toast.success('Pengaturan nota disimpan', 'Berlaku untuk semua komputer studio.');
  };

  return (
    <Card
      title={
        <>
          <ReceiptText size={18} aria-hidden="true" />
          Kasir & nota
        </>
      }
      description="Data bisnis yang dicetak di nota transaksi."
      actions={<Badge tone="accent">Semua komputer</Badge>}
    >
      <form id={formId} className="form-stack" onSubmit={handleSave}>
        {field(
          'businessName',
          'Nama bisnis',
          'Snapme Studio',
          'Dicetak di kepala nota bila logo tidak tersedia. Nota saat ini memakai logo Snap Me.',
        )}
        {field('address', 'Alamat', `Kosong = ${PRINTED_ADDRESS}`)}
        {field('phone', 'Telepon / WA', `Kosong = ${PRINTED_PHONE}`)}
        <div className="form-group">
          <label htmlFor={`${formId}-paperSize`}>Ukuran kertas nota</label>
          <Select id={`${formId}-paperSize`} value={values.paperSize || '80mm'} onChange={set('paperSize')}>
            {!PAPER_SIZES.some((p) => p.value === (values.paperSize || '80mm')) && (
              <option value={values.paperSize}>{values.paperSize}</option>
            )}
            {PAPER_SIZES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </Select>
        </div>
        {field('footerNote', 'Catatan di bawah nota', 'Terima kasih atas kunjungannya')}
        <span className="form-label">Pratinjau</span>
        <ReceiptPreview values={values} />
        <div className="profile-actions">
          {dirty && (
            <Button variant="ghost" icon={Undo2} onClick={() => setDraft(null)}>
              Batalkan
            </Button>
          )}
          <Button type="submit" variant="primary" icon={Save} disabled={!dirty || !orgId}>
            Simpan
          </Button>
        </div>
      </form>
    </Card>
  );
}
