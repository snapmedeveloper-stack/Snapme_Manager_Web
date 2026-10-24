import { useState } from 'react';
import { Check, Copy, ExternalLink, MessageCircle, Trash2 } from 'lucide-react';
import { Badge, Button, Modal, Select, useToast } from '../ui';
import { STATUS_TONE } from '../../constants/status';
import { bookingStage, PHOTOBOOTH_STAGES, STUDIO_STAGES, stageLabel } from '../../utils/bookingStage';
import { buildBookingTicket, whatsappShareLink } from '../../utils/bookingTicket';
import { copyText } from '../../utils/clipboard';
import {
  clampDuration,
  formatTimeRange,
  isOfferedAt,
  packageColor,
  parseTimeInput,
  placeName,
  timeInputValue,
} from '../../utils/timeline';
import AddOnPicker from './AddOnPicker';
import PlaceSelect from './PlaceSelect';
import { changeAddOnQty, isPhotoboothId } from './bookingForm';

// Field booking yang bisa diubah dari sheet ini (sisanya ditulis Snapme_Desktop: datang, bayar, upload, …)
const EDITABLE = ['customerName', 'waNumber', 'studio', 'startHour', 'startMin', 'duration', 'package', 'addOns'];

/**
 * Detail booking. original = booking saat sheet dibuka (isi awal form); live = booking terbaru dari Firestore,
 * dipakai untuk status proses supaya ikut berubah selama sheet terbuka (mis. ditandai datang di Desktop).
 * Simpan mengirim form; halaman hanya menulis field yang berbeda dari original. Owner hanya melihat.
 * Nama dikunci setelah customer datang & folder Drive dibuat (nama folder memakai nama customer), sama dengan Desktop.
 */
export default function BookingDetailSheet({
  original,
  live,
  readOnly,
  studios,
  photobooths,
  packages,
  addOns,
  onSave,
  onDelete,
  onClose,
}) {
  const toast = useToast();
  const [form, setForm] = useState(() => Object.fromEntries(EDITABLE.map((key) => [key, original[key]])));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const isPhotobooth = isPhotoboothId(photobooths, form.studio);
  const offeredPackages = packages.filter((p) => isOfferedAt(p, form.studio, isPhotobooth));
  const offeredAddOns = addOns.filter((ao) => isOfferedAt(ao, form.studio, isPhotobooth));
  const nameLocked = readOnly || (!!live.arrivedAt && !!live.driveLink);
  const stage = bookingStage(live, { isPhotobooth: isPhotoboothId(photobooths, live.studio) });
  const lastStage = (isPhotoboothId(photobooths, live.studio) ? PHOTOBOOTH_STAGES : STUDIO_STAGES).length;
  const duration = clampDuration(form.duration, original.duration);
  // Tiket dari data tersimpan (live), bukan isian yang belum disimpan: Desktop mencocokkan nama & tanggal persis
  const hasPhone = !!(live.waNumber || live.customerPhone);
  const ticket = hasPhone ? '' : buildBookingTicket(live);

  const copyTicket = async () => {
    try {
      await copyText(ticket);
      toast.success('Tiket booking disalin', 'Tempel di chat WhatsApp customer.');
    } catch (err) {
      toast.error('Gagal menyalin tiket', err.message);
    }
  };

  const set = (key) => (value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setError('');
  };
  // Isian jam di luar 04:00–23:59 (atau sedang dihapus saat mengetik) diabaikan
  const changeTime = (value) => {
    const time = parseTimeInput(value);
    if (!time) return;
    setForm((f) => ({ ...f, ...time }));
    setError('');
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const message = await onSave({ ...form, duration });
    setSaving(false);
    if (message) setError(message);
  };

  const footer = readOnly ? (
    <Button variant="primary" onClick={onClose}>
      Tutup
    </Button>
  ) : (
    <>
      <Button variant="danger" icon={Trash2} iconOnly aria-label="Hapus booking" onClick={onDelete} />
      <Button onClick={onClose}>Batal</Button>
      <Button variant="primary" type="submit" form="tl-detail-form" loading={saving}>
        Simpan
      </Button>
    </>
  );

  return (
    <Modal open title={live.customerName || 'Detail booking'} onClose={onClose} footer={footer}>
      <div className="tl-detail-meta">
        <span className="tl-swatch" style={{ '--item-color': packageColor(packages, live.package) }} aria-hidden="true" />
        <span>
          {placeName(live.studio, studios, photobooths)} ·{' '}
          <span className="num">{formatTimeRange(live.startHour, live.startMin || 0, live.duration)}</span>
        </span>
      </div>
      <div className="tl-detail-badges">
        <Badge tone={stage === lastStage ? STATUS_TONE.done : STATUS_TONE.active}>
          Tahap {stage}: {stageLabel(stage, isPhotoboothId(photobooths, live.studio))}
        </Badge>
        {live.arrivedAt ? (
          <Badge tone={STATUS_TONE.active} icon={Check}>
            Datang
          </Badge>
        ) : (
          <Badge tone={STATUS_TONE.waiting}>Belum datang</Badge>
        )}
        {live.waSent && (
          <Badge tone={STATUS_TONE.done} icon={Check}>
            WA terkirim
          </Badge>
        )}
      </div>
      {live.driveLink && (
        <a className="btn btn-sm tl-drive-link" href={live.driveLink} target="_blank" rel="noopener noreferrer">
          <ExternalLink size={14} aria-hidden="true" />
          Buka folder Google Drive
        </a>
      )}

      {!hasPhone && (
        <section className="tl-ticket" aria-label="Tiket booking">
          <span className="tl-ticket-title">Nomor WhatsApp belum ada</span>
          <span className="form-hint">
            Kirim tiket booking ke customer. Bila dikirim dari WhatsApp nomor studio, nomor customer otomatis tertaut ke
            booking ini.
          </span>
          <div className="tl-ticket-actions">
            <a className="btn btn-primary" href={whatsappShareLink(ticket)} target="_blank" rel="noopener noreferrer">
              <MessageCircle size={16} aria-hidden="true" />
              WhatsApp
            </a>
            <Button icon={Copy} onClick={copyTicket}>
              Salin
            </Button>
          </div>
        </section>
      )}

      <form id="tl-detail-form" className="form-stack tl-detail-form" onSubmit={submit}>
        <div className="form-group">
          <label htmlFor="tl-detail-name">Nama customer</label>
          <input
            id="tl-detail-name"
            className="input"
            value={form.customerName || ''}
            onChange={(e) => set('customerName')(e.target.value)}
            disabled={nameLocked}
            autoComplete="off"
          />
          {nameLocked && !readOnly && (
            <span className="form-hint">Nama dikunci karena folder Drive customer sudah dibuat.</span>
          )}
        </div>
        <div className="form-group">
          <label htmlFor="tl-detail-wa">No WhatsApp (opsional)</label>
          <input
            id="tl-detail-wa"
            className="input"
            type="tel"
            inputMode="tel"
            placeholder="0812xxxxxx"
            value={form.waNumber || ''}
            onChange={(e) => set('waNumber')(e.target.value)}
            disabled={readOnly}
          />
        </div>
        <div className="tl-form-row">
          <div className="form-group">
            <label htmlFor="tl-detail-place">Ruangan</label>
            <PlaceSelect
              id="tl-detail-place"
              value={form.studio}
              onChange={set('studio')}
              studios={studios}
              photobooths={photobooths}
              disabled={readOnly}
            />
          </div>
          <div className="form-group">
            <label htmlFor="tl-detail-time">Jam mulai</label>
            <input
              id="tl-detail-time"
              className="input num"
              type="time"
              min="04:00"
              max="23:59"
              value={timeInputValue(form.startHour, form.startMin)}
              onChange={(e) => changeTime(e.target.value)}
              disabled={readOnly}
            />
          </div>
        </div>
        <div className="tl-form-row">
          <div className="form-group">
            <label htmlFor="tl-detail-package">Paket</label>
            <Select id="tl-detail-package" value={form.package || ''} onChange={set('package')} disabled={readOnly}>
              <option value="" disabled>
                Pilih paket
              </option>
              {/* Paket lama yang tidak tersedia di ruangan ini tetap tampil supaya isian tidak kosong */}
              {form.package && !offeredPackages.some((p) => p.name === form.package) && (
                <option value={form.package}>{form.package} (tidak tersedia di ruangan ini)</option>
              )}
              {offeredPackages.map((p) => (
                <option key={p.id} value={p.name}>
                  {p.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="form-group">
            <label htmlFor="tl-detail-duration">Durasi (menit)</label>
            <input
              id="tl-detail-duration"
              className="input num"
              type="number"
              inputMode="numeric"
              min="10"
              step="5"
              value={form.duration}
              onChange={(e) => set('duration')(e.target.value)}
              onBlur={() => set('duration')(duration)}
              disabled={readOnly}
            />
          </div>
        </div>
        {offeredAddOns.length > 0 && (
          <div className="form-group">
            <span className="form-label">Item tambahan</span>
            <AddOnPicker items={offeredAddOns} value={form.addOns} onChange={changeAddOnQty(setForm)} disabled={readOnly} />
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
