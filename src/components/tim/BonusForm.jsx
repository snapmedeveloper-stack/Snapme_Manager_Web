import { useId, useState } from 'react';
import { Button, Modal, MoneyInput } from '../ui';
import { formatMonth } from '../../utils/attendance';

/** Tambah bonus untuk satu staff di bulan itu. onSave({ amount, note }). */
export default function BonusForm({ staffName, month, onSave, onClose }) {
  const formId = useId();
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const value = Math.round(Number(amount) || 0);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (value > 0) onSave({ amount: value, note: note.trim() });
  };

  return (
    <Modal
      open
      size="sm"
      title={`Bonus ${staffName}`}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Batal</Button>
          <Button type="submit" form={formId} variant="primary" disabled={value <= 0}>
            Tambah bonus
          </Button>
        </>
      }
    >
      <form id={formId} className="form-stack" onSubmit={handleSubmit}>
        <p className="form-hint">Masuk ke gaji {formatMonth(month)}.</p>
        <div className="form-group">
          <label htmlFor={`${formId}-amount`}>Jumlah</label>
          <MoneyInput id={`${formId}-amount`} value={amount} autoFocus onChange={setAmount} />
        </div>
        <div className="form-group">
          <label htmlFor={`${formId}-note`}>Keterangan</label>
          <input
            id={`${formId}-note`}
            className="input"
            placeholder="cth. Target booking tercapai"
            maxLength={120}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      </form>
    </Modal>
  );
}
