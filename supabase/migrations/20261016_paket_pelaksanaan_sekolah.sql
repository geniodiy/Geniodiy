-- Paket belajar: pelaksanaan "Sekolah" (16 Oct 2026, owner's choice) di samping Privat dan Kelompok,
-- untuk paket S_ dari database lama (GENIO_SYSTEM, DB_MASTER_GENIO sheet PROGRAM). Kode inisial S.
alter table public.paket_belajar drop constraint paket_belajar_pelaksanaan_check;
alter table public.paket_belajar add constraint paket_belajar_pelaksanaan_check
  check (pelaksanaan = any (array['Privat'::text, 'Kelompok'::text, 'Sekolah'::text]));
