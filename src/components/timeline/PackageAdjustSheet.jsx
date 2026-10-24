import { useState } from 'react';
import { Button, Modal, Select } from '../ui';
import { isOfferedAt } from '../../utils/timeline';

/**
 * Booking digeser ke ruangan yang tidak menyediakan paketnya: pilih paket pengganti untuk melanjutkan pindah
 * (sama dengan PackageAdjustModal Snapme_Desktop). onConfirm(namaPaket).
 */
export default function PackageAdjustSheet({ booking, targetId, targetName, targetIsPhotobooth, packages, onCancel, onConfirm }) {
  const [selected, setSelected] = useState('');
  return (
    <Modal
      open
      size="sm"
      title="Sesuaikan paket"
      onClose={onCancel}
      footer={
        <>
          <Button onClick={onCancel}>Batal pindah</Button>
          <Button variant="primary" disabled={!selected} onClick={() => onConfirm(selected)}>
            Lanjutkan
          </Button>
        </>
      }
    >
      <div className="form-stack">
        <p>
          Paket <strong>{booking.package}</strong> tidak tersedia di <strong>{targetName}</strong>. Pilih paket pengganti
          untuk melanjutkan pemindahan.
        </p>
        <div className="form-group">
          <label htmlFor="tl-adjust-package">Paket pengganti</label>
          <Select id="tl-adjust-package" value={selected} onChange={setSelected}>
            <option value="" disabled>
              Pilih paket
            </option>
            {packages
              .filter((p) => isOfferedAt(p, targetId, targetIsPhotobooth))
              .map((p) => (
                <option key={p.id} value={p.name}>
                  {p.name}
                </option>
              ))}
          </Select>
        </div>
      </div>
    </Modal>
  );
}
