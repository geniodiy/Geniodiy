-- Jadwal kosong tutor: tutor mengisi kapan ia bisa mengajar (blok 30 menit, 07.00-21.00) lewat "Atur jadwal kosong";
-- manajer, super admin, kepala unit, dan HRD melihatnya di menu "Jadwal Kosong Tutor" (dikurangi jadwal mengajar).
-- Diterapkan di GDIY 12 Okt 2026.
set statement_timeout = '30s';
set lock_timeout = '10s';

-- 1. Rentang waktu kosong per hari (blok yang berdampingan digabung jadi satu baris)
create table if not exists public.tutor_jadwal_kosong (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null default auth.uid() references public.users(id) on delete cascade,
  hari text not null check (hari in ('senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu', 'minggu')),
  jam_mulai time not null,
  jam_selesai time not null,
  created_at timestamptz not null default now(),
  check (jam_selesai > jam_mulai)
);
create index if not exists idx_tutor_jadwal_kosong_tutor on public.tutor_jadwal_kosong (tutor_id);
alter table public.tutor_jadwal_kosong enable row level security;
drop policy if exists tutor_jadwal_kosong_tutor on public.tutor_jadwal_kosong;
create policy tutor_jadwal_kosong_tutor on public.tutor_jadwal_kosong for all
  using (public.current_role_name() = 'tutor' and tutor_id = auth.uid())
  with check (public.current_role_name() = 'tutor' and tutor_id = auth.uid());
drop policy if exists tutor_jadwal_kosong_staff_select on public.tutor_jadwal_kosong;
create policy tutor_jadwal_kosong_staff_select on public.tutor_jadwal_kosong for select
  using (public.current_role_name() in ('super_admin', 'manajer', 'kepala_unit', 'hrd'));
grant select, insert, update, delete on public.tutor_jadwal_kosong to authenticated;

-- 2. Kapan terakhir tutor memperbarui jadwal kosongnya (tetap terisi walau semua blok dikosongkan)
alter table public.tutor_profile add column if not exists jadwal_kosong_at timestamptz;

-- 3. Simpan sekaligus (hapus lama + isi baru + catat waktu) dalam satu perintah (CTE), jadi atomik; SECURITY INVOKER
--    jadi RLS tetap berlaku. Ditulis sebagai fungsi SQL satu perintah (bukan plpgsql) karena alat migrasi memecah di ';'.
--    Mengembalikan jumlah baris yang disimpan; peran selain tutor tidak mengubah apa pun.
create or replace function public.simpan_jadwal_kosong(p_slots jsonb) returns integer language sql security invoker set search_path = public as $$
  with del as (
    delete from public.tutor_jadwal_kosong where tutor_id = auth.uid() and public.current_role_name() = 'tutor' returning 1
  ), ins as (
    insert into public.tutor_jadwal_kosong (tutor_id, hari, jam_mulai, jam_selesai)
    select auth.uid(), s->>'hari', (s->>'jam_mulai')::time, (s->>'jam_selesai')::time
    from jsonb_array_elements(coalesce(p_slots, '[]'::jsonb)) s
    where public.current_role_name() = 'tutor'
    returning 1
  ), prof as (
    insert into public.tutor_profile (user_id, jadwal_kosong_at)
    select auth.uid(), now() where public.current_role_name() = 'tutor'
    on conflict (user_id) do update set jadwal_kosong_at = excluded.jadwal_kosong_at
    returning 1
  )
  select (select count(*) from ins)::integer + 0 * (select count(*) from del)::integer + 0 * (select count(*) from prof)::integer
$$;
revoke all on function public.simpan_jadwal_kosong(jsonb) from public, anon;
grant execute on function public.simpan_jadwal_kosong(jsonb) to authenticated;
revoke all on public.tutor_jadwal_kosong from anon;

-- 4. Jam mengajar yang sudah terisi (kontrak aktif, tanpa jadwal fleksibel). SECURITY DEFINER karena kepala unit
--    hanya bisa membaca jadwal unitnya, padahal tutor bisa mengajar di unit lain. Hanya mengembalikan tutor + jam,
--    tanpa data siswa. Tutor hanya mendapat jam miliknya sendiri.
create or replace function public.tutor_jam_terisi()
returns table (tutor_id uuid, hari text, jam_mulai time, jam_selesai time)
language sql stable security definer set search_path = public as $$
  select kt.tutor_id, j.hari, j.jam_mulai, j.jam_selesai
  from public.jadwal j
  join public.kontrak_tutor kt on kt.id = j.kontrak_tutor_id
  left join public.kontrak_siswa ks on ks.id = kt.kontrak_siswa_id
  where coalesce(kt.status, 'aktif') = 'aktif' and coalesce(ks.status, 'aktif') = 'aktif'
    and j.hari <> 'fleksibel' and j.jam_selesai > j.jam_mulai
    and (public.current_role_name() in ('super_admin', 'manajer', 'kepala_unit', 'hrd')
         or (public.current_role_name() = 'tutor' and kt.tutor_id = auth.uid()));
$$;
revoke all on function public.tutor_jam_terisi() from public, anon;
grant execute on function public.tutor_jam_terisi() to authenticated;
