import { Badge } from '../ui';
import { describeLocations } from './layananUtils';

const MAX_SHOWN = 3;

/**
 * "Berlaku di" (versi baris HP dari LocationCell Snapme_Desktop): nama ruangan/photobooth aktif sebagai badge
 * (maks. 3 + sisa), "Semua ruangan", atau peringatan bila semua lokasinya sudah diarsipkan.
 */
export default function LocationBadges({ item, places }) {
  const { everywhere, names, loading } = describeLocations(item, places.studioIndex, places.photoboothIndex);

  if (loading) return null;
  if (everywhere) return <span className="lyn-row-meta">Semua ruangan &amp; photobooth</span>;
  if (!names.length) {
    return (
      <span className="lyn-badges">
        <Badge tone="warning">Lokasi sudah diarsipkan, edit untuk memilih ulang</Badge>
      </span>
    );
  }
  const extra = names.length - MAX_SHOWN;
  return (
    <span className="lyn-badges">
      {names.slice(0, MAX_SHOWN).map((name, i) => (
        <Badge key={`${i}-${name}`} tone="neutral">
          {name}
        </Badge>
      ))}
      {extra > 0 && <Badge tone="neutral">+{extra}</Badge>}
    </span>
  );
}
