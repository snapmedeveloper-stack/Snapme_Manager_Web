import { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { Button, EmptyState, Select, Spinner } from '../ui';
import ActivityList from './ActivityList';
import { useLogRange } from './useLogData';
import { CATEGORY_LABEL, SOURCE_LABEL, buildActivityRows, matchesQuery, periodRange } from './logModel';

const PAGE = 300;
const PERIODS = [
  { value: 'hari', label: 'Hari ini' },
  { value: 'kemarin', label: 'Kemarin' },
  { value: '7hari', label: '7 hari' },
  { value: '30hari', label: '30 hari' },
];
// Kategori aktivitas yang bisa dipilih (error ada di menu Error)
const CATEGORIES = Object.keys(CATEGORY_LABEL).filter((c) => !['crash', 'log'].includes(c));

/**
 * Aktivitas (§7.2.3): daftar kronologis dengan cari, periode, kategori, PC, dan sumber. Periode & PC disaring di server;
 * kategori, sumber, dan kata kunci disaring dari catatan yang termuat (tombol "Muat lebih lama" menambah 300).
 */
export default function LogActivities({ orgId, managerId, devices, onOpenRow }) {
  const [period, setPeriod] = useState('hari');
  const [category, setCategory] = useState('');
  const [machineId, setMachineId] = useState('');
  const [source, setSource] = useState('');
  const [search, setSearch] = useState('');
  const [pages, setPages] = useState(1);
  const range = useMemo(() => periodRange(period), [period]);
  const data = useLogRange({
    orgId,
    type: 'activity',
    managerId,
    machineId: machineId || undefined,
    from: range.from,
    to: range.to,
    pageSize: PAGE * pages,
  });

  const rows = useMemo(() => {
    const docs = data.docs.filter(
      (d) => (!category || d.category === category) && (!source || d.source === source) && matchesQuery(d, search),
    );
    return buildActivityRows(docs);
  }, [data.docs, category, source, search]);

  const changePeriod = (value) => {
    setPeriod(value);
    setPages(1);
  };

  return (
    <>
      <div className="log-toolbar">
        <div className="log-search">
          <Search size={16} aria-hidden="true" />
          <input
            className="input"
            type="search"
            placeholder="Cari customer, no. transaksi, kalimat…"
            aria-label="Cari aktivitas"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              icon={X}
              aria-label="Hapus pencarian"
              onClick={() => setSearch('')}
            />
          )}
        </div>
        <div className="chip-row" role="group" aria-label="Periode">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              type="button"
              className={`chip${period === p.value ? ' is-active' : ''}`}
              aria-pressed={period === p.value}
              onClick={() => changePeriod(p.value)}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="chip-row" role="group" aria-label="Kategori">
          <button
            type="button"
            className={`chip${!category ? ' is-active' : ''}`}
            aria-pressed={!category}
            onClick={() => setCategory('')}
          >
            Semua
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              className={`chip${category === c ? ' is-active' : ''}`}
              aria-pressed={category === c}
              onClick={() => setCategory(c)}
            >
              {CATEGORY_LABEL[c]}
            </button>
          ))}
        </div>
        <div className="log-filters">
          <Select
            value={machineId}
            onChange={(v) => {
              setMachineId(v);
              setPages(1);
            }}
            aria-label="PC"
          >
            <option value="">Semua PC</option>
            {devices.map((d) => (
              <option key={d.id} value={d.id}>
                {d.machineName || d.id}
              </option>
            ))}
          </Select>
          <Select value={source} onChange={setSource} aria-label="Sumber">
            <option value="">Semua sumber</option>
            {Object.entries(SOURCE_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="page-body">
        {data.loading ? (
          <div className="page-loading">
            <Spinner size="lg" />
          </div>
        ) : data.error ? (
          <EmptyState title="Gagal memuat aktivitas" description={data.error} />
        ) : rows.length === 0 ? (
          <EmptyState
            title="Belum ada aktivitas pada periode ini"
            description="Ubah periode, kategori, atau kata kunci."
          />
        ) : (
          <>
            <ActivityList rows={rows} onOpen={onOpenRow} />
            {data.hasMore && (
              <Button block onClick={() => setPages((p) => p + 1)}>
                Muat lebih lama
              </Button>
            )}
          </>
        )}
      </div>
    </>
  );
}
