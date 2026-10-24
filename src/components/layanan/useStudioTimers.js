import { useEffect, useState } from 'react';
import { onSnapshot, updateDoc } from 'firebase/firestore';
import { useToast } from '../ui';
import { writeInBackground } from '../../utils/firestoreWrite';
import { orgCollection, orgDoc } from './layananUtils';

/**
 * Saklar timer per ruangan (field studios/{id}.timerEnabled), sama dengan studioEnabled + handleToggleStudio di App
 * Snapme_Desktop. Desktop membaca field ini dari Firestore, jadi saklar dari Manager langsung berlaku di PC studio.
 * Mengembalikan { studioEnabled: { [id]: boolean }, onToggleStudio(id) }.
 */
export function useStudioTimers(orgId) {
  const toast = useToast();
  const [studioEnabled, setStudioEnabled] = useState({});

  useEffect(() => {
    if (!orgId) return undefined;
    return onSnapshot(orgCollection(orgId, 'studios'), (snap) => {
      const enabled = {};
      snap.forEach((d) => {
        enabled[d.id] = d.data().timerEnabled ?? false;
      });
      setStudioEnabled(enabled);
    });
  }, [orgId]);

  const onToggleStudio = (studioId) => {
    const on = !studioEnabled[studioId];
    setStudioEnabled((prev) => ({ ...prev, [studioId]: on }));
    writeInBackground(
      () => updateDoc(orgDoc(orgId, 'studios', studioId), { timerEnabled: on }),
      (err) => {
        setStudioEnabled((prev) => ({ ...prev, [studioId]: !on }));
        toast.error('Gagal mengubah timer', err.message);
      },
    );
  };

  return { studioEnabled, onToggleStudio };
}
