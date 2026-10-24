// Helper form booking (tambah & detail).

/** Ubah jumlah satu item tambahan di form booking. Pemakaian: onChange={changeAddOnQty(setForm)}. */
export const changeAddOnQty = (setForm) => (ao, delta) =>
  setForm((prev) => {
    const currentQty = prev.addOns?.[ao.id]?.qty || 0;
    if (delta < 0 && currentQty <= 0) return prev;
    return { ...prev, addOns: { ...prev.addOns, [ao.id]: { name: ao.name, price: ao.price, qty: currentQty + delta } } };
  });

/** Ruangan ini photobooth? */
export const isPhotoboothId = (photobooths, placeId) => photobooths.some((p) => p.id === placeId);
