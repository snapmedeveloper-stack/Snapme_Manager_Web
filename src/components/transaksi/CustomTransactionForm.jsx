import { useEffect, useId, useMemo, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { Button, Modal, MoneyInput, Select, Switch, Tabs } from '../ui';
import { formatRupiah, getLocalDateString } from '../../utils/format';
import { depositNumber } from '../../utils/deposit';
import {
  MAX_NAME,
  MAX_NOTE,
  customDepositError,
  customDepositFields,
  customTransactionError,
  customTransactionFields,
  draftOf,
  evenShares,
  sharesTotal,
} from './customTransaction';

const PAYMENTS = [
  { value: 'cash', label: 'Tunai' },
  { value: 'transfer', label: 'Transfer' },
];
const PAY_MODES = [
  { value: 'full', label: 'Lunas' },
  { value: 'dp', label: 'DP' },
];

/** Staff organisasi (realtime), urut nama. */
function useOrgStaff(orgId) {
  const [staff, setStaff] = useState(null);
  useEffect(() => {
    if (!orgId) return undefined;
    return onSnapshot(
      collection(db, 'organizations', orgId, 'staff'),
      (snap) =>
        setStaff(
          snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.name || '').localeCompare(b.name || '')),
        ),
      (err) => {
        console.error('[Transaksi] Gagal memuat staff', err);
        setStaff([]);
      },
    );
  }, [orgId]);
  return staff;
}

/**
 * Tambah / ubah transaksi custom (lihat customTransaction.js): nama, tanggal, total harga, metode bayar, catatan, dan
 * fee per staff cabang terpilih. Memilih staff membagi total fee rata; nominal tiap staff boleh diubah (total fee lalu
 * mengikuti jumlahnya). tx = transaksi yang diubah (null = baru). settle = transaksi DP custom yang dilunasi (isian
 * dari rencananya, DP dipotong). Transaksi baru boleh disimpan sebagai DP (Snapme_Desktop/docs/RENCANA_DP.md §4.3).
 * onSave({ kind: 'custom' | 'dp', fields }, tanggal) → Promise.
 */
export default function CustomTransactionForm({ orgId, tx, settle = null, branches, managerId, onSave, onClose }) {
  const formId = useId();
  const staff = useOrgStaff(orgId);
  const today = getLocalDateString(new Date());
  const defaultBranch = branches.some((b) => b.managerId === managerId) ? managerId : branches[0]?.managerId || null;
  const [draft, setDraft] = useState(() => draftOf(tx, { today, managerId: defaultBranch, settle }));
  const [payMode, setPayMode] = useState('full'); // hanya transaksi baru: 'full' | 'dp'
  const [totalFee, setTotalFee] = useState(() => String(sharesTotal(draft.shares) || ''));
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  const set = (key, value) => setDraft((d) => ({ ...d, [key]: value }));
  // Pilihan: staff aktif cabang ini + staff yang sudah tercatat di transaksi ini (walau kini nonaktif / cabang lain)
  const options = useMemo(
    () =>
      (staff || []).filter(
        (s) =>
          draft.shares[s.id] !== undefined ||
          (s.active !== false && (!draft.managerId || s.managerId === draft.managerId)),
      ),
    [staff, draft.managerId, draft.shares],
  );
  const selectedIds = options.filter((s) => draft.shares[s.id] !== undefined).map((s) => s.id);
  const feeSum = sharesTotal(draft.shares);
  const isDeposit = !tx && !settle && payMode === 'dp';
  const error = isDeposit ? customDepositError(draft) : customTransactionError(draft);
  const deducted = Math.min(Number(draft.total) || 0, draft.deduction?.amount || 0);

  const toggleStaff = (staffId, on) => {
    const ids = options.map((s) => s.id).filter((id) => (id === staffId ? on : draft.shares[id] !== undefined));
    set('shares', evenShares(totalFee, ids));
  };
  const changeTotalFee = (value) => {
    setTotalFee(value);
    set('shares', evenShares(value, selectedIds));
  };
  const changeShare = (staffId, value) => {
    const shares = { ...draft.shares, [staffId]: value };
    set('shares', shares);
    setTotalFee(String(sharesTotal(shares) || ''));
  };
  const changeBranch = (value) => {
    // Ganti cabang: staff cabang lama dilepas
    setDraft((d) => ({ ...d, managerId: value, shares: {} }));
    setTotalFee('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitted(true);
    if (error || saving) return;
    setSaving(true);
    try {
      await onSave(
        isDeposit
          ? { kind: 'dp', fields: customDepositFields(draft, staff || [], depositNumber()) }
          : { kind: 'custom', fields: customTransactionFields(draft, staff || []) },
        draft.date,
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      size="md"
      title={settle ? 'Lunasi transaksi custom' : tx ? 'Ubah transaksi custom' : 'Transaksi custom'}
      onClose={saving ? undefined : onClose}
      footer={
        <>
          <Button onClick={onClose} disabled={saving}>
            Batal
          </Button>
          <Button type="submit" form={formId} variant="primary" loading={saving}>
            Simpan
          </Button>
        </>
      }
    >
      <form id={formId} className="form-stack" onSubmit={handleSubmit} noValidate>
        <p className="form-hint">
          {isDeposit
            ? 'DP masuk rekap pendapatan hari ini. Fee staff baru masuk gaji saat transaksi dilunasi.'
            : 'Masuk ke rekap pendapatan, dan fee masuk ke gaji staff bulan transaksi. Tidak tampil di Snap Me Desktop.'}
        </p>
        {!tx && !settle && (
          <Tabs options={PAY_MODES} value={payMode} onChange={setPayMode} ariaLabel="Jenis pembayaran" />
        )}
        <div className="form-group">
          <label htmlFor={`${formId}-name`}>Nama transaksi</label>
          <input
            id={`${formId}-name`}
            className="input"
            placeholder="cth. Foto wisuda Undiksha"
            maxLength={MAX_NAME}
            value={draft.name}
            autoFocus={!tx}
            onChange={(e) => set('name', e.target.value)}
          />
        </div>
        <div className="trx-form-row">
          <div className="form-group">
            <label htmlFor={`${formId}-date`}>Tanggal</label>
            <input
              id={`${formId}-date`}
              type="date"
              className="input"
              value={draft.date}
              onChange={(e) => set('date', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label htmlFor={`${formId}-total`}>Total harga</label>
            <MoneyInput id={`${formId}-total`} value={draft.total} onChange={(v) => set('total', v)} />
          </div>
        </div>
        {isDeposit && (
          <div className="form-group">
            <label htmlFor={`${formId}-deposit`}>DP diterima</label>
            <MoneyInput id={`${formId}-deposit`} value={draft.deposit} onChange={(v) => set('deposit', v)} />
            <span className="form-hint">
              Sisa dibayar saat pelunasan:{' '}
              <span className="num">
                {formatRupiah(Math.max(0, (Number(draft.total) || 0) - (Number(draft.deposit) || 0)))}
              </span>
            </span>
          </div>
        )}
        {deducted > 0 && (
          <dl className="trx-deposit-sum">
            <div>
              <dt>Potong DP</dt>
              <dd className="num">{formatRupiah(-deducted)}</dd>
            </div>
            <div className="is-strong">
              <dt>Dibayar sekarang</dt>
              <dd className="num">{formatRupiah((Number(draft.total) || 0) - deducted)}</dd>
            </div>
          </dl>
        )}
        <div className="form-group">
          <span className="form-label">{isDeposit ? 'Metode bayar DP' : 'Metode bayar'}</span>
          <Tabs
            options={PAYMENTS}
            value={draft.paymentMethod}
            onChange={(v) => set('paymentMethod', v)}
            ariaLabel="Metode bayar"
          />
        </div>

        <section className="trx-fee" aria-label="Fee staff">
          <div className="trx-fee-head">
            <span className="form-label">Fee staff</span>
            <span className="num trx-fee-sum">{formatRupiah(feeSum)}</span>
          </div>
          {branches.length > 1 && (
            <Select value={draft.managerId || ''} onChange={changeBranch} aria-label="Cabang staff">
              {branches.map((b) => (
                <option key={b.managerId} value={b.managerId}>
                  Cabang {b.name}
                </option>
              ))}
            </Select>
          )}
          <div className="form-group">
            <label htmlFor={`${formId}-fee`}>Total fee (dibagi rata ke staff terpilih)</label>
            <MoneyInput id={`${formId}-fee`} value={totalFee} onChange={changeTotalFee} />
          </div>
          {staff === null ? (
            <p className="form-hint">Memuat staff…</p>
          ) : options.length === 0 ? (
            <p className="form-hint">Belum ada staff aktif di cabang ini. Tambahkan di Tim → Staff.</p>
          ) : (
            <ul className="trx-fee-list">
              {options.map((s) => {
                const on = draft.shares[s.id] !== undefined;
                return (
                  <li key={s.id} className="trx-fee-row">
                    <Switch checked={on} onChange={(v) => toggleStaff(s.id, v)} ariaLabel={`Fee untuk ${s.name}`} />
                    <span className="trx-fee-name">
                      {s.name}
                      {s.active === false && <span className="form-hint"> (nonaktif)</span>}
                    </span>
                    {on && (
                      <MoneyInput
                        className="trx-fee-amount"
                        aria-label={`Fee ${s.name}`}
                        value={draft.shares[s.id]}
                        onChange={(v) => changeShare(s.id, v)}
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <p className="form-hint">Kosongkan semua bila transaksi ini tanpa fee.</p>
        </section>

        <div className="form-group">
          <label htmlFor={`${formId}-note`}>Catatan (opsional)</label>
          <textarea
            id={`${formId}-note`}
            className="textarea"
            maxLength={MAX_NOTE}
            placeholder="cth. DP sudah masuk, sisa dibayar di lokasi"
            value={draft.note}
            onChange={(e) => set('note', e.target.value)}
          />
        </div>
        {submitted && error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}
