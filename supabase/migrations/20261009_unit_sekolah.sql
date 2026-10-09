-- Unit sekolah: unit punya jenis privat (default, seperti sekarang) atau sekolah.
-- Di unit sekolah, baris orangtua adalah sekolah (nama sekolah, no_hp = WhatsApp PIC, pic_nama = nama kontak)
-- dan baris siswa adalah rombel (nama rombel, jenjang, jumlah_siswa). Kontrak, presensi, dan tagihan tetap per pertemuan.
-- Diterapkan di GDIY 9 Okt 2026. Unit 5 diubah ke jenis sekolah atas permintaan owner.
set statement_timeout = '30s';
set lock_timeout = '10s';

alter table public.units add column if not exists jenis text not null default 'privat';
alter table public.units drop constraint if exists units_jenis_check;
alter table public.units add constraint units_jenis_check check (jenis in ('privat', 'sekolah'));

alter table public.orangtua add column if not exists pic_nama text;

alter table public.siswa add column if not exists jumlah_siswa integer;
alter table public.siswa drop constraint if exists siswa_jumlah_siswa_check;
alter table public.siswa add constraint siswa_jumlah_siswa_check check (jumlah_siswa is null or jumlah_siswa > 0);

update public.units set jenis = 'sekolah' where nama_unit = 'Unit 5';
