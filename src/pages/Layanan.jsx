import { useState } from 'react';
import { Camera, CupSoda, DoorOpen, Package, PackagePlus, UtensilsCrossed } from 'lucide-react';
import AppBar from '../components/layout/AppBar';
import { useLayananData } from '../components/layanan/useLayananData';
import { useStudioTimers } from '../components/layanan/useStudioTimers';
import PlaceTab from '../components/layanan/PlaceTab';
import PackageTab from '../components/layanan/PackageTab';
import ProductTab from '../components/layanan/ProductTab';
import './Layanan.css';

// Bagian halaman (sama dengan Snapme_Desktop); dataKey = daftar yang jumlahnya ditampilkan di chip
const SECTIONS = [
  { value: 'ruangan', label: 'Ruangan', icon: DoorOpen, dataKey: 'studios' },
  { value: 'photobooth', label: 'Photobooth', icon: Camera, dataKey: 'photobooths' },
  { value: 'paket', label: 'Paket', icon: Package, dataKey: 'packages' },
  { value: 'addon', label: 'Item Tambahan', icon: PackagePlus, dataKey: 'addOns' },
  { value: 'makanan', label: 'Makanan', icon: UtensilsCrossed, dataKey: 'makanan' },
  { value: 'minuman', label: 'Minuman', icon: CupSoda, dataKey: 'minuman' },
];

/**
 * Layanan & Produk: master data yang dipakai Timeline dan Kasir (ruangan, photobooth, paket, item tambahan,
 * makanan, minuman). Sejak rombak tanpa role (docs/RENCANA_TANPA_ROLE.md), harga & layanan hanya diubah dari sini:
 * owner mengelola data cabang yang sedang dipilih. Data baru disimpan
 * atas nama cabang itu (managerId), jadi owner yang melihat "semua cabang" harus memilih cabang dulu.
 */
export default function Layanan({ orgId, userMeta, managerId, managerIds = null }) {
  const canEdit = userMeta?.role === 'owner' && !!managerId;
  const ownerId = managerId;
  const [section, setSection] = useState('ruangan');
  const data = useLayananData(orgId, managerIds, true);
  const { studioEnabled, onToggleStudio } = useStudioTimers(orgId);
  const { studios, photobooths, studioIndex, photoboothIndex, packages, addOns, makanan, minuman } = data;

  const shared = { canEdit, orgId, ownerId };
  const places = { studios, photobooths, studioIndex, photoboothIndex };
  const products = { addon: addOns, makanan, minuman };

  return (
    <>
      <AppBar title="Layanan & Produk" />
      <div className="lyn-toolbar">
        <div className="chip-row" role="group" aria-label="Bagian Layanan">
          {SECTIONS.map(({ value, label, icon: Icon, dataKey }) => (
            <button
              key={value}
              type="button"
              className={`chip${section === value ? ' is-active' : ''}`}
              aria-pressed={section === value}
              onClick={() => setSection(value)}
            >
              <Icon size={14} aria-hidden="true" />
              {label}
              <span className="chip-count num">{data[dataKey].length}</span>
            </button>
          ))}
        </div>
        {!canEdit && <p className="lyn-readonly">Pilih cabang di Profil untuk mengubah layanan & harga.</p>}
      </div>

      <div className="page-body">
        {section === 'ruangan' || section === 'photobooth' ? (
          <PlaceTab
            key={section}
            kind={section}
            items={section === 'ruangan' ? studios : photobooths}
            packages={packages}
            studioEnabled={studioEnabled}
            onToggleStudio={onToggleStudio}
            {...shared}
          />
        ) : section === 'paket' ? (
          <PackageTab packages={packages} places={places} {...shared} />
        ) : (
          <ProductTab key={section} kind={section} items={products[section]} places={places} {...shared} />
        )}
      </div>
    </>
  );
}
