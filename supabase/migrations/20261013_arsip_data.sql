-- Arsip data (13 Oct 2026, owner's choice): manajer dan super admin bisa "menghapus" orang tua/sekolah dan kontrak siswa.
-- Data tanpa riwayat (belum ada presensi, invoice, pemasukan lain) dihapus permanen.
-- Data yang sudah punya riwayat diarsipkan: disembunyikan dari daftar dan pilihan, statusnya dinonaktifkan
-- (jadwal ikut berhenti karena kontrak tutornya nonaktif), tetapi presensi, invoice, kwitansi, gaji dan laporan tetap utuh.
-- Pulihkan mengembalikan status persis seperti sebelum diarsipkan (arsip_status_lama).
-- Diuji 13 Oct 2026 di transaksi yang di-rollback: kepala unit ditolak, presensi pending ditolak, data tanpa riwayat
-- terhapus bersih, arsip orang tua menonaktifkan siswa/kontrak/kontrak tutor, pulihkan mengembalikan semua status.

-- Bagian 1: kolom
alter table public.orangtua add column if not exists diarsipkan_at timestamptz,
  add column if not exists diarsipkan_oleh uuid references public.users(id) on delete set null;
alter table public.siswa add column if not exists diarsipkan_at timestamptz,
  add column if not exists diarsipkan_oleh uuid references public.users(id) on delete set null,
  add column if not exists arsip_status_lama text;
alter table public.kontrak_siswa add column if not exists diarsipkan_at timestamptz,
  add column if not exists diarsipkan_oleh uuid references public.users(id) on delete set null,
  add column if not exists arsip_status_lama text;
alter table public.kontrak_tutor add column if not exists arsip_status_lama text;

-- Bagian 2: ringkasan riwayat sebelum menghapus (dipakai popup hapus). SECURITY INVOKER: RLS tetap berlaku.
create or replace function public.arsip_cek(p_jenis text, p_id uuid)
returns jsonb
language sql
stable
set search_path to 'public'
as $$
  with ks as (
    select k.id from public.kontrak_siswa k
    where (p_jenis = 'kontrak' and k.id = p_id)
       or (p_jenis = 'ortu' and k.siswa_id in (select s.id from public.siswa s where s.orangtua_id = p_id))
  ), kt as (
    select t.id from public.kontrak_tutor t where t.kontrak_siswa_id in (select id from ks)
  ), pr as (
    select p.id, p.status, p.tanggal, t.kontrak_siswa_id
    from public.presensi p join public.kontrak_tutor t on t.id = p.kontrak_tutor_id
    where p.kontrak_tutor_id in (select id from kt)
  )
  select jsonb_build_object(
    'ada', case when p_jenis = 'kontrak' then exists (select 1 from public.kontrak_siswa where id = p_id)
                when p_jenis = 'ortu' then exists (select 1 from public.orangtua where id = p_id) else false end,
    'siswa', case when p_jenis = 'ortu' then (select count(*) from public.siswa where orangtua_id = p_id) else 0 end,
    'kontrak', (select count(*) from ks),
    'presensi', (select count(*) from pr),
    'presensi_pending', (select count(*) from pr where status = 'pending'),
    'belum_ditagih', (select count(*) from pr where status in ('diterima', 'visit')
                        and not exists (select 1 from public.invoice i where i.kontrak_siswa_id = pr.kontrak_siswa_id
                                        and i.periode = to_char(pr.tanggal, 'YYYY-MM'))),
    'invoice', (select count(*) from public.invoice where kontrak_siswa_id in (select id from ks)),
    'invoice_belum', (select count(*) from public.invoice where kontrak_siswa_id in (select id from ks) and status = 'belum_lunas'),
    'kwitansi', (select count(*) from public.receipt r join public.invoice i on i.id = r.invoice_id where i.kontrak_siswa_id in (select id from ks)),
    'pemasukan', case when p_jenis = 'ortu' then (select count(*) from public.pemasukan_lain where orangtua_id = p_id) else 0 end,
    'pemasukan_belum', case when p_jenis = 'ortu' then (select count(*) from public.pemasukan_lain where orangtua_id = p_id and status = 'belum_lunas') else 0 end
  );
$$;

-- Bagian 3: keputusan per data: 'hapus' (tanpa riwayat), 'arsip' (ada riwayat), atau 'tolak:<alasan>'.
-- Catatan: fungsi ditulis sebagai SQL satu perintah (CTE), karena isi plpgsql/multi-perintah selalu timeout lewat MCP.
create or replace function public.arsip_mode(p_jenis text, p_id uuid)
returns text
language sql
stable
set search_path to 'public'
as $$
  select case
    when not public.is_manajemen() then 'tolak:Hanya manajer dan super admin yang bisa menghapus data.'
    when p_jenis not in ('kontrak', 'ortu') then 'tolak:Jenis data tidak dikenal.'
    when not coalesce((c->>'ada')::boolean, false) then 'tolak:Data tidak ditemukan.'
    when (c->>'presensi_pending')::int > 0 then 'tolak:Masih ada ' || (c->>'presensi_pending') || ' presensi menunggu verifikasi. Setujui atau tolak dulu.'
    when (c->>'invoice_belum')::int > 0 then 'tolak:Masih ada ' || (c->>'invoice_belum') || ' tagihan belum lunas. Selesaikan dulu di menu Tagihan.'
    when (c->>'pemasukan_belum')::int > 0 then 'tolak:Masih ada ' || (c->>'pemasukan_belum') || ' pemasukan lain belum lunas. Selesaikan dulu.'
    when (c->>'presensi')::int = 0 and (c->>'invoice')::int = 0 and (c->>'pemasukan')::int = 0 then 'hapus'
    else 'arsip' end
  from (select public.arsip_cek(p_jenis, p_id) as c) x;
$$;

-- Bagian 4: hapus atau arsipkan. Mengembalikan 'dihapus', 'diarsipkan' atau 'tolak:<alasan>'.
-- Arsip menyimpan status lama (arsip_status_lama), kontrak aktif jadi selesai, kontrak tutor nonaktif (jadwal berhenti).
create or replace function public.arsip_data(p_jenis text, p_id uuid)
returns text
language sql
set search_path to 'public'
as $$
  with m as (
    select public.arsip_mode(p_jenis, p_id) as mode
  ), ks as (
    select k.id, k.diarsipkan_at from public.kontrak_siswa k
    where (p_jenis = 'kontrak' and k.id = p_id)
       or (p_jenis = 'ortu' and k.siswa_id in (select s.id from public.siswa s where s.orangtua_id = p_id))
  ), del_kt as (
    delete from public.kontrak_tutor where (select mode from m) = 'hapus' and kontrak_siswa_id in (select id from ks) returning 1
  ), del_ks as (
    delete from public.kontrak_siswa where (select mode from m) = 'hapus' and id in (select id from ks) returning 1
  ), del_sw as (
    delete from public.siswa where (select mode from m) = 'hapus' and p_jenis = 'ortu' and orangtua_id = p_id returning 1
  ), del_ot as (
    delete from public.orangtua where (select mode from m) = 'hapus' and p_jenis = 'ortu' and id = p_id returning 1
  ), up_kt as (
    update public.kontrak_tutor set arsip_status_lama = status, status = 'nonaktif'
    where (select mode from m) = 'arsip' and kontrak_siswa_id in (select id from ks where diarsipkan_at is null) returning 1
  ), up_ks as (
    update public.kontrak_siswa
    set arsip_status_lama = status, status = case when status = 'aktif' then 'selesai' else status end,
        diarsipkan_at = now(), diarsipkan_oleh = auth.uid()
    where (select mode from m) = 'arsip' and id in (select id from ks where diarsipkan_at is null) returning 1
  ), up_sw as (
    update public.siswa set arsip_status_lama = status, status = 'nonaktif', diarsipkan_at = now(), diarsipkan_oleh = auth.uid()
    where (select mode from m) = 'arsip' and p_jenis = 'ortu' and orangtua_id = p_id and diarsipkan_at is null returning 1
  ), up_ot as (
    update public.orangtua set diarsipkan_at = now(), diarsipkan_oleh = auth.uid()
    where (select mode from m) = 'arsip' and p_jenis = 'ortu' and id = p_id returning 1
  )
  select case m.mode when 'hapus' then 'dihapus' when 'arsip' then 'diarsipkan' else m.mode end
  from m
  where (select count(*) from del_kt) + (select count(*) from del_ks) + (select count(*) from del_sw) + (select count(*) from del_ot)
      + (select count(*) from up_kt) + (select count(*) from up_ks) + (select count(*) from up_sw) + (select count(*) from up_ot) >= 0;
$$;

-- Bagian 4b: pulihkan ke status sebelum diarsipkan. Orang tua memulihkan siswa dan kontrak yang ikut terarsip bersamanya
-- (diarsipkan_at sama); kontrak yang terarsip bersama orang tuanya hanya bisa dipulihkan lewat orang tuanya.
create or replace function public.pulihkan_data(p_jenis text, p_id uuid)
returns text
language sql
set search_path to 'public'
as $$
  with o as (
    select diarsipkan_at as t from public.orangtua where p_jenis = 'ortu' and id = p_id
  ), m as (
    select case
      when not public.is_manajemen() then 'tolak:Hanya manajer dan super admin yang bisa memulihkan data.'
      when p_jenis = 'kontrak' and not exists (select 1 from public.kontrak_siswa where id = p_id and diarsipkan_at is not null)
        then 'tolak:Kontrak ini tidak ada di arsip.'
      when p_jenis = 'kontrak' and exists (select 1 from public.kontrak_siswa k join public.siswa s on s.id = k.siswa_id where k.id = p_id and s.diarsipkan_at is not null)
        then 'tolak:Kontrak ini terarsip bersama orang tuanya. Pulihkan orang tuanya.'
      when p_jenis = 'ortu' and (select t from o) is null then 'tolak:Data ini tidak ada di arsip.'
      when p_jenis not in ('kontrak', 'ortu') then 'tolak:Jenis data tidak dikenal.'
      else 'ok' end as mode
  ), ks as (
    select k.id from public.kontrak_siswa k
    where (select mode from m) = 'ok'
      and ((p_jenis = 'kontrak' and k.id = p_id)
        or (p_jenis = 'ortu' and k.diarsipkan_at = (select t from o)
            and k.siswa_id in (select s.id from public.siswa s where s.orangtua_id = p_id)))
  ), up_kt as (
    update public.kontrak_tutor set status = coalesce(arsip_status_lama, status), arsip_status_lama = null
    where kontrak_siswa_id in (select id from ks) returning 1
  ), up_ks as (
    update public.kontrak_siswa set status = coalesce(arsip_status_lama, status), arsip_status_lama = null,
      diarsipkan_at = null, diarsipkan_oleh = null
    where id in (select id from ks) returning 1
  ), up_sw as (
    update public.siswa set status = coalesce(arsip_status_lama, status), arsip_status_lama = null,
      diarsipkan_at = null, diarsipkan_oleh = null
    where (select mode from m) = 'ok' and p_jenis = 'ortu' and orangtua_id = p_id and diarsipkan_at = (select t from o) returning 1
  ), up_ot as (
    update public.orangtua set diarsipkan_at = null, diarsipkan_oleh = null
    where (select mode from m) = 'ok' and p_jenis = 'ortu' and id = p_id returning 1
  )
  select case m.mode when 'ok' then 'dipulihkan' else m.mode end
  from m
  where (select count(*) from up_kt) + (select count(*) from up_ks) + (select count(*) from up_sw) + (select count(*) from up_ot) >= 0;
$$;

-- Bagian 5: hanya pengguna yang sudah masuk
revoke execute on function public.arsip_cek(text, uuid) from public, anon;
revoke execute on function public.arsip_mode(text, uuid) from public, anon;
revoke execute on function public.arsip_data(text, uuid) from public, anon;
revoke execute on function public.pulihkan_data(text, uuid) from public, anon;
grant execute on function public.arsip_cek(text, uuid) to authenticated;
grant execute on function public.arsip_mode(text, uuid) to authenticated;
grant execute on function public.arsip_data(text, uuid) to authenticated;
grant execute on function public.pulihkan_data(text, uuid) to authenticated;
