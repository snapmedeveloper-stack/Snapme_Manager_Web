// Salinan Snapme_Desktop/src/components/layanan/ProductForm.jsx: ubah keduanya bersamaan.
import { useEffect, useId, useRef, useState } from 'react';
import { addDoc, increment, updateDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { ImagePlus, Trash2 } from 'lucide-react';
import { storage } from '../../firebase';
import { Button, Modal, useToast } from '../ui';
import { writeInBackground } from '../../utils/firestoreWrite';
import { initialLocations, orgCollection, orgDoc, PRODUCT_KINDS } from './layananUtils';
import LocationPicker from './LocationPicker';
import ProductThumb from './ProductThumb';

/**
 * Form tambah/edit produk (item tambahan, makanan, minuman); item = null untuk produk baru.
 * Stok makanan/minuman: saat tambah = stok awal; saat edit = stok masuk yang ditambahkan (increment).
 * Simpan tidak menunggu server (modal langsung tertutup). Unggah gambar memang ditunggu, tetapi bisa dibatalkan:
 * bila modal ditutup saat mengunggah, tidak ada yang disimpan (jadi stok tidak bertambah dua kali).
 */
export default function ProductForm({ kind, item, places, orgId, ownerId, onClose }) {
  const { collection: collectionName, label, hasStock, hasLocations } = PRODUCT_KINDS[kind];
  const formId = useId();
  const fileInput = useRef(null);
  const closed = useRef(false);
  const toast = useToast();
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState(() => ({
    name: item?.name || '',
    price: item?.price != null ? String(item.price) : '',
    stock: '',
    image: item?.image || '', // URL tersimpan, pratinjau blob: dari file baru, atau kosong
    file: null,
    // Makanan/minuman tidak punya pilihan lokasi: nilai lamanya disimpan apa adanya
    locations: hasLocations
      ? initialLocations(item, places)
      : { studios: item?.studios || [], photobooths: item?.photobooths || [] },
  }));
  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));
  const name = form.name.trim();

  // Lepas URL pratinjau file lama saat diganti atau form ditutup
  useEffect(() => {
    const preview = form.image;
    return () => {
      if (preview.startsWith('blob:')) URL.revokeObjectURL(preview);
    };
  }, [form.image]);

  const close = () => {
    closed.current = true;
    onClose();
  };

  const handlePickImage = (e) => {
    const file = e.target.files[0];
    e.target.value = ''; // supaya file yang sama bisa dipilih lagi
    if (!file) return;
    const image = URL.createObjectURL(file);
    setForm((f) => ({ ...f, file, image }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || uploading) return;
    let image = form.image;
    if (form.file) {
      setUploading(true);
      try {
        const fileRef = ref(storage, `organizations/${orgId}/${collectionName}/${Date.now()}_${form.file.name}`);
        await uploadBytes(fileRef, form.file);
        image = await getDownloadURL(fileRef);
      } catch (err) {
        if (closed.current) return;
        toast.error('Gagal mengunggah gambar', err.message);
        setUploading(false);
        return;
      }
      if (closed.current) return; // dibatalkan saat mengunggah: jangan simpan apa pun
    }
    const stock = Number(form.stock) || 0;
    const fields = {
      name,
      price: Number(form.price) || 0,
      studios: form.locations.studios,
      photobooths: form.locations.photobooths,
      image,
    };
    writeInBackground(
      () =>
        item
          ? updateDoc(orgDoc(orgId, collectionName, item.id), { ...fields, stock: hasStock ? increment(stock) : 0 })
          : addDoc(orgCollection(orgId, collectionName), {
              ...fields,
              stock: hasStock ? stock : 0,
              archived: false,
              managerId: ownerId,
              createdAt: new Date().toISOString(),
            }),
      (err) => toast.error(`Gagal menyimpan ${label.toLowerCase()}`, `${name}: ${err.message}`, { persistent: true }),
    );
    toast.success(item ? `${label} disimpan` : `${label} ditambahkan`, name);
    close();
  };

  return (
    <Modal
      open
      title={item ? `Edit ${label}` : `Tambah ${label}`}
      onClose={close}
      footer={
        <>
          <Button onClick={close}>Batal</Button>
          <Button type="submit" form={formId} variant="primary" loading={uploading} disabled={!name}>
            {item ? 'Simpan Perubahan' : `Tambah ${label}`}
          </Button>
        </>
      }
    >
      <form id={formId} className="form-stack" onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor={`${formId}-name`}>Nama</label>
          <input
            id={`${formId}-name`}
            className="input"
            placeholder={kind === 'addon' ? 'cth. Extra Cetak 4R' : `Nama ${label.toLowerCase()}`}
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
          {hasStock && (
            <div className="form-group">
              <label htmlFor={`${formId}-stock`}>{item ? 'Tambah stok masuk' : 'Stok awal'}</label>
              <input
                id={`${formId}-stock`}
                className="input"
                type="number"
                placeholder="0"
                value={form.stock}
                onChange={(e) => set('stock')(e.target.value)}
              />
              {item && <span className="form-hint">Stok sekarang {item.stock || 0}. Kosongkan bila tidak ada.</span>}
            </div>
          )}
        </div>
        <div className="form-group">
          <span className="form-label">Gambar</span>
          <div className="lyn-image-field">
            <ProductThumb src={form.image} large placeholder={ImagePlus} />
            <Button size="sm" icon={ImagePlus} disabled={uploading} onClick={() => fileInput.current?.click()}>
              {form.image ? 'Ganti gambar' : 'Pilih gambar'}
            </Button>
            {form.image && (
              <Button
                size="sm"
                variant="ghost"
                icon={Trash2}
                disabled={uploading}
                onClick={() => setForm((f) => ({ ...f, image: '', file: null }))}
              >
                Hapus
              </Button>
            )}
            <input ref={fileInput} type="file" accept="image/*" hidden onChange={handlePickImage} />
          </div>
          {uploading && <span className="form-hint">Mengunggah gambar… Tekan Batal untuk membatalkan.</span>}
        </div>
        {hasLocations && <LocationPicker places={places} value={form.locations} onChange={set('locations')} />}
      </form>
    </Modal>
  );
}
