-- Hapus sesi Sachie 31 Jul 2026 (KON-26210, tutor Malia) agar Juli sama dengan rekap web lama (owner's choice 16 Oct 2026).
-- Web lama tidak menghitung sesi ini (jadwal JAD-26341 tanpa kontrak), lapkeu menghitungnya.
-- Dijalankan owner di Supabase SQL Editor. Snapshot sebelum hapus:
--   presensi 2026-07-31 14:30 Unit 4, harga kontrak 70.000, nominal_dibayar 45.000, invoice 92ac2fb9-aa7b-4606-b3d7-289c8a9fd2f5
--   invoice  92ac2fb9-aa7b-4606-b3d7-289c8a9fd2f5 KON-26210 2026-07 urutan 1, 1 pertemuan, 70.000, lunas, 1 kuitansi
--   slip_gaji 7f4bcec0-e308-44f2-b682-88f726104d52 Malia 2026-07, 1 pertemuan, 45.000, sudah_dibayar
-- Setelahnya Juli: 125 sesi, omset 25.916.599, gaji 12.502.650 (sama dengan web lama).
begin;
alter table public.presensi disable trigger trg_presensi_lock_ditagih;
delete from public.laporan_kirim where presensi_id in (select id from public.presensi where invoice_id = '92ac2fb9-aa7b-4606-b3d7-289c8a9fd2f5');
delete from public.presensi where invoice_id = '92ac2fb9-aa7b-4606-b3d7-289c8a9fd2f5';
alter table public.presensi enable trigger trg_presensi_lock_ditagih;
delete from public.receipt where invoice_id = '92ac2fb9-aa7b-4606-b3d7-289c8a9fd2f5';
delete from public.invoice where id = '92ac2fb9-aa7b-4606-b3d7-289c8a9fd2f5';
delete from public.slip_gaji where id = '7f4bcec0-e308-44f2-b682-88f726104d52';
commit;
