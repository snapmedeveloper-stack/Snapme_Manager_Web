import { Plus } from 'lucide-react';
import { Button, Modal } from '../ui';
import { formatDay } from '../../utils/attendance';
import DayDetail from './DayDetail';

/** Rincian satu tanggal sebagai bottom sheet (HP) dengan tombol catat kerja. Isinya DayDetail. */
export default function DaySheet({ date, editable, onAdd, onClose, ...detail }) {
  return (
    <Modal
      open
      onClose={onClose}
      title={formatDay(date)}
      footer={
        editable ? (
          <Button variant="primary" icon={Plus} onClick={onAdd}>
            Catat kerja
          </Button>
        ) : null
      }
    >
      <DayDetail date={date} editable={editable} {...detail} />
    </Modal>
  );
}
