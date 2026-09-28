-- Kontak bantuan untuk tutor (Beranda tutor: "Jadwal untuk isi presensi belum muncul?").
-- Tutor hanya boleh membaca baris users miliknya sendiri (users_select_self), jadi nama dan
-- nomor kepala unit diambil lewat fungsi ini. Hanya mengembalikan nama, unit, no_hp, dan jenis kelamin.
--   1. Kepala unit aktif dari unit tempat tutor punya kontrak aktif.
--   2. Kalau tutor belum punya kontrak aktif: manajer aktif yang punya nomor HP.
-- jenis_kelamin dipakai untuk sapaan: L = Mr., P = Ms.
drop function if exists public.tutor_kontak_bantuan();
create function public.tutor_kontak_bantuan()
returns table (user_id uuid, nama text, no_hp text, role text, unit_id uuid, nama_unit text, jenis_kelamin text)
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select u.id from public.users u
    where u.id = auth.uid() and u.role = 'tutor'
  ),
  my_units as (
    select distinct kt.unit_id from public.kontrak_tutor kt
    join me on me.id = kt.tutor_id
    where kt.status = 'aktif' and kt.unit_id is not null
  ),
  kepala as (
    select u.id, u.nama, u.no_hp, u.role, u.unit_id, un.nama_unit, u.jenis_kelamin
    from public.users u
    join my_units mu on mu.unit_id = u.unit_id
    left join public.units un on un.id = u.unit_id
    where u.role = 'kepala_unit' and u.status = 'aktif'
  )
  select * from kepala
  union all
  select u.id, u.nama, u.no_hp, u.role, null::uuid, null::text, u.jenis_kelamin
  from public.users u
  where exists (select 1 from me)
    and not exists (select 1 from kepala)
    and u.role = 'manajer' and u.status = 'aktif' and coalesce(u.no_hp, '') <> ''
  order by 6 nulls last, 2;
$$;

revoke all on function public.tutor_kontak_bantuan() from public, anon;
grant execute on function public.tutor_kontak_bantuan() to authenticated;
