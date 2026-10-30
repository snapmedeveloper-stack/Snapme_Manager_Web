import { useState } from 'react';
import { Button, Modal, Switch } from '../ui';
import { formatRupiah } from '../../utils/format';
import { splitFee, transactionFee } from '../../utils/handlerFee';
import { packageNamesOf } from './gajiUtils';

/**
 * Pilih/koreksi penanggung jawab satu transaksi (Snapme Desktop mengisinya saat bayar di Kasir).
 * Pilihan: staff aktif cabang ini, ditambah penanggung jawab yang sudah tercatat walau kini nonaktif/cabang lain.
 * onSave({ handlers, handlerFee }); handlerFee = fee tersimpan transaksi, atau fee paket sekarang untuk transaksi lama.
 */
export default function HandlerForm({ tx, staff, packages, onSave, onClose }) {
  const recordedIds = (tx.handlers || []).map((h) => h.staffId);
  const [selected, setSelected] = useState(recordedIds);
  const fee = transactionFee(tx, packages);
  const options = [
    ...staff
      .filter((s) => s.active !== false || recordedIds.includes(s.id))
      .map((s) => ({ staffId: s.id, name: s.name })),
    ...(tx.handlers || []).filter((h) => !staff.some((s) => s.id === h.staffId)),
  ];
  const share = splitFee(fee, selected.length)[0] || 0;

  const toggle = (staffId, on) =>
    setSelected((prev) => (on ? [...prev, staffId] : prev.filter((id) => id !== staffId)));

  const handleSave = () =>
    onSave({
      // Urutan mengikuti daftar staff, supaya pembagian sisa rupiah tidak bergantung urutan ketukan
      handlers: options.filter((o) => selected.includes(o.staffId)),
      handlerFee: fee,
    });

  return (
    <Modal
      open
      size="sm"
      title="Penanggung jawab"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Batal</Button>
          <Button variant="primary" onClick={handleSave}>
            Simpan
          </Button>
        </>
      }
    >
      <div className="form-stack">
        <p className="tim-pay-tx">
          <strong>{tx.customerName || 'Tanpa nama'}</strong>
          <span>{packageNamesOf(tx, packages) || 'Paket'}</span>
          <span className="num">
            Fee {formatRupiah(fee)}
            {selected.length > 1 && ` · ${formatRupiah(share)} per orang`}
          </span>
        </p>
        {options.length === 0 ? (
          <p className="form-hint">Belum ada staff di cabang ini. Tambahkan di bagian Staff.</p>
        ) : (
          <ul className="tim-pay-pick">
            {options.map((o) => (
              <li key={o.staffId} className="tim-switch-row">
                <span>{o.name}</span>
                <Switch
                  checked={selected.includes(o.staffId)}
                  onChange={(on) => toggle(o.staffId, on)}
                  ariaLabel={`${o.name} menangani transaksi ini`}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
