-- Jadwal ikut durasi kontrak tutor (14 Oct 2026, permintaan pemilik):
-- jam_selesai setiap jadwal = jam_mulai + kontrak_tutor.durasi_menit. Dipanggil dari form kontrak tutor
-- (ModuleKontrak.html) setiap kali tutor disimpan, jadi mengubah durasi langsung mengubah jam selesai jadwalnya.
-- Kontrak tutor tanpa durasi (null) tidak disentuh. SECURITY INVOKER: RLS jadwal tetap berlaku
-- (kepala unit hanya unitnya, manajemen semua). Satu perintah SQL (isi plpgsql/multi-perintah timeout lewat MCP).
create or replace function public.sesuaikan_jadwal_durasi(p_kontrak_tutor_id uuid)
returns integer
language sql
set search_path to 'public'
as $$
  with up as (
    update public.jadwal j
    set jam_selesai = j.jam_mulai + make_interval(mins => kt.durasi_menit)
    from public.kontrak_tutor kt
    where kt.id = p_kontrak_tutor_id and j.kontrak_tutor_id = kt.id
      and kt.durasi_menit is not null and kt.durasi_menit > 0 and j.jam_mulai is not null
      and j.jam_selesai is distinct from (j.jam_mulai + make_interval(mins => kt.durasi_menit))
    returning 1
  )
  select count(*)::int from up;
$$;
revoke execute on function public.sesuaikan_jadwal_durasi(uuid) from public, anon;
grant execute on function public.sesuaikan_jadwal_durasi(uuid) to authenticated;

-- Penyesuaian data lama (14 Oct 2026), dua jadwal yang belum cocok dengan durasinya:
--   jadwal c5f584f0-8c91-4b1c-9082-921111f9952b (rabu 15:00, durasi 120): jam_selesai 16:30 -> 17:00
--   jadwal 7bd0f7ed-cbc1-488d-a566-8abb1e4e835d (selasa 14:00, durasi 60): jam_selesai 15:30 -> 15:00
-- select public.sesuaikan_jadwal_durasi('83ed09c6-9505-4bd7-8750-72e17346d948');
-- select public.sesuaikan_jadwal_durasi('719eddf2-5db0-4a3b-b6ff-98016a27394b');
-- Kembalikan bila perlu:
-- update public.jadwal set jam_selesai = '16:30' where id = 'c5f584f0-8c91-4b1c-9082-921111f9952b';
-- update public.jadwal set jam_selesai = '15:30' where id = '7bd0f7ed-cbc1-488d-a566-8abb1e4e835d';
