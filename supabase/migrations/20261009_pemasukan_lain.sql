-- Pemasukan lain: biaya di luar sesi les (cetak modul, biaya tes, simulasi, dll.) yang dibebankan ke orang tua atau sekolah
-- dan ikut ditagih di invoice bulanan (menu Tagihan). Kategori bisa ditambah, diubah, dan dinonaktifkan oleh manajer.
-- Diterapkan di GDIY 9 Okt 2026.
set statement_timeout = '30s';
set lock_timeout = '10s';

-- 1. Kategori (diatur manajer di menu Pemasukan lain > Kategori)
create table if not exists public.pemasukan_kategori (
  id uuid primary key default gen_random_uuid(),
  nama text not null,
  ikon text not null default 'ph-tag',
  urutan integer not null default 0,
  aktif boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists uq_pemasukan_kategori_nama on public.pemasukan_kategori (lower(nama));
alter table public.pemasukan_kategori enable row level security;

drop policy if exists pemasukan_kategori_select on public.pemasukan_kategori;
create policy pemasukan_kategori_select on public.pemasukan_kategori for select using (public.current_role_name() in ('super_admin', 'manajer', 'kepala_unit', 'hrd'));
drop policy if exists pemasukan_kategori_write on public.pemasukan_kategori;
create policy pemasukan_kategori_write on public.pemasukan_kategori for all using (public.is_manajemen()) with check (public.is_manajemen());
grant select, insert, update, delete on public.pemasukan_kategori to authenticated;

insert into public.pemasukan_kategori (nama, ikon, urutan) values
  ('Cetak modul', 'ph-book-open-text', 1),
  ('Biaya tes', 'ph-exam', 2),
  ('Simulasi', 'ph-clipboard-text', 3),
  ('Lainnya', 'ph-dots-three-circle', 99)
on conflict do nothing;

-- 2. Transaksi pemasukan lain
create table if not exists public.pemasukan_lain (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id),
  orangtua_id uuid not null references public.orangtua(id) on delete restrict,
  siswa_id uuid references public.siswa(id) on delete set null,
  kategori_id uuid not null references public.pemasukan_kategori(id) on delete restrict,
  tanggal date not null default current_date,
  keterangan text not null,
  jumlah numeric not null default 1 check (jumlah > 0),
  harga_satuan numeric not null default 0 check (harga_satuan >= 0),
  nominal numeric generated always as (jumlah * harga_satuan) stored,
  status text not null default 'belum_lunas' check (status in ('belum_lunas', 'lunas')),
  tanggal_lunas timestamptz,
  invoice_id uuid references public.invoice(id) on delete set null,
  pdf_url text,
  input_oleh uuid references public.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_pemasukan_lain_tanggal on public.pemasukan_lain (tanggal);
create index if not exists idx_pemasukan_lain_ortu on public.pemasukan_lain (orangtua_id);
alter table public.pemasukan_lain enable row level security;

-- Sama dengan operasional: manajemen semua unit, kepala unit hanya unitnya sendiri
drop policy if exists pemasukan_lain_manajemen on public.pemasukan_lain;
create policy pemasukan_lain_manajemen on public.pemasukan_lain for all using (public.is_manajemen()) with check (public.is_manajemen());
drop policy if exists pemasukan_lain_kepala_unit on public.pemasukan_lain;
create policy pemasukan_lain_kepala_unit on public.pemasukan_lain for all
  using (public.current_role_name() = 'kepala_unit' and unit_id = public.current_unit_id())
  with check (public.current_role_name() = 'kepala_unit' and unit_id = public.current_unit_id());
grant select, insert, update, delete on public.pemasukan_lain to authenticated;

-- 3. Bukti foto wajib (sama seperti operasional). Ditambahkan 9 Okt 2026 saat tabel masih kosong.
alter table public.pemasukan_lain add column if not exists foto_url text;
alter table public.pemasukan_lain alter column foto_url set not null;
