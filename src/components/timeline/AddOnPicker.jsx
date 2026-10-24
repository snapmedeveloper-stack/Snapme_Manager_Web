import { Minus, Plus } from 'lucide-react';
import { Button } from '../ui';
import { formatRupiah } from '../../utils/format';

/**
 * Daftar item tambahan dengan jumlah (− / +), sama dengan Snapme_Desktop. value = addOns booking
 * { [id]: { name, price, qty } }. onChange(item, delta) mengubah jumlah satu item; jumlah tidak bisa di bawah 0.
 */
export default function AddOnPicker({ items, value, onChange, disabled = false }) {
  return (
    <div className="tl-addons">
      {items.map((ao) => {
        const qty = value?.[ao.id]?.qty || 0;
        return (
          <div key={ao.id} className="tl-addon">
            <div className="tl-addon-text">
              <span className="tl-addon-name">{ao.name}</span>
              <span className="tl-addon-price num">{ao.price ? formatRupiah(ao.price) : 'Gratis'}</span>
            </div>
            <div className="tl-stepper">
              <Button
                size="sm"
                variant="ghost"
                iconOnly
                icon={Minus}
                aria-label={`Kurangi ${ao.name}`}
                disabled={disabled || qty <= 0}
                onClick={() => onChange(ao, -1)}
              />
              <span className="tl-stepper-qty num" aria-live="polite">
                {qty}
              </span>
              <Button
                size="sm"
                variant="ghost"
                iconOnly
                icon={Plus}
                aria-label={`Tambah ${ao.name}`}
                disabled={disabled}
                onClick={() => onChange(ao, 1)}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
