import { Select } from '../ui';

/** Pilihan ruangan: studio dan photobooth dalam dua kelompok. onChange(idRuangan). */
export default function PlaceSelect({ id, value, onChange, studios, photobooths, disabled }) {
  return (
    <Select id={id} value={value || ''} onChange={onChange} disabled={disabled}>
      <option value="" disabled>
        Pilih ruangan
      </option>
      {studios.length > 0 && (
        <optgroup label="Studio">
          {studios.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </optgroup>
      )}
      {photobooths.length > 0 && (
        <optgroup label="Photobooth">
          {photobooths.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </optgroup>
      )}
    </Select>
  );
}
