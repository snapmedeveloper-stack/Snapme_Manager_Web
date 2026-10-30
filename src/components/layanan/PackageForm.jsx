// Salinan Snapme_Desktop/src/components/layanan/PackageForm.jsx: ubah keduanya bersamaan.
import { useId, useState } from 'react';
import { addDoc, updateDoc } from 'firebase/firestore';
import { Button, ColorPicker, Modal, useToast } from '../ui';
import { DEFAULT_CATEGORY_COLOR, PACKAGE_FALLBACK_COLOR } from '../../constants/colors';
import { writeInBackground } from '../../utils/firestoreWrite';
import { initialLocations, orgCollection, orgDoc } from './layananUtils';
import LocationPicker from './LocationPicker';

const DEFAULT_DURATION = 30;

/**
 * Form tambah/edit paket layanan (pkg = null untuk paket baru).
 * Paket baru ditaruh paling akhir (order = nextOrder). Warna lama paket di luar 8 warna kategori tetap dipertahankan.
 * Simpan tidak menunggu server: modal langsung tertutup (tidak bisa tersimpan dua kali, tidak mengunci saat offline).
 */
export default function PackageForm({ pkg, places, orgId, ownerId, nextOrder, onClose }) {
  const formId = useId();
  const toast = useToast();
  const [form, setForm] = useState(() => ({
    name: pkg?.name || '',
    price: pkg?.price != null ? String(pkg.price) : '',
    duration: String(pkg?.duration || DEFAULT_DURATION),
    handlerFee: pkg?.handlerFee ? String(pkg.handlerFee) : '',
    color: pkg ? pkg.color || PACKAGE_FALLBACK_COLOR : DEFAULT_CATEGORY_COLOR,
    locations: initialLocations(pkg, places),
  }));
  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));
  const name = form.name.trim();
  const price = Number(form.price) || 0;
  const handlerFee = Math.max(0, Math.round(Number(form.handlerFee) || 0));
  // Fee tidak boleh melebihi harga paket (aturan yang sama dipakai Kasir saat fee diubah)
  const feeTooHigh = handlerFee > price;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name || feeTooHigh) return;
    const fields = {
      name,
      price,
      duration: Number(form.duration) || DEFAULT_DURATION,
      handlerFee,
      studios: form.locations.studios,
      photobooths: form.locations.photobooths,
      color: form.color,
    };
    writeInBackground(
      () =>
        pkg
          ? updateDoc(orgDoc(orgId, 'packages', pkg.id), fields)
          : addDoc(orgCollection(orgId, 'packages'), {
              ...fields,
              managerId: ownerId,
              createdAt: new Date().toISOString(),
              order: nextOrder,
            }),
      (err) => toast.error('Gagal menyimpan paket', `${name}: ${err.message}`, { persistent: true }),
    );
    toast.success(pkg ? 'Paket disimpan' : 'Paket ditambahkan', name);
    onClose();
  };

  return (
    <Modal
      open
      title={pkg ? 'Edit Paket' : 'Tambah Paket'}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Batal</Button>
          <Button type="submit" form={formId} variant="primary" disabled={!name || feeTooHigh}>
            {pkg ? 'Simpan Perubahan' : 'Tambah Paket'}
          </Button>
        </>
      }
    >
      <form id={formId} className="form-stack" onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor={`${formId}-name`}>Nama paket</label>
          <input
            id={`${formId}-name`}
            className="input"
            placeholder="cth. Prewedding Reguler"
            value={form.name}
            autoFocus
            onChange={(e) => set('name')(e.target.value)}
          />
        </div>
        <div className="lyn-form-row">
          <div className="form-group">
            <label htmlFor={`${formId}-price`}>Harga (Rp)</label>
            <input
              id={`${formId}-price`}
              className="input"
              type="number"
              min="0"
              placeholder="0"
              value={form.price}
              onChange={(e) => set('price')(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label htmlFor={`${formId}-duration`}>Durasi (menit)</label>
            <input
              id={`${formId}-duration`}
              className="input"
              type="number"
              min="1"
              value={form.duration}
              onChange={(e) => set('duration')(e.target.value)}
            />
          </div>
        </div>
        <div className="form-group">
          <label htmlFor={`${formId}-fee`}>Fee penanggung jawab (Rp)</label>
          <input
            id={`${formId}-fee`}
            className={`input${feeTooHigh ? ' is-error' : ''}`}
            type="number"
            min="0"
            placeholder="0 = tanpa fee"
            value={form.handlerFee}
            onChange={(e) => set('handlerFee')(e.target.value)}
          />
          {feeTooHigh && <span className="form-error">Fee tidak boleh melebihi harga paket.</span>}
          <span className="form-hint">
            Untuk staff yang menangani paket ini, dibagi rata bila lebih dari satu orang. Bisa diubah di Kasir saat
            bayar (maksimal harga paket). Terkumpul per bulan dan dibayar bersama gaji awal bulan berikutnya.
          </span>
        </div>
        <div className="form-group">
          <span className="form-label">Warna di Timeline</span>
          <ColorPicker value={form.color} onChange={set('color')} ariaLabel="Warna paket" />
        </div>
        <LocationPicker places={places} value={form.locations} onChange={set('locations')} />
      </form>
    </Modal>
  );
}
