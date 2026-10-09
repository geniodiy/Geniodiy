-- Identitas yang dicetak di semua PDF (invoice, kuitansi, slip gaji, laporan belajar, rekap):
-- alamat, kontak, rekening pembayaran, penanda tangan, tagline, dan file cap + tanda tangan (Google Drive).
-- Disimpan sebagai JSON di pengaturan.nilai (kunci identitas_dokumen), diubah manajer di menu Pengaturan.
-- Semua pengguna yang masuk boleh membaca baris ini saja (dibutuhkan tutor dan HRD untuk slip gaji dan laporan);
-- isinya memang tercetak di dokumen yang dikirim ke orang tua dan tutor.
set statement_timeout = '20s';
set lock_timeout = '8s';

insert into public.pengaturan (kunci, nilai, keterangan)
select 'identitas_dokumen', $json${
  "alamat": "Jl. Gedongkuning, Gg. Antasena No.13A, Pringgolayan, Bantul, Yogyakarta",
  "telepon": "082133131931",
  "email": "genioyogyakarta@gmail.com",
  "kontak_admin": "082133131931 (Admin Genio Yogyakarta)",
  "rekening": [
    {"bank": "BRI", "nomor": "138001004672509"},
    {"bank": "BNI", "nomor": "838161400"},
    {"bank": "BCA", "nomor": "8023104383"}
  ],
  "atas_nama": "Finda Triarsa",
  "ttd_nama": "Finda Triarsa, S.Pd.",
  "ttd_jabatan": "Kepala Cabang Genio Yogyakarta",
  "ttd_file_id": "",
  "tagline": "Juara bukan hanya sekadar impian!"
}$json$, 'Identitas dokumen PDF: alamat, kontak, rekening, penanda tangan, tagline'
where not exists (select 1 from public.pengaturan where kunci = 'identitas_dokumen');

drop policy if exists pengaturan_select_identitas_dokumen on public.pengaturan;
create policy pengaturan_select_identitas_dokumen on public.pengaturan for select to authenticated
  using (kunci = 'identitas_dokumen');
