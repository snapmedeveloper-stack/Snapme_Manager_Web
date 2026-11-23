import { useId, useState } from 'react';
import { Button, Modal } from '../ui';
import { DEVICE_NAME_MAX, cleanDeviceName } from './useLogData';

/**
 * Ubah nama satu PC. Nama dari owner berlaku di Snap Me Desktop PC itu (nama PC, nama server WhatsApp, nama di log
 * berikutnya); catatan log lama tetap memakai nama saat itu. onSave(nama) dengan nama yang sudah dirapikan.
 */
export default function DeviceNameForm({ device, onSave, onClose }) {
  const formId = useId();
  const [name, setName] = useState(device.machineName || '');
  const clean = cleanDeviceName(name);
  const unchanged = device.nameSet && clean === device.machineName;

  return (
    <Modal
      open
      size="sm"
      title="Ubah nama PC"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Batal</Button>
          <Button type="submit" form={formId} variant="primary" disabled={!clean || unchanged}>
            Simpan
          </Button>
        </>
      }
    >
      <form
        id={formId}
        className="form-stack"
        onSubmit={(e) => {
          e.preventDefault();
          if (clean && !unchanged) onSave(clean);
        }}
      >
        <div className="form-group">
          <label htmlFor={`${formId}-name`}>Nama PC</label>
          <input
            id={`${formId}-name`}
            className="input"
            value={name}
            maxLength={DEVICE_NAME_MAX}
            onChange={(e) => setName(e.target.value)}
            placeholder="Contoh: PC Kasir Depan"
            autoComplete="off"
          />
          <span className="form-hint">
            Snap Me Desktop di PC ini langsung memakai nama ini (juga sebagai nama server WhatsApp) begitu online.
            Catatan log lama tetap memakai nama sebelumnya.
          </span>
        </div>
      </form>
    </Modal>
  );
}
