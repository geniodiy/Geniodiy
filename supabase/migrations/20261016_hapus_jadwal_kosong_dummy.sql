-- Hapus 4 baris jadwal kosong contoh (dibuat 12 Oct 2026 lewat 20261012_tutor_jadwal_kosong_dummy.sql) milik
-- Finda Triarsa, atas permintaan pemilik 16 Oct 2026. Isi sebelumnya: selasa 09-12, kamis 13-17, sabtu 08-12, minggu 14-17.
-- jadwal_kosong_at dikosongkan supaya pengingat "Atur jadwal kosong" muncul lagi di Beranda tutor.
delete from public.tutor_jadwal_kosong where id in ('9e460b82-8af9-4dc6-8bbd-58ba03633b91','7802504a-48b1-4003-824d-b797c17238b1',
  'b01f3891-db9a-4b07-9687-3686b0d5220f','22ef40e8-eca7-4910-915c-08a3cbb08376');
update public.tutor_profile set jadwal_kosong_at = null where user_id = 'cf6e92a3-4711-4750-a6b8-fb4208171f1f';
