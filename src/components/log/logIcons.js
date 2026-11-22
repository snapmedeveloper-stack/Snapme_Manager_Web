// Ikon per kategori log (lucide-react). Dipisah dari logModel.js supaya logika murni bisa diuji tanpa React.
import { createElement } from 'react';
import {
  Bot,
  CalendarCheck,
  CalendarDays,
  CircleAlert,
  Cog,
  FileImage,
  FolderOpen,
  LayoutTemplate,
  MessageCircle,
  Monitor,
  Printer,
  Receipt,
  ScrollText,
  ShoppingCart,
  Sparkles,
  Zap,
} from 'lucide-react';

export const CATEGORY_ICON = {
  sistem: Monitor,
  booking: CalendarDays,
  timeline: CalendarDays,
  absensi: CalendarCheck,
  kasir: ShoppingCart,
  transaksi: Receipt,
  file: FolderOpen,
  print: Printer,
  template: LayoutTemplate,
  pasfoto: FileImage,
  wa: MessageCircle,
  bot: Bot,
  setting: Cog,
  auto: Zap,
  crash: CircleAlert,
  log: ScrollText,
};

/** Ikon kategori sebagai elemen (komponen ikonnya statis, dipilih dari peta di atas). */
export const CategoryIcon = ({ category, size = 16 }) =>
  createElement(CATEGORY_ICON[category] || Sparkles, { size, 'aria-hidden': true });
