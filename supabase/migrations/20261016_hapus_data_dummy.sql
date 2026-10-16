-- Hapus data uji coba (16 Oct 2026, owner's choice "hapus semua sampai habis"): 5 tutor dummy (tutor1, tutor2, tutor33,
-- tutor4, tutor5 @genio.id) beserta semua datanya, ditambah kontrak siswa yang hanya dipegang tutor dummy, tagihan,
-- kuitansi, pemasukan lain, siswa dan orang tua uji coba. Cadangan seluruh baris: supabase/backups/20261016_hapus_data_dummy.json.
-- Tetap: Ibu Patrisia (Giselle, Gwyneth) beserta tutor dan tagihannya, akun kepala unit/HRD/manajer, operasional.
set lock_timeout = '5s';
create temp table _d on commit drop as select id from public.users
  where email in ('tutor1@genio.id','tutor2@genio.id','tutor33@genio.id','tutor4@genio.id','tutor5@genio.id') and role = 'tutor';
create temp table _s on commit drop as select distinct ks.siswa_id id from public.kontrak_siswa ks
  join public.kontrak_tutor kt on kt.kontrak_siswa_id = ks.id where kt.tutor_id in (select id from _d);
create temp table _ks on commit drop as select id from public.kontrak_siswa where siswa_id in (select id from _s);
create temp table _o on commit drop as select distinct orangtua_id id from public.siswa where id in (select id from _s);
create temp table _kt on commit drop as select id from public.kontrak_tutor
  where kontrak_siswa_id in (select id from _ks) or tutor_id in (select id from _d);
create temp table _inv on commit drop as select id from public.invoice where kontrak_siswa_id in (select id from _ks);
delete from public.pemasukan_lain where orangtua_id in (select id from _o) or invoice_id in (select id from _inv);
delete from public.receipt where invoice_id in (select id from _inv);
delete from public.invoice where id in (select id from _inv);              -- presensi.invoice_id ikut jadi null
delete from public.presensi where kontrak_tutor_id in (select id from _kt); -- laporan_kirim ikut terhapus (cascade)
delete from public.kontrak_tutor where id in (select id from _kt);          -- jadwal ikut terhapus (cascade)
delete from public.kontrak_siswa where id in (select id from _ks);
delete from public.siswa where id in (select id from _s);
delete from public.orangtua where id in (select id from _o);
delete from public.slip_gaji where tutor_id in (select id from _d);
delete from public.users where id in (select id from _d);                   -- tutor_profile, jadwal kosong ikut (cascade)
delete from auth.users where id in (select id from _d);                     -- akun login (identities ikut cascade)
-- Akun Auth yatim ckfd27@gmail.com (uji 11 Sep 2026, tanpa baris public.users), lalu email tutor Finda Triarsa
-- (finda@gmail.com) diganti ke ckfd27@gmail.com sesuai sheet lama.
delete from auth.users where lower(email) = 'ckfd27@gmail.com' and not exists (select 1 from public.users p where p.id = auth.users.id);
update auth.users set email = 'ckfd27@gmail.com', updated_at = now() where lower(email) = 'finda@gmail.com';
update auth.identities set identity_data = identity_data || '{"email":"ckfd27@gmail.com"}'::jsonb, updated_at = now()
  where provider = 'email' and user_id = (select id from auth.users where email = 'ckfd27@gmail.com');
update public.users set email = 'ckfd27@gmail.com' where lower(email) = 'finda@gmail.com' and role = 'tutor';
