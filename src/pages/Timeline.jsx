import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Calendar, Clipboard, Check, RefreshCw, Layers } from 'lucide-react';
import { db } from '../firebase';
import { collection, onSnapshot, query, where, doc, deleteDoc, updateDoc, setDoc, writeBatch } from 'firebase/firestore';

function LiveClock() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formattedTime = time.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace(/\./g, ':');

  return (
    <div className="timeline-live-clock-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div className="timeline-live-clock" style={{ fontSize: 24, fontWeight: 700, color: 'var(--accent-primary)', fontFamily: 'Inter, sans-serif', letterSpacing: '1px', fontVariantNumeric: 'tabular-nums', minWidth: '105px', textAlign: 'right' }}>
        {formattedTime}
      </div>
    </div>
  );
}

const START_HOUR = 4;
const END_HOUR = 24;
const TOTAL_HOURS = END_HOUR - START_HOUR;
const MIN_GAP_MINUTES = 20;
const SNAP_MINUTES = 1;
const MIN_DURATION = 10;

const normalizePhoneNumber = (phone) => {
  if (!phone) return '';
  if (phone.includes('@')) return phone;
  let p = phone.replace(/\D/g, '');
  if (p.startsWith('62')) return '0' + p.slice(2);
  if (p && !p.startsWith('0')) return '0' + p;
  return p;
};

const Timeline = ({ orgId }) => {
  const [bookings, setBookings] = useState([]);
  const [studios, setStudios] = useState([]);
  const [photobooths, setPhotobooths] = useState([]);
  const [studioPackages, setStudioPackages] = useState([]);
  const [studioAddOns, setStudioAddOns] = useState([]);
  
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
  });

  const todayString = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
  })();

  // Timeline Scroll and Zoom States
  const [zoomLevel, setZoomLevel] = useState(240); // pixels per hour
  const zoomLevelRef = useRef(zoomLevel);
  zoomLevelRef.current = zoomLevel;

  const PIXELS_PER_HOUR = zoomLevel;
  const PIXELS_PER_MINUTE = PIXELS_PER_HOUR / 60;
  const TRACK_WIDTH = TOTAL_HOURS * PIXELS_PER_HOUR;

  const [hoveredSlot, setHoveredSlot] = useState(null);
  const [dragState, setDragState] = useState(null);
  const [clickIntent, setClickIntent] = useState(null);
  
  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isModalPhotobooth, setIsModalPhotobooth] = useState(false);
  const [modalForm, setModalForm] = useState({ customerName: '', waNumber: '', package: '', addOns: {}, startHour: 10, startMin: 0 });
  const [modalSlot, setModalSlot] = useState(null);
  const [modalError, setModalError] = useState('');
  
  const [detailBookingId, setDetailBookingId] = useState(null);
  const [detailForm, setDetailForm] = useState(null);
  const [deleteConfirmPending, setDeleteConfirmPending] = useState(false);
  const [bookingToast, setBookingToast] = useState(null);
  
  // Tab Rekap
  const [recapTab, setRecapTab] = useState('Semua');

  const scrollRef = useRef(null);
  const wrapperRef = useRef(null);
  const tracksScrollRef = useRef(null);
  const thumbRef = useRef(null);
  const dateInputRef = useRef(null);
  const isSyncingScrollRef = useRef(false);

  const showBookingToast = (type, message) => {
    setBookingToast({ type, message });
    setTimeout(() => setBookingToast(null), 3500);
  };

  // 1. Fetch Studios
  useEffect(() => {
    if (!orgId) return;
    const colRef = collection(db, 'organizations', orgId, 'studios');
    const unsub = onSnapshot(colRef, (snap) => {
      const st = [];
      snap.forEach(d => {
        const data = d.data();
        if (!data.archived) {
          st.push({ id: d.id, name: data.name || d.id, order: data.order || 0 });
        }
      });
      st.sort((a, b) => a.order - b.order);
      setStudios(st);
    });
    return () => unsub();
  }, [orgId]);

  // 2. Fetch Photobooths
  useEffect(() => {
    if (!orgId) return;
    const colRef = collection(db, 'organizations', orgId, 'photobooths');
    const unsub = onSnapshot(colRef, (snap) => {
      const pb = [];
      snap.forEach(d => {
        const data = d.data();
        if (!data.archived) {
          pb.push({ id: d.id, name: data.name || d.id, order: data.order || 0 });
        }
      });
      pb.sort((a, b) => a.order - b.order);
      setPhotobooths(pb);
    });
    return () => unsub();
  }, [orgId]);

  // 3. Fetch Packages
  useEffect(() => {
    if (!orgId) return;
    const colRef = collection(db, 'organizations', orgId, 'packages');
    const unsub = onSnapshot(colRef, (snap) => {
      const pkgs = [];
      snap.forEach(d => {
        const data = d.data();
        if (!data.archived) {
          pkgs.push({ id: d.id, ...data, order: data.order || 0 });
        }
      });
      pkgs.sort((a, b) => a.order - b.order);
      setStudioPackages(pkgs);
    });
    return () => unsub();
  }, [orgId]);

  // 4. Fetch Add Ons
  useEffect(() => {
    if (!orgId) return;
    const colRef = collection(db, 'organizations', orgId, 'add_ons');
    const unsub = onSnapshot(colRef, (snap) => {
      const items = [];
      snap.forEach(d => {
        const data = d.data();
        if (!data.archived) {
          items.push({ id: d.id, ...data });
        }
      });
      setStudioAddOns(items);
    });
    return () => unsub();
  }, [orgId]);

  // 5. Fetch Bookings for selected date
  useEffect(() => {
    if (!orgId) return;
    const q = query(
      collection(db, 'organizations', orgId, 'bookings'),
      where('date', '==', selectedDate)
    );
    const unsub = onSnapshot(q, (snap) => {
      const bks = [];
      snap.forEach(d => {
        const data = d.data();
        // Pastikan field startHour dan startMin ada, fallback jika kosong
        let startHour = data.startHour;
        let startMin = data.startMin;
        if (startHour === undefined && data.time) {
          const parts = data.time.split(':');
          startHour = parseInt(parts[0], 10);
          startMin = parseInt(parts[1], 10) || 0;
        }
        bks.push({ 
          id: d.id, 
          ...data,
          startHour: startHour !== undefined ? startHour : 10,
          startMin: startMin !== undefined ? startMin : 0,
          duration: data.duration ? Number(data.duration) : 30
        });
      });
      setBookings(bks);
    }, (err) => console.error("Firebase load bookings error:", err));
    return () => unsub();
  }, [orgId, selectedDate]);

  // Scroll to Current Time
  const [currentTimePos, setCurrentTimePos] = useState(-1);
  const [viewportW, setViewportW] = useState(1000);
  const scrollLeftRef = useRef(0);

  useEffect(() => {
    const updateTimePos = () => {
      const now = new Date();
      const totalMins = now.getHours() * 60 + now.getMinutes();
      if (totalMins >= START_HOUR * 60 && totalMins <= END_HOUR * 60) {
        setCurrentTimePos(totalMins - START_HOUR * 60);
      } else {
        setCurrentTimePos(-1);
      }
    };
    updateTimePos();
    const intervalId = setInterval(updateTimePos, 30000);
    return () => clearInterval(intervalId);
  }, []);

  const scrollToCurrentTime = (smooth = true) => {
    if (currentTimePos >= 0 && scrollRef.current) {
      let targetScroll = (currentTimePos * PIXELS_PER_MINUTE) - (viewportW / 2);
      targetScroll = Math.max(0, Math.min(targetScroll, TRACK_WIDTH - viewportW));
      
      if (!smooth && tracksScrollRef.current) {
        tracksScrollRef.current.scrollLeft = targetScroll;
        scrollLeftRef.current = targetScroll;
        if (thumbRef.current && TRACK_WIDTH > 0) {
          const sRatio = targetScroll / TRACK_WIDTH;
          thumbRef.current.style.left = `${sRatio * 100}%`;
        }
      }
      
      scrollRef.current.scrollTo({ left: targetScroll, behavior: smooth ? 'smooth' : 'auto' });
    }
  };

  const [initialScrolledDate, setInitialScrolledDate] = useState('');
  useEffect(() => {
    if (selectedDate !== todayString) {
      setInitialScrolledDate('');
      return;
    }
    if (currentTimePos >= 0 && initialScrolledDate !== selectedDate && scrollRef.current && tracksScrollRef.current) {
      const timer = setTimeout(() => {
        scrollToCurrentTime(false);
        setInitialScrolledDate(selectedDate);
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [currentTimePos, selectedDate, initialScrolledDate]);

  // Measure Viewport
  useEffect(() => {
    if (!scrollRef.current) return;
    const observer = new ResizeObserver(entries => {
      for (let entry of entries) setViewportW(entry.contentRect.width);
    });
    observer.observe(scrollRef.current);
    return () => observer.disconnect();
  }, []);

  // Keyboard Alt+Wheel Zoom + Horizontal Scroll
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const onWheel = (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey) {
        e.preventDefault();
        setHoveredSlot(null);
        
        const scrollEl = scrollRef.current;
        if (!scrollEl) return;
        
        const rect = scrollEl.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const anchorX = Math.max(0, mouseX);
        const currentScroll = scrollEl.scrollLeft;
        const timeAtMouseHr = (currentScroll + anchorX) / zoomLevelRef.current; 
        
        const zoomFactor = Math.exp(-e.deltaY * 0.005); 
        let newZoom = zoomLevelRef.current * zoomFactor;
        newZoom = Math.max(80, Math.min(newZoom, 500));
        setZoomLevel(newZoom);
        
        const newScroll = (timeAtMouseHr * newZoom) - anchorX;
        setTimeout(() => { if (scrollRef.current) scrollRef.current.scrollLeft = newScroll; }, 0);
      } else {
        if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
        e.preventDefault();
        if (scrollRef.current) {
          scrollRef.current.scrollLeft += e.deltaY;
        }
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const hours = Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => START_HOUR + i);

  // Drag-and-drop & Resizing Logic (Adapted from Desktop, directly updating Firestore on drop)
  const handleBlockMouseDown = (e, booking) => {
    e.stopPropagation();
    
    const startX = e.clientX;
    const min = (booking.startHour - START_HOUR) * 60 + booking.startMin;

    const timer = setTimeout(() => {
      setClickIntent(null);
      setHoveredSlot(null);
      setDragState({
        id: booking.id, 
        type: 'move', 
        startX, 
        initialMin: min, 
        initialDuration: booking.duration,
        originalStudio: booking.studio, 
        targetStudio: booking.studio, 
        currentMin: min, 
        currentDuration: booking.duration, 
        pushes: {}
      });
    }, 350);
    setClickIntent({ timer, booking });
  };

  useEffect(() => {
    if (!clickIntent) return;
    const handleGlobalUpForClick = () => {
      clearTimeout(clickIntent.timer);
      setClickIntent(null);
      setDetailBookingId(clickIntent.booking.id);
      setDetailForm({ ...bookings.find(b => b.id === clickIntent.booking.id) });
    };
    window.addEventListener('mouseup', handleGlobalUpForClick);
    return () => window.removeEventListener('mouseup', handleGlobalUpForClick);
  }, [clickIntent, bookings]);

  const handleResizeMouseDown = (e, booking) => {
    e.stopPropagation();
    e.preventDefault();
    const min = (booking.startHour - START_HOUR) * 60 + booking.startMin;
    setHoveredSlot(null);
    setDragState({
      id: booking.id, 
      type: 'resize', 
      startX: e.clientX, 
      initialMin: min, 
      initialDuration: booking.duration,
      originalStudio: booking.studio, 
      targetStudio: booking.studio, 
      currentMin: min, 
      currentDuration: booking.duration, 
      pushes: {}
    });
  };

  useEffect(() => {
    if (!dragState) return;
    const PIX_MIN = zoomLevelRef.current / 60; 

    const handleGlobalMove = (e) => {
      setDragState(prev => {
        if (!prev) return prev;
        const deltaX = e.clientX - prev.startX;
        const deltaMins = Math.round((deltaX / PIX_MIN) / SNAP_MINUTES) * SNAP_MINUTES;

        let newMin = prev.initialMin;
        let newDuration = prev.initialDuration;

        if (prev.type === 'resize') {
          newDuration = Math.max(MIN_DURATION, prev.initialDuration + deltaMins);
        } else {
          newMin = Math.max(0, prev.initialMin + deltaMins);
        }

        const sameStudio = bookings
          .filter(b => b.studio === prev.targetStudio && b.id !== prev.id)
          .map(b => ({ ...b, min: (b.startHour - START_HOUR) * 60 + b.startMin }))
          .sort((a,b) => a.min - b.min);

        let minAllowed = 0;
        for (let b of sameStudio) {
          if (b.min + b.duration <= newMin) {
            if (b.min + b.duration > minAllowed) minAllowed = b.min + b.duration;
          }
        }
        if (prev.type === 'move' && newMin < minAllowed) newMin = minAllowed;

        let pushes = {};
        let currentEnd = newMin + newDuration;
        for (let b of sameStudio) {
          if (b.min >= minAllowed) {
            if (currentEnd > b.min) {
              const shift = currentEnd - b.min;
              pushes[b.id] = shift;
              currentEnd = b.min + shift + b.duration;
            }
          }
        }
        return { ...prev, currentMin: newMin, currentDuration: newDuration, pushes };
      });
    };

    const handleGlobalUp = async () => {
      if (!dragState) return;
      
      const newHour = Math.floor(dragState.currentMin / 60) + START_HOUR;
      const newMin = dragState.currentMin % 60;
      const timeStr = `${newHour.toString().padStart(2, '0')}:${newMin.toString().padStart(2, '0')}`;

      try {
        const batch = writeBatch(db);
        
        // Update dragged booking
        batch.update(doc(db, 'organizations', orgId, 'bookings', dragState.id), {
          studio: dragState.targetStudio,
          startHour: newHour,
          startMin: newMin,
          time: timeStr,
          duration: dragState.currentDuration
        });

        // Update pushed bookings
        Object.entries(dragState.pushes).forEach(([pushedId, shiftMin]) => {
          const pb = bookings.find(b => b.id === pushedId);
          if (pb) {
            const oldMin = (pb.startHour - START_HOUR) * 60 + pb.startMin;
            const targetMin = oldMin + shiftMin;
            const pHour = Math.floor(targetMin / 60) + START_HOUR;
            const pMin = targetMin % 60;
            const pTimeStr = `${pHour.toString().padStart(2, '0')}:${pMin.toString().padStart(2, '0')}`;
            
            batch.update(doc(db, 'organizations', orgId, 'bookings', pushedId), {
              startHour: pHour,
              startMin: pMin,
              time: pTimeStr
            });
          }
        });

        await batch.commit();
        showBookingToast('success', 'Jadwal berhasil digeser.');
      } catch (err) {
        console.error("Batch update drag booking failed:", err);
        showBookingToast('error', 'Gagal memindahkan jadwal.');
      }
      setDragState(null);
    };

    window.addEventListener('mousemove', handleGlobalMove);
    window.addEventListener('mouseup', handleGlobalUp);
    return () => {
      window.removeEventListener('mousemove', handleGlobalMove);
      window.removeEventListener('mouseup', handleGlobalUp);
    };
  }, [dragState, bookings, orgId]);

  const updateHoveredSlot = (clientX, currentTarget, studioId) => {
    if (dragState || clickIntent) return;
    const rect = currentTarget.getBoundingClientRect();
    const x = clientX - rect.left;
    let snappedMin = Math.round((x / PIXELS_PER_MINUTE) / SNAP_MINUTES) * SNAP_MINUTES;

    if (snappedMin < 0 || snappedMin > TOTAL_HOURS * 60) { setHoveredSlot(null); return; }

    const studioBookings = bookings.filter(b => b.studio === studioId).map(b => {
      const bMin = (b.startHour - START_HOUR) * 60 + b.startMin;
      return { start: bMin, end: bMin + b.duration };
    });

    if (studioBookings.some(b => snappedMin >= b.start && snappedMin < b.end)) { setHoveredSlot(null); return; }

    let freeStart = 0, freeEnd = TOTAL_HOURS * 60;
    for (let b of studioBookings) {
      if (b.end <= snappedMin && b.end > freeStart) freeStart = b.end;
      if (b.start > snappedMin && b.start < freeEnd) freeEnd = b.start;
    }

    if (freeEnd - freeStart >= MIN_GAP_MINUTES && snappedMin + MIN_GAP_MINUTES <= freeEnd) {
      setHoveredSlot({ studio: studioId, min: snappedMin, x: snappedMin * PIXELS_PER_MINUTE });
    } else {
      setHoveredSlot(null);
    }
  };

  // Click/Tap handler for blank track space (touch-friendly adding)
  const handleTrackClick = (e, studioId) => {
    if (dragState || clickIntent) return;
    if (e.target !== e.currentTarget && !e.target.classList.contains('timeline-track-bg-line')) return;
    updateHoveredSlot(e.clientX, e.currentTarget, studioId);
  };

  // Hover Slot Finder
  const handleTrackMove = (e, studioId) => {
    updateHoveredSlot(e.clientX, e.currentTarget, studioId);
  };

  const handleTrackTouchMove = (e, studioId) => {
    if (e.touches && e.touches.length > 0) {
      updateHoveredSlot(e.touches[0].clientX, e.currentTarget, studioId);
    }
  };

  const openAddModal = (e) => {
    e.stopPropagation();
    if (!hoveredSlot) return;
    
    const h = Math.floor(hoveredSlot.min / 60) + START_HOUR;
    const m = hoveredSlot.min % 60;

    setModalSlot({ studio: hoveredSlot.studio, min: hoveredSlot.min });
    setModalForm({ 
      customerName: '', 
      waNumber: '', 
      package: '', 
      addOns: {}, 
      startHour: h, 
      startMin: m 
    });
    setModalError('');
    setIsModalOpen(true);
    setHoveredSlot(null);
  };

  const saveNewBooking = async () => {
    if (!modalForm.customerName.trim()) {
      setModalError('Nama Customer wajib diisi!');
      return;
    }
    if (!modalForm.package) {
      setModalError('Paket Studio wajib dipilih!');
      return;
    }
    
    const isDuplicate = bookings.some(b => 
      b.date === selectedDate && 
      b.customerName.toLowerCase() === modalForm.customerName.trim().toLowerCase()
    );
    if (isDuplicate) {
      setModalError(`Nama "${modalForm.customerName.trim()}" sudah terdaftar hari ini.`);
      return;
    }
    setModalError('');

    const pkgData = studioPackages.find(p => p.name === modalForm.package);
    const calculatedDuration = pkgData?.duration || 30;

    const newId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    const timeStr = `${modalForm.startHour.toString().padStart(2, '0')}:${modalForm.startMin.toString().padStart(2, '0')}`;

    try {
      await setDoc(doc(db, 'organizations', orgId, 'bookings', newId), {
        id: newId,
        studio: modalSlot.studio,
        customerName: modalForm.customerName.trim(),
        waNumber: normalizePhoneNumber(modalForm.waNumber),
        package: modalForm.package,
        addOns: modalForm.addOns || {},
        date: selectedDate,
        startHour: modalForm.startHour,
        startMin: modalForm.startMin,
        time: timeStr,
        duration: Number(calculatedDuration),
        createdAt: new Date().toISOString()
      });
      setIsModalOpen(false);
      showBookingToast('success', `Jadwal "${modalForm.customerName}" berhasil ditambahkan.`);
    } catch (e) {
      setModalError("Gagal menyimpan ke Firestore: " + e.message);
    }
  };

  const saveEditedBooking = async () => {
    if (!detailForm.customerName.trim()) {
      alert("Nama Customer wajib diisi!");
      return;
    }
    
    const timeStr = `${detailForm.startHour.toString().padStart(2, '0')}:${(detailForm.startMin || 0).toString().padStart(2, '0')}`;
    const normalizedForm = { 
      ...detailForm, 
      customerName: detailForm.customerName.trim(),
      waNumber: normalizePhoneNumber(detailForm.waNumber),
      time: timeStr
    };

    try {
      await updateDoc(doc(db, 'organizations', orgId, 'bookings', detailForm.id), normalizedForm);
      setDetailBookingId(null);
      setDetailForm(null);
      showBookingToast('success', 'Jadwal berhasil diperbarui.');
    } catch (e) {
      alert("Gagal memperbarui jadwal: " + e.message);
    }
  };

  const confirmDelete = async () => {
    const name = detailForm?.customerName;
    try {
      await deleteDoc(doc(db, 'organizations', orgId, 'bookings', detailForm.id));
      setDetailBookingId(null);
      setDetailForm(null);
      setDeleteConfirmPending(false);
      showBookingToast('delete', `Booking "${name}" berhasil dihapus.`);
    } catch (e) {
      alert("Gagal menghapus: " + e.message);
    }
  };

  const handleToggleArrived = async (booking) => {
    try {
      const ref = doc(db, 'organizations', orgId, 'bookings', booking.id);
      if (booking.arrivedAt) {
        await updateDoc(ref, { arrivedAt: null, completedAt: null });
      } else {
        await updateDoc(ref, { arrivedAt: new Date().toISOString(), completedAt: null });
      }
    } catch (e) {
      console.error("Gagal update status kedatangan:", e);
    }
  };

  const handleRecap = () => {
    if (bookings.length === 0) {
      showBookingToast('info', 'Tidak ada booking untuk disalin.');
      return;
    }
    const d = new Date(selectedDate);
    const dayName = d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' });
    
    let filteredBookings = [...bookings];
    if (recapTab === 'Studio') {
      filteredBookings = filteredBookings.filter(b => studios.some(s => s.id === b.studio));
    } else if (recapTab === 'Photobooth') {
      filteredBookings = filteredBookings.filter(b => photobooths.some(p => p.id === b.studio));
    }

    if (filteredBookings.length === 0) {
      showBookingToast('info', `Tidak ada booking ${recapTab !== 'Semua' ? recapTab : ''} untuk disalin.`);
      return;
    }

    const sorted = filteredBookings.sort((a, b) => {
      const startA = a.startHour * 60 + (a.startMin || 0);
      const startB = b.startHour * 60 + (b.startMin || 0);
      return startA - startB;
    });

    const fixCaps = (str) => {
      if (!str) return '';
      return str.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    };

    const lines = sorted.map((b, i) => {
      const startStr = `${b.startHour.toString().padStart(2, '0')}.${(b.startMin || 0).toString().padStart(2, '0')}`;
      const name = fixCaps(b.customerName);
      const pkg = b.package ? b.package.toLowerCase() : '';
      
      const addOnsArray = [];
      if (b.addOns) {
        Object.entries(b.addOns).forEach(([id, data]) => {
          if (data.qty > 0) {
            const addOn = studioAddOns.find(ao => ao.id === id);
            if (addOn) {
              addOnsArray.push(`${data.qty}x ${addOn.name}`);
            }
          }
        });
      }
      const addOnStr = addOnsArray.length > 0 ? ` (+ ${addOnsArray.join(', ')})` : '';

      return `${i + 1}. ${name} ${startStr} ${pkg}${addOnStr}`;
    });

    const text = `${dayName} (${recapTab})\n${lines.join('\n')}`;
    navigator.clipboard.writeText(text).then(() => {
      showBookingToast('success', `Rekap ${recapTab} hari ini berhasil disalin!`);
    }).catch(() => {
      alert("Gagal menyalin rekap.");
    });
  };

  // Premiere Scrollbar Drag
  const startRatio = scrollLeftRef.current / TRACK_WIDTH || 0;
  const viewportRatio = viewportW / (TRACK_WIDTH || 1);
  const thumbWidth = Math.max(10, Math.min(100, viewportRatio * 100));
  const thumbLeft = startRatio * 100;

  const handleMasterScroll = (e) => {
    if (isSyncingScrollRef.current) return;
    const sl = e.target.scrollLeft;
    scrollLeftRef.current = sl;
    
    isSyncingScrollRef.current = true;
    if (e.target === scrollRef.current && tracksScrollRef.current) {
      tracksScrollRef.current.scrollLeft = sl;
    } else if (e.target === tracksScrollRef.current && scrollRef.current) {
      scrollRef.current.scrollLeft = sl;
    }
    isSyncingScrollRef.current = false;
    
    if (thumbRef.current && TRACK_WIDTH > 0) {
      const sRatio = sl / TRACK_WIDTH;
      thumbRef.current.style.left = `${sRatio * 100}%`;
    }
  };

  const handleThumbDrag = (e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startScroll = scrollLeftRef.current;
    const onMove = ev => {
      if (!scrollRef.current) return;
      const deltaX = ev.clientX - startX;
      scrollRef.current.scrollLeft = startScroll + (deltaX / viewportW) * TRACK_WIDTH;
    };
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const handleHandleResize = (e, side) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const initZoom = zoomLevelRef.current;
    const initialStartRatio = scrollLeftRef.current / (TOTAL_HOURS * initZoom);
    const initialEndRatio = (scrollLeftRef.current + viewportW) / (TOTAL_HOURS * initZoom);

    const onMove = ev => {
      const deltaRatio = (ev.clientX - startX) / viewportW;
      let newStartRatio = initialStartRatio;
      let newEndRatio = initialEndRatio;
      
      if (side === 'left') {
        newStartRatio += deltaRatio;
        newStartRatio = Math.max(0, Math.min(newEndRatio - 0.05, newStartRatio));
      } else {
        newEndRatio += deltaRatio;
        newEndRatio = Math.max(newStartRatio + 0.05, Math.min(1, newEndRatio));
      }

      const newViewportRatio = newEndRatio - newStartRatio;
      const newTrackWidth = viewportW / newViewportRatio;
      let newZoom = newTrackWidth / TOTAL_HOURS;
      newZoom = Math.max(80, Math.min(newZoom, 500));

      setZoomLevel(newZoom);
      if (scrollRef.current) {
        scrollRef.current.scrollLeft = newStartRatio * (TOTAL_HOURS * newZoom);
      }
    };
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // Rendering Helpers
  const formatTimeRange = (startH, startM, durationMin) => {
    const s = new Date(); s.setHours(startH, startM, 0); 
    const e = new Date(s.getTime() + durationMin * 60000);
    const f = (d) => d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace(/\./g, ':');
    return `${f(s)} - ${f(e)}`;
  };

  const renderBooking = (booking) => {
    let min = (booking.startHour - START_HOUR) * 60 + booking.startMin;
    let duration = booking.duration;
    let studio = booking.studio;
    let isDragging = false;

    if (dragState) {
      if (dragState.id === booking.id) {
        min = dragState.currentMin; duration = dragState.currentDuration; studio = dragState.targetStudio; isDragging = true;
      } else if (dragState.pushes[booking.id]) min += dragState.pushes[booking.id];
    }
    const left = min * PIXELS_PER_MINUTE;
    const width = duration * PIXELS_PER_MINUTE;

    const classNames = `timeline-booking-block ${isDragging ? 'dragging' : ''} ${clickIntent?.booking.id === booking.id ? 'active-hold' : ''}`;
    
    const displayTitle = booking.customerName;
    const pkg = studioPackages.find(p => p.name === booking.package);
    const color = pkg?.color || '#0ea5e9';
    
    const blockStyle = {
      left, 
      width, 
      transition: (clickIntent || isDragging) ? 'none' : 'transform 0.15s ease',
      background: `${color}80`,
      borderLeftColor: color,
      borderColor: `${color}66`,
      color: 'var(--text-primary)'
    };

    const hasArrived = !!booking.arrivedAt;

    return (
      <div
        key={`block-${booking.id}`}
        className={`${classNames}${hasArrived ? ' booking-active' : ''}`}
        style={blockStyle}
        onMouseDown={(e) => handleBlockMouseDown(e, booking)}
      >
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div className="booking-title" title={displayTitle} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 700 }}>{displayTitle || '-'}</span>
          </div>
          <div className="booking-time" style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden' }}>
             <span style={{ fontWeight: 500, color: 'var(--text-secondary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{booking.package || '-'}</span>
             <span style={{ whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', fontSize: '10.5px' }}>{formatTimeRange(booking.startHour, booking.startMin, duration)}</span>
             <span style={{ opacity: 0.8, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', fontSize: '10.5px' }}>{duration} Menit</span>
          </div>
        </div>

        <div className="arrived-bar">
          <div
            className={`arrived-bar-btn${hasArrived ? ' arrived-bar-btn-active' : ''}`}
            style={{ pointerEvents: 'none', cursor: 'default' }}
            title={hasArrived ? 'Customer sudah datang' : 'Customer belum datang'}
          >
            {hasArrived ? 'Datang' : 'Belum Datang'}
          </div>
        </div>

        <div className="booking-resize-handle" onMouseDown={(e) => handleResizeMouseDown(e, booking)} />
      </div>
    );
  };

  const isToday = selectedDate === todayString;
  const nowMinsCurrent = new Date().getHours() * 60 + new Date().getMinutes();
  const bStart = b => b.startHour * 60 + (b.startMin || 0);
  const bEnd   = b => bStart(b) + (b.duration || 30);
  
  let recapBookings = bookings;
  if (recapTab === 'Studio') {
    recapBookings = bookings.filter(b => studios.some(s => s.id === b.studio));
  } else if (recapTab === 'Photobooth') {
    recapBookings = bookings.filter(b => photobooths.some(p => p.id === b.studio));
  }

  const recapAktif    = isToday ? recapBookings.filter(b => bStart(b) <= nowMinsCurrent && bEnd(b) > nowMinsCurrent).length : 0;
  const recapSelesai  = isToday ? recapBookings.filter(b => bEnd(b) <= nowMinsCurrent).length : 0;
  const recapMenunggu = isToday ? recapBookings.filter(b => bStart(b) > nowMinsCurrent).length : recapBookings.length;
  const recapTotalMin = recapBookings.reduce((s, b) => s + (b.duration || 30), 0);
  const recapJam      = Math.floor(recapTotalMin / 60);
  const recapSisaMnt  = recapTotalMin % 60;

  return (
    <div className="page-enter timeline-page-container" style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '0px' }}>
      
      {/* Header Rekap / Bar Control */}
      <div className="timeline-control-bar" style={{ 
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
        flexWrap: 'wrap', gap: '16px', background: 'var(--bg-surface)', padding: '12px 24px', 
        borderBottom: '1px solid var(--border-color)'
      }}>
        {/* Tab & Stats */}
        <div className="timeline-control-bar-left" style={{ display: 'flex', alignItems: 'center', gap: 20, flexShrink: 0, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', background: 'var(--bg-color)', borderRadius: 8, padding: 4, border: '1px solid var(--border-color)' }}>
            {['Semua', 'Studio', 'Photobooth'].map(tab => (
              <button
                key={tab}
                onClick={() => setRecapTab(tab)}
                style={{
                  background: recapTab === tab ? 'var(--bg-surface)' : 'transparent',
                  color: recapTab === tab ? 'var(--text-primary)' : 'var(--text-secondary)',
                  border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', transition: 'all 0.2s',
                  boxShadow: recapTab === tab ? 'var(--shadow-sm)' : 'none'
                }}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="timeline-control-bar-separator" style={{ width: 1, height: 24, background: 'var(--border-color)' }} />

          {recapBookings.length > 0 ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: 17 }}>{recapBookings.length}</span>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Booking</span>
              </div>

              {recapAktif > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 12px', borderRadius: 20, background: 'rgba(239,68,68,0.08)' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', display: 'inline-block', animation: 'pulse-dot 1.5s infinite' }} />
                  <span style={{ fontWeight: 800, color: '#ef4444', fontSize: 15 }}>{recapAktif}</span>
                  <span style={{ color: '#ef4444', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Berjalan</span>
                </div>
              )}

              {recapSelesai > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 20, background: 'rgba(16,185,129,0.08)' }}>
                  <span style={{ fontWeight: 800, color: '#10b981', fontSize: 15 }}>{recapSelesai}</span>
                  <span style={{ color: '#10b981', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Selesai</span>
                </div>
              )}

              {recapMenunggu > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 20, background: 'rgba(79,70,229,0.08)' }}>
                  <span style={{ fontWeight: 800, color: 'var(--primary-color)', fontSize: 15 }}>{recapMenunggu}</span>
                  <span style={{ color: 'var(--primary-color)', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{isToday ? 'Menunggu' : 'Terjadwal'}</span>
                </div>
              )}

              <div className="timeline-control-bar-separator" style={{ width: 1, height: 24, background: 'var(--border-color)' }} />

              <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                <strong style={{ color: 'var(--text-primary)', fontWeight: 800, fontSize: 14 }}>
                  {recapJam > 0 ? `${recapJam}j ` : ''}{recapSisaMnt}m
                </strong> total
              </span>
            </>
          ) : (
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-secondary)' }}>Jadwal Kosong</div>
          )}
        </div>

        {/* Right side controls */}
        <div className="timeline-control-bar-right" style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button
            onClick={handleRecap}
            className="btn btn-ghost"
            style={{
              padding: '7px 12px', display: 'flex', alignItems: 'center', gap: 6,
              borderRadius: 8, fontSize: 12, fontWeight: 600,
              background: 'var(--bg-color)'
            }}
            title="Salin Rekap Hari Ini"
          >
            <Clipboard size={15} />
            Copy Recap
          </button>

          <div className="timeline-control-bar-separator" style={{ width: '1px', height: '18px', background: 'var(--border-color)' }}></div>

          <button 
            className="btn btn-ghost" 
            style={{ padding: '8px', display: 'flex', borderRadius: '50%', background: selectedDate === todayString ? 'var(--bg-hover)' : 'var(--accent-subtle)' }}
            onClick={() => {
              if (selectedDate !== todayString) setSelectedDate(todayString);
              else scrollToCurrentTime();
            }} 
            title={selectedDate === todayString ? "Gulir ke Waktu Saat Ini" : "Kembali ke Hari Ini"}
          >
            <Calendar size={18} />
          </button>

          <div 
            style={{ 
              position: 'relative', 
              cursor: 'pointer', 
              padding: '6px 16px', 
              borderRadius: '8px', 
              transition: 'background 0.2s',
              display: 'flex',
              alignItems: 'center',
              background: 'var(--bg-hover)'
            }} 
            className="date-picker-trigger"
            onClick={() => dateInputRef.current?.showPicker()}
          >
            <input 
              ref={dateInputRef}
              type="date" 
              value={selectedDate} 
              onChange={e => setSelectedDate(e.target.value)} 
              style={{ 
                opacity: 0, 
                position: 'absolute', 
                left: 0, top: 0, width: '100%', height: '100%', 
                cursor: 'pointer',
                zIndex: -1,
                pointerEvents: 'none'
              }} 
            />
            <div style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {new Date(selectedDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
          </div>

          <div className="timeline-control-bar-separator" style={{ width: '1px', height: '28px', background: 'var(--border-color)' }}></div>
          <LiveClock />
        </div>
      </div>

      {/* TIMELINE CONTAINER */}
      <div className="timeline-wrapper" ref={wrapperRef} style={{ flex: 1, minHeight: 0 }} onMouseLeave={() => setHoveredSlot(null)}>
        
        {/* Ruler Row */}
        <div className="timeline-header-row">
          <div className="timeline-left-panel timeline-header-left">
            <Layers size={14} className="timeline-header-icon" />
            <span className="timeline-header-text">Layer Studio</span>
          </div>
          <div className="timeline-scroll-area" ref={scrollRef} onScroll={handleMasterScroll}>
            <div className="timeline-ruler" style={{ width: TRACK_WIDTH }}>
              {hours.map(hour => (
                <React.Fragment key={`ruler-${hour}`}>
                  <div className="timeline-ruler-mark" style={{ left: (hour - START_HOUR) * PIXELS_PER_HOUR }}>{hour.toString().padStart(2, '0')}:00</div>
                  {hour !== END_HOUR && <div className="timeline-ruler-mark-half" style={{ left: (hour - START_HOUR) * PIXELS_PER_HOUR + (PIXELS_PER_HOUR / 2) }} />}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>

        {/* Tracks Grid Area */}
        <div className="timeline-tracks" style={{ flex: 1, display: 'flex', overflowY: 'auto', overflowX: 'hidden', alignItems: 'flex-start' }}>
          
          {/* Left Panel Labels */}
          <div className="timeline-left-panel" style={{ overflowY: 'visible' }}>
            {studios.map(studio => (
              <div key={studio.id} className="timeline-track-row">
                <div className="timeline-track-label">
                  <span>{studio.name}</span>
                </div>
              </div>
            ))}
            
            {photobooths.length > 0 && (
              <div className="timeline-track-label timeline-photobooth-divider" style={{ height: 33, display: 'flex', alignItems: 'center', background: 'var(--bg-color)', color: 'var(--text-muted)', fontSize: 11, fontWeight: 700, padding: '4px 16px', borderBottom: '1px solid var(--border-color)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Photobooth
              </div>
            )}
            {photobooths.map(pb => (
              <div key={pb.id} className="timeline-track-row" style={{ background: '#f8fafc' }}>
                <div className="timeline-track-label">
                  <span>{pb.name}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Scrollable Tracks Area */}
          <div className="timeline-scroll-area" style={{ flex: 1, minWidth: 0, overflowX: 'auto', overflowY: 'visible' }} ref={tracksScrollRef} onScroll={handleMasterScroll}>
            <div style={{ width: TRACK_WIDTH, minHeight: '100%', position: 'relative' }}>
              
              {/* Current Time Playhead line */}
              {currentTimePos >= 0 && selectedDate === todayString && (
                <div className="timeline-playhead" style={{ left: currentTimePos * PIXELS_PER_MINUTE }} />
              )}

              {/* Studio Tracks */}
              {studios.map((studio) => (
                <div 
                  key={studio.id} className="timeline-track-row timeline-track-container" style={{ width: TRACK_WIDTH }}
                  onMouseMove={(e) => handleTrackMove(e, studio.id)}
                  onTouchMove={(e) => handleTrackTouchMove(e, studio.id)}
                  onClick={(e) => handleTrackClick(e, studio.id)}
                  onMouseEnter={() => { if (dragState && dragState.type === 'move') setDragState(s => ({...s, targetStudio: studio.id})) }}
                >
                  {hours.map(h => <div key={`bg-${h}`} className="timeline-track-bg-line" style={{ left: (h - START_HOUR) * PIXELS_PER_HOUR }} />)}
                  
                  {bookings.filter(b => b.studio === studio.id && !(dragState && dragState.id === b.id && dragState.targetStudio !== studio.id)).map(renderBooking)}
                  {dragState && dragState.targetStudio === studio.id && dragState.originalStudio !== studio.id && bookings.filter(b => b.id === dragState.id).map(renderBooking)}
                  
                  {hoveredSlot && hoveredSlot.studio === studio.id && !dragState && !clickIntent && (
                     <div className="timeline-add-indicator" style={{ left: hoveredSlot.x }}>
                        <div className="timeline-add-time-badge">{`${Math.floor(hoveredSlot.min / 60) + START_HOUR}:${(hoveredSlot.min % 60).toString().padStart(2, '0')}`}</div>
                        <div className="timeline-add-btn" onClick={(e) => { setIsModalPhotobooth(false); openAddModal(e); }}>
                           <Plus size={14} />
                        </div>
                     </div>
                  )}
                </div>
              ))}

              {/* Photobooth divider row */}
              {photobooths.length > 0 && (
                <div className="timeline-track-row" style={{ height: 33, background: '#f1f5f9', borderBottom: '1px solid var(--border-color)', pointerEvents: 'none' }}></div>
              )}

              {/* Photobooth Tracks */}
              {photobooths.map((pb) => (
                <div 
                  key={pb.id} className="timeline-track-row timeline-track-container" style={{ width: TRACK_WIDTH, background: '#f8fafc' }}
                  onMouseMove={(e) => handleTrackMove(e, pb.id)}
                  onTouchMove={(e) => handleTrackTouchMove(e, pb.id)}
                  onClick={(e) => handleTrackClick(e, pb.id)}
                  onMouseEnter={() => { if (dragState && dragState.type === 'move') setDragState(s => ({...s, targetStudio: pb.id})) }}
                >
                  {hours.map(h => <div key={`bg-${h}`} className="timeline-track-bg-line" style={{ left: (h - START_HOUR) * PIXELS_PER_HOUR }} />)}
                  
                  {bookings.filter(b => b.studio === pb.id && !(dragState && dragState.id === b.id && dragState.targetStudio !== pb.id)).map(renderBooking)}
                  {dragState && dragState.targetStudio === pb.id && dragState.originalStudio !== pb.id && bookings.filter(b => b.id === dragState.id).map(renderBooking)}
                  
                  {hoveredSlot && hoveredSlot.studio === pb.id && !dragState && !clickIntent && (
                     <div className="timeline-add-indicator" style={{ left: hoveredSlot.x }}>
                        <div className="timeline-add-time-badge">{`${Math.floor(hoveredSlot.min / 60) + START_HOUR}:${(hoveredSlot.min % 60).toString().padStart(2, '0')}`}</div>
                        <div className="timeline-add-btn" onClick={(e) => { setIsModalPhotobooth(true); openAddModal(e); }}>
                           <Plus size={14} />
                        </div>
                     </div>
                  )}
                </div>
              ))}

            </div>
          </div>
        </div>

        {/* Zoom controller bar */}
        <div className="premiere-scrollbar-wrapper">
          <div className="premiere-scrollbar-container">
            <div ref={thumbRef} className="premiere-scrollbar-thumb" style={{ left: `${thumbLeft}%`, width: `${thumbWidth}%` }} onMouseDown={handleThumbDrag}>
              <div className="premiere-scrollbar-handle" onMouseDown={e => handleHandleResize(e, 'left')} />
              <div style={{ flex: 1, height: '100%' }} onMouseDown={handleThumbDrag} />
              <div className="premiere-scrollbar-handle" onMouseDown={e => handleHandleResize(e, 'right')} />
            </div>
          </div>
        </div>

      </div>

      {/* MODAL TAMBAH BOOKING */}
      {isModalOpen && (
        <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setIsModalOpen(false); }}>
          <div className="modal-content">
            <div className="modal-header">
              <div className="modal-title">Tambah Jadwal di {studios.find(s => s.id === modalSlot?.studio)?.name || photobooths.find(p => p.id === modalSlot?.studio)?.name || modalSlot?.studio}</div>
            </div>
            
            <div className="form-group">
              <label>Nama Customer</label>
              <input 
                type="text" 
                placeholder="Contoh: Dian" 
                value={modalForm.customerName} 
                onChange={e => { setModalForm({...modalForm, customerName: e.target.value}); setModalError(''); }} 
                autoFocus 
              />
            </div>

            <div className="form-group">
              <label>No WA (Opsional)</label>
              <input type="text" placeholder="0812xxxxxx" value={modalForm.waNumber} onChange={e => setModalForm({...modalForm, waNumber: e.target.value})} />
            </div>

            {/* Time Selection Fields */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '8px' }}>
              <div className="form-group">
                <label>Jam Mulai</label>
                <select value={modalForm.startHour} onChange={e => setModalForm({...modalForm, startHour: Number(e.target.value)})}>
                  {hours.map(h => <option key={h} value={h}>{h.toString().padStart(2, '0')}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Menit</label>
                <select value={modalForm.startMin} onChange={e => setModalForm({...modalForm, startMin: Number(e.target.value)})}>
                  {Array.from({ length: 60 }, (_, i) => i).map(m => (
                    <option key={m} value={m}>{m.toString().padStart(2, '0')}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>Paket Studio</label>
              <select value={modalForm.package} onChange={e => { setModalForm({...modalForm, package: e.target.value}); setModalError(''); }}>
                <option value="" disabled>-- Pilih Paket --</option>
                {studioPackages.filter(pkg => {
                  const hasPhotobooths = pkg.photobooths && pkg.photobooths.length > 0;
                  const hasStudios = pkg.studios && pkg.studios.length > 0;
                  if (isModalPhotobooth) {
                    if (hasPhotobooths) return pkg.photobooths.includes(modalSlot?.studio);
                    if (hasStudios) return false;
                    return true;
                  } else {
                    if (hasStudios) return pkg.studios.includes(modalSlot?.studio);
                    if (hasPhotobooths) return false;
                    return true;
                  }
                }).map((pkg, i) => <option key={i} value={pkg.name}>{pkg.name}</option>)}
              </select>
            </div>

            {modalError && (
              <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '8px 12px', color: '#dc2626', fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6, marginTop: 10 }}>
                {modalError}
              </div>
            )}

            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setIsModalOpen(false)}>Batal</button>
              <button className="btn btn-primary" onClick={saveNewBooking}>Simpan Booking</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DETAIL BOOKING */}
      {detailBookingId && detailForm && (() => {
        const isDetailPhotobooth = photobooths.some(p => p.id === detailForm.studio);
        const availablePackagesForEdit = studioPackages.filter(pkg => {
          const hasPhotobooths = pkg.photobooths && pkg.photobooths.length > 0;
          const hasStudios = pkg.studios && pkg.studios.length > 0;
          if (isDetailPhotobooth) {
            if (hasPhotobooths) return pkg.photobooths.includes(detailForm.studio);
            if (hasStudios) return false;
            return true;
          } else {
            if (hasStudios) return pkg.studios.includes(detailForm.studio);
            if (hasPhotobooths) return false;
            return true;
          }
        });

        return (
          <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) { setDetailBookingId(null); setDetailForm(null); } }}>
            <div className="modal-content" style={{ width: 480 }}>
              <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                  background: `${studioPackages.find(p => p.name === detailForm.package)?.color || '#0ea5e9'}1A`,
                  border: `1.5px solid ${studioPackages.find(p => p.name === detailForm.package)?.color || '#0ea5e9'}4D`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <Calendar size={18} color={studioPackages.find(p => p.name === detailForm.package)?.color || '#0ea5e9'} />
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
                    {detailForm.customerName || 'Detail Jadwal'}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                    {studios.find(s => s.id === detailForm.studio)?.name || photobooths.find(p => p.id === detailForm.studio)?.name || detailForm.studio}
                    {' · '}
                    {formatTimeRange(detailForm.startHour, detailForm.startMin || 0, detailForm.duration)}
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px' }}>
                <div className="form-group" style={{ gridColumn: '1 / 3' }}>
                  <label>Nama Customer</label>
                  <input
                    type="text"
                    value={detailForm.customerName || ''}
                    onChange={e => setDetailForm({ ...detailForm, customerName: e.target.value })}
                  />
                </div>
                
                <div className="form-group" style={{ gridColumn: '1 / 3' }}>
                  <label>No WA (Opsional)</label>
                  <input
                    type="text"
                    placeholder="0812xxxx"
                    value={detailForm.waNumber || ''}
                    onChange={e => setDetailForm({ ...detailForm, waNumber: e.target.value })}
                  />
                </div>

                {/* Edit Time and Studio dropdowns for mobile-friendliness */}
                <div className="form-group">
                  <label>Jam Mulai</label>
                  <select value={detailForm.startHour} onChange={e => setDetailForm({...detailForm, startHour: Number(e.target.value)})}>
                    {hours.map(h => <option key={h} value={h}>{h.toString().padStart(2, '0')}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Menit</label>
                  <select value={detailForm.startMin || 0} onChange={e => setDetailForm({...detailForm, startMin: Number(e.target.value)})}>
                    {Array.from({ length: 60 }, (_, i) => i).map(m => (
                      <option key={m} value={m}>{m.toString().padStart(2, '0')}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Studio/Photobooth</label>
                  <select value={detailForm.studio || ''} onChange={e => setDetailForm({...detailForm, studio: e.target.value})}>
                    {studios.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    {photobooths.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label>Durasi (Menit)</label>
                  <input
                    type="number" min="10" step="5"
                    value={detailForm.duration}
                    onChange={e => setDetailForm({ ...detailForm, duration: Math.max(10, Number(e.target.value)) })}
                  />
                </div>

                <div className="form-group" style={{ gridColumn: '1 / 3' }}>
                  <label>Paket Studio</label>
                  <select value={detailForm.package || ''} onChange={e => setDetailForm({ ...detailForm, package: e.target.value })}>
                    <option value="" disabled>-- Pilih Paket --</option>
                    {availablePackagesForEdit.map((pkg, i) => <option key={i} value={pkg.name}>{pkg.name}</option>)}
                  </select>
                </div>
              </div>

              {/* Google Drive Link (if available) */}
              {detailForm.driveLink && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 14px', marginTop: 14,
                  background: 'rgba(16,185,129,0.08)',
                  border: '1px solid rgba(16,185,129,0.3)',
                  borderRadius: 10
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                  </svg>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, color: '#10b981', fontWeight: 600 }}>Folder Google Drive</div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{detailForm.driveLink}</div>
                  </div>
                  <a
                    href={detailForm.driveLink} target="_blank" rel="noopener noreferrer"
                    style={{
                      flexShrink: 0, padding: '5px 10px',
                      background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.4)',
                      borderRadius: 7, color: '#10b981', fontSize: 12, fontWeight: 700,
                      textDecoration: 'none', whiteSpace: 'nowrap'
                    }}
                  >Buka ↗</a>
                </div>
              )}

              {/* Action Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 18, borderTop: '1px solid var(--border-color)', paddingTop: 18 }}>
                <button
                  onClick={() => setDeleteConfirmPending(true)}
                  title="Hapus Booking"
                  className="btn btn-danger"
                  style={{
                    flexShrink: 0, width: 42, height: 42,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    borderRadius: 10, cursor: 'pointer', padding: 0
                  }}
                >
                  <Trash2 size={18} />
                </button>

                <div style={{ flex: 1 }} />

                <button
                  className="btn btn-ghost"
                  onClick={() => { setDetailBookingId(null); setDetailForm(null); }}
                  style={{ height: 42, padding: '0 22px', fontSize: 14 }}
                >Batal</button>

                <button
                  className="btn btn-primary"
                  onClick={saveEditedBooking}
                  style={{ height: 42, padding: '0 32px', fontSize: 14, fontWeight: 700 }}
                >Simpan</button>
              </div>

            </div>
          </div>
        );
      })()}

      {/* MODAL KONFIRMASI HAPUS */}
      {deleteConfirmPending && (
        <div className="modal-overlay" style={{ zIndex: 1100 }} onMouseDown={(e) => { if (e.target === e.currentTarget) setDeleteConfirmPending(false); }}>
          <div className="modal-content" style={{ maxWidth: 380, textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🗑️</div>
            <div className="modal-title" style={{ marginBottom: 8 }}>Hapus Booking?</div>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 24, lineHeight: 1.6 }}>
              Booking <strong style={{ color: 'var(--text-primary)' }}>{detailForm?.customerName}</strong> akan dihapus permanen dari jadwal.
            </p>
            <div className="modal-actions" style={{ justifyContent: 'center', gap: 12 }}>
              <button className="btn btn-ghost" onClick={() => setDeleteConfirmPending(false)} autoFocus>Batal</button>
              <button className="btn btn-danger" style={{ minWidth: 120 }} onClick={confirmDelete}>Ya, Hapus</button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST NOTIFIKASI */}
      {bookingToast && (
        <div style={{
          position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
          zIndex: 9990, display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 22px', borderRadius: 12,
          background: bookingToast.type === 'delete'
            ? 'linear-gradient(135deg, #7f1d1d, #991b1b)'
            : 'linear-gradient(135deg, #065f46, #047857)',
          border: `1px solid ${bookingToast.type === 'delete' ? '#ef4444' : '#10b981'}`,
          boxShadow: '0 8px 28px rgba(0,0,0,0.15)',
          minWidth: 260, maxWidth: 440,
        }}>
          <span style={{ fontSize: 18 }}>{bookingToast.type === 'delete' ? '🗑️' : '✅'}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{bookingToast.message}</span>
          <button onClick={() => setBookingToast(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
        </div>
      )}

    </div>
  );
};

export default Timeline;
