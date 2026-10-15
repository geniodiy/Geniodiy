-- Paket belajar lengkap (16 Oct 2026, owner's choice): 78 kombinasi jenis x pelaksanaan x mode x jenjang
-- (Olimpiade, TKA, Reguler, Internasional untuk SD/SMP/SMA; UTBK hanya SMA; jenjang Lainnya tidak dipakai).
-- 44 paket dari sheet PROGRAM database lama (GENIO_SYSTEM) dengan harga, 34 kombinasi baru tanpa harga:
-- harga_default null = "Konfirmasi harga ke manajer" di aplikasi, diisi manajer lewat Edit paket.
-- Nama: "<Pelaksanaan> <Mode> <Jenis> <Jenjang>" (UTBK tanpa jenjang). Kode: inisial jenis + pelaksanaan + mode + _JENJANG.

-- Bagian 1: harga boleh kosong
alter table public.paket_belajar alter column harga_default drop not null;
alter table public.paket_belajar drop constraint if exists paket_belajar_harga_default_check;
alter table public.paket_belajar add constraint paket_belajar_harga_default_check check (harga_default is null or harga_default > 0);

-- Bagian 2: 4 paket lama diubah di tempat (kontrak tetap tersambung; harga kontrak tidak berubah karena tersimpan per kontrak).
-- Sebelum: P_REG_SD 'Reguler SD' 75000, P_REG_SMP 'Reguler SMP' 90000, P_REG_SMA 'Reguler SMA' 100000 (kategori kosong),
-- IPD_SD 'Persiapan UTBK' 150000 (Internasional, Privat, Daring, SD).
update public.paket_belajar set kode_paket = 'RPL_SD', nama_paket = 'Privat Luring Reguler SD', harga_default = 80000,
  jenjang = 'SD', jenis = 'Reguler', pelaksanaan = 'Privat', mode_belajar = 'Luring' where kode_paket = 'P_REG_SD';
update public.paket_belajar set kode_paket = 'RPL_SMP', nama_paket = 'Privat Luring Reguler SMP', harga_default = 90000,
  jenjang = 'SMP', jenis = 'Reguler', pelaksanaan = 'Privat', mode_belajar = 'Luring' where kode_paket = 'P_REG_SMP';
update public.paket_belajar set kode_paket = 'RPL_SMA', nama_paket = 'Privat Luring Reguler SMA', harga_default = 110000,
  jenjang = 'SMA', jenis = 'Reguler', pelaksanaan = 'Privat', mode_belajar = 'Luring' where kode_paket = 'P_REG_SMA';
update public.paket_belajar set nama_paket = 'Privat Daring Internasional SD', harga_default = 85000 where kode_paket = 'IPD_SD';

-- Bagian 3: sisa kombinasi (yang sudah ada, termasuk OPD_SMP dan RPD_SMA, dilewati)
insert into public.paket_belajar (kode_paket, nama_paket, harga_default, jenjang, jenis, pelaksanaan, mode_belajar, status)
select v.kode, v.nama, v.harga, v.jenjang, v.jenis, v.pelaksanaan, v.mode, 'aktif'
from (values
  ('OPL_SD', 'Privat Luring Olimpiade SD', 150000, 'SD', 'Olimpiade', 'Privat', 'Luring'),
  ('OPL_SMP', 'Privat Luring Olimpiade SMP', 175000, 'SMP', 'Olimpiade', 'Privat', 'Luring'),
  ('OPL_SMA', 'Privat Luring Olimpiade SMA', 225000, 'SMA', 'Olimpiade', 'Privat', 'Luring'),
  ('TPL_SD', 'Privat Luring TKA SD', 100000, 'SD', 'TKA', 'Privat', 'Luring'),
  ('TPL_SMP', 'Privat Luring TKA SMP', 120000, 'SMP', 'TKA', 'Privat', 'Luring'),
  ('TPL_SMA', 'Privat Luring TKA SMA', 150000, 'SMA', 'TKA', 'Privat', 'Luring'),
  ('RPL_SD', 'Privat Luring Reguler SD', 80000, 'SD', 'Reguler', 'Privat', 'Luring'),
  ('RPL_SMP', 'Privat Luring Reguler SMP', 90000, 'SMP', 'Reguler', 'Privat', 'Luring'),
  ('RPL_SMA', 'Privat Luring Reguler SMA', 110000, 'SMA', 'Reguler', 'Privat', 'Luring'),
  ('IPL_SD', 'Privat Luring Internasional SD', 100000, 'SD', 'Internasional', 'Privat', 'Luring'),
  ('IPL_SMP', 'Privat Luring Internasional SMP', 115000, 'SMP', 'Internasional', 'Privat', 'Luring'),
  ('IPL_SMA', 'Privat Luring Internasional SMA', 135000, 'SMA', 'Internasional', 'Privat', 'Luring'),
  ('UPL_SMA', 'Privat Luring UTBK', 150000, 'SMA', 'UTBK', 'Privat', 'Luring'),
  ('OPD_SD', 'Privat Daring Olimpiade SD', 135000, 'SD', 'Olimpiade', 'Privat', 'Daring'),
  ('OPD_SMP', 'Privat Daring Olimpiade SMP', 160000, 'SMP', 'Olimpiade', 'Privat', 'Daring'),
  ('OPD_SMA', 'Privat Daring Olimpiade SMA', 200000, 'SMA', 'Olimpiade', 'Privat', 'Daring'),
  ('TPD_SD', 'Privat Daring TKA SD', 85000, 'SD', 'TKA', 'Privat', 'Daring'),
  ('TPD_SMP', 'Privat Daring TKA SMP', 100000, 'SMP', 'TKA', 'Privat', 'Daring'),
  ('TPD_SMA', 'Privat Daring TKA SMA', 125000, 'SMA', 'TKA', 'Privat', 'Daring'),
  ('RPD_SD', 'Privat Daring Reguler SD', 50000, 'SD', 'Reguler', 'Privat', 'Daring'),
  ('RPD_SMP', 'Privat Daring Reguler SMP', 60000, 'SMP', 'Reguler', 'Privat', 'Daring'),
  ('RPD_SMA', 'Privat Daring Reguler SMA', 70000, 'SMA', 'Reguler', 'Privat', 'Daring'),
  ('IPD_SD', 'Privat Daring Internasional SD', 85000, 'SD', 'Internasional', 'Privat', 'Daring'),
  ('IPD_SMP', 'Privat Daring Internasional SMP', 100000, 'SMP', 'Internasional', 'Privat', 'Daring'),
  ('IPD_SMA', 'Privat Daring Internasional SMA', 120000, 'SMA', 'Internasional', 'Privat', 'Daring'),
  ('UPD_SMA', 'Privat Daring UTBK', null, 'SMA', 'UTBK', 'Privat', 'Daring'),
  ('OKL_SD', 'Kelompok Luring Olimpiade SD', 225000, 'SD', 'Olimpiade', 'Kelompok', 'Luring'),
  ('OKL_SMP', 'Kelompok Luring Olimpiade SMP', 255000, 'SMP', 'Olimpiade', 'Kelompok', 'Luring'),
  ('OKL_SMA', 'Kelompok Luring Olimpiade SMA', 330000, 'SMA', 'Olimpiade', 'Kelompok', 'Luring'),
  ('TKL_SD', 'Kelompok Luring TKA SD', 150000, 'SD', 'TKA', 'Kelompok', 'Luring'),
  ('TKL_SMP', 'Kelompok Luring TKA SMP', 170000, 'SMP', 'TKA', 'Kelompok', 'Luring'),
  ('TKL_SMA', 'Kelompok Luring TKA SMA', 200000, 'SMA', 'TKA', 'Kelompok', 'Luring'),
  ('RKL_SD', 'Kelompok Luring Reguler SD', 120000, 'SD', 'Reguler', 'Kelompok', 'Luring'),
  ('RKL_SMP', 'Kelompok Luring Reguler SMP', 135000, 'SMP', 'Reguler', 'Kelompok', 'Luring'),
  ('RKL_SMA', 'Kelompok Luring Reguler SMA', 155000, 'SMA', 'Reguler', 'Kelompok', 'Luring'),
  ('IKL_SD', 'Kelompok Luring Internasional SD', 150000, 'SD', 'Internasional', 'Kelompok', 'Luring'),
  ('IKL_SMP', 'Kelompok Luring Internasional SMP', 170000, 'SMP', 'Internasional', 'Kelompok', 'Luring'),
  ('IKL_SMA', 'Kelompok Luring Internasional SMA', 200000, 'SMA', 'Internasional', 'Kelompok', 'Luring'),
  ('UKL_SMA', 'Kelompok Luring UTBK', 225000, 'SMA', 'UTBK', 'Kelompok', 'Luring'),
  ('OKD_SD', 'Kelompok Daring Olimpiade SD', null, 'SD', 'Olimpiade', 'Kelompok', 'Daring'),
  ('OKD_SMP', 'Kelompok Daring Olimpiade SMP', null, 'SMP', 'Olimpiade', 'Kelompok', 'Daring'),
  ('OKD_SMA', 'Kelompok Daring Olimpiade SMA', null, 'SMA', 'Olimpiade', 'Kelompok', 'Daring'),
  ('TKD_SD', 'Kelompok Daring TKA SD', null, 'SD', 'TKA', 'Kelompok', 'Daring'),
  ('TKD_SMP', 'Kelompok Daring TKA SMP', null, 'SMP', 'TKA', 'Kelompok', 'Daring'),
  ('TKD_SMA', 'Kelompok Daring TKA SMA', null, 'SMA', 'TKA', 'Kelompok', 'Daring'),
  ('RKD_SD', 'Kelompok Daring Reguler SD', null, 'SD', 'Reguler', 'Kelompok', 'Daring'),
  ('RKD_SMP', 'Kelompok Daring Reguler SMP', null, 'SMP', 'Reguler', 'Kelompok', 'Daring'),
  ('RKD_SMA', 'Kelompok Daring Reguler SMA', null, 'SMA', 'Reguler', 'Kelompok', 'Daring'),
  ('IKD_SD', 'Kelompok Daring Internasional SD', null, 'SD', 'Internasional', 'Kelompok', 'Daring'),
  ('IKD_SMP', 'Kelompok Daring Internasional SMP', null, 'SMP', 'Internasional', 'Kelompok', 'Daring'),
  ('IKD_SMA', 'Kelompok Daring Internasional SMA', null, 'SMA', 'Internasional', 'Kelompok', 'Daring'),
  ('UKD_SMA', 'Kelompok Daring UTBK', null, 'SMA', 'UTBK', 'Kelompok', 'Daring'),
  ('OSL_SD', 'Sekolah Luring Olimpiade SD', 300000, 'SD', 'Olimpiade', 'Sekolah', 'Luring'),
  ('OSL_SMP', 'Sekolah Luring Olimpiade SMP', 350000, 'SMP', 'Olimpiade', 'Sekolah', 'Luring'),
  ('OSL_SMA', 'Sekolah Luring Olimpiade SMA', 400000, 'SMA', 'Olimpiade', 'Sekolah', 'Luring'),
  ('TSL_SD', 'Sekolah Luring TKA SD', 350000, 'SD', 'TKA', 'Sekolah', 'Luring'),
  ('TSL_SMP', 'Sekolah Luring TKA SMP', 400000, 'SMP', 'TKA', 'Sekolah', 'Luring'),
  ('TSL_SMA', 'Sekolah Luring TKA SMA', 450000, 'SMA', 'TKA', 'Sekolah', 'Luring'),
  ('RSL_SD', 'Sekolah Luring Reguler SD', null, 'SD', 'Reguler', 'Sekolah', 'Luring'),
  ('RSL_SMP', 'Sekolah Luring Reguler SMP', null, 'SMP', 'Reguler', 'Sekolah', 'Luring'),
  ('RSL_SMA', 'Sekolah Luring Reguler SMA', null, 'SMA', 'Reguler', 'Sekolah', 'Luring'),
  ('ISL_SD', 'Sekolah Luring Internasional SD', null, 'SD', 'Internasional', 'Sekolah', 'Luring'),
  ('ISL_SMP', 'Sekolah Luring Internasional SMP', null, 'SMP', 'Internasional', 'Sekolah', 'Luring'),
  ('ISL_SMA', 'Sekolah Luring Internasional SMA', null, 'SMA', 'Internasional', 'Sekolah', 'Luring'),
  ('USL_SMA', 'Sekolah Luring UTBK', null, 'SMA', 'UTBK', 'Sekolah', 'Luring'),
  ('OSD_SD', 'Sekolah Daring Olimpiade SD', null, 'SD', 'Olimpiade', 'Sekolah', 'Daring'),
  ('OSD_SMP', 'Sekolah Daring Olimpiade SMP', null, 'SMP', 'Olimpiade', 'Sekolah', 'Daring'),
  ('OSD_SMA', 'Sekolah Daring Olimpiade SMA', null, 'SMA', 'Olimpiade', 'Sekolah', 'Daring'),
  ('TSD_SD', 'Sekolah Daring TKA SD', null, 'SD', 'TKA', 'Sekolah', 'Daring'),
  ('TSD_SMP', 'Sekolah Daring TKA SMP', null, 'SMP', 'TKA', 'Sekolah', 'Daring'),
  ('TSD_SMA', 'Sekolah Daring TKA SMA', null, 'SMA', 'TKA', 'Sekolah', 'Daring'),
  ('RSD_SD', 'Sekolah Daring Reguler SD', null, 'SD', 'Reguler', 'Sekolah', 'Daring'),
  ('RSD_SMP', 'Sekolah Daring Reguler SMP', null, 'SMP', 'Reguler', 'Sekolah', 'Daring'),
  ('RSD_SMA', 'Sekolah Daring Reguler SMA', null, 'SMA', 'Reguler', 'Sekolah', 'Daring'),
  ('ISD_SD', 'Sekolah Daring Internasional SD', null, 'SD', 'Internasional', 'Sekolah', 'Daring'),
  ('ISD_SMP', 'Sekolah Daring Internasional SMP', null, 'SMP', 'Internasional', 'Sekolah', 'Daring'),
  ('ISD_SMA', 'Sekolah Daring Internasional SMA', null, 'SMA', 'Internasional', 'Sekolah', 'Daring'),
  ('USD_SMA', 'Sekolah Daring UTBK', null, 'SMA', 'UTBK', 'Sekolah', 'Daring')
) as v(kode, nama, harga, jenjang, jenis, pelaksanaan, mode)
on conflict (kode_paket) do nothing;
