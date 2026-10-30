import { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Download,
  HandCoins,
  Settings2,
  TriangleAlert,
  UserRoundX,
  Wallet,
} from 'lucide-react';
import { Badge, Button, Card, EmptyState, Spinner, useConfirm, useToast } from '../ui';
import { formatRupiah } from '../../utils/format';
import { addMonths, formatMonth } from '../../utils/attendance';
import { transactionFee } from '../../utils/handlerFee';
import { writeInBackground } from '../../utils/firestoreWrite';
import { addBonus, deleteBonus, markPaid, savePayrollSettings, saveHandlers, unmarkPaid } from './gajiData';
import { downloadPayrollCsv, printPayslip } from './gajiExport';
import { buildPayroll, packageNamesOf, payrollSettingsFor, payrollTotals } from './gajiUtils';
import { STAFF_LABELS, labelsOf } from './staffLabels';
import { useGajiData } from './useGajiData';
import BonusForm from './BonusForm';
import HandlerForm from './HandlerForm';
import PayrollSettingsForm from './PayrollSettingsForm';
import PayslipSheet from './PayslipSheet';

const byOrder = (a, b) => (a.order ?? 0) - (b.order ?? 0);

/**
 * Gaji staff satu cabang per bulan kerja, dibayar awal bulan berikutnya: upah jam kerja (harga per jam × jam kerja di
 * Absensi) + uang makan (per hari jaga) + fee penanggung jawab paket + bonus (ditambah di rincian staff). Tarif &
 * fee paket diatur lewat tombol Atur;
 * rekap semua staff diunduh lewat tombol Rekap (CSV), slip per staff dari rinciannya (PDF lewat jendela cetak).
 * Owner menandai tiap staff sudah dibayar dan bisa mengoreksi penanggung jawab transaksi (termasuk transaksi berfee
 * yang belum ada penanggung jawabnya). data.records = catatan kerja cabang bulan ini (useTimData).
 * Cabang transaksi = cabang akun studio yang membuatnya (createdBy); pembuat tak dikenal tampil di semua cabang.
 */
export default function GajiSection({ orgId, user, managerId, month, onMonthChange, data, branches, accounts }) {
  const toast = useToast();
  const confirm = useConfirm();
  const gaji = useGajiData(orgId, managerId, month);
  const [openStaffId, setOpenStaffId] = useState(null);
  const [editingTx, setEditingTx] = useState(null);
  const [editingSettings, setEditingSettings] = useState(false);
  const [bonusFor, setBonusFor] = useState(null); // staff yang sedang ditambah bonusnya
  const payday = formatMonth(addMonths(month, 1));
  const settings = payrollSettingsFor(gaji.settingsDocs, month);
  const activePackages = gaji.packages.filter((p) => !p.archived).sort(byOrder);

  const branchOfUid = new Map(accounts.filter((a) => a.uid).map((a) => [a.uid, a.managerId]));
  const branchIds = new Set(branches.map((b) => b.managerId));
  const inBranch = (tx) => {
    const branch = branchOfUid.get(tx.createdBy) ?? (branchIds.has(tx.createdBy) ? tx.createdBy : null);
    return branch === null || branch === managerId;
  };
  const { rows, unassigned } = buildPayroll({
    ...gaji,
    staff: data.staff,
    records: data.records,
    settings,
    inBranch,
  });
  const totals = payrollTotals(rows);
  // Nominal tunjangan sudah diisi tetapi belum ada staff aktif berlabel itu: tunjangannya tidak akan masuk ke siapa pun
  const unlabeledRates = STAFF_LABELS.filter(
    (l) =>
      settings[l.settingKey] > 0 &&
      !data.staff.some((s) => s.active !== false && labelsOf(s).some((x) => x.key === l.key)),
  );
  const openRow = rows.find((r) => r.staff.id === openStaffId);
  const exportOptions = {
    month,
    settings,
    packages: gaji.packages,
    records: data.records,
    branchName: branches.find((b) => b.managerId === managerId)?.name,
  };

  const fail = (title) => (err) => toast.error(title, err.message, { persistent: true });

  const handleDownloadSlip = (row) => {
    if (!printPayslip(row, exportOptions))
      toast.error('Slip tidak bisa dibuka', 'Izinkan pop-up untuk situs ini, lalu coba lagi.');
  };

  const handleDownloadRecap = async () => {
    try {
      await downloadPayrollCsv(rows, exportOptions);
    } catch (err) {
      console.error('[Gaji] Gagal mengunduh rekap', err);
      toast.error('Gagal mengunduh rekap', err.message);
    }
  };

  const handleSaveSettings = (fields) => {
    writeInBackground(
      () => savePayrollSettings(orgId, user, { managerId, month, ...fields }),
      fail('Gagal menyimpan pengaturan gaji'),
    );
    toast.success(
      'Pengaturan gaji disimpan',
      `${formatRupiah(fields.hourlyRate)}/jam · makan ${formatRupiah(fields.mealAllowance)}/hari`,
    );
    setEditingSettings(false);
  };

  const handleMarkPaid = async (row) => {
    const ok = await confirm({
      title: `Tandai gaji ${row.staff.name} sudah dibayar?`,
      message: `${formatMonth(month)}: ${formatRupiah(row.total)} (jam kerja ${formatRupiah(row.hoursPay)} + makan ${formatRupiah(row.mealPay)} + tunjangan ${formatRupiah(row.allowanceTotal)} + fee ${formatRupiah(row.feeTotal)} + bonus ${formatRupiah(row.bonusTotal)}).`,
      confirmText: 'Tandai dibayar',
    });
    if (!ok) return;
    const slip = {
      month,
      staffId: row.staff.id,
      staffName: row.staff.name,
      managerId,
      hourlyRate: settings.hourlyRate,
      minutes: row.minutes,
      hours: row.hours,
      hoursPay: row.hoursPay,
      mealAllowance: settings.mealAllowance,
      days: row.days,
      mealPay: row.mealPay,
      feeTotal: row.feeTotal,
      allowances: row.allowances.map(({ key, rate, amount }) => ({ key, rate, amount })),
      allowanceTotal: row.allowanceTotal,
      feeCount: row.fees.length,
      bonusTotal: row.bonusTotal,
      bonusCount: row.bonuses.length,
      total: row.total,
    };
    writeInBackground(() => markPaid(orgId, user, slip), fail('Gagal menandai dibayar'));
    toast.success('Ditandai dibayar', `${row.staff.name} · ${formatRupiah(row.total)}`);
  };

  const handleUnmarkPaid = async (row) => {
    const ok = await confirm({
      title: 'Batalkan tanda dibayar?',
      message: `Gaji ${row.staff.name} ${formatMonth(month)} kembali tercatat belum dibayar dan dihitung ulang dari data terbaru.`,
      confirmText: 'Batalkan tanda',
      destructive: true,
    });
    if (ok) writeInBackground(() => unmarkPaid(orgId, month, row.staff.id), fail('Gagal membatalkan tanda dibayar'));
  };

  const handleAddBonus = ({ amount, note }) => {
    const person = bonusFor;
    writeInBackground(
      () => addBonus(orgId, user, { managerId, month, staffId: person.id, staffName: person.name, amount, note }),
      fail('Gagal menambah bonus'),
    );
    toast.success('Bonus ditambahkan', `${person.name} · ${formatRupiah(amount)}`);
    setBonusFor(null);
  };

  const handleDeleteBonus = async (bonus) => {
    const ok = await confirm({
      title: 'Hapus bonus?',
      message: `${bonus.note || 'Bonus'} ${formatRupiah(bonus.amount)} untuk ${bonus.staffName} dihapus dari gaji ${formatMonth(month)}.`,
      confirmText: 'Hapus',
      destructive: true,
    });
    if (ok) writeInBackground(() => deleteBonus(orgId, bonus.id), fail('Gagal menghapus bonus'));
  };

  const handleSaveHandlers = (fields) => {
    const tx = editingTx;
    writeInBackground(() => saveHandlers(orgId, user, tx.id, fields), fail('Gagal menyimpan penanggung jawab'));
    toast.success(
      'Penanggung jawab disimpan',
      fields.handlers.length ? fields.handlers.map((h) => h.name).join(', ') : 'Tanpa penanggung jawab',
    );
    setEditingTx(null);
  };

  return (
    <>
      <Card
        title={
          <>
            <Wallet size={18} aria-hidden="true" />
            Gaji
          </>
        }
        description={`Kerja selama ${formatMonth(month)} dibayar awal ${payday}.`}
        actions={
          <>
            <Button
              size="sm"
              icon={Download}
              disabled={gaji.loading || rows.length === 0}
              title="Unduh rekap gaji semua staff (Excel/CSV)"
              onClick={handleDownloadRecap}
            >
              Rekap
            </Button>
            <Button size="sm" icon={Settings2} disabled={gaji.loading} onClick={() => setEditingSettings(true)}>
              Atur
            </Button>
          </>
        }
      >
        <div className="tim-month-nav">
          <Button
            variant="ghost"
            iconOnly
            icon={ChevronLeft}
            aria-label="Bulan sebelumnya"
            onClick={() => onMonthChange(addMonths(month, -1))}
          />
          <span className="tim-month-label">{formatMonth(month)}</span>
          <Button
            variant="ghost"
            iconOnly
            icon={ChevronRight}
            aria-label="Bulan berikutnya"
            onClick={() => onMonthChange(addMonths(month, 1))}
          />
        </div>

        {gaji.loading ? (
          <div className="page-loading">
            <Spinner size="lg" />
          </div>
        ) : (
          <>
            {gaji.error && <p className="form-error">Sebagian data gagal dimuat: {gaji.error}</p>}
            {settings.month ? (
              <p className="tim-pay-rate num">
                {formatRupiah(settings.hourlyRate)}/jam · uang makan {formatRupiah(settings.mealAllowance)}/hari · Admin{' '}
                {formatRupiah(settings.adminAllowance)}/bulan · CS {formatRupiah(settings.csAllowance)}/hari hadir
                {settings.month !== month && (
                  <span className="tim-pay-muted"> (tarif sejak {formatMonth(settings.month)})</span>
                )}
              </p>
            ) : (
              <p className="tim-pay-warning">
                <TriangleAlert size={16} aria-hidden="true" />
                Harga per jam dan uang makan belum diatur. Ketuk Atur untuk mengisinya.
              </p>
            )}
            {unlabeledRates.length > 0 && (
              <p className="tim-pay-warning">
                <TriangleAlert size={16} aria-hidden="true" />
                Tunjangan {unlabeledRates.map((l) => l.label).join(' & ')} sudah diatur, tetapi belum ada staff dengan
                label itu. Pasang labelnya di Tim → Staff (ikon pensil pada nama staff).
              </p>
            )}

            {rows.length === 0 ? (
              <EmptyState icon={Wallet} title="Belum ada staff" description="Tambahkan staff dulu di bagian Staff." />
            ) : (
              <>
                <dl className="tim-pay-summary">
                  <div>
                    <dt>Jam kerja</dt>
                    <dd className="num">{formatRupiah(totals.hoursPay)}</dd>
                  </div>
                  <div>
                    <dt>Uang makan</dt>
                    <dd className="num">{formatRupiah(totals.mealPay)}</dd>
                  </div>
                  <div>
                    <dt>Tunjangan</dt>
                    <dd className="num">{formatRupiah(totals.allowanceTotal)}</dd>
                  </div>
                  <div>
                    <dt>Fee</dt>
                    <dd className="num">{formatRupiah(totals.feeTotal)}</dd>
                  </div>
                  <div>
                    <dt>Bonus</dt>
                    <dd className="num">{formatRupiah(totals.bonusTotal)}</dd>
                  </div>
                  <div className="is-total">
                    <dt>Total</dt>
                    <dd className="num">{formatRupiah(totals.total)}</dd>
                  </div>
                </dl>
                <p className="tim-pay-muted">
                  {totals.paid} dari {rows.length} staff sudah dibayar.
                </p>
                <ul className="tim-list">
                  {rows.map((row) => (
                    <li key={row.staff.id}>
                      <button
                        type="button"
                        className="tim-row tim-pay-row"
                        onClick={() => setOpenStaffId(row.staff.id)}
                      >
                        <span className="tim-row-main">
                          <span className={`tim-row-title${row.staff.active === false ? ' is-muted' : ''}`}>
                            {row.staff.name}
                          </span>
                          <span className="tim-row-meta num">
                            {labelsOf(row.staff).map((l) => `${l.label} · `)}
                            {row.hours} jam · {row.days} hari · Fee {formatRupiah(row.feeTotal)}
                            {row.bonusTotal > 0 && ` · Bonus ${formatRupiah(row.bonusTotal)}`}
                          </span>
                        </span>
                        <span className="tim-pay-side">
                          <span className="num tim-pay-amount">{formatRupiah(row.total)}</span>
                          {row.changed ? (
                            <Badge tone="warning" icon={TriangleAlert}>
                              Berubah
                            </Badge>
                          ) : row.payroll ? (
                            <Badge tone="success" icon={CircleCheck}>
                              Dibayar
                            </Badge>
                          ) : (
                            <Badge>Belum</Badge>
                          )}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </Card>

      {!gaji.loading && unassigned.length > 0 && (
        <Card
          title={
            <>
              <UserRoundX size={18} aria-hidden="true" />
              Belum ada penanggung jawab
            </>
          }
          description="Transaksi berpaket fee yang belum dipilih penanggung jawabnya. Fee-nya belum masuk ke gaji siapa pun."
        >
          <ul className="tim-list">
            {unassigned.map((tx) => (
              <li key={tx.id} className="tim-row">
                <span className="tim-row-main">
                  <span className="tim-row-title">{tx.customerName || 'Tanpa nama'}</span>
                  <span className="tim-row-meta">
                    {packageNamesOf(tx, gaji.packages)} · Fee{' '}
                    <span className="num">{formatRupiah(transactionFee(tx, gaji.packages))}</span>
                  </span>
                </span>
                <Button size="sm" icon={HandCoins} onClick={() => setEditingTx(tx)}>
                  Pilih
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {editingSettings && (
        <PayrollSettingsForm
          month={month}
          settings={settings}
          packages={activePackages}
          onSave={handleSaveSettings}
          onClose={() => setEditingSettings(false)}
        />
      )}
      {openRow && (
        <PayslipSheet
          key={openRow.staff.id}
          row={openRow}
          month={month}
          settings={settings}
          packages={gaji.packages}
          onEditHandlers={setEditingTx}
          onAddBonus={() => setBonusFor(openRow.staff)}
          onDeleteBonus={handleDeleteBonus}
          onDownload={() => handleDownloadSlip(openRow)}
          onMarkPaid={() => handleMarkPaid(openRow)}
          onUnmarkPaid={() => handleUnmarkPaid(openRow)}
          onClose={() => setOpenStaffId(null)}
        />
      )}
      {bonusFor && (
        <BonusForm staffName={bonusFor.name} month={month} onSave={handleAddBonus} onClose={() => setBonusFor(null)} />
      )}
      {editingTx && (
        <HandlerForm
          tx={editingTx}
          staff={data.staff}
          packages={gaji.packages}
          onSave={handleSaveHandlers}
          onClose={() => setEditingTx(null)}
        />
      )}
    </>
  );
}
