import { useId, useState } from 'react';
import { Button, Modal, MoneyInput } from '../ui';
import { formatRupiah } from '../../utils/format';
import { formatMonth } from '../../utils/attendance';
import { STAFF_LABELS } from './staffLabels';

// Tarif yang disimpan di payrollSettings; tunjangan label mengikuti STAFF_LABELS
const RATE_KEYS = ['hourlyRate', 'mealAllowance', ...STAFF_LABELS.map((l) => l.settingKey)];

const toAmount = (text) => Math.max(0, Math.round(Number(text) || 0));
const draftOf = (amount) => (amount ? String(amount) : '');

/** Isian rupiah dengan label & keterangan (dipakai untuk tarif dan fee paket). */
function AmountField({ id, label, hint, value, onChange, error }) {
  return (
    <div className="form-group">
      <label htmlFor={id}>{label}</label>
      <MoneyInput id={id} className={error ? 'is-error' : ''} value={value} onChange={onChange} />
      {error ? <span className="form-error">{error}</span> : hint && <span className="form-hint">{hint}</span>}
    </div>
  );
}

/**
 * Pengaturan gaji cabang mulai bulan ini: harga per jam (× jam kerja di Absensi), uang makan per hari (× hari jaga),
 * tunjangan label staff (Admin per bulan, CS per hari hadir), dan fee penanggung jawab per paket (sama dengan isian fee
 * di Layanan, maksimal harga paket). settings: pengaturan yang berlaku sekarang (gajiUtils.payrollSettingsFor).
 * onSave({ hourlyRate, mealAllowance, adminAllowance, csAllowance, packageFees: { packageId: fee } hanya yang berubah }).
 */
export default function PayrollSettingsForm({ month, settings, packages, onSave, onClose }) {
  const formId = useId();
  const [rates, setRates] = useState(() => Object.fromEntries(RATE_KEYS.map((key) => [key, draftOf(settings[key])])));
  const setRate = (key) => (value) => setRates((prev) => ({ ...prev, [key]: value }));
  const [fees, setFees] = useState(() => Object.fromEntries(packages.map((p) => [p.id, draftOf(p.handlerFee)])));
  const feeError = (p) => (toAmount(fees[p.id]) > (p.price || 0) ? 'Fee tidak boleh melebihi harga paket.' : '');
  const valid = packages.every((p) => !feeError(p));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!valid) return;
    const packageFees = Object.fromEntries(
      packages.filter((p) => toAmount(fees[p.id]) !== (p.handlerFee || 0)).map((p) => [p.id, toAmount(fees[p.id])]),
    );
    onSave({ ...Object.fromEntries(RATE_KEYS.map((key) => [key, toAmount(rates[key])])), packageFees });
  };

  return (
    <Modal
      open
      title="Pengaturan gaji"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Batal</Button>
          <Button type="submit" form={formId} variant="primary" disabled={!valid}>
            Simpan
          </Button>
        </>
      }
    >
      <form id={formId} className="form-stack" onSubmit={handleSubmit}>
        <section className="tim-pay-settings" aria-labelledby={`${formId}-rates`}>
          <h3 id={`${formId}-rates`} className="tim-pay-settings-title">
            Tarif mulai {formatMonth(month)}
          </h3>
          <p className="form-hint">Berlaku juga untuk bulan-bulan berikutnya sampai diubah lagi.</p>
          <div className="tim-pay-rates">
            <AmountField
              id={`${formId}-hourly`}
              label="Harga per jam"
              hint="Dikali jam kerja di Absensi."
              value={rates.hourlyRate}
              onChange={setRate('hourlyRate')}
            />
            <AmountField
              id={`${formId}-meal`}
              label="Uang makan per hari"
              hint="Sekali per hari jaga."
              value={rates.mealAllowance}
              onChange={setRate('mealAllowance')}
            />
          </div>
        </section>

        <section className="tim-pay-settings" aria-labelledby={`${formId}-labels`}>
          <h3 id={`${formId}-labels`} className="tim-pay-settings-title">
            Tunjangan label
          </h3>
          <p className="form-hint">
            Untuk staff berlabel (label dipasang di Tim → Staff). Admin dibayar penuh tiap bulan tanpa melihat absensi;
            CS dikali jumlah hari hadir.
          </p>
          <div className="tim-pay-rates">
            {STAFF_LABELS.map((l) => (
              <AmountField
                key={l.key}
                id={`${formId}-${l.key}`}
                label={`${l.label} ${l.basis}`}
                hint={l.perDay ? 'Dikali jumlah hari hadir.' : 'Nominal tetap tiap bulan.'}
                value={rates[l.settingKey]}
                onChange={setRate(l.settingKey)}
              />
            ))}
          </div>
        </section>

        <section className="tim-pay-settings" aria-labelledby={`${formId}-fees`}>
          <h3 id={`${formId}-fees`} className="tim-pay-settings-title">
            Fee paket
          </h3>
          <p className="form-hint">
            Untuk staff yang menangani paket, dibagi rata bila lebih dari satu orang. Kosongkan untuk paket tanpa fee.
          </p>
          {packages.length === 0 ? (
            <p className="form-hint">Belum ada paket. Tambahkan di Layanan.</p>
          ) : (
            packages.map((p) => (
              <AmountField
                key={p.id}
                id={`${formId}-fee-${p.id}`}
                label={p.name}
                hint={`Harga ${formatRupiah(p.price)}`}
                value={fees[p.id]}
                onChange={(value) => setFees((prev) => ({ ...prev, [p.id]: value }))}
                error={feeError(p)}
              />
            ))
          )}
        </section>
      </form>
    </Modal>
  );
}
