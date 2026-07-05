import React, { useState, useEffect } from 'react';
import { doc, collection, onSnapshot, addDoc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { Trash2, ArrowUp, ArrowDown, Camera, Box, Palette, Settings, GripVertical, ChevronUp, ChevronDown, Plus } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

const PRESET_COLORS = [
  '#000000', '#434343', '#666666', '#999999', '#b7b7b7', '#cccccc', '#d9d9d9', '#efefef', '#f3f3f3', '#ffffff',
  '#980000', '#ff0000', '#ff9900', '#ffff00', '#00ff00', '#00ffff', '#4a86e8', '#0000ff', '#9900ff', '#ff00ff',
  '#e6b8af', '#f4cccc', '#fce5cd', '#fff2cc', '#d9ead3', '#d0e0e3', '#c9daf8', '#cfe2f3', '#d9d2e9', '#ead1dc',
  '#dd7e6b', '#ea9999', '#f9cb9c', '#ffe599', '#b6d7a8', '#a2c4c9', '#a4c2f4', '#9fc5e8', '#b4a7d6', '#d5a6bd',
  '#cc4125', '#e06666', '#f6b26b', '#ffd966', '#93c47d', '#76a5af', '#6d9eeb', '#6fa8dc', '#8e7cc3', '#c27ba0',
  '#a61c00', '#cc0000', '#e69138', '#f1c232', '#6aa84f', '#45818e', '#3c78d8', '#3d85c6', '#674ea7', '#a64d79',
  '#85200c', '#990000', '#b45f06', '#bf9000', '#38761d', '#134f5c', '#1155cc', '#0b5394', '#351c75', '#741b47',
  '#5b0f00', '#660000', '#783f04', '#7f6000', '#274e13', '#0c343d', '#1c4587', '#073763', '#20124d', '#4c1130'
];

export default function Layanan({ user, orgId, userMeta, studioEnabled = {}, onToggleStudio, managerId }) {
  const isManager = userMeta?.role === 'manager';
  
  
  const [activeTab, setActiveTab] = useState('ruangan');
  const [showAddStudioModal, setShowAddStudioModal] = useState(false);
  const [showAddPhotoboothModal, setShowAddPhotoboothModal] = useState(false);
  const [showPackageModal, setShowPackageModal] = useState(false);
  const [showAddOnModal, setShowAddOnModal] = useState(false);

  // Accordion State
  const [expandedRows, setExpandedRows] = useState({});
  const toggleRow = (id) => {
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Drag and Drop Handler
  const onDragEnd = async (result) => {
    if (!result.destination) return;
    const { source, destination, type } = result;
    if (source.index === destination.index) return;

    let items = [];
    let collectionName = '';

    if (type === 'studio') {
      items = Array.from(studios);
      collectionName = 'studios';
    } else if (type === 'photobooth') {
      items = Array.from(photobooths);
      collectionName = 'photobooths';
    } else if (type === 'package') {
      items = Array.from(packages);
      collectionName = 'packages';
    } else if (type === 'addon') {
      items = Array.from(addOns);
      collectionName = 'add_ons';
    }

    const [reorderedItem] = items.splice(source.index, 1);
    items.splice(destination.index, 0, reorderedItem);

    // Optimistic update
    if (type === 'studio') setStudios(items);
    else if (type === 'photobooth') setPhotobooths(items);
    else if (type === 'package') setPackages(items);
    else if (type === 'addon') setAddOns(items);

    try {
      const batch = writeBatch(db);
      items.forEach((item, index) => {
        const docRef = doc(db, 'organizations', orgId, collectionName, item.id);
        batch.update(docRef, { order: index });
      });
      await batch.commit();
    } catch (error) {
      console.error('Error updating order:', error);
      alert('Gagal menyimpan urutan');
    }
  };


  const [studios, setStudios] = useState([]);
  const [newStudio, setNewStudio] = useState('');

  const [photobooths, setPhotobooths] = useState([]);
  const [newPhotobooth, setNewPhotobooth] = useState('');

  const [packages, setPackages] = useState([]);
  const [editingPackageId, setEditingPackageId] = useState(null);
  const [newPkgName, setNewPkgName] = useState('');
  const [newPkgPrice, setNewPkgPrice] = useState('');
  const [newPkgDuration, setNewPkgDuration] = useState(30);
  const [pkgColor, setPkgColor] = useState('#38bdf8');
  const [selectedPackageStudios, setSelectedPackageStudios] = useState({});
  const [selectedPackagePhotobooths, setSelectedPackagePhotobooths] = useState({});

  const [addOns, setAddOns] = useState([]);
  const [editingAddOnId, setEditingAddOnId] = useState(null);
  const [newAddOnName, setNewAddOnName] = useState('');
  const [newAddOnPrice, setNewAddOnPrice] = useState('');
  const [newAddOnImage, setNewAddOnImage] = useState('');
  const [newAddOnImageFile, setNewAddOnImageFile] = useState(null);
  const [selectedAddOnStudios, setSelectedAddOnStudios] = useState({});
  const [selectedAddOnPhotobooths, setSelectedAddOnPhotobooths] = useState({});
  const [isUploadingAddOn, setIsUploadingAddOn] = useState(false);

  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => {
    if (!orgId || (!isManager && userMeta?.role !== 'owner')) return;
    const colRef = collection(db, 'organizations', orgId, 'studios');
    const unsubscribe = onSnapshot(colRef, (snapshot) => {
      const st = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        if ((!managerId || data.managerId === managerId) && !data.archived) {
          st.push({ id: docSnap.id, name: data.name || docSnap.id, order: data.order || 0 });
        }
      });
      st.sort((a, b) => a.order - b.order);
      setStudios(st);
    });
    return () => unsubscribe();
  }, [orgId, isManager, userMeta?.role, managerId]);

  useEffect(() => {
    if (!orgId || (!isManager && userMeta?.role !== 'owner')) return;
    const colRef = collection(db, 'organizations', orgId, 'photobooths');
    const unsubscribe = onSnapshot(colRef, (snapshot) => {
      const pb = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        if ((!managerId || data.managerId === managerId) && !data.archived) {
          pb.push({ id: docSnap.id, name: data.name || docSnap.id, order: data.order || 0 });
        }
      });
      pb.sort((a, b) => a.order - b.order);
      setPhotobooths(pb);
    });
    return () => unsubscribe();
  }, [orgId, isManager, userMeta?.role, managerId]);

  useEffect(() => {
    if (!orgId || (!isManager && userMeta?.role !== 'owner')) return;
    const colRef = collection(db, 'organizations', orgId, 'packages');
    const unsubscribe = onSnapshot(colRef, (snapshot) => {
      const pkgs = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        if ((!managerId || data.managerId === managerId) && !data.archived) {
          pkgs.push({ id: docSnap.id, ...data, order: data.order || 0 });
        }
      });
      pkgs.sort((a, b) => a.order - b.order);
      setPackages(pkgs);
    });
    return () => unsubscribe();
  }, [orgId, isManager, userMeta?.role, managerId]);

  useEffect(() => {
    if (!orgId || (!isManager && userMeta?.role !== 'owner')) return;
    const colRef = collection(db, 'organizations', orgId, 'add_ons');
    const unsubscribe = onSnapshot(colRef, (snapshot) => {
      const items = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        if ((!managerId || data.managerId === managerId) && !data.archived) {
          items.push({ id: docSnap.id, ...data });
        }
      });
      setAddOns(items);
    });
    return () => unsubscribe();
  }, [orgId, isManager, userMeta?.role, managerId]);

  const handleAddStudio = async (e) => {
    e?.preventDefault();
    const sName = newStudio.trim();
    if (!sName) return;
    if (studios.find(s => s.name === sName)) { alert('Studio sudah ada!'); return; }
    
    try {
      await addDoc(collection(db, 'organizations', orgId, 'studios'), {
        name: sName,
        active: true,
        managerId: managerId || user.uid,
        timerEnabled: false,
        order: studios.length
      });
      setNewStudio('');
    } catch (err) {
      alert("Gagal Simpan Firebase: " + err.message);
    }
  };

  const handleDeleteStudio = (studioId, sName) => {
    setDeleteConfirm({ type: 'studio', id: studioId, name: sName });
  };

  const handleMoveStudio = async (index, direction) => {
    if (direction === -1 && index === 0) return;
    if (direction === 1 && index === studios.length - 1) return;

    // Clone array and assign explicit order based on current index
    const newStudios = studios.map((s, i) => ({ ...s, order: s.order !== undefined && s.order !== 0 ? s.order : i }));
    newStudios.sort((a, b) => a.order - b.order);

    // Swap elements
    const temp = newStudios[index];
    newStudios[index] = newStudios[index + direction];
    newStudios[index + direction] = temp;

    try {
      // Update all studios with their new index as order to guarantee distinct values
      await Promise.all(
        newStudios.map((s, i) => 
          updateDoc(doc(db, 'organizations', orgId, 'studios', s.id), { order: i })
        )
      );
    } catch (err) {
      alert("Gagal mengubah urutan: " + err.message);
    }
  };

  const handleAddPhotobooth = async (e) => {
    e?.preventDefault();
    const pbName = newPhotobooth.trim();
    if (!pbName) return;
    if (photobooths.find(p => p.name === pbName)) { alert('Photobooth sudah ada!'); return; }
    
    try {
      await addDoc(collection(db, 'organizations', orgId, 'photobooths'), {
        name: pbName,
        active: true,
        managerId: managerId || user.uid,
        order: photobooths.length
      });
      setNewPhotobooth('');
    } catch (err) {
      alert("Gagal Simpan Firebase: " + err.message);
    }
  };

  const handleDeletePhotobooth = (pbId, pbName) => {
    setDeleteConfirm({ type: 'photobooth', id: pbId, name: pbName });
  };

  const handleMovePhotobooth = async (index, direction) => {
    if (direction === -1 && index === 0) return;
    if (direction === 1 && index === photobooths.length - 1) return;

    const newPbs = photobooths.map((p, i) => ({ ...p, order: p.order !== undefined && p.order !== 0 ? p.order : i }));
    newPbs.sort((a, b) => a.order - b.order);

    const temp = newPbs[index];
    newPbs[index] = newPbs[index + direction];
    newPbs[index + direction] = temp;

    try {
      await Promise.all(
        newPbs.map((p, i) => 
          updateDoc(doc(db, 'organizations', orgId, 'photobooths', p.id), { order: i })
        )
      );
    } catch (err) {
      alert("Gagal mengubah urutan: " + err.message);
    }
  };

  const handleCheckboxChange = (sName) => {
    setSelectedPackageStudios(prev => ({
      ...prev,
      [sName]: !prev[sName]
    }));
  };

  const handlePhotoboothCheckboxChange = (pbName) => {
    setSelectedPackagePhotobooths(prev => ({
      ...prev,
      [pbName]: !prev[pbName]
    }));
  };

  const handleAddPackage = async (e) => {
    e?.preventDefault();
    const pkgName = newPkgName.trim();
    if (!pkgName) return;
    
    const selStudios = Object.keys(selectedPackageStudios).filter(k => selectedPackageStudios[k]);
    const selPhotobooths = Object.keys(selectedPackagePhotobooths).filter(k => selectedPackagePhotobooths[k]);
    
    try {
      if (editingPackageId) {
        await updateDoc(doc(db, 'organizations', orgId, 'packages', editingPackageId), {
          name: pkgName,
          price: Number(newPkgPrice) || 0,
          duration: Number(newPkgDuration) || 30,
          studios: selStudios,
          photobooths: selPhotobooths,
          color: pkgColor,
        });
        setEditingPackageId(null);
      } else {
        await addDoc(collection(db, 'organizations', orgId, 'packages'), {
          name: pkgName,
          price: Number(newPkgPrice) || 0,
          duration: Number(newPkgDuration) || 30,
          studios: selStudios,
          photobooths: selPhotobooths,
          color: pkgColor,
          managerId: managerId || user.uid,
          createdAt: new Date().toISOString(),
          order: packages.length
        });
      }
      setNewPkgName('');
      setNewPkgPrice('');
      setNewPkgDuration(30);
      setPkgColor('#38bdf8');
      setSelectedPackageStudios({});
      setSelectedPackagePhotobooths({});
    } catch (err) {
      alert("Gagal Firebase Paket: " + err.message);
    }
  };

  const handleEditPackage = (pkg) => {
    setEditingPackageId(pkg.id);
    setNewPkgName(pkg.name);
    setNewPkgPrice(pkg.price);
    setNewPkgDuration(pkg.duration || 30);
    setPkgColor(pkg.color || '#38bdf8');
    const selStudios = {};
    if (pkg.studios) {
      pkg.studios.forEach(s => selStudios[s] = true);
    }
    setSelectedPackageStudios(selStudios);

    const selPhotobooths = {};
    if (pkg.photobooths) {
      pkg.photobooths.forEach(p => selPhotobooths[p] = true);
    }
    setSelectedPackagePhotobooths(selPhotobooths);
    
    setShowPackageModal(true);
  };

  const handleCancelEdit = () => {
    setShowPackageModal(false);
    setEditingPackageId(null);
    setNewPkgName('');
    setNewPkgPrice('');
    setNewPkgDuration(30);
    setPkgColor('#38bdf8');
    setSelectedPackageStudios({});
    setSelectedPackagePhotobooths({});
  };

  const handleDeletePackage = (pkgId, pkgName) => {
    setDeleteConfirm({ type: 'package', id: pkgId, name: pkgName });
  };

  const handleMovePackage = async (index, direction) => {
    if (direction === -1 && index === 0) return;
    if (direction === 1 && index === packages.length - 1) return;

    // Clone array and assign explicit order based on current index
    const newPkgs = packages.map((p, i) => ({ ...p, order: p.order !== undefined && p.order !== 0 ? p.order : i }));
    newPkgs.sort((a, b) => a.order - b.order);

    // Swap elements
    const temp = newPkgs[index];
    newPkgs[index] = newPkgs[index + direction];
    newPkgs[index + direction] = temp;

    try {
      // Update all packages with their new index as order to guarantee distinct values
      await Promise.all(
        newPkgs.map((p, i) => 
          updateDoc(doc(db, 'organizations', orgId, 'packages', p.id), { order: i })
        )
      );
    } catch (err) {
      alert("Gagal mengubah urutan: " + err.message);
    }
  };

  const handleAddOnCheckboxChange = (sName) => {
    setSelectedAddOnStudios(prev => ({ ...prev, [sName]: !prev[sName] }));
  };

  const handleAddOnPhotoboothCheckboxChange = (pbName) => {
    setSelectedAddOnPhotobooths(prev => ({ ...prev, [pbName]: !prev[pbName] }));
  };

  const handleImageUploadAddOn = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setNewAddOnImageFile(file);
    setNewAddOnImage(URL.createObjectURL(file));
  };

  const handleAddAddOn = async (e) => {
    e?.preventDefault();
    const aoName = newAddOnName.trim();
    if (!aoName) return;

    setIsUploadingAddOn(true);
    let imageUrl = newAddOnImage;

    try {
      if (newAddOnImageFile) {
        const storageRef = ref(storage, `organizations/${orgId}/add_ons/${Date.now()}_${newAddOnImageFile.name}`);
        await uploadBytes(storageRef, newAddOnImageFile);
        imageUrl = await getDownloadURL(storageRef);
      }

      const selStudios = Object.keys(selectedAddOnStudios).filter(k => selectedAddOnStudios[k]);
      const selPhotobooths = Object.keys(selectedAddOnPhotobooths).filter(k => selectedAddOnPhotobooths[k]);
      
      if (editingAddOnId) {
        await updateDoc(doc(db, 'organizations', orgId, 'add_ons', editingAddOnId), {
          name: aoName,
          price: Number(newAddOnPrice) || 0,
          studios: selStudios,
          photobooths: selPhotobooths,
          image: imageUrl
        });
        setEditingAddOnId(null);
      } else {
        await addDoc(collection(db, 'organizations', orgId, 'add_ons'), {
          name: aoName,
          price: Number(newAddOnPrice) || 0,
          studios: selStudios,
          photobooths: selPhotobooths,
          image: imageUrl,
          managerId: managerId || user.uid,
          createdAt: new Date().toISOString()
        });
      }
      setNewAddOnName('');
      setNewAddOnPrice('');
      setNewAddOnImage('');
      setNewAddOnImageFile(null);
      setSelectedAddOnStudios({});
      setSelectedAddOnPhotobooths({});
    } catch (err) {
      alert("Gagal Firebase Item Tambahan: " + err.message);
    } finally {
      setIsUploadingAddOn(false);
    }
  };

  const handleEditAddOn = (ao) => {
    setEditingAddOnId(ao.id);
    setNewAddOnName(ao.name);
    setNewAddOnPrice(ao.price);
    setNewAddOnImage(ao.image || '');
    setNewAddOnImageFile(null);
    const selStudios = {};
    if (ao.studios) {
      ao.studios.forEach(s => selStudios[s] = true);
    }
    setSelectedAddOnStudios(selStudios);

    const selPhotobooths = {};
    if (ao.photobooths) {
      ao.photobooths.forEach(p => selPhotobooths[p] = true);
    }
    setSelectedAddOnPhotobooths(selPhotobooths);

    setShowAddOnModal(true);
  };

  const handleCancelEditAddOn = () => {
    setShowAddOnModal(false);
    setEditingAddOnId(null);
    setNewAddOnName('');
    setNewAddOnPrice('');
    setNewAddOnImage('');
    setNewAddOnImageFile(null);
    setSelectedAddOnStudios({});
    setSelectedAddOnPhotobooths({});
  };

  const handleDeleteAddOn = (aoId, aoName) => {
    setDeleteConfirm({ type: 'add_on', id: aoId, name: aoName });
  };

  const executeDelete = () => {
    if (!deleteConfirm) return;
    if (deleteConfirm.type === 'studio') {
      const docRef = doc(db, 'organizations', orgId, 'studios', deleteConfirm.id);
      updateDoc(docRef, { archived: true }).catch(e => alert("Gagal Firebase (Update): " + e.message));
    } else if (deleteConfirm.type === 'package') {
      const docRef = doc(db, 'organizations', orgId, 'packages', deleteConfirm.id);
      updateDoc(docRef, { archived: true }).catch(e => alert("Gagal Firebase Paket (Update): " + e.message));
    } else if (deleteConfirm.type === 'add_on') {
      const docRef = doc(db, 'organizations', orgId, 'add_ons', deleteConfirm.id);
      updateDoc(docRef, { archived: true }).catch(e => alert("Gagal Firebase Item Tambahan (Update): " + e.message));
    } else if (deleteConfirm.type === 'photobooth') {
      const docRef = doc(db, 'organizations', orgId, 'photobooths', deleteConfirm.id);
      updateDoc(docRef, { archived: true }).catch(e => alert("Gagal Firebase Photobooth (Update): " + e.message));
    }
    setDeleteConfirm(null);
  };

  return (
    <>
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="page-enter" style={{ height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
        
        

        {!isManager && userMeta?.role !== 'owner' ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'Outfit', fontSize: 18, marginTop: 100 }}>
            Akses Terbatas: Hanya Manager / Owner.
          </div>
        ) : (
          <div className="layanan-container" style={{ flexDirection: "column" }}>
            
            {/* SIDEBAR / LEFT PANEL */}
            <div className="layanan-topbar" style={{ display: "flex", gap: 12, padding: "20px 32px", borderBottom: "1px solid var(--border-subtle)", overflowX: "auto" }}>
              
              <button 
                onClick={() => setActiveTab('ruangan')}
                className={`layanan-topbar-btn ${activeTab === 'ruangan' ? 'active' : ''}`}
              >
                <span style={{ marginRight: 12, fontSize: 18 }}>🚪</span>
                Daftar Ruangan
              </button>

              <button 
                onClick={() => setActiveTab('photobooth')}
                className={`layanan-topbar-btn ${activeTab === 'photobooth' ? 'active' : ''}`}
              >
                <span style={{ marginRight: 12, fontSize: 18 }}>📸</span>
                Daftar Photobooth
              </button>

              <button 
                onClick={() => setActiveTab('paket')}
                className={`layanan-topbar-btn ${activeTab === 'paket' ? 'active' : ''}`}
              >
                <span style={{ marginRight: 12, fontSize: 18 }}>📸</span>
                Daftar Paket Layanan
              </button>

              <button 
                onClick={() => setActiveTab('addon')}
                className={`layanan-topbar-btn ${activeTab === 'addon' ? 'active' : ''}`}
              >
                <span style={{ marginRight: 12, fontSize: 18 }}>🛍️</span>
                Daftar Item Tambahan
              </button>

            </div>

            {/* CENTER PANEL */}
            <div className="layanan-content">
              
              {activeTab === 'ruangan' && (
                <div className="fade-in layanan-card">
                  <h4 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>Daftar Ruangan</h4>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24, lineHeight: 1.4 }}>Kelola ruangan fisik Anda yang akan digunakan sebagai lapis penjadwalan.</p>
                  


                  
                  <Droppable droppableId="studios" type="studio">
                    {(provided) => (
                      <div {...provided.droppableProps} ref={provided.innerRef} style={{ display: 'flex', flexDirection: 'column' }}>
                        {studios.length === 0 ? (
                          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 8, color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>Belum ada data ruangan.</div>
                        ) : studios.map((studio, index) => (
                          <Draggable key={studio.id} draggableId={studio.id} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                className={`layanan-list-item ${snapshot.isDragging ? 'dragging' : ''}`}
                                style={{
                                  ...provided.draggableProps.style,
                                  flexDirection: 'column', alignItems: 'stretch', padding: 0, overflow: 'hidden'
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', cursor: 'pointer' }} onClick={() => toggleRow(studio.id)}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <div {...provided.dragHandleProps} onClick={e => e.stopPropagation()} style={{ cursor: 'grab', color: 'var(--text-muted)', padding: '4px' }}>
                                      <GripVertical size={18} />
                                    </div>
                                    <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{studio.name}</span>
                                  </div>
                                  <div style={{ color: 'var(--text-muted)' }}>
                                    {expandedRows[studio.id] ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                  </div>
                                </div>
                                {expandedRows[studio.id] && (
                                  <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border-color)', background: 'var(--bg-base)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div 
                                      style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                                      onClick={() => onToggleStudio?.(studio.id)}
                                      title={studioEnabled[studio.id] ? 'Timer aktif — klik untuk nonaktifkan' : 'Timer nonaktif — klik untuk aktifkan'}
                                    >
                                      <span style={{ fontSize: 11, fontWeight: 600, color: studioEnabled[studio.id] ? '#10b981' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                        {studioEnabled[studio.id] ? 'Timer On' : 'Timer Off'}
                                      </span>
                                      <div style={{ 
                                        width: 36, height: 20, 
                                        background: studioEnabled[studio.id] ? '#10b981' : 'var(--bg-hover)', 
                                        borderRadius: 20, position: 'relative', 
                                        transition: 'all 0.3s',
                                        border: studioEnabled[studio.id] ? 'none' : '1px solid var(--border-active)'
                                      }}>
                                        <div style={{ 
                                          width: 16, height: 16, background: '#fff', borderRadius: '50%', 
                                          position: 'absolute', top: studioEnabled[studio.id] ? 2 : 1, 
                                          left: studioEnabled[studio.id] ? 18 : 2, 
                                          transition: 'all 0.3s', 
                                          boxShadow: '0 1px 3px rgba(0,0,0,0.2)' 
                                        }} />
                                      </div>
                                    </div>
                                    {userMeta?.role !== 'owner' && (
                                      <button onClick={() => handleDeleteStudio(studio.id, studio.name)} className="layanan-action-btn danger" style={{ gap: 6 }} title="Hapus"><Trash2 size={16} /> Hapus Ruangan</button>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                  {userMeta?.role !== 'owner' && (
                    <button onClick={() => setShowAddStudioModal(true)} style={{ width: '100%', marginTop: 16, padding: '14px', border: '1px dashed var(--border-active)', borderRadius: 12, background: 'transparent', color: 'var(--text-secondary)', fontWeight: 600, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, cursor: 'pointer', transition: 'all 0.2s' }} onMouseOver={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }} onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}>
                      <Plus size={18} /> Tambah Ruangan Baru
                    </button>
                  )}

                </div>
              )}

              {activeTab === 'photobooth' && (
                <div className="fade-in layanan-card">
                  <h4 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>Daftar Photobooth</h4>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24, lineHeight: 1.4 }}>Kelola photobooth Anda yang akan digunakan sebagai lapis penjadwalan mandiri.</p>
                  


                  
                  <Droppable droppableId="photobooths" type="photobooth">
                    {(provided) => (
                      <div {...provided.droppableProps} ref={provided.innerRef} style={{ display: 'flex', flexDirection: 'column' }}>
                        {photobooths.length === 0 ? (
                          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 8, color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>Belum ada data photobooth.</div>
                        ) : photobooths.map((pb, index) => (
                          <Draggable key={pb.id} draggableId={pb.id} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                className={`layanan-list-item ${snapshot.isDragging ? 'dragging' : ''}`}
                                style={{
                                  ...provided.draggableProps.style,
                                  flexDirection: 'column', alignItems: 'stretch', padding: 0, overflow: 'hidden'
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', cursor: 'pointer' }} onClick={() => toggleRow(pb.id)}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <div {...provided.dragHandleProps} onClick={e => e.stopPropagation()} style={{ cursor: 'grab', color: 'var(--text-muted)', padding: '4px' }}>
                                      <GripVertical size={18} />
                                    </div>
                                    <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{pb.name}</span>
                                  </div>
                                  <div style={{ color: 'var(--text-muted)' }}>
                                    {expandedRows[pb.id] ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                  </div>
                                </div>
                                {expandedRows[pb.id] && (
                                  <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border-color)', background: 'var(--bg-base)', display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                                    {userMeta?.role !== 'owner' && (
                                      <button onClick={() => handleDeletePhotobooth(pb.id, pb.name)} className="layanan-action-btn danger" style={{ gap: 6 }} title="Hapus"><Trash2 size={16} /> Hapus Photobooth</button>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                  {userMeta?.role !== 'owner' && (
                    <button onClick={() => setShowAddPhotoboothModal(true)} style={{ width: '100%', marginTop: 16, padding: '14px', border: '1px dashed var(--border-active)', borderRadius: 12, background: 'transparent', color: 'var(--text-secondary)', fontWeight: 600, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, cursor: 'pointer', transition: 'all 0.2s' }} onMouseOver={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }} onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}>
                      <Plus size={18} /> Tambah Photobooth Baru
                    </button>
                  )}

                </div>
              )}

              {activeTab === 'paket' && (
                <div className="fade-in layanan-card">
                  <h4 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>Daftar Paket Layanan</h4>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24, lineHeight: 1.4 }}>Bentuk dan mapping paket layanan fototgrafi sesuai dengan letak studio.</p>



                  
                  <Droppable droppableId="packages" type="package">
                    {(provided) => (
                      <div {...provided.droppableProps} ref={provided.innerRef} style={{ display: 'flex', flexDirection: 'column' }}>
                        {packages.length === 0 ? (
                          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 8, color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>Belum ada data paket.</div>
                        ) : packages.map((pkg, index) => (
                          <Draggable key={pkg.id} draggableId={pkg.id} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                className={`layanan-list-item ${snapshot.isDragging ? 'dragging' : ''}`}
                                style={{
                                  ...provided.draggableProps.style,
                                  flexDirection: 'column', alignItems: 'stretch', padding: 0, overflow: 'hidden',
                                  marginBottom: 8
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', cursor: 'pointer' }} onClick={() => toggleRow(pkg.id)}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                                    <div {...provided.dragHandleProps} onClick={e => e.stopPropagation()} style={{ cursor: 'grab', color: 'var(--text-muted)', padding: '4px' }}>
                                      <GripVertical size={18} />
                                    </div>
                                    <div style={{ width: 24, height: 24, borderRadius: '50%', background: pkg.color || '#38bdf8', boxShadow: '0 2px 8px rgba(0,0,0,0.2)', flexShrink: 0 }} />
                                    <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pkg.name}</span>
                                  </div>
                                  <div style={{ color: 'var(--text-muted)' }}>
                                    {expandedRows[pkg.id] ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                  </div>
                                </div>
                                {expandedRows[pkg.id] && (
                                  <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border-color)', background: 'var(--bg-base)', display: 'flex', flexDirection: 'column', gap: 16 }}>
                                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                      <span style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-subtle)', padding: '4px 8px', borderRadius: 6, fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
                                        {pkg.price ? `Rp ${pkg.price.toLocaleString('id-ID')}` : 'Belum di-set'}
                                      </span>
                                      <span style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-subtle)', padding: '4px 8px', borderRadius: 6, fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                                        {pkg.duration || 30} Menit
                                      </span>
                                      <span style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-subtle)', padding: '4px 8px', borderRadius: 6, fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <svg style={{ flexShrink: 0 }} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                                        <span>
                                          {(pkg.studios?.length > 0 || pkg.photobooths?.length > 0) ? (
                                            [...(pkg.studios || []).map(sId => studios.find(s => s.id === sId)?.name || sId), ...(pkg.photobooths || []).map(pId => photobooths.find(p => p.id === pId)?.name || pId)].join(', ')
                                          ) : 'Semua Studio & Photobooth'}
                                        </span>
                                      </span>
                                    </div>
                                    {userMeta?.role !== 'owner' && (
                                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, borderTop: '1px dashed var(--border-subtle)', paddingTop: 16 }}>
                                        <button onClick={() => handleEditPackage(pkg)} className="layanan-action-btn" style={{ color: '#3b82f6', gap: 6, fontWeight: 600 }}><Settings size={16} /> Edit Paket</button>
                                        <button onClick={() => handleDeletePackage(pkg.id, pkg.name)} className="layanan-action-btn danger" style={{ gap: 6 }} title="Hapus"><Trash2 size={16} /> Hapus Paket</button>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                  {userMeta?.role !== 'owner' && (
                    <button onClick={() => { handleCancelEdit(); setShowPackageModal(true); }} style={{ width: '100%', marginTop: 16, padding: '14px', border: '1px dashed var(--border-active)', borderRadius: 12, background: 'transparent', color: 'var(--text-secondary)', fontWeight: 600, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, cursor: 'pointer', transition: 'all 0.2s' }} onMouseOver={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }} onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}>
                      <Plus size={18} /> Tambah Paket Baru
                    </button>
                  )}

                </div>
              )}

              {activeTab === 'addon' && (
                <div className="fade-in layanan-card">
                  <h4 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>Daftar Item Tambahan</h4>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24, lineHeight: 1.4 }}>Kelola produk tambahan opsional untuk customer (mis: Extra Print, Soft Copy).</p>



                  
                  <Droppable droppableId="addons" type="addon">
                    {(provided) => (
                      <div {...provided.droppableProps} ref={provided.innerRef} style={{ display: 'flex', flexDirection: 'column' }}>
                        {addOns.length === 0 ? (
                          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 8, color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>Belum ada data item tambahan.</div>
                        ) : addOns.map((ao, index) => (
                          <Draggable key={ao.id} draggableId={ao.id} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                className={`layanan-list-item ${snapshot.isDragging ? 'dragging' : ''}`}
                                style={{
                                  ...provided.draggableProps.style,
                                  flexDirection: 'column', alignItems: 'stretch', padding: 0, overflow: 'hidden',
                                  marginBottom: 8
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', cursor: 'pointer' }} onClick={() => toggleRow(ao.id)}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                                    <div {...provided.dragHandleProps} onClick={e => e.stopPropagation()} style={{ cursor: 'grab', color: 'var(--text-muted)', padding: '4px' }}>
                                      <GripVertical size={18} />
                                    </div>
                                    {ao.image ? (
                                      <img src={ao.image} alt="" style={{ width: 32, height: 32, borderRadius: 6, objectFit: 'cover' }} />
                                    ) : (
                                      <div style={{ width: 32, height: 32, borderRadius: 6, background: 'var(--bg-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                                        <Camera size={16} />
                                      </div>
                                    )}
                                    <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ao.name}</span>
                                  </div>
                                  <div style={{ color: 'var(--text-muted)' }}>
                                    {expandedRows[ao.id] ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                  </div>
                                </div>
                                {expandedRows[ao.id] && (
                                  <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border-color)', background: 'var(--bg-base)', display: 'flex', flexDirection: 'column', gap: 16 }}>
                                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                      <span style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-subtle)', padding: '4px 8px', borderRadius: 6, fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
                                        {ao.price ? `Rp ${ao.price.toLocaleString('id-ID')}` : 'Gratis / Belum di-set'}
                                      </span>
                                      <span style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-subtle)', padding: '4px 8px', borderRadius: 6, fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <svg style={{ flexShrink: 0 }} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                                        <span>
                                          {(ao.studios?.length > 0 || ao.photobooths?.length > 0) ? (
                                            [...(ao.studios || []).map(sId => studios.find(s => s.id === sId)?.name || sId), ...(ao.photobooths || []).map(pId => photobooths.find(p => p.id === pId)?.name || pId)].join(', ')
                                          ) : 'Semua Studio & Photobooth'}
                                        </span>
                                      </span>
                                    </div>
                                    {userMeta?.role !== 'owner' && (
                                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, borderTop: '1px dashed var(--border-subtle)', paddingTop: 16 }}>
                                        <button onClick={() => handleEditAddOn(ao)} className="layanan-action-btn" style={{ color: '#3b82f6', gap: 6, fontWeight: 600 }}><Settings size={16} /> Edit Item</button>
                                        <button onClick={() => handleDeleteAddOn(ao.id, ao.name)} className="layanan-action-btn danger" style={{ gap: 6 }} title="Hapus"><Trash2 size={16} /> Hapus Item</button>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                  {userMeta?.role !== 'owner' && (
                    <button onClick={() => { handleCancelEditAddOn(); setShowAddOnModal(true); }} style={{ width: '100%', marginTop: 16, padding: '14px', border: '1px dashed var(--border-active)', borderRadius: 12, background: 'transparent', color: 'var(--text-secondary)', fontWeight: 600, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, cursor: 'pointer', transition: 'all 0.2s' }} onMouseOver={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }} onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}>
                      <Plus size={18} /> Tambah Item Tambahan
                    </button>
                  )}

                </div>
              )}

            </div>
          </div>
        )}
              </div>
      </DragDropContext>

      
      {showAddStudioModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 20 }} onClick={() => setShowAddStudioModal(false)}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 16, maxWidth: 400, width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.5)', animation: 'slideInRight 0.2s ease', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '32px 40px 16px', flexShrink: 0 }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>Tambah Ruangan</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.4 }}>Masukkan nama ruangan fisik yang akan ditambahkan.</div>
            </div>
            <form onSubmit={(e) => { handleAddStudio(e); setShowAddStudioModal(false); }} style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
              <div style={{ overflowY: 'auto', padding: '0 40px 24px' }}>
                <input type="text" placeholder="Nama ruangan (cth: Studio Atas)" value={newStudio} onChange={e => setNewStudio(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg-base)', border: '1px solid var(--border-active)', borderRadius: 8, padding: '12px 16px', color: 'var(--text-primary)', outline: 'none', fontSize: 14 }} autoFocus />
              </div>
              <div style={{ padding: '16px 40px', background: 'var(--bg-card)', borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: 12, flexShrink: 0 }}>
                <button type="button" onClick={() => setShowAddStudioModal(false)} style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>Batal</button>
                <button type="submit" disabled={!newStudio.trim()} style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: 'var(--accent-primary)', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 14, opacity: !newStudio.trim() ? 0.5 : 1 }}>Simpan</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAddPhotoboothModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 20 }} onClick={() => setShowAddPhotoboothModal(false)}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 16, maxWidth: 400, width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.5)', animation: 'slideInRight 0.2s ease', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '32px 40px 16px', flexShrink: 0 }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>Tambah Photobooth</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.4 }}>Masukkan nama photobooth baru.</div>
            </div>
            <form onSubmit={(e) => { handleAddPhotobooth(e); setShowAddPhotoboothModal(false); }} style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
              <div style={{ overflowY: 'auto', padding: '0 40px 24px' }}>
                <input type="text" placeholder="Nama photobooth" value={newPhotobooth} onChange={e => setNewPhotobooth(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg-base)', border: '1px solid var(--border-active)', borderRadius: 8, padding: '12px 16px', color: 'var(--text-primary)', outline: 'none', fontSize: 14 }} autoFocus />
              </div>
              <div style={{ padding: '16px 40px', background: 'var(--bg-card)', borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: 12, flexShrink: 0 }}>
                <button type="button" onClick={() => setShowAddPhotoboothModal(false)} style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>Batal</button>
                <button type="submit" disabled={!newPhotobooth.trim()} style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: 'var(--accent-primary)', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 14, opacity: !newPhotobooth.trim() ? 0.5 : 1 }}>Simpan</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPackageModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 20 }} onClick={() => { handleCancelEdit(); setShowPackageModal(false); }}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 16, maxWidth: 600, width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.5)', animation: 'slideInRight 0.2s ease', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '32px 40px 16px', flexShrink: 0 }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>{editingPackageId ? 'Edit Paket' : 'Tambah Paket Baru'}</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.4 }}>Isi detail paket layanan yang akan ditawarkan ke customer.</div>
            </div>
            
            <div style={{ overflowY: 'auto', padding: '0 40px 24px', display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
                                
                      <form 
                        onSubmit={async (e) => { await handleAddPackage(e); setShowPackageModal(false); }} 
                        onMouseDown={e => e.stopPropagation()}
                        id="package-form" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
                      >
                        <input 
                          type="text" placeholder="Nama Paket (cth: Prewedd Reguler)"
                          value={newPkgName} onChange={e => setNewPkgName(e.target.value)}
                          style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg-card)', border: '1px solid var(--border-active)', borderRadius: 8, padding: '12px 16px', color: 'var(--text-primary)', outline: 'none', fontSize: 14 }}
                        />
                        <div style={{ display: 'flex', gap: 16, width: '100%' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <input 
                              type="number" placeholder="Harga (IDR)"
                              value={newPkgPrice} onChange={e => setNewPkgPrice(e.target.value)}
                              style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg-card)', border: '1px solid var(--border-active)', borderRadius: 8, padding: '12px 16px', color: 'var(--text-primary)', outline: 'none', fontSize: 14 }}
                            />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <input 
                              type="number" placeholder="Durasi (Menit)"
                              value={newPkgDuration} onChange={e => setNewPkgDuration(e.target.value)}
                              style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg-card)', border: '1px solid var(--border-active)', borderRadius: 8, padding: '12px 16px', color: 'var(--text-primary)', outline: 'none', fontSize: 14 }}
                            />
                          </div>
                        </div>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <label style={{ fontSize: 13, color: '#cbd5e1', fontWeight: 500 }}>Warna Paket Layanan</label>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', background: 'var(--bg-card)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                            {PRESET_COLORS.map(color => (
                              <button
                                key={color}
                                type="button"
                                onClick={() => setPkgColor(color)}
                                style={{
                                  width: 24, height: 24, borderRadius: '50%',
                                  background: color,
                                  border: pkgColor === color ? '2px solid var(--text-primary)' : '1px solid var(--border-subtle)',
                                  outline: pkgColor === color ? '2px solid var(--accent-primary)' : 'none',
                                  cursor: 'pointer',
                                  transition: 'transform 0.1s',
                                  transform: pkgColor === color ? 'scale(1.15)' : 'scale(1)',
                                  padding: 0,
                                  boxShadow: pkgColor === color ? '0 0 8px rgba(0,0,0,0.4)' : 'none',
                                }}
                                title={color}
                              />
                            ))}
                          </div>
                        </div>

                        <div>
                          <label style={{ display: 'block', marginBottom: 10, fontSize: 13, color: '#cbd5e1', fontWeight: 500 }}>Berlaku di ruangan mana saja?</label>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                            {studios.map(studio => (
                              <label key={studio.id} style={{ 
                                display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer', 
                                background: selectedPackageStudios[studio.id] ? 'var(--accent-primary)' : 'var(--bg-card)', 
                                color: selectedPackageStudios[studio.id] ? '#fff' : 'var(--text-secondary)',
                                border: selectedPackageStudios[studio.id] ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                                padding: '8px 16px', borderRadius: 30, transition: 'all 0.2s', fontWeight: 500
                              }}>
                                <input type="checkbox" checked={selectedPackageStudios[studio.id] || false} onChange={() => handleCheckboxChange(studio.id)} style={{ display: 'none' }} />
                                {studio.name}
                              </label>
                            ))}
                            {studios.length === 0 && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Belum ada studio — paket akan berlaku di semua studio</span>}
                          </div>
                        </div>

                        {photobooths.length > 0 && (
                          <div style={{ marginTop: 8 }}>
                            <label style={{ display: 'block', marginBottom: 10, fontSize: 13, color: '#cbd5e1', fontWeight: 500 }}>Berlaku di photobooth mana saja?</label>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                              {photobooths.map(pb => (
                                <label key={pb.id} style={{ 
                                  display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer', 
                                  background: selectedPackagePhotobooths[pb.id] ? 'var(--accent-primary)' : 'var(--bg-card)', 
                                  color: selectedPackagePhotobooths[pb.id] ? '#fff' : 'var(--text-secondary)',
                                  border: selectedPackagePhotobooths[pb.id] ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                                  padding: '8px 16px', borderRadius: 30, transition: 'all 0.2s', fontWeight: 500
                                }}>
                                  <input type="checkbox" checked={selectedPackagePhotobooths[pb.id] || false} onChange={() => handlePhotoboothCheckboxChange(pb.id)} style={{ display: 'none' }} />
                                  {pb.name}
                                </label>
                              ))}
                            </div>
                          </div>
                        )}

                        
                      </form>
                    
            </div>

            <div style={{ padding: '16px 40px', background: 'var(--bg-card)', borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: 12, flexShrink: 0 }}>
              <button type="button" onClick={() => { handleCancelEdit(); setShowPackageModal(false); }} className="btn btn-ghost" style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>Batal</button>
              <button type="submit" form="package-form" className="btn btn-primary" style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: 'var(--accent-primary)', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 14, opacity: !newPkgName.trim() ? 0.5 : 1 }} disabled={!newPkgName.trim()}>{editingPackageId ? 'Simpan Perubahan' : 'Buat Paket Baru'}</button>
            </div>
          </div>
        </div>
      )}

      {showAddOnModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 20 }} onClick={() => { handleCancelEditAddOn(); setShowAddOnModal(false); }}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 16, maxWidth: 500, width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.5)', animation: 'slideInRight 0.2s ease', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '32px 40px 16px', flexShrink: 0 }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>{editingAddOnId ? 'Edit Item Tambahan' : 'Tambah Item Tambahan'}</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.4 }}>Isi detail item atau produk tambahan.</div>
            </div>
            
            <div style={{ overflowY: 'auto', padding: '0 40px 24px', display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
                                
                      <form 
                        onSubmit={async (e) => { await handleAddAddOn(e); setShowAddOnModal(false); }} 
                        onMouseDown={e => e.stopPropagation()}
                        id="addon-form" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
                      >
                        <input 
                          type="text" placeholder="Nama Produk (cth: Extra Cetak 4R)"
                          value={newAddOnName} onChange={e => setNewAddOnName(e.target.value)}
                          style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg-card)', border: '1px solid var(--border-active)', borderRadius: 8, padding: '12px 16px', color: 'var(--text-primary)', outline: 'none', fontSize: 14 }}
                        />
                        <input 
                          type="number" placeholder="Harga (IDR)"
                          value={newAddOnPrice} onChange={e => setNewAddOnPrice(e.target.value)}
                          style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg-card)', border: '1px solid var(--border-active)', borderRadius: 8, padding: '12px 16px', color: 'var(--text-primary)', outline: 'none', fontSize: 14 }}
                        />

                        <div>
                          <label style={{ fontSize: 13, color: '#cbd5e1', fontWeight: 500, marginBottom: 8, display: 'block' }}>Gambar Item</label>
                          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                            {newAddOnImage ? (
                              <div style={{ width: 64, height: 64, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
                                <img src={newAddOnImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              </div>
                            ) : (
                              <div style={{ width: 64, height: 64, borderRadius: 8, background: 'var(--bg-card)', border: '1px dashed var(--border-active)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>📸</div>
                            )}
                            <label style={{ cursor: 'pointer', background: 'var(--bg-hover)', padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                              Pilih Gambar
                              <input type="file" accept="image/*" onChange={handleImageUploadAddOn} style={{ display: 'none' }} />
                            </label>
                            {newAddOnImage && (
                              <button type="button" onClick={() => { setNewAddOnImage(''); setNewAddOnImageFile(null); }} className="layanan-action-btn danger" title="Hapus"><Trash2 size={16} /></button>
                            )}
                          </div>
                        </div>

                        <div>
                          <label style={{ display: 'block', marginBottom: 10, fontSize: 13, color: '#cbd5e1', fontWeight: 500 }}>Tersedia di ruangan mana saja?</label>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                            {studios.map(studio => (
                              <label key={studio.id} style={{ 
                                display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer', 
                                background: selectedAddOnStudios[studio.id] ? 'var(--accent-primary)' : 'var(--bg-card)', 
                                color: selectedAddOnStudios[studio.id] ? '#fff' : 'var(--text-secondary)',
                                border: selectedAddOnStudios[studio.id] ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                                padding: '8px 16px', borderRadius: 30, transition: 'all 0.2s', fontWeight: 500
                              }}>
                                <input type="checkbox" checked={selectedAddOnStudios[studio.id] || false} onChange={() => handleAddOnCheckboxChange(studio.id)} style={{ display: 'none' }} />
                                {studio.name}
                              </label>
                            ))}
                            {studios.length === 0 && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Belum ada studio — tersedia di semua studio</span>}
                          </div>
                        </div>

                        {photobooths.length > 0 && (
                          <div style={{ marginTop: 8 }}>
                            <label style={{ display: 'block', marginBottom: 10, fontSize: 13, color: '#cbd5e1', fontWeight: 500 }}>Tersedia di photobooth mana saja?</label>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                              {photobooths.map(pb => (
                                <label key={pb.id} style={{ 
                                  display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer', 
                                  background: selectedAddOnPhotobooths[pb.id] ? 'var(--accent-primary)' : 'var(--bg-card)', 
                                  color: selectedAddOnPhotobooths[pb.id] ? '#fff' : 'var(--text-secondary)',
                                  border: selectedAddOnPhotobooths[pb.id] ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                                  padding: '8px 16px', borderRadius: 30, transition: 'all 0.2s', fontWeight: 500
                                }}>
                                  <input type="checkbox" checked={selectedAddOnPhotobooths[pb.id] || false} onChange={() => handleAddOnPhotoboothCheckboxChange(pb.id)} style={{ display: 'none' }} />
                                  {pb.name}
                                </label>
                              ))}
                            </div>
                          </div>
                        )}

                        
                      </form>
                    
            </div>

            <div style={{ padding: '16px 40px', background: 'var(--bg-card)', borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: 12, flexShrink: 0 }}>
              <button type="button" onClick={() => { handleCancelEditAddOn(); setShowAddOnModal(false); }} className="btn btn-ghost" style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>Batal</button>
              <button type="submit" form="addon-form" className="btn btn-primary" style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: 'var(--accent-primary)', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 14, opacity: (!newAddOnName.trim() || isUploadingAddOn) ? 0.5 : 1 }} disabled={!newAddOnName.trim() || isUploadingAddOn}>{isUploadingAddOn ? 'Menyimpan...' : (editingAddOnId ? 'Simpan Perubahan' : 'Buat Item Tambahan')}</button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(4px)'
          }}
          onClick={() => setDeleteConfirm(null)}
        >
          <div
            style={{
              background: 'var(--bg-surface)', border: '1px solid var(--border-active)',
              borderRadius: 16, padding: '32px 40px', maxWidth: 400, width: '90%',
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
              animation: 'slideInRight 0.2s ease'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontSize: 28, marginBottom: 12 }}>🗑️</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
              Arsipkan {deleteConfirm.type === 'studio' ? 'Ruangan' : (deleteConfirm.type === 'package' ? 'Paket' : 'Item Tambahan')}?
            </div>
            <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 28, lineHeight: 1.5 }}>
              <strong style={{ color: 'var(--text-primary)' }}>"{deleteConfirm.name}"</strong> akan diarsipkan dan tidak muncul lagi di timeline.
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setDeleteConfirm(null)}
                style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600, fontSize: 14 }}
              >
                Batal
              </button>
              <button
                onClick={executeDelete}
                style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: '#ef4444', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 14, boxShadow: '0 4px 12px rgba(239,68,68,0.4)' }}
              >
                Ya, Arsipkan
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
