-- Catatan pengiriman laporan belajar ke orang tua (tab "Kirim laporan" di Presensi).
-- Satu baris per pertemuan yang sudah ditandai terkirim. "Batalkan tanda" menghapus barisnya,
-- jadi pertemuan itu ikut lagi di kiriman berikutnya. Hanya kepala unit (unitnya sendiri),
-- manajer, dan super admin yang bisa melihat dan menandai.
-- Diterapkan di GDIY 9 Okt 2026 dalam beberapa bagian (tabel, FK, tiap policy terpisah) karena batas waktu MCP.
set statement_timeout = '30s';
set lock_timeout = '10s';

create table if not exists public.laporan_kirim (
  id uuid primary key default gen_random_uuid(),
  presensi_id uuid not null references public.presensi(id) on delete cascade,
  dikirim_at timestamptz not null default now(),
  dikirim_oleh uuid references public.users(id) on delete set null default auth.uid(),
  cara text not null default 'satuan' check (cara in ('satuan', 'rekap')),
  mode text not null default 'link' check (mode in ('link', 'file')),
  isi text not null default 'per_pertemuan' check (isi in ('per_pertemuan', 'rekap')),
  rekap_url text,
  constraint uq_laporan_kirim_presensi unique (presensi_id)
);

alter table public.laporan_kirim enable row level security;

drop policy if exists laporan_kirim_select on public.laporan_kirim;
create policy laporan_kirim_select on public.laporan_kirim for select using (
  public.is_manajemen()
  or (public.current_role_name() = 'kepala_unit' and exists (
    select 1 from public.presensi p where p.id = laporan_kirim.presensi_id and p.unit_id = public.current_unit_id()))
);

drop policy if exists laporan_kirim_insert on public.laporan_kirim;
create policy laporan_kirim_insert on public.laporan_kirim for insert with check (
  public.is_manajemen()
  or (public.current_role_name() = 'kepala_unit' and exists (
    select 1 from public.presensi p where p.id = laporan_kirim.presensi_id and p.unit_id = public.current_unit_id()))
);

drop policy if exists laporan_kirim_delete on public.laporan_kirim;
create policy laporan_kirim_delete on public.laporan_kirim for delete using (
  public.is_manajemen()
  or (public.current_role_name() = 'kepala_unit' and exists (
    select 1 from public.presensi p where p.id = laporan_kirim.presensi_id and p.unit_id = public.current_unit_id()))
);

grant select, insert, delete on public.laporan_kirim to authenticated;
