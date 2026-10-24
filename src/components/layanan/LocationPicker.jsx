// Salinan Snapme_Desktop/src/components/layanan/LocationPicker.jsx: ubah keduanya bersamaan.
import { useId } from 'react';
import { Check } from 'lucide-react';

function ChipGroup({ label, options, selected, onToggle, emptyText }) {
  const labelId = useId();
  return (
    <div className="form-group" role="group" aria-labelledby={labelId}>
      <span id={labelId} className="form-label">
        {label}
      </span>
      <div className="lyn-chips">
        {options.map((option) => {
          const on = selected.includes(option.id);
          return (
            <button
              key={option.id}
              type="button"
              className={`lyn-chip${on ? ' is-on' : ''}`}
              aria-pressed={on}
              onClick={() => onToggle(option.id)}
            >
              {on && <Check size={14} aria-hidden="true" />}
              {option.name}
            </button>
          );
        })}
        {options.length === 0 && <span className="form-hint">{emptyText}</span>}
      </div>
    </div>
  );
}

const toggle = (list, id) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

/**
 * Pilihan ruangan & photobooth tempat paket/item berlaku (disimpan sebagai id di field studios / photobooths).
 * places: { studios, photobooths, ... } dari useLayananData. Nilai awalnya dari initialLocations (id lokasi yang sudah
 * diarsipkan dibuang, supaya tidak tersimpan lagi).
 */
export default function LocationPicker({ places, value, onChange }) {
  const { studios, photobooths } = places;
  return (
    <>
      <ChipGroup
        label="Berlaku di ruangan"
        options={studios}
        selected={value.studios}
        onToggle={(id) => onChange({ ...value, studios: toggle(value.studios, id) })}
        emptyText="Belum ada ruangan."
      />
      {photobooths.length > 0 && (
        <ChipGroup
          label="Berlaku di photobooth"
          options={photobooths}
          selected={value.photobooths}
          onToggle={(id) => onChange({ ...value, photobooths: toggle(value.photobooths, id) })}
        />
      )}
      {value.removed > 0 && (
        <span className="form-hint lyn-hint-warning">
          {value.removed} ruangan/photobooth lama yang sudah diarsipkan dilepas dari pilihan. Periksa lagi pilihannya.
        </span>
      )}
      <span className="form-hint">Biarkan semua tidak dipilih agar berlaku di semua ruangan &amp; photobooth.</span>
    </>
  );
}
