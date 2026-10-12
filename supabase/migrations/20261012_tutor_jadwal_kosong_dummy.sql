-- Data contoh (dummy) jadwal kosong untuk 4 tutor aktif, atas permintaan pemilik 12 Okt 2026, supaya menu
-- Jadwal Kosong Tutor bisa dicoba sebelum tutor mengisi sendiri. Diterapkan di GDIY 12 Okt 2026 pukul 14.06 UTC.
-- Jam dipilih supaya tidak bertabrakan dengan jadwal mengajar yang ada. Begitu tutor menyimpan "Atur jadwal kosong",
-- baris dummy miliknya otomatis terganti (simpan_jadwal_kosong mengganti semua baris tutor itu).
-- Untuk menghapus semua dummy yang belum diganti tutor:
--   delete from public.tutor_jadwal_kosong where created_at = '2026-10-12 14:06:31.901609+00';
--   update public.tutor_profile set jadwal_kosong_at = null where jadwal_kosong_at = '2026-10-12 14:06:39.635902+00';
insert into public.tutor_jadwal_kosong (tutor_id, hari, jam_mulai, jam_selesai) values
('106e0aaa-1a8d-47dd-a76e-35991f4a5471','senin','08:00','12:00'),   -- Agus Setiawan
('106e0aaa-1a8d-47dd-a76e-35991f4a5471','selasa','16:00','19:00'),
('106e0aaa-1a8d-47dd-a76e-35991f4a5471','rabu','13:00','18:00'),
('106e0aaa-1a8d-47dd-a76e-35991f4a5471','kamis','08:00','11:00'),
('106e0aaa-1a8d-47dd-a76e-35991f4a5471','sabtu','13:00','16:00'),
('75565af1-a1ba-4993-9456-a9290d136e85','senin','13:00','17:00'),   -- Dewi Anggraini
('75565af1-a1ba-4993-9456-a9290d136e85','rabu','08:00','12:00'),
('75565af1-a1ba-4993-9456-a9290d136e85','kamis','15:00','19:00'),
('75565af1-a1ba-4993-9456-a9290d136e85','jumat','15:00','18:00'),
('75565af1-a1ba-4993-9456-a9290d136e85','minggu','09:00','12:00'),
('cf6e92a3-4711-4750-a6b8-fb4208171f1f','selasa','09:00','12:00'),  -- Finda Triarsa
('cf6e92a3-4711-4750-a6b8-fb4208171f1f','kamis','13:00','17:00'),
('cf6e92a3-4711-4750-a6b8-fb4208171f1f','sabtu','08:00','12:00'),
('cf6e92a3-4711-4750-a6b8-fb4208171f1f','minggu','14:00','17:00'),
('27856c52-702e-4a86-ac9c-6f45809fc583','senin','18:00','21:00'),   -- Tono Wijaya
('27856c52-702e-4a86-ac9c-6f45809fc583','selasa','13:00','17:00'),
('27856c52-702e-4a86-ac9c-6f45809fc583','kamis','14:00','18:00'),
('27856c52-702e-4a86-ac9c-6f45809fc583','jumat','08:00','11:00'),
('27856c52-702e-4a86-ac9c-6f45809fc583','sabtu','15:00','20:00');
update public.tutor_profile set jadwal_kosong_at = now() where user_id in
  ('106e0aaa-1a8d-47dd-a76e-35991f4a5471','75565af1-a1ba-4993-9456-a9290d136e85','cf6e92a3-4711-4750-a6b8-fb4208171f1f','27856c52-702e-4a86-ac9c-6f45809fc583');
