import { useState } from 'react';
import { Button, Modal, Select } from '../ui';
import { isOfferedAt, timeInputValue } from '../../utils/timeline';
import AddOnPicker from './AddOnPicker';
import PlaceSelect from './PlaceSelect';
import { changeAddOnQty, isPhotoboothId } from './bookingForm';

/**
 * Tambah booking: nama, WA, ruangan, jam mulai, paket, item tambahan (sama dengan AddBookingModal Snapme_Desktop,
 * ditambah pilihan ruangan & jam karena di HP booking juga ditambah dari tampilan agenda).
 * initial = { placeId, startHour, startMin }. onSave(form) mengembalikan pesan kesalahan, atau '' bila tersimpan.
 */
export default function AddBookingSheet({ initial, studios, photobooths, packages, addOns, onSave, onClose }) {
  const [form, setForm] = useState({
    customerName: '',
    waNumber: '',
    placeId: initial.placeId || '',
    time: timeInputValue(initial.startHour, initial.startMin),
    package: '',
    addOns: {},
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const isPhotobooth = isPhotoboothId(photobooths, form.placeId);
  const offeredPackages = packages.filter((p) => isOfferedAt(p, form.placeId, isPhotobooth));
  const offeredAddOns = addOns.filter((ao) => isOfferedAt(ao, form.placeId, isPhotobooth));
  const set = (key) => (value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setError('');
  };

  // Pindah ruangan: paket & item tambahan yang tidak tersedia di ruangan baru dikosongkan
  const changePlace = (placeId) => {
    const toPhotobooth = isPhotoboothId(photobooths, placeId);
    setForm((f) => {
      const pkg = packages.find((p) => p.name === f.package);
      const keepAddOns = Object.fromEntries(
        Object.entries(f.addOns).filter(([id]) => {
          const ao = addOns.find((a) => a.id === id);
          return ao && isOfferedAt(ao, placeId, toPhotobooth);
        }),
      );
      return { ...f, placeId, package: pkg && isOfferedAt(pkg, placeId, toPhotobooth) ? f.package : '', addOns: keepAddOns };
    });
    setError('');
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const message = await onSave(form);
    setSaving(false);
    if (message) setError(message);
  };

  return (
    <Modal
      open
      title="Tambah booking"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Batal</Button>
          <Button variant="primary" type="submit" form="tl-add-form" loading={saving}>
            Simpan
          </Button>
        </>
      }
    >
      <form id="tl-add-form" className="form-stack" onSubmit={submit}>
        <div className="form-group">
          <label htmlFor="tl-add-name">Nama customer</label>
          <input
            id="tl-add-name"
            className="input"
            placeholder="Contoh: Dian"
            value={form.customerName}
            onChange={(e) => set('customerName')(e.target.value)}
            autoComplete="off"
          />
        </div>
        <div className="form-group">
          <label htmlFor="tl-add-wa">No WhatsApp (opsional)</label>
          <input
            id="tl-add-wa"
            className="input"
            type="tel"
            inputMode="tel"
            placeholder="0812xxxxxx"
            value={form.waNumber}
            onChange={(e) => set('waNumber')(e.target.value)}
          />
        </div>
        <div className="tl-form-row">
          <div className="form-group">
            <label htmlFor="tl-add-place">Ruangan</label>
            <PlaceSelect id="tl-add-place" value={form.placeId} onChange={changePlace} studios={studios} photobooths={photobooths} />
          </div>
          <div className="form-group">
            <label htmlFor="tl-add-time">Jam mulai</label>
            <input
              id="tl-add-time"
              className="input num"
              type="time"
              min="04:00"
              max="23:59"
              value={form.time}
              onChange={(e) => set('time')(e.target.value)}
            />
          </div>
        </div>
        <div className="form-group">
          <label htmlFor="tl-add-package">Paket</label>
          <Select id="tl-add-package" value={form.package} onChange={set('package')} disabled={!form.placeId}>
            <option value="" disabled>
              {form.placeId ? 'Pilih paket' : 'Pilih ruangan dulu'}
            </option>
            {offeredPackages.map((p) => (
              <option key={p.id} value={p.name}>
                {p.name} · {p.duration || 30} menit
              </option>
            ))}
          </Select>
        </div>
        {offeredAddOns.length > 0 && (
          <div className="form-group">
            <span className="form-label">Item tambahan (opsional)</span>
            <AddOnPicker items={offeredAddOns} value={form.addOns} onChange={changeAddOnQty(setForm)} />
          </div>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}
