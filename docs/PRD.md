# PRD Sistem Manajemen Bimbel (v5)

> v5 (27 Sep 2026): disesuaikan dengan aplikasi yang sudah dibangun untuk role Manajer. Perubahan dari v4 ditandai **[v5]** dan dirangkum di changelog paling bawah. Status tiap modul ada di Section 14.

## 0. Identitas Brand
- **Nama Bimbel:** Genio Institute Yogyakarta
- **Warna dasar:** Putih
- **Warna aksen:**
  - Biru `#1C1AAF`
  - Merah `#D4070F`
- **[v5] Sistem desain:** mengikuti `CLAUDE.md` (Design preferences). Ringkasnya:
  - Font Plus Jakarta Sans di semua teks. Poppins hanya untuk nama brand "Genio Institute".
  - Logo lockup asli: badge logo + "Genio" biru, "Institute" merah, "Yogyakarta".
  - Panel highlight gradasi biru gelap (`#070833` ke `#101075` ke biru), satu angka hero besar, ornamen dari data asli. Mint untuk positif, amber untuk telat, coral untuk biaya.
  - Popup gaya form login (lapisan "Genio UI" di `Config.html`). Tombol utama biru, sekunder putih berborder.
  - Tabel membekukan kolom identitas di kiri (sticky) dan dirancang untuk HP.
  - Teks sentence case, tanpa em dash. Tema terang saja. Animasi menghormati `prefers-reduced-motion`.

## 1. Ringkasan
Website manajemen bimbel untuk mengelola data ortu/siswa, kontrak belajar, kontrak tutor, presensi mengajar, approval, penggajian tutor, dan pelaporan keuangan per unit maupun gabungan.

**Tech stack**
- Frontend + backend logic: Google Apps Script (Web App)
- Database: Supabase (Postgres)
- Storage file (foto bukti, foto profil, PDF hasil generate): Google Drive

**Dokumen yang digenerate otomatis (PDF, disimpan ke Google Drive)**
1. Presensi (per pertemuan, setelah disetujui)
2. Invoice / Tagihan (untuk ortu, berdasarkan kontrak siswa)
3. Receipt (setelah invoice ditandai lunas)
4. Slip Gaji Tutor (per periode gajian)

**[v5] Struktur aplikasi:** satu web app Apps Script dengan dua halaman: `Login.html` dan `Dashboard.html`. Semua modul (`Module*.html`) di-include ke Dashboard dan diganti lewat JS, bukan pindah halaman. Data diambil langsung dari browser ke Supabase REST (`supaRest`) memakai token user, jadi keamanan data bergantung pada RLS. Apps Script (`Code.gs`) dipakai untuk upload file dan generate PDF ke Google Drive. Deploy: import file ke Apps Script (`Export.gs`), lalu buat versi deployment baru.

**Entry point:** Website ini tidak punya landing page — halaman utama (`/`) langsung menuju halaman **Login**. Di halaman Login juga terdapat tombol **"Daftar sebagai Tutor"** (lihat Section 11). Landing page/marketing dibuat terpisah di website lain, di luar scope sistem manajemen ini.

## 1a. Struktur Folder Google Drive

Supaya file tidak numpuk di satu folder, dipisah per jenis dan per konteks.

> **[v5] Implementasi saat ini:** folder dipisah per jenis, belum per unit/periode. ID folder diatur di bagian atas `Code.gs`:
> - `PRESENSI_FOLDER_IDS.foto` dan `.catatan`: dokumentasi dan catatan pembelajaran presensi (satu folder).
> - `OPERASIONAL_FOLDER_ID`: foto nota operasional.
> - `PROFIL_FOLDER_ID`: foto profil.
> - `SLIP_GAJI_FOLDER_ID`: PDF slip gaji.
> - `LAPORAN_BELAJAR_FOLDER_ID`: PDF presensi (laporan belajar).
> - `INVOICE_FOLDER_ID`: PDF invoice.
> - `KUITANSI_FOLDER_ID`: PDF kuitansi.
>
> Kalau ID kosong, folder dibuat otomatis di `Genio Institute - Uploads/`. File dibagikan "siapa saja dengan link, lihat", dan file lama dengan nama sama dipindah ke sampah saat digenerate ulang. Struktur di bawah tetap jadi target jangka panjang.


```
Genio Institute - Sistem/
├── foto-profil/              (semua role, termasuk foto profil tutor)
│   └── {user_id}.jpg
├── foto-bukti-presensi/
│   └── {unit_id}/{presensi_id}.jpg
├── pdf-presensi/
│   └── {unit_id}/{periode}/{presensi_id}.pdf
├── pdf-invoice/
│   └── {unit_id}/{periode}/{invoice_id}.pdf
├── pdf-receipt/
│   └── {unit_id}/{periode}/{receipt_id}.pdf
├── pdf-slip-gaji/
│   └── {periode}/{tutor_id}.pdf     (lintas unit, karena slip gaji digabung per tutor)
└── genio-news/
    └── {genio_news_id}.jpg
```

**Aturan kompresi gambar** (berlaku untuk `foto-profil` dan `genio-news`; `foto-bukti-presensi` tidak dikompres agresif karena jadi bukti resmi — cukup resize ringan bila perlu):
- Upload bebas ukuran dari sisi user.
- Dikompres sebelum disimpan: resize ke lebar maksimum 800px, kompresi kualitas ke target ukuran file wajar (mis. maks ~300–500KB).
- Kompresi dilakukan di sisi client (browser, pakai `<canvas>`) sebelum dikirim ke Apps Script, supaya payload upload juga lebih ringan — bukan dikompres setelah sampai di server.

---

## 2. Role & Hak Akses

| Role | Cakupan | Hak Utama |
|---|---|---|
| **Super Admin** | Seluruh sistem | Kelola semua data, kelola akun/role, akses penuh ke semua unit, editor Genio News |
| **Manajer** | Seluruh unit | Semua hak Kepala Unit + semua hak HRD (lintas unit) + Kelola Pengguna, Kelola Unit, Kelola Paket Belajar, Penggajian, editor Genio News |
| **HRD** | Seluruh unit (SDM) | Edit data tutor (termasuk approve/reject pendaftar baru), kelola data ortu & siswa, kelola kontrak, lihat rekap SDM & total gaji tutor 3 bulanan |
| **Kepala Unit** (×5) | 1 unit | Kelola data ortu/siswa, kontrak siswa & tutor, approval presensi unitnya, lihat rekap unitnya (read-only untuk data tutor) |
| **Tutor** | Diri sendiri | Isi presensi, lihat jadwal, lihat riwayat presensi & slip gaji, lihat Genio News. **Tidak terikat unit** — bisa mengajar siswa dari unit manapun |

---

## 3. Alur Data Utama (Master Flow)

```
Data Ortu
   │
   ▼
Data Siswa (1 ortu bisa >1 siswa; saat input siswa → pilih "ortu baru" / "ortu lama")
   │
   ▼
Kontrak Siswa (paket belajar + harga SATUAN per pertemuan yang disepakati ortu/siswa)
   │
   ▼
Kontrak Tutor (pilih 1 kontrak siswa → isi fee mengajar + uang transport jika ada)
   │
   ▼
Jadwal otomatis muncul di Dashboard Tutor
   │
   ▼
Tutor isi Presensi (tanggal, jam, materi, foto bukti)
   │
   ▼
Approval oleh Kepala Unit / Manajer → Terima / Tolak / Visit
   │
   ▼
Jika Tolak → Tutor edit ulang laporan yang sama → menunggu approval lagi (bisa berkali-kali)
   │
   ▼
Jika Terima/Visit → dihitung ke Rekap Pertemuan, Omset, dan Gaji Tutor (dengan potongan denda jika telat lapor)
   │
   ▼
Bulan berikutnya → klik "Generate Invoice" (harga satuan × jumlah pertemuan diterima+visit bulan lalu) → Lunas → Receipt digenerate
   │
   ▼
Bulan berikutnya → klik "Generate Slip Gaji" → Manajer tandai "sudah dibayar"
```

**Catatan logika kontrak:**
- Kontrak Siswa = dasar penagihan ke ortu. Harga bersifat **satuan per pertemuan**, bukan paket flat bulanan — jadi tidak ada batas jumlah pertemuan per bulan, dan tidak ada pro-rata (tagihan otomatis menyesuaikan berapa kali pertemuan benar-benar terjadi).
- Kontrak Tutor = dasar pembayaran ke tutor, terikat pada satu kontrak siswa tertentu.
- **Tutor tidak terikat unit** — satu tutor bisa punya kontrak dengan siswa dari unit manapun. Unit sebuah pertemuan mengikuti unit siswanya, bukan unit tutornya.
- Satu kontrak siswa bisa dipakai oleh **lebih dari satu** kontrak tutor sekaligus (misal 1 paket belajar mencakup Matematika & Fisika dengan tutor berbeda) — relasi kontrak siswa ke kontrak tutor bersifat one-to-many.

---

## 4. Modul Presensi

**Input oleh Tutor:**
- Tanggal
- Jam
- Materi (pilih: teks atau link)
- Upload foto bukti pertemuan → disimpan ke Google Drive
- **[v5]** Upload foto catatan pembelajaran (opsional, mis. foto papan tulis) → `presensi.catatan_pembelajaran_url`

> **[v5] Implementasi:** semua perhitungan presensi dilakukan di database lewat trigger `presensi_before_write`, bukan di aplikasi:
> - Mengisi `tanggal_input_pertama` sekali saat INSERT dan menguncinya saat UPDATE.
> - Menghitung `terlambat` dari `batas_jam_telat`.
> - Menghitung `nominal_sebelum_denda`, `denda`, dan `nominal_dibayar` dari kontrak tutor dan tabel `pengaturan`.
> - Revisi laporan yang ditolak otomatis kembali ke `pending` dan field approval direset.
> - Presensi diwakilkan otomatis `diterima`, tidak telat, tanpa denda.

**Status presensi:** `pending` → `diterima` / `ditolak` / `visit`

**Logika hasil approval:**
| Status | Dihitung sebagai pertemuan? | Gaji tutor |
|---|---|---|
| Diterima | Ya | Fee mengajar + transport (sesuai kontrak tutor), dikurangi denda telat jika berlaku |
| Ditolak | Tidak | Tidak dibayar — tutor wajib edit ulang laporan |
| Visit | Ya (dianggap berjalan) | **Flat Rp30.000** — `uang_transport` di kontrak tutor TIDAK dibayarkan, dan tidak kena denda telat |

> Presensi berstatus `diterima` **dan** `visit` sama-sama dihitung sebagai pertemuan yang ditagihkan ke ortu (1× harga satuan). Yang berbeda hanya sisi pembayaran ke tutor.

> Nominal visit (Rp30.000), persentase denda (2%), dan batas keterlambatan (24 jam) tidak di-hardcode — disimpan di tabel `pengaturan` (Section 7.16) supaya bisa diubah Manajer tanpa mengubah kode.

**Aturan input presensi:** satu kontrak tutor tidak boleh punya dua presensi dengan **tanggal + jam yang sama persis** (unique constraint). Beberapa pertemuan di tanggal yang sama tetap boleh asalkan jamnya berbeda.

### 4.1 Alur Revisi Laporan yang Ditolak
- Jika Kepala Unit/Manajer menolak (`ditolak`), tutor **mengedit baris presensi yang sama** (bukan membuat entri baru) — mengubah materi/foto bukti sesuai catatan penolakan.
- Setelah diedit, status otomatis kembali ke `pending` untuk diperiksa ulang.
- Tutor boleh merevisi **berkali-kali** sampai akhirnya di-approve (diterima/visit).
- Field `approved_by`, `approved_at`, `catatan_approval` di-reset ke `null` setiap kali direvisi.

### 4.2 Denda Keterlambatan Lapor
- Berlaku **hanya untuk presensi berstatus `diterima`** (tidak berlaku untuk `visit` atau `ditolak`).
- Dihitung dari selisih antara **waktu pelaksanaan** (tanggal + jam di jadwal/presensi) dan **waktu input pertama kali** oleh tutor (`tanggal_input_pertama` — nilai ini TIDAK berubah saat laporan direvisi, supaya tutor tidak bisa "mereset" jam telat lewat revisi berulang).
- Jika selisih > 24 jam → dikenakan **denda 2% dari `fee_mengajar`** (uang transport tidak kena potong).
- Perhitungan nominal akhir:
  - `nominal_sebelum_denda` = fee_mengajar + uang_transport
  - `denda` = 2% × fee_mengajar (jika terlambat), else 0
  - `nominal_dibayar` = `nominal_sebelum_denda` − `denda`
- **Pengecualian:** tidak berlaku untuk presensi dengan `metode_input = diwakilkan` (lihat Section 4.3) — keterlambatan input dalam kasus ini bukan kesalahan tutor (mis. kendala internet/akses web), jadi tidak dihitung telat & tidak kena denda.

### 4.3 Pengisian Presensi oleh Manajer/Kepala Unit (Mewakili Tutor)

Untuk kasus tutor mengalami kendala (internet/akses web) sehingga tidak bisa mengisi presensi sendiri, **Manajer** dan **Kepala Unit** bisa mengisikan presensi atas nama tutor tersebut.

**Cakupan akses:**
- **Manajer** — bisa mewakili tutor manapun, untuk jadwal di unit manapun (lintas unit).
- **Kepala Unit** — hanya bisa mewakili untuk jadwal yang **unit_id-nya sama dengan unitnya sendiri**. Kalau seorang tutor mengajar di beberapa unit, Kepala Unit hanya melihat & bisa mengisikan jadwal tutor tersebut yang ada di unitnya, bukan jadwal tutor itu di unit lain.

**Alur:**
1. Di tab **Presensi**, tersedia tombol khusus (mis. **"Isi Presensi untuk Tutor"**), terpisah dari tombol/tab approval.
2. Klik tombol → muncul **popup search**: search box + daftar tutor **berstatus aktif**.
   - Manajer: daftar semua tutor aktif.
   - Kepala Unit: daftar dibatasi ke tutor yang punya minimal satu `kontrak_tutor` dengan `unit_id` = unitnya.
3. Pilih satu tutor dari daftar → muncul **daftar jadwal** milik tutor tersebut.
   - Manajer: semua jadwal tutor itu, lintas unit.
   - Kepala Unit: hanya jadwal yang `unit_id`-nya sama dengan unitnya.
4. Pilih jadwal yang sesuai → lanjut ke **form isi presensi** dengan field yang sama seperti pengisian normal oleh tutor (tanggal, jam, materi, upload foto bukti — lihat Section 4).
5. Setelah disimpan:
   - `metode_input` = `diwakilkan`, `diinput_oleh` = user_id Manajer/Kepala Unit yang mengisi.
   - Status **langsung `diterima`** (skip alur approval terpisah) — karena yang mengisi (Manajer/Kepala Unit) sudah berwenang meng-approve, jadi `approved_by`/`approved_at` otomatis terisi sama dengan `diinput_oleh`/waktu input.
   - **Tidak kena denda telat** (lihat pengecualian Section 4.2), dan `terlambat` disimpan sebagai `false`.
   - Tetap tunduk pada constraint `unique (kontrak_tutor_id, tanggal, jam)` — tidak bisa dobel dengan presensi yang sudah ada untuk jadwal yang sama.
   - PDF presensi final tetap digenerate seperti alur normal setelah status `diterima`.

---

## 5. Modul Approval (Kepala Unit / Manajer)

Approval presensi tidak eksklusif per role — Kepala Unit dan Manajer punya wewenang setara, siapa pun yang lebih dulu memproses presensi tersebut, itu yang berlaku (first come, first served). Tidak ada urutan/hierarki approval. **Catatan:** ini berlaku untuk presensi `metode_input = mandiri` (diisi tutor sendiri); presensi `metode_input = diwakilkan` tidak melalui approval karena sudah langsung berstatus `diterima` (lihat Section 4.3).

Tampilan approval menampilkan:
- Preview teks materi (atau link)
- Tombol lihat foto bukti dokumentasi
- PDF laporan presensi (auto-generate)
- Badge "Terlambat" jika sudah lewat 24 jam sejak input pertama
- 3 tombol aksi: **Terima / Tolak / Visit** (kalau Tolak, wajib isi `catatan_approval` sebagai alasan agar tutor tahu apa yang perlu diperbaiki)

Setelah "Terima" atau "Visit" → PDF Presensi final digenerate dan disimpan ke Google Drive, data masuk ke rekap omset/gaji.

> **[v5] Implementasi:**
> - PDF presensi bernama "Laporan Belajar Siswa" (`generateLaporanBelajarPdf` di `Code.gs`), dibuat saat Setujui atau Visit, lalu `pdf_url` disimpan.
> - Tampilan approval juga menampilkan foto catatan pembelajaran, chip "Diwakilkan", dan nominal denda di chip "Terlambat".
> - Riwayat bisa difilter berdasarkan status, telat, dan metode input.
> - Manajer bisa mengubah status presensi yang sudah diproses dan menghapus presensi yang ditolak.
> - Presensi diwakilkan belum membuat PDF Laporan Belajar (masuk daftar perbaikan).

**Siklus bulanan:** seluruh kalkulasi, invoice, receipt, slip gaji, dan rekapan dihitung per bulan (bukan per minggu/periode lain).

**Mekanisme generate (manual, bukan cron):**
- Invoice dan slip gaji **tidak digenerate otomatis**. Ada tombol **"Generate Invoice"** dan **"Generate Slip Gaji"** yang diklik manual oleh Manajer.
- Periode yang dihitung selalu **bulan penuh sebelumnya** (tanggal 1 s/d akhir bulan), dan digenerate saat sudah masuk bulan berikutnya — supaya semua presensi bulan tersebut sudah selesai di-approve.
  - Contoh: awal Februari, klik Generate → menghasilkan invoice & slip gaji untuk periode Januari (1–31 Januari).
- **Invoice** = `kontrak_siswa.harga` (harga satuan per pertemuan) × jumlah pertemuan yang tercatat di periode itu, dihitung dari presensi berstatus **`diterima` atau `visit`** (`ditolak` dan `pending` tidak dihitung).
- **Slip gaji** = akumulasi `nominal_dibayar` seluruh presensi tutor tersebut di periode itu.
- Sistem menolak generate ulang untuk periode & kontrak/tutor yang sudah pernah digenerate (unique per periode), supaya tidak dobel.

> **[v5] Implementasi saat ini (berbeda dari rencana di atas):**
> - **Tagihan disinkronkan otomatis, bukan lewat tombol Generate.** Setiap kali Manajer membuka menu Tagihan untuk suatu periode:
>   - Invoice dibuat atau diperbarui dari presensi `diterima`/`visit` bulan itu (harga satuan × jumlah pertemuan).
>   - Invoice belum lunas yang pertemuannya jadi 0 dihapus.
>   - Invoice yang sudah lunas tidak diubah (snapshot tetap).
> - Tagihan dikelompokkan per orang tua.
> - Ada aksi tambahan: kirim via WhatsApp, "Batalkan lunas" (menghapus receipt dan file PDF-nya), dan hapus tagihan.
> - **Slip gaji juga digenerate otomatis, bukan lewat tombol Generate.** Setiap kali Manajer atau Super Admin membuka menu Gaji untuk suatu periode:
>   - Tutor yang punya presensi `diterima`/`visit` tapi belum punya slip dibuatkan slip `belum_dibayar`. Unique `(tutor_id, periode)` mencegah dobel.
>   - Slip yang belum dibayar disinkronkan ulang dari presensi.
>   - Slip yang sudah dibayar tidak diubah.
>   - PDF slip hanya bisa dibuat setelah ditandai sudah dibayar. Ada "Cetak semua slip".
>   - HRD hanya melihat, tidak membuat slip.
> - **Periode:** dipilih lewat pemilih bulan global di header. Pemilih ini berlaku untuk semua menu, bukan hanya bulan lalu.

---

## 6. Dashboard per Role

### 6.0 [v5] Navigasi (berlaku untuk semua role)
Istilah "sidebar" di PRD ini diwujudkan sebagai berikut:
- **HP:** dock melayang di bawah dengan 4 tab: **Home**, **Presensi** (badge jumlah pending), **Gaji**, **Lainnya**. Tab Lainnya berisi kartu profil, daftar menu lain yang dikelompokkan ("Data & Transaksi", "Admin"), dan tombol Keluar.
- **Desktop:** header atas memuat judul modul, **pemilih periode (bulan) global** yang berlaku ke semua menu, **lonceng notifikasi**, dan tombol keluar. Menu Lainnya tampil sebagai panel kiri dengan konten di kanan (split view).
- Menu yang tidak dipakai sebuah role disembunyikan dari dock dan dari Lainnya. Menu di dock bisa berbeda per role (mis. Tutor: Beranda, Presensi, Slip gaji, Lainnya).
- Lonceng notifikasi (real-time, tidak terikat periode):
  - presensi menunggu approval
  - presensi telat 14 hari terakhir
  - pendaftar tutor baru

### 6.1 Dashboard Tutor
Sidebar:
1. **Beranda** — grafik jumlah pertemuan & gaji, 3 bulan terakhir (rentang bisa disesuaikan); ditambah cuplikan singkat Genio News terbaru/aktif di bagian atas
2. **Jadwal dan Presensi** — daftar jadwal mengajar yang dimiliki tutor sekaligus form isi presensi untuk jadwal tersebut
3. **Riwayat Presensi** — termasuk status (pending/diterima/ditolak/visit), badge terlambat, dan akses edit untuk laporan yang ditolak
4. **Slip Gaji** — per periode, bisa diunduh
5. **Genio News** — read-only, lihat info/offer dari admin; tombol "Hubungi Admin" muncul jika diisi editor
6. **Profile** — lihat Section 10

### 6.2 Dashboard Kepala Unit
Sidebar:
1. **Home** — cuplikan singkat Genio News terbaru/aktif di bagian atas, lalu highlight per periode 1 bulan (dropdown pilih bulan): siswa aktif, jumlah pertemuan, omset, pengeluaran, laba bersih — **semua angka dihitung untuk bulan yang dipilih saja** (bukan akumulasi/live saat ini); "siswa aktif" berarti siswa dengan kontrak aktif berjalan pada bulan tersebut. Shortcut jumlah approval presensi pending & jumlah tagihan belum lunas; grafik tren omset, laba bersih, dan jumlah sesi untuk periode yang dipilih
2. **Data Ortu & Siswa** (digabung satu menu)
3. **Kontrak** — kontrak siswa, kontrak tutor, dan tambah jadwal
4. **Presensi** — tab Approval & tab Riwayat, ditambah tombol **"Isi Presensi untuk Tutor"** untuk mengisikan presensi mewakili tutor yang berkendala (lihat Section 4.3) — dibatasi hanya tutor & jadwal di unitnya
5. **Tagihan**
6. **Operasional** — input pengeluaran tambahan unit
7. **Data Tutor** — read-only, tanpa tombol edit/tambah/hapus
8. **Genio News** — read-only
9. **Profile**

### 6.3 Dashboard HRD
Sidebar:
1. **Home** — cuplikan singkat Genio News terbaru/aktif di bagian atas, lalu rekap 3 bulanan (rentang bisa disesuaikan): jumlah pertemuan, jumlah tutor aktif, total gaji tutor per bulan, **jumlah tutor telat lapor**, **jumlah tutor belum ada jadwal**, **jumlah pendaftar tutor baru yang pending approval**, **jumlah siswa baru bulan ini**
2. **Data Ortu & Siswa** (digabung, bisa dikelola; saat tambah siswa ada pilihan unit tujuan)
3. **Kontrak** — kontrak siswa, kontrak tutor, tambah jadwal
4. **Data Tutor** — CRUD tutor + menu approve/reject pendaftar tutor baru
5. **Genio News** — sebagai **editor** (create/edit/hapus post, atur tombol kontak admin)
6. **Profile**

> HRD boleh melihat data kontrak dan total gaji tutor (untuk keperluan rekap SDM), tapi **tidak** punya menu Tagihan, Operasional, dan Penggajian — menandai invoice lunas & membayar gaji tetap wewenang Manajer/Super Admin.

### 6.4 Dashboard Manajer
Union dari Kepala Unit + HRD, ditambah menu eksklusif. Sidebar:
1. **Home** — struktur mirip Home Kepala Unit tapi lintas semua unit sekaligus, tersusun dari atas ke bawah, dengan dropdown pilih bulan yang berlaku untuk seluruh bagian Home ini:
   - **Cuplikan singkat Genio News** terbaru/aktif, ditampilkan paling atas
   - **Highlight gabungan semua unit** (untuk bulan yang dipilih saja, bukan akumulasi live): siswa aktif, jumlah pertemuan, omset, pengeluaran, laba bersih (total semua unit)
   - **Pie chart siswa aktif per unit** — proporsi jumlah siswa aktif tiap unit **pada bulan yang dipilih**
   - **Notifikasi/shortcut** (badge jumlah): pendaftar tutor baru menunggu acc, presensi menunggu approval, tagihan belum lunas — masing-masing bisa diklik langsung ke menu terkait (bagian ini real-time, tidak terikat filter bulan)
   - **Grafik tren** (paling bawah) — periode bisa dikustom terpisah (multi-bulan), mencakup semua unit: omset, pengeluaran (gaji + operasional), laba bersih
2. **Progres** — rata-rata semua unit (total pertemuan, omset, laba bersih), 3 bulan terakhir/bisa disesuaikan
3. **Data Ortu & Siswa** (lintas unit)
4. **Kontrak** (lintas unit)
5. **Presensi** — Approval & Riwayat, lintas unit, ditambah tombol **"Isi Presensi untuk Tutor"** untuk mengisikan presensi mewakili tutor manapun (lintas unit, lihat Section 4.3)
6. **Tagihan** (lintas unit) — termasuk tombol **"Generate Invoice"** untuk periode bulan sebelumnya, dan tandai lunas → generate receipt
7. **Operasional** (lintas unit)
8. **Data Tutor** — full CRUD (tambah/edit status/hapus) + approve/reject pendaftar baru, lintas unit
9. **Penggajian** — tombol **"Generate Slip Gaji"** untuk periode bulan sebelumnya, daftar gaji semua tutor semua unit + tombol "Tandai Sudah Dibayar"
10. **Paket Belajar** — kelola master paket (tambah/edit kode, nama, harga satuan default, nonaktifkan paket lama)
11. **Genio News** — sebagai **editor** (create/edit/hapus post, atur tombol kontak admin)
12. **Kelola Pengguna** — CRUD akun semua role (Super Admin/Manajer/HRD/Kepala Unit/Tutor), assign role & unit_id
13. **Kelola Unit** — CRUD tabel `units`
14. **Pengaturan** — ubah nominal visit, persentase denda telat, batas jam keterlambatan (tabel `pengaturan`)
15. **Profile**

> **[v5] Menu Manajer yang sudah dibangun:**
>
> | Posisi | Menu | Isi saat ini |
> |---|---|---|
> | Dock | **Home** | Highlight bulanan omset, laba bersih + margin, pengeluaran (gaji + operasional) dengan perbandingan bulan lalu. Banner presensi pending. Rekap keuangan per unit (siswa aktif, sesi, omset, pengeluaran, laba). Grafik tren 3/6/12 bulan (omset/laba/sesi). Sesi Hari ini (semua unit): grid hari ini + fleksibel per jam, status lapor per sesi, popup detail dengan WA pengingat, link Lihat selengkapnya ke Jadwal mengajar. Carousel Genio News. |
> | Dock | **Presensi** | Tab Approval & Riwayat, lintas unit, plus "Isi presensi untuk tutor". |
> | Dock | **Gaji** | Penggajian: daftar slip per periode, tandai sudah dibayar, cetak slip. |
> | Lainnya | Data Ortu & Siswa | Lintas unit, alur ortu baru / sudah terdaftar. |
> | Lainnya | Kontrak | Kontrak siswa + kontrak tutor (one-to-many). |
> | Lainnya | **Jadwal Mengajar** | [v5] Dipisah dari Kontrak: grid mingguan per tutor + tabel, popover detail sesi. |
> | Lainnya | Tagihan | Invoice per orang tua, lunas → receipt, PDF invoice & kuitansi. |
> | Lainnya | Kelola Tutor | = "Data Tutor": edit, hapus, approve/tolak pendaftar. |
> | Lainnya | Operasional | Pengeluaran per unit dengan foto bukti. |
> | Lainnya | Kelola Unit | CRUD unit (nonaktifkan, bukan hapus). |
> | Lainnya | Paket Belajar | Master paket + jenjang, jenis, pelaksanaan, mode belajar. |
> | Lainnya | Kelola User | = "Kelola Pengguna": akun non-tutor, role, status, unit. |
> | Lainnya | Genio News | Belum dibangun (label "Coming Soon"). |
> | Lainnya | Pengaturan | Nominal visit, persen denda, batas jam telat. |
> | Lainnya | Profil | Kartu profil di atas menu Lainnya + halaman detail. |
>
> Belum ada: menu **Progres**, pie chart siswa aktif per unit, shortcut tagihan belum lunas di Home. Semua ini masuk daftar Section 14.

> **Catatan implementasi:** Karena sidebar Manajer = union dari Kepala Unit + HRD, halaman/komponen HTML untuk menu yang sama (Data Ortu & Siswa, Kontrak, Presensi, Tagihan, Operasional, Data Tutor) dipakai ulang (shared component), dibedakan lewat flag akses (unit-scoped vs lintas-unit, read-only vs edit) — bukan bikin halaman terpisah untuk tiap role.

### 6.5 Dashboard Super Admin
Akses penuh ke semua modul di atas, lintas unit, ditambah kelola akun & role pengguna. Juga berhak sebagai editor Genio News. Home mengikuti struktur Home Manajer (Section 6.4), termasuk cuplikan singkat Genio News di bagian atas.

### 6.6 Alur Input Data Ortu & Siswa

Saat menambah siswa baru, form menyediakan pilihan di awal:

- **Ortu Baru** → isi form data ortu (nama, no HP, alamat) sekaligus data siswa (nama, unit tujuan) dalam satu alur.
- **Ortu Lama** → search box cari ortu **berdasarkan nama** (bukan nomor HP), pilih dari hasil pencarian, lalu lanjut isi data siswa baru yang ditautkan ke ortu tersebut.

> Catatan: karena pencarian ortu lama memakai nama (bukan nomor HP sebagai kunci unik), berpotensi muncul nama yang mirip/sama dari ortu berbeda. Petugas input (HRD/Kepala Unit/Manajer) perlu memastikan sendiri ortu yang dipilih benar sebelum menyimpan — sistem tidak melakukan validasi duplikat otomatis untuk `orangtua`.

---

## 7. Skema Database (Supabase)

> **[v5]** Skema sudah dibuat di project Supabase **GDIY** (16 tabel, semua RLS aktif, berisi data dummy). Semua tabel sudah punya `created_at` dan `updated_at` (dengan trigger updated_at). Kolom tambahan di luar v4 ditandai [v5] di tabel masing-masing.

Konvensi umum:
- Semua `id` = `uuid default gen_random_uuid()` (primary key).
- Semua tabel punya `created_at timestamptz default now()` **dan** `updated_at timestamptz default now()` (konsisten di seluruh tabel, untuk audit trail).
- Semua nominal pakai tipe `numeric(12,2)`.
- Foreign key pakai `on delete restrict` untuk data transaksi (kontrak, presensi, invoice) supaya histori tidak ikut terhapus; `on delete cascade` hanya untuk data anak murni (mis. `jadwal` ikut `kontrak_tutor`).
- **Denormalisasi `unit_id`:** tabel `kontrak_siswa`, `kontrak_tutor`, `presensi`, dan `invoice` menyimpan `unit_id` langsung (disalin dari `siswa.unit_id` saat baris dibuat). Tujuannya supaya RLS Kepala Unit dan filter per-unit tidak perlu join berantai 3–4 level, dan supaya unit yang tercatat di histori tidak berubah kalau siswa dipindah unit di kemudian hari.

### 7.1 `units`
Master 5 unit/cabang.
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid PK | |
| nama_unit | text | unik |
| status | text | `aktif` / `nonaktif` |
| created_at | timestamptz | |

Dikelola lewat menu **Kelola Unit** (Manajer/Super Admin).

### 7.2 `users`
Akun login untuk semua role (kecuali disederhanakan lewat Supabase Auth `auth.users`; tabel ini jadi profil tambahan).
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid PK | sama dengan `auth.users.id` |
| nama | text | |
| email | text | unik |
| role | text | enum: `super_admin`, `manajer`, `hrd`, `kepala_unit`, `tutor` |
| unit_id | uuid FK → units.id | nullable — **hanya wajib diisi untuk role `kepala_unit`**. Super admin/manajer/HRD lintas unit, dan **tutor tidak terikat unit** (bisa mengajar siswa dari unit manapun) |
| status | text | untuk role selain tutor: `aktif` / `nonaktif`. Khusus **tutor**: `pending_approval` / `aktif` / `nonaktif` |
| jenis_kelamin | text | `L` / `P` — berlaku untuk semua role |
| foto_profil_url | text | nullable — link file di Google Drive, berlaku **untuk semua role**; foto di-upload bebas ukuran lalu dikompres (resize/reduce quality) sebelum disimpan |
| login_method | text | `google` / `password` |
| no_hp | text | **[v5]** nullable, nomor HP/WA untuk kontak (ditampilkan di Profil dengan tautan WhatsApp) |
| created_at | timestamptz | |
| updated_at | timestamptz | |

Dikelola lewat menu **Kelola Pengguna** (Manajer/Super Admin) untuk semua role; untuk role tutor secara khusus juga tersedia di menu **Data Tutor** (HRD/Manajer).

### 7.3 `tutor_profile`
Data tambahan khusus tutor (1–1 dengan `users`).
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK → users.id, unique | |
| keahlian | text[] atau text | bisa multi-mapel |
| pendidikan_terakhir | text | diisi saat pendaftaran mandiri |
| no_wa | text | diisi saat pendaftaran mandiri |
| no_rekening | text | nullable, dilengkapi setelah di-acc |
| nama_bank | text | nullable, dilengkapi setelah di-acc |

### 7.4 `orangtua`
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid PK | |
| nama | text | |
| no_hp | text | |
| alamat | text | nullable |
| created_at | timestamptz | |
| created_by | uuid FK → users.id | siapa yang input (kepala unit/HRD) |

### 7.5 `siswa`
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid PK | |
| nama | text | |
| orangtua_id | uuid FK → orangtua.id | |
| unit_id | uuid FK → units.id | wajib diisi (dipilih HRD/kepala unit saat input) |
| status | text | `aktif` / `nonaktif` |
| jenis_kelamin | text | **[v5]** `L` / `P` |
| jenjang | text | **[v5]** mis. SD / SMP / SMA |
| kelas | text | **[v5]** nullable |
| sekolah | text | **[v5]** nullable |
| created_at | timestamptz | |

### 7.6 `paket_belajar`
Master jenis paket belajar (wajib dipilih saat membuat kontrak siswa — bukan input bebas). Dikelola lewat menu **Paket Belajar** (Manajer).
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid PK | |
| kode_paket | text | unik, mis. `P_REG_SMA`, `P_INTENSIF_SMP`, `P_UTBK` |
| nama_paket | text | mis. "Reguler SMA", "Intensif SMP", "Persiapan UTBK" |
| harga_default | numeric(12,2) | **harga satuan per pertemuan**, bukan harga flat bulanan. Tetap bisa dioverride di kontrak siswa |
| status | text | `aktif` / `nonaktif` (paket lama tidak dihapus, cukup dinonaktifkan) |
| jenjang | text | **[v5]** jenjang sasaran paket |
| jenis | text | **[v5]** jenis paket (mis. reguler, intensif, persiapan ujian) |
| pelaksanaan | text | **[v5]** tempat pelaksanaan (mis. di unit / privat ke rumah) |
| mode_belajar | text | **[v5]** mis. tatap muka / online |
| created_at | timestamptz | |

### 7.7 `kontrak_siswa`
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid PK | |
| siswa_id | uuid FK → siswa.id | |
| unit_id | uuid FK → units.id | denormalisasi dari `siswa.unit_id` saat kontrak dibuat |
| paket_belajar_id | uuid FK → paket_belajar.id, **not null** | wajib dipilih dari master paket |
| harga | numeric(12,2) | **harga satuan per pertemuan** yang disepakati (default mengikuti `harga_default` paket, bisa dioverride manual per siswa jika ada diskon/kesepakatan khusus) |
| tanggal_mulai | date | |
| tanggal_selesai | date | nullable (kontrak berjalan terus sampai diberhentikan) |
| nomor_kontrak | text | **[v5]** nomor kontrak yang tampil di UI dan dokumen |
| status | text | `aktif` / `selesai` / `dibatalkan` |
| created_by | uuid FK → users.id | |
| created_at | timestamptz | |

### 7.8 `kontrak_tutor`
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid PK | |
| tutor_id | uuid FK → users.id | tutor dari unit manapun boleh dipilih (tutor tidak terikat unit) |
| kontrak_siswa_id | uuid FK → kontrak_siswa.id | satu kontrak siswa bisa dipakai banyak baris di sini (mapel/tutor beda) |
| unit_id | uuid FK → units.id | denormalisasi dari `kontrak_siswa.unit_id` — unit mengikuti siswa, bukan tutor |
| mapel | text | nullable, penjelas kontrak (mis. "Matematika") |
| fee_mengajar | numeric(12,2) | per pertemuan |
| uang_transport | numeric(12,2) | nullable/default 0 |
| durasi_menit | int | **[v5]** durasi per sesi, dipakai untuk jam mengajar |
| status | text | `aktif` / `nonaktif` |
| created_by | uuid FK → users.id | |
| created_at | timestamptz | |

### 7.9 `jadwal`
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid PK | |
| kontrak_tutor_id | uuid FK → kontrak_tutor.id, on delete cascade | |
| hari | text | `senin`..`minggu` |
| jam_mulai | time | |
| jam_selesai | time | nullable |

### 7.10 `presensi`
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid PK | |
| kontrak_tutor_id | uuid FK → kontrak_tutor.id | |
| unit_id | uuid FK → units.id | denormalisasi dari `kontrak_tutor.unit_id` |
| tanggal | date | tanggal pelaksanaan |
| jam | time | jam pelaksanaan |
| materi_teks | text | nullable |
| materi_link | text | nullable |
| foto_url | text | link file di Google Drive |
| status | text | `pending` / `diterima` / `ditolak` / `visit` |
| catatan_approval | text | nullable, wajib diisi jika status `ditolak` — jadi acuan tutor merevisi |
| approved_by | uuid FK → users.id | nullable, direset ke null setiap kali direvisi setelah ditolak. Untuk presensi `metode_input = diwakilkan`, otomatis diisi sama dengan `diinput_oleh` (self-attested saat input, lihat Section 4.3) |
| approved_at | timestamptz | nullable, direset ke null setiap kali direvisi setelah ditolak |
| metode_input | text | `mandiri` (default, diisi tutor sendiri) / `diwakilkan` (diisi Manajer/Kepala Unit mewakili tutor, lihat Section 4.3) |
| diinput_oleh | uuid FK → users.id | nullable — hanya terisi jika `metode_input = diwakilkan`; mencatat Manajer/Kepala Unit yang mengisikan presensi ini, untuk audit trail |
| tanggal_input_pertama | timestamptz | diisi sekali saat presensi pertama kali dibuat, **tidak berubah** saat direvisi — dasar hitung keterlambatan. Tidak berlaku untuk `metode_input = diwakilkan` (lihat Section 4.3) |
| terlambat | boolean | true jika `tanggal_input_pertama` − (tanggal+jam pelaksanaan) > 24 jam. Selalu `false` jika `metode_input = diwakilkan` |
| nominal_sebelum_denda | numeric(12,2) | fee_mengajar + uang_transport (diterima) / 30000 (visit) / 0 (ditolak) |
| denda | numeric(12,2) | 2% × fee_mengajar jika `terlambat` = true **dan** status `diterima`; else 0. Selalu `0` jika `metode_input = diwakilkan` |
| nominal_dibayar | numeric(12,2) | `nominal_sebelum_denda` − `denda` |
| pdf_url | text | link PDF presensi final di Google Drive, terisi setelah diterima/visit |
| catatan_pembelajaran_url | text | **[v5]** nullable, foto catatan pembelajaran di Google Drive |
| created_at | timestamptz | |
| updated_at | timestamptz | berubah setiap kali direvisi |

**Constraint:** `unique (kontrak_tutor_id, tanggal, jam)` — mencegah presensi dobel untuk pertemuan yang sama. Beberapa pertemuan di tanggal yang sama tetap boleh selama jamnya berbeda.

### 7.11 `invoice`
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid PK | |
| kontrak_siswa_id | uuid FK → kontrak_siswa.id | |
| unit_id | uuid FK → units.id | denormalisasi dari `kontrak_siswa.unit_id` |
| periode | text/date | format `YYYY-MM` — periode bulan yang ditagih (bulan sebelumnya), digenerate manual lewat tombol |
| jumlah_pertemuan | int | jumlah presensi berstatus `diterima` + `visit` di periode itu (snapshot saat generate) |
| harga_satuan | numeric(12,2) | snapshot `kontrak_siswa.harga` saat generate — supaya tagihan lama tidak berubah kalau harga kontrak direvisi |
| nominal | numeric(12,2) | `harga_satuan` × `jumlah_pertemuan` |
| status | text | `belum_lunas` / `lunas` |
| tanggal_lunas | timestamptz | nullable |
| pdf_url | text | link PDF invoice di Google Drive |
| created_at | timestamptz | |
| updated_at | timestamptz | |

**Constraint:** `unique (kontrak_siswa_id, periode)` — satu kontrak siswa hanya boleh punya satu invoice per periode (mencegah generate dobel).

### 7.12 `receipt`
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid PK | |
| invoice_id | uuid FK → invoice.id, unique | 1 invoice = 1 receipt |
| tanggal_bayar | timestamptz | |
| pdf_url | text | link PDF receipt di Google Drive |
| dibuat_oleh | uuid FK → users.id | |

### 7.13 `slip_gaji`
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid PK | |
| tutor_id | uuid FK → users.id | |
| periode | text/date | format `YYYY-MM` |
| total_pertemuan | int | jumlah presensi diterima+visit di periode itu |
| total_gaji | numeric(12,2) | akumulasi `nominal_dibayar` dari tabel presensi (sudah termasuk potongan denda) |
| status | text | `belum_dibayar` / `sudah_dibayar` |
| tanggal_dibayar | timestamptz | nullable |
| dibayar_oleh | uuid FK → users.id | manajer yang klik "tandai dibayar" |
| pdf_url | text | link PDF slip gaji di Google Drive |
| created_at | timestamptz | |
| updated_at | timestamptz | |

**Constraint:** `unique (tutor_id, periode)` — satu tutor hanya boleh punya satu slip gaji per periode (mencegah generate dobel). Karena tutor bisa mengajar lintas unit, slip gaji **menggabungkan** seluruh pertemuannya dari semua unit menjadi satu slip.

### 7.14 `operasional`
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid PK | |
| unit_id | uuid FK → units.id | |
| tanggal | date | |
| keterangan | text | |
| nominal | numeric(12,2) | |
| input_oleh | uuid FK → users.id | |
| foto_url | text | **[v5]** nullable, foto nota/bukti pengeluaran di Google Drive |
| created_at | timestamptz | |

### 7.15 `genio_news`
Post informasi/offer dari admin, dikelola oleh Manajer/Super Admin sebagai editor, ditampilkan (read-only) ke Tutor, Kepala Unit, dan HRD.
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid PK | |
| judul | text | |
| isi | text | |
| gambar_url | text | nullable, link file di Google Drive |
| tanggal_publish | timestamptz | |
| tanggal_expire | timestamptz | nullable — jika lewat, post tidak tampil lagi (tapi tidak dihapus) |
| status | text | `aktif` / `nonaktif` |
| tombol_kontak_label | text | nullable — teks tombol (mis. "Hubungi Admin"), opsional |
| tombol_kontak_url | text | nullable — link tujuan tombol (mis. WA), hanya muncul jika diisi |
| dibuat_oleh | uuid FK → users.id | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### 7.16 `pengaturan`
Konfigurasi sistem berbentuk key-value, bisa diubah Manajer/Super Admin lewat menu **Pengaturan** tanpa mengubah kode.
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid PK | |
| kunci | text | unik, mis. `nominal_visit`, `persen_denda_telat`, `batas_jam_telat` |
| nilai | text | disimpan sebagai text, dikonversi sesuai kebutuhan |
| keterangan | text | penjelasan untuk UI |
| updated_by | uuid FK → users.id | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

**Nilai awal (seed):**
| kunci | nilai | keterangan |
|---|---|---|
| `nominal_visit` | `30000` | Nominal flat yang dibayarkan untuk presensi berstatus visit |
| `persen_denda_telat` | `2` | Persentase denda dari fee mengajar jika telat lapor |
| `batas_jam_telat` | `24` | Batas jam sejak pelaksanaan sebelum dianggap telat |

> Catatan: nilai pengaturan yang **sudah terpakai** pada presensi/slip gaji lama tidak ikut berubah saat pengaturan diubah, karena `nominal_dibayar` dan `denda` disimpan sebagai snapshot di baris `presensi` (lihat Section 13).

### 7.17 Relasi Ringkas (ER sederhana)

```
units 1───n users            (hanya kepala_unit yang terikat unit)
units 1───n siswa
units 1───n operasional
units 1───n kontrak_siswa    (denormalisasi)
units 1───n kontrak_tutor    (denormalisasi)
units 1───n presensi         (denormalisasi)
units 1───n invoice          (denormalisasi)

orangtua 1───n siswa
siswa 1───n kontrak_siswa
kontrak_siswa 1───n kontrak_tutor   (one-to-many, sesuai keputusan poin 5)
kontrak_tutor 1───n jadwal
kontrak_tutor 1───n presensi
kontrak_siswa 1───n invoice         (unique per periode)
invoice 1───1 receipt
users(tutor) 1───1 tutor_profile
users(tutor) 1───n kontrak_tutor    (lintas unit — tutor tidak terikat unit)
users(tutor) 1───n slip_gaji        (unique per periode, gabungan semua unit)
users(manajer/super_admin) 1───n genio_news   (sebagai dibuat_oleh)
pengaturan                          (tabel key-value, standalone)
```

### 7.18 Catatan RLS (Row Level Security) Supabase

Gunakan kolom `role` dan `unit_id` di tabel `users` (via `auth.uid()`) sebagai basis policy. Karena `unit_id` sudah didenormalisasi ke tabel transaksi (lihat konvensi Section 7), policy per unit cukup membandingkan satu kolom tanpa join berantai.

- **Tutor**: hanya boleh SELECT/INSERT/UPDATE baris `presensi` miliknya sendiri (`kontrak_tutor.tutor_id = auth.uid()`); UPDATE hanya diizinkan saat status `ditolak` (untuk revisi); read-only untuk `slip_gaji` miliknya; read-only untuk `genio_news` yang aktif; UPDATE terbatas pada kolom miliknya sendiri di `users`/`tutor_profile` (termasuk `foto_profil_url`). **Tidak difilter `unit_id`** karena tutor tidak terikat unit — cakupannya ditentukan oleh kontrak tutor yang dia miliki.
- **Kepala Unit**: SELECT/INSERT/UPDATE terbatas pada baris yang `unit_id`-nya sama dengan unit dia (siswa, kontrak_siswa, kontrak_tutor, presensi, invoice, operasional). Untuk `users` (data tutor) hanya SELECT, tanpa INSERT/UPDATE/DELETE. Termasuk INSERT `presensi` dengan `metode_input = diwakilkan` (Section 4.3), tetap dibatasi `unit_id` unitnya sendiri walau tutornya lintas unit. Read-only untuk `genio_news` dan `pengaturan`.
- **HRD**: akses lintas unit (tanpa filter `unit_id`) untuk `users`/`tutor_profile` (full CRUD tutor + approve/reject pendaftar baru: `users.status = pending_approval` → `aktif`, atau hapus permanen jika ditolak), `orangtua`, `siswa`, serta **SELECT** untuk `kontrak_siswa`, `kontrak_tutor`, `presensi`, dan `slip_gaji` (untuk rekap SDM & total gaji tutor). Full CRUD (sebagai editor) untuk `genio_news`. HRD **tidak** boleh UPDATE `slip_gaji.status`, `invoice.status`, maupun akses `operasional` — itu wewenang Manajer/Super Admin.
- **Manajer**: full akses lintas unit ke semua tabel, termasuk `users` (semua role), `units`, `paket_belajar`, `pengaturan`, `genio_news` (sebagai editor), dan `slip_gaji`/`invoice` (termasuk update status jadi `sudah_dibayar`/`lunas`).
- **Super Admin**: bypass semua policy (akses penuh), termasuk editor `genio_news` dan `pengaturan`.

> **[v5] Implementasi:**
> - Policy memakai fungsi helper SECURITY DEFINER: `current_role_name`, `current_status`, `current_unit_id`, `is_manajemen`, `is_staff_lintas_unit`.
> - Trigger pengaman: `trg_users_prevent_self_escalation` (user tidak bisa menaikkan role/status sendiri), `trg_kontrak_tutor_check_role`, dan `trg_tutor_profile_check_role`.
> - Catatan advisor keamanan yang sengaja dibiarkan untuk sekarang ada di `CLAUDE.md`.
> - Karena aplikasi mengakses Supabase langsung dari browser, **RLS adalah satu-satunya pembatas akses**. Menyembunyikan menu di UI hanya soal tampilan.

---

## 8. Ringkasan Perbedaan Hak Akses Data Tutor

| | Kepala Unit | HRD | Manajer |
|---|---|---|---|
| Lihat data tutor | ✅ | ✅ | ✅ |
| Tambah tutor | ❌ | ✅ | ✅ |
| Edit status tutor | ❌ | ✅ | ✅ |
| Hapus tutor | ❌ | ✅ | ✅ |
| Acc/tolak pendaftar tutor baru | ❌ | ✅ | ✅ |

---

## 9. Autentikasi

| Role | Metode Login |
|---|---|
| Super Admin, Manajer, HRD, Kepala Unit | Google Sign-In **atau** email/password |
| Tutor | Email/password saja — akun dibuat sendiri lewat pendaftaran mandiri (lihat Section 11), atau bisa juga dibuatkan admin/HRD/kepala unit; tutor bisa ganti password sendiri |

> **[v5] Implementasi:**
> - Sudah ada: login email/password (Supabase Auth) dan pemblokiran akun `pending_approval` ("Akun Anda masih menunggu persetujuan admin.") dan `nonaktif`.
> - Belum ada: Google Sign-In.
> - Sesi disimpan di browser dan belum menyimpan `unit_id`. `unit_id` ini diperlukan untuk dashboard Kepala Unit.
> - Redesign tampilan login (desktop dan HP) sudah dipratinjaukan tapi ditunda.

---

## 10. Menu Profile (ada di semua role, biasanya ditaruh paling bawah sidebar)

**Semua role** — halaman Profile menampilkan (mode lihat): nama lengkap, email, jenis kelamin, foto profil, dengan satu tombol **Edit** yang membuka form untuk mengubah nama, email, jenis kelamin, foto profil (upload bebas ukuran, otomatis dikompres sebelum disimpan ke Google Drive), dan password.

> **[v5] Implementasi:**
> - Mode lihat sudah ada: highlight putih berisi avatar, nama, role, status, unit, dan tanggal bergabung, lalu kartu Kontak (email dengan tombol salin, tautan WhatsApp) dan kartu Akun.
>
> **Edit profil (satu popup, semua role):**
> - **Foto profil:** menerima JPG, PNG, dan HEIC/HEIF. HEIC dikonversi di browser dengan heic2any yang dimuat dari jsDelivr hanya saat diperlukan. Setelah dipilih, foto dipotong di popup "Atur foto" (geser, zoom slider/scroll/cubit, masker lingkaran), lalu jadi JPEG persegi maks. 800×800 ~400KB, diunggah ke Drive `Foto Profil` lewat `uploadProfilFile`, disimpan sebagai link gambar langsung. Foto lama dipindah ke sampah.
> - **Data diri:** nama, jenis kelamin, no WhatsApp (`users.no_hp`).
> - **Khusus tutor:** keahlian, pendidikan terakhir, bank, rekening (`tutor_profile`). No WA ikut disimpan ke `tutor_profile.no_wa`.
> - **Ganti password:** di bagian yang bisa dibuka-tutup. Wajib isi password saat ini (dicek ulang lewat login), password baru minimal 8 karakter, ada indikator kekuatan.
> - **Email:** hanya ditampilkan. Mengubah email login butuh konfirmasi Supabase, jadi belum dibuka.
> - Role, status, dan unit tidak bisa diubah sendiri. Ini dijaga trigger `prevent_self_privilege_escalation`.

**Khusus Tutor** — tambahan field yang ditampilkan & bisa diedit: keterampilan/keahlian mengajar, nomor rekening (+ nama bank). Field `pendidikan_terakhir` dan `no_wa` (diisi saat pendaftaran) juga ditampilkan di sini dan bisa diedit.

---

## 11. Pendaftaran Mandiri Tutor Baru

Di halaman Login tersedia tombol **"Daftar sebagai Tutor"** dengan alur berikut:

1. Calon tutor mengisi form pendaftaran: **nama**, **jenis kelamin**, **pendidikan terakhir**, **keterampilan/keahlian mapel**, **nomor WA**, serta email & password untuk akun. **[v5]** Form juga sudah meminta **nama bank** dan **nomor rekening** (opsional) serta konfirmasi password, lalu menampilkan halaman sukses.
2. Saat submit, akun langsung dibuat: `users` (role `tutor`, termasuk `jenis_kelamin`, `unit_id` dibiarkan null karena tutor tidak terikat unit) dan `tutor_profile` (pendidikan_terakhir, no_wa, keahlian), dengan `users.status = pending_approval`.
3. Login diblokir selama status masih `pending_approval` (ditampilkan pesan "Menunggu persetujuan admin").
4. HRD atau Manajer meninjau pendaftar baru di menu **Data Tutor** (ada indikator/badge jumlah pending di Home HRD & Manajer):
   - **Jika di-acc** → `users.status` diubah menjadi `aktif`, tutor bisa login. Setelah login pertama kali, tutor bisa melengkapi profil lebih lanjut (no. rekening, nama bank) dan **upload foto profil**.
   - **Jika ditolak** → data akun & profil tutor tersebut **dihapus permanen** dari database (bukan sekadar diubah status).
   - **[v5] Catatan:**
     - Saat ini hanya baris `public.users` (dan profil) yang dihapus. Akun di Supabase Auth masih tersisa, jadi email itu tidak bisa dipakai daftar ulang.
     - **Sudah diperbaiki:** tolak dan hapus sekarang lewat Edge Function `admin-users`, yang menghapus `public.users`, `tutor_profile` (cascade), dan akun Supabase Auth sekaligus.

---

## 12. Genio News

Fitur pengumuman/offer dari admin ke seluruh unit.

- **Editor:** Manajer, HRD, & Super Admin (create, edit, hapus post).
- **Pembaca (read-only):** Tutor, Kepala Unit.
- **Preview di Home:** setiap role (Tutor, Kepala Unit, HRD, Manajer, Super Admin) menampilkan cuplikan singkat post Genio News terbaru/aktif di bagian atas dashboard Home/Beranda masing-masing (judul + tanggal, klik untuk buka detail di menu Genio News penuh). Untuk role dengan hak edit (HRD, Manajer, Super Admin), cuplikan ini tetap read-only preview — aksi create/edit/hapus tetap dilakukan di menu Genio News penuh, bukan dari widget preview di Home.
- **Isi satu post:** judul, isi teks, gambar/banner (opsional), tanggal publish, tanggal expire (opsional — kalau lewat, post otomatis tidak tampil), status aktif/nonaktif.
- **Broadcast:** semua post tampil ke semua unit (tidak ditarget per unit).
- **[v5] Status:**
  - Tabel `genio_news` sudah ada (4 post dummy).
  - Home Manajer menampilkannya sebagai carousel gambar, **belum di paling atas**.
  - Menu Genio News penuh (daftar, detail, editor) belum dibangun.
- **Tombol kontak admin:** opsional, editor bisa memilih untuk menambahkan tombol (mis. "Hubungi Admin" mengarah ke link WA) di sebuah post. Kalau tidak diisi, tombol tidak muncul.

---

## 13. Kebijakan Retensi Data Historis (Bulan Berjalan vs Bulan Lampau)

**Prinsip:** rekap bulan-bulan yang sudah lewat (jumlah pertemuan, omset, laba bersih, dll.) bersifat **final/terkunci** — tidak boleh berubah walaupun data master (ortu, siswa, kontrak) yang jadi sumbernya kemudian dihapus.

- Semua FK dari tabel transaksi (`kontrak_siswa`, `kontrak_tutor`, `presensi`, `invoice`, `receipt`, `slip_gaji`) ke data master (`siswa`, `orangtua`, `kontrak_siswa`, `kontrak_tutor`, `users`) memakai `on delete restrict` (lihat konvensi Section 7). Artinya: **siswa, ortu, atau kontrak yang sudah punya riwayat presensi/invoice tidak bisa dihapus permanen** — database akan menolak.
- Konsekuensinya di UI: tombol "Hapus" untuk siswa/ortu/kontrak yang sudah punya histori transaksi **harus diarahkan menjadi "Nonaktifkan"** (`status = nonaktif` / `selesai` / `dibatalkan`), bukan hard delete. Hard delete hanya benar-benar memungkinkan untuk data yang belum punya histori sama sekali (misal siswa baru didaftarkan lalu dibatalkan sebelum ada kontrak/presensi).
- Rekap bulanan (jumlah pertemuan, omset, laba bersih, dll.) dihitung dari baris `presensi`/`invoice`/`operasional` yang **sudah tercatat pada bulan itu** — bukan dihitung ulang secara live dari status siswa/kontrak saat ini. Jadi meskipun siswa/kontraknya kemudian dinonaktifkan, angka bulan-bulan sebelumnya tidak ikut berubah.
- **Prinsip snapshot:** angka yang sudah final disimpan sebagai kolom di baris transaksi, bukan dihitung ulang dari master:
  - `presensi.nominal_dibayar`, `presensi.denda` → snapshot dari `fee_mengajar` + nilai `pengaturan` saat presensi di-approve. Kalau fee kontrak atau pengaturan denda diubah nanti, presensi lama tidak berubah.
  - `invoice.harga_satuan`, `invoice.jumlah_pertemuan` → snapshot saat generate. Kalau harga kontrak siswa direvisi, invoice lama tidak berubah.
  - `presensi.unit_id`, `invoice.unit_id` (dst.) → snapshot. Kalau siswa dipindah unit, histori tetap tercatat di unit lamanya.
- Pengecualian: data pendaftaran tutor yang **ditolak** (Section 11) memang dihapus permanen — tapi ini terjadi sebelum tutor punya kontrak/presensi apa pun, jadi tidak memengaruhi histori manapun.

---

## 14. Rencana Urutan Pengembangan

Strategi: kerjakan dashboard **Manajer** lebih dulu (karena sidebar Manajer = superset dari Kepala Unit + HRD). Begitu Manajer fix, Kepala Unit & HRD tinggal reuse komponen yang sama dengan flag akses berbeda (unit-scoped vs lintas-unit, read-only vs edit). Pendekatan **mobile-first**, desktop menyusul setelah versi mobile tiap fase selesai.

### Fase 0 — Foundation
1. Halaman **Login** (sederhana dulu): form email/password, tombol "Daftar sebagai Tutor", tombol Google Sign-In (non-tutor).
2. Setup seluruh tabel di Supabase sesuai Section 7 + RLS policy dasar (Section 7.18).
3. SQL seed data dummy — mencakup: 5 units, users tiap role (termasuk beberapa tutor dengan status campuran termasuk `pending_approval`), orangtua & siswa, paket_belajar, kontrak_siswa, kontrak_tutor, jadwal, presensi (termasuk contoh kasus telat & direvisi), invoice, receipt, slip_gaji, operasional, genio_news.

> Skema + dummy dikerjakan tuntas dulu sebelum masuk UI, supaya saat membangun komponen tidak perlu bolak-balik ubah skema karena kebutuhan baru.

### Fase 1 — Dashboard Manajer (mobile-first)
Urutan modul (mengikuti alur dependency data):
1. Kelola Unit
2. Pengaturan (tabel `pengaturan` — dibutuhkan lebih awal karena dipakai modul Presensi)
3. Kelola Pengguna (termasuk Data Tutor + approve/reject pendaftar tutor baru)
4. Data Ortu & Siswa
5. Paket Belajar
6. Kontrak (kontrak siswa + kontrak tutor + jadwal)
7. Presensi (approval + riwayat, termasuk logika denda telat & alur revisi laporan ditolak)
8. Tagihan (invoice + receipt, termasuk tombol Generate Invoice)
9. Operasional
10. Penggajian (slip gaji, termasuk tombol Generate Slip Gaji)
11. Home & Progres (dikerjakan paling akhir karena berupa agregasi dari semua modul di atas)
12. Genio News

### [v5] Status per 27 Sep 2026

**Fase 0: selesai, kecuali Google Sign-In.**
- Selesai: skema lengkap, RLS, trigger, dan data dummy. Login email/password dan pendaftaran tutor.

**Fase 1 + Fase 2 (Manajer, HP dan desktop): sebagian besar selesai.**

Semua modul di bawah sudah diredesign mengikuti sistem desain v5 (highlight, tabel sticky, popup Genio UI, tampilan HP dan desktop). Jadi Fase 2 praktis dikerjakan bersamaan dengan Fase 1.

| # | Modul | Status | Yang masih kurang |
|---|---|---|---|
| 1 | Kelola Unit | Selesai | |
| 2 | Pengaturan | Selesai | |
| 3 | Kelola User + Kelola Tutor | Selesai | Tambah user dan tambah tutor, lalu tolak pendaftar dan hapus akun lewat Edge Function `admin-users` (ikut menghapus akun Auth). |
| 4 | Data Ortu & Siswa | Selesai | Hapus permanen untuk data tanpa histori (sekarang hanya nonaktifkan, dan ini boleh tetap begitu) |
| 5 | Paket Belajar | Selesai | |
| 6 | Kontrak + Jadwal | Selesai | |
| 7 | Presensi | Selesai (sisi Manajer), sisi tutor sebagian | PDF Laporan Belajar untuk presensi diwakilkan. Halaman Presensi tutor (isi, revisi, jadwal lengkap) sudah dibuat di Fase 4a. |
| 8 | Tagihan | Selesai (dengan sinkron otomatis) | |
| 9 | Operasional | Selesai | |
| 10 | Penggajian | Selesai (dengan generate otomatis) | Pengeluaran gaji di Home membaca `slip_gaji`, jadi baru terisi setelah menu Gaji bulan itu dibuka. |
| 11 | Home & Progres | Sebagian | Genio News dipindah ke paling atas. Tambah siswa aktif dan jumlah pertemuan di highlight, pie chart siswa aktif per unit, shortcut tagihan belum lunas. Menu Progres belum ada. |
| 12 | Genio News | Belum | Menu penuh dengan daftar, detail, dan editor (upload gambar dengan kompresi). |
| + | Profil | Selesai | Ubah email login belum dibuka. |
| + | Login | Sebagian | Redesign tampilan (ditunda), Google Sign-In. |

Bug kecil yang ditemukan: tombol "Lihat semua" di kartu Jadwal tutor (Home) membuka Kontrak, seharusnya Jadwal Mengajar.

### [v5] Fase 3a: Dashboard Kepala Unit (dikerjakan 27 Sep 2026)
- **Dock:** Home, Presensi, **Jadwal mengajar**, Lainnya. Gaji tidak tampil.
- **Lainnya:** Data ortu & siswa, Kontrak, Tagihan, Data tutor (hanya lihat), Operasional, Genio News, Profil.
- **Home (`ModuleHomeUnit.html`, opsi B):**
  - Sapaan dengan foto dan nama.
  - Highlight unit: omset sebagai angka utama dengan tren 6 bulan. Panel kanan transparan (bukan kartu putih): gauge setengah lingkaran margin dengan laba bersih di tengah (mint, koral kalau rugi), tumpukan avatar siswa aktif, titik sesi, dan pita koral pengeluaran (honor dari presensi + operasional).
  - Perlu tindakan: presensi menunggu, tagihan belum lunas, presensi telat, siswa belum ada tutor.
  - Sesi hari ini dengan status lapor dan tombol WA.
  - Tutor di unit ini (sesi, telat, ditolak).
  - Tren 3/6/12 bulan dengan garis periode sebelumnya.
  - Genio News di paling bawah.
- **Hak per halaman:**
  - Presensi: ubah status dan hapus (yang ditolak), sama seperti manajer.
  - Tagihan: tandai lunas, batalkan lunas, kirim WA. Tombol "Hapus tagihan" dihapus untuk semua role.
  - Operasional: tambah, edit, hapus.
  - Kontrak: hapus kontrak tutor disembunyikan.
  - Semua pilihan unit terkunci ke unitnya.
- **Database:** policy baru `receipt_delete_kepala_unit` dan `operasional_delete_kepala_unit`.
- **Sesi:** menyimpan `unit_id` dan `unit_nama` (`genioEnsureSessionProfile`).
- **Belum diuji dengan akun kepala unit asli.**

### [v5] Fase 3b: Dashboard HRD (dikerjakan 27 Sep 2026)
- **Dock:** Home, **Tutor** (kelola penuh + tinjau pendaftar), **Jadwal**, Lainnya.
- **Lainnya:** Data ortu & siswa, Kontrak, Presensi (hanya lihat), Genio News, Profil.
- **Hak:**
  - Tambah dan edit siswa, kontrak siswa, kontrak tutor, dan jadwal. RLS sudah mengizinkan lewat `is_staff_lintas_unit()`.
  - Tidak bisa menghapus kontrak tutor dan jadwal. Tombolnya disembunyikan.
  - Presensi tanpa tombol approval, isi untuk tutor, ubah status, maupun hapus.
- **Home (`ModuleHomeUnit.html` mode HRD, opsi B):**
  - Total gaji tutor bulan ini (dari `presensi.nominal_dibayar`) dengan batang 3 bulan.
  - Panel kanan transparan dengan pola yang sama: gauge persentase tutor mengajar dari tutor aktif, tumpukan avatar tutor yang mengajar, titik sesi, serta pil tutor telat lapor dan siswa baru bulan ini.
  - Perlu tindakan: pendaftar menunggu, tutor aktif tanpa jadwal, tutor telat lapor, siswa belum ada tutor.
  - Sesi Hari ini semua unit.
  - Kinerja tutor semua unit.
  - Tren SDM: pertemuan, gaji tutor, tutor mengajar.
  - Genio News.
- **Belum diuji dengan akun HRD asli.**

### [v5] Ganti email hanya oleh admin (30 Sep 2026)
- Pengguna **tidak bisa** mengganti email sendiri; kolom email di Profil tetap terkunci.
- **Manajer / super admin** mengganti email lewat **Kelola User > Edit pengguna**, **HRD** lewat **Data Tutor > Edit tutor** (tutor saja). Kepala unit tidak punya akses.
- Diproses Edge Function `admin-users` aksi `update_email`: mengganti email login di Supabase Auth dan salinan di `public.users` sekaligus, tanpa email verifikasi (tidak butuh SMTP). Kalau salah satu gagal, email login dikembalikan.
- Sebelumnya edit email di dua halaman itu hanya mengubah tabel `users`, sehingga email login tidak ikut berganti.
- **Perlu redeploy Edge Function `admin-users`** setelah kode ini dipakai.

### [v5] Menu tambah cepat dan peta ikon
- Tombol + di bottom bar (HP) dan pill di kanan bawah (desktop). Tutor: langsung membuka alur isi presensi, tanpa menu. Manajer dan super admin tidak memakai tombol +. Kepala unit: menu presensi, siswa, operasional, kontrak, jadwal. HRD: menu tutor, siswa, kontrak, jadwal. Menu berupa roda setengah lingkaran dari balik bottom bar (HP) atau kartu daftar "Tambah baru" (desktop). Tiap pilihan membuka modulnya lalu menekan tombol tambah modul itu. Ditutup lewat ×, ketuk di luar, atau Esc.
- Ikon disamakan per konsep di seluruh aplikasi (dock, menu Lainnya, Home, popup): presensi check-circle, siswa student, kontrak file-text, jadwal calendar-blank, operasional receipt, tagihan credit-card, tutor chalkboard-teacher, paket belajar books, unit buildings, user user-gear, news newspaper, pengaturan gear. Menu Lainnya sekarang memakai ikon Phosphor yang sama dengan modul.

### [v5] Tombol + isi presensi tutor
- Tutor: tombol + bulat biru (stroke putih) di tengah bottom bar pada HP, pill putih "Isi presensi" dengan tombol + di kiri pada pojok kanan bawah desktop. Keduanya membuka pemilih sesi, tampil di semua halaman tutor, dan menghilang saat popup terbuka. Tombol Isi presensi di highlight Beranda dan Presensi dihapus. Bottom bar dibuat lebih ringkas (maks 350px) dan latar tombol dock bulat penuh di HP dan desktop.
- Bottom bar HP baru: bar mengambang dengan tab sama lebar, ikon 24px, tab aktif berupa ikon terisi dengan garis biru di atasnya (tanpa pil). Tutor, kepala unit, dan HRD: bar punya cekungan di tengah dan tombol + bergradasi biru duduk di cekungan itu. Manajer tetap bar polos tanpa +.
- Tutor: tombol + tetap tampil selama pemilih sesi, form isi presensi, atau preview laporan terbuka, berputar menjadi x (desktop: label "Tutup"), dan menutup popup saat ditekan. Di HP popup berhenti di atas bottom bar. Popup muncul dari tombol + dan kembali mengecil ke tombol itu saat ditutup. Pindah dari pemilih siswa ke form (dan kembali lewat kolom siswa) memakai satu kartu yang isinya bergeser, tanpa tutup lalu buka popup baru. Tombol + tutor langsung membuka form isi presensi; bagian setelah kolom siswa terkunci sampai siswa dipilih, dan pemilih siswa berupa dropdown di bawah kolom siswa di dalam form (cari, daftar nama), bukan popup terpisah. Bottom bar HP diganti gaya kapsul abu muda: hanya ikon (tulisan tetap di tab header desktop), tab aktif berupa pil putih yang bergeser, tombol + biru 48px tepat di slot tengah (tanpa cekungan).

### [v5] Pagination tabel (semua modul)
- Semua tabel data punya footer otomatis dari `Config.html` (`genioPager`): info posisi, pilihan baris per halaman (10/25/50/100), tombol pertama, sebelumnya, nomor halaman, berikutnya, terakhir. Pilihan disimpan terpisah untuk HP dan layar lebar. Kembali ke halaman 1 saat jumlah data berubah (cari, filter). Footer tidak tampil kalau data 10 atau kurang. Berlaku di Kelola user, Data tutor, Gaji, Gaji tutor, Jadwal, Kelola unit, Kontrak, Operasional, Ortu dan siswa, Paket belajar, Presensi, Presensi tutor, dan Tagihan. Tampilan kartu tidak dipaginasi.

### [v5] Fase 4a: Presensi tutor (dikerjakan 28 Sep 2026)
- **Dock tutor:** Beranda, Presensi, Gaji, Profil. Tidak ada menu Lainnya. Genio News nanti cukup tampil di Beranda.
- **Beranda tutor** masih panel "sedang dikembangkan" (Fase 4b). Gaji tutor sudah (Fase 4c, lihat di bawah).
- **Halaman Presensi (`ModulePresensiTutor.html`, panel `presensi-tutor`):**
  - **Highlight:**
    - Angka utama: jumlah perlu tindakan, dengan batang presensi per minggu (amber = ada laporan telat).
    - Ring status bulan ini.
    - Tombol **Isi presensi**: pilih siswa, lalu isi form.
  - **Tab Progres presensi**, dengan filter:
    - **Perlu tindakan:** laporan ditolak (Revisi laporan) di paling atas, lalu jadwal hari ini dan sesi fleksibel minggu ini yang belum dilapor.
    - **Menunggu:** laporan yang belum diperiksa.
    - **Selesai:** diterima atau visit pada periode header, dengan centang hijau.
  - **Tab Jadwal lengkap:**
    - **Jadwal mingguan** tampil tepat di bawah highlight, di tab mana pun (Progres presensi maupun Jadwal lengkap). Panah detail di popup pindah ke tab Jadwal lengkap lalu menyorot kontraknya. seperti kepala unit tetapi hanya jadwal tutor itu: satu titik satu sesi, warna per siswa, kolom fleksibel di depan. Ketuk titik membuka popup dengan tombol **Chat (nama kepala unit)** (WhatsApp, kepala unit dari unit kontrak lewat RPC `tutor_kontak_bantuan`), **Isi presensi**, dan panah detail yang menggulir dan menyorot kartu atau baris kontrak yang sesuai di bawahnya.
    - Per kontrak aktif: jadwal acuan dan pertemuan bulan ini dibanding estimasi.
    - Estimasi pertemuan = jumlah sesi per minggu × 4.
    - Estimasi fee bulan ini, dengan rincian mengajar dan transport per sesi.
  - **Tampilan:** kartu atau tabel. Kartu selalu sama tinggi dan tombol aksinya selalu satu dan sama lebar.
  - **Lihat laporan:** preview HTML laporan belajar dari `previewLaporanBelajarHtml` di `Code.gs` (template yang sama dengan PDF), ditambah tautan lampiran dan PDF bila sudah ada.
  - **Form:**
    - Jadwal hanya acuan. Tanggal dan jam diisi sesuai pelaksanaan.
    - Peringatan muncul bila sudah lewat 24 jam.
    - Foto HEIC dikonversi dan dikompres ke JPEG maksimal 1600px.
    - Revisi boleh mengubah tanggal, jam, materi, link, dan foto.
  - **Keamanan:** trigger `presensi_before_write` memaksa laporan tutor berstatus `pending`, lihat `supabase/migrations/20260927_presensi_tutor_write_guard.sql`.
- **Lonceng notifikasi tutor:** hanya laporan ditolak yang perlu direvisi.
- **Profil tutor:** baris unit tidak ditampilkan, karena tutor tidak terikat unit mana pun.
- **Foto tutor di semua role:** pemilih tutor di form kontrak tutor dan di "Isi presensi untuk tutor" sekarang ikut menampilkan foto profil, atau inisial kalau belum ada foto.
- **Belum diuji dengan akun tutor asli.**
- **Sorotan laporan ditolak:** hanya pill status "Perlu revisi" yang berkedip pelan (latar dan tulisan memudar lalu jelas lagi, ±2,4 dtk), di kartu maupun tabel. Tanpa bayangan atau garis tepi merah. Mode kurangi gerakan: tanpa kedip.

### [v5] Fase 4b: Beranda tutor (dikerjakan 28 Sep 2026, opsi B)
- **Halaman:** `ModuleHomeTutor.html`, panel `home-tutor`. Memakai kelas `.kuh-*` dari Home kepala unit.
- **Sapaan:** foto, nama, dan tanggal.
- **Highlight:**
  - Gaji bulan ini (periode header), dibanding bulan lalu.
  - Nominal yang masih menunggu approval.
  - Garis gaji 6 bulan dengan kurva monoton.
  - Tombol **Isi presensi**.
  - Panel kanan (opsi G) mengikuti pola highlight modul lain: cincin progres pertemuan ("4/16", terlaksana + visit dari estimasi jadwal × 4), daftar Terlaksana, Visit (hanya kalau ada), Menunggu, Tepat waktu, Denda telat (hanya kalau ada), lalu bantuan "Jadwal untuk isi presensi belum muncul?" dengan tombol putih berikon WhatsApp hijau. Kontak diambil dari RPC `tutor_kontak_bantuan()` (`supabase/migrations/20260928_tutor_kontak_bantuan.sql`, sudah terpasang 29 Sep 2026): semua kepala unit aktif (unit tempat tutor punya kontrak aktif ditandai "Unit Anda" dan ditaruh paling atas), atau manajer kalau belum ada kepala unit. Tombol selalu membuka popup pilih kepala unit; sapaan Mr. (L), Ms. (P), Kak kalau kosong. RPC belum ada atau nomor kosong: WhatsApp dibuka dengan pesan saja.
- **Perlu tindakan:** perlu revisi, jadwal hari ini, menunggu diperiksa, slip belum dibayar. Kartu membuka Presensi dengan filter yang sesuai, atau tab Riwayat slip di Gaji.
- **Laporan ditolak** (kartu terpisah, hanya muncul kalau ada): angka jumlah di panel kiri gradien merah, daftar laporan (siswa, mapel, tanggal, catatan penolakan, tombol Revisi) maksimal sekitar 3 baris lalu digeser. Desktop: di atas Sesi hari ini dengan lebar sama (kolom kiri, Tren mengajar di kanan).
- **Tanpa laporan ditolak:** kartu merah diganti kartu hijau "Semua laporan aman" dengan centang besar (menggambar sendiri), dan kotak Perlu revisi di deretan atas jadi hijau bercentang dengan angka 0.
- **Sesi hari ini:** grid jam seperti Home kepala unit (`.kuh-jm-*`, `.home-jm-*`) berisi jadwal tutor itu saja: baris Hari ini, Kemarin (kalau ada jadwal), dan Fleksibel (kolom Bebas). Titik berwarna per siswa, cincin hijau = sudah lapor, amber = belum lapor. Titik dibuka jadi popup: Chat (kepala unit dari unit kontrak, RPC `tutor_kontak_bantuan`) dan Isi presensi (Revisi kalau ditolak) lewat `window.genioPresensiTutor.open`; popup Presensi tutor dipindah ke `body`. Setelah terkirim, Beranda dimuat ulang (event `genio:presensi-tutor`).
- **Tab bar tutor** (Presensi: Progres presensi / Jadwal lengkap dan filter Perlu tindakan / Menunggu / Selesai; Gaji: Rincian / Riwayat slip; Beranda: Pertemuan / Gaji) bisa ditahan lalu digeser (`genioBindScrub` di Config). Ganti tab, filter, atau tampilan tidak melompat ke atas (`genioKeepScroll`).
- **Tren mengajar 3 bulan** (garis + kotak bulan):
  - Pertemuan atau gaji.
  - Garis bergradasi biru dengan area lembut, nilai di tiap titik, dan titik bulan terpilih berdenyut.
  - Garis putus-putus abu-abu untuk 3 bulan sebelumnya.
  - Crosshair dan tooltip; kotak bulan di bawahnya ikut menyala.
  - Tiga kotak bulan berisi angka dan selisih persen dari bulan sebelumnya (semua bulan berlatar sama).
  - Di desktop setinggi kartu Sesi hari ini.
- **Genio News:** ketuk untuk membuka tautannya.
- **Belum diuji dengan akun tutor asli.**

### [v5] Fase 4c: Gaji tutor (dikerjakan 28 Sep 2026)
- **Halaman:** `ModuleGajiTutor.html`, panel `gaji-tutor`.
- **Highlight:**
  - Angka utama: gaji periode header, dari presensi diterima dan visit. Kalau slip sudah dibayar, angkanya diambil dari `slip_gaji.total_gaji`.
  - Status: sudah dibayar dengan tanggal, menunggu transfer, atau masih berjalan.
  - Batang 6 bulan, bulan terpilih berwarna mint.
  - Legenda: sesi dibayar, visit, dan presensi yang masih menunggu approval (sesi dan nominal).
  - Panel samping: mengajar, transport, visit, denda telat, dan rekening.
  - Tombol **Lihat slip gaji**. Kalau slip belum dibuat, tombolnya jadi **Lihat estimasi slip**.
- **Tab Rincian bulan ini:**
  - Kartu per siswa dan jenis: satu anak bisa punya kartu "N Diterima" dan kartu "N Visit" yang terpisah (pill di pojok kanan atas). Isinya chip mapel dan jam, total dibayar, dan rumus uang saja (mis. "Rp 250.000 + Rp 40.000 − Rp 1.500"; kartu visit tanpa rumus). Tombol "Detail" pindah ke tampilan tabel dengan pencarian nama anak itu.
  - Tabel per sesi: mengajar, transport, denda, dan dibayar, dengan baris total.
- **Tab Riwayat slip:** slip per periode dari `slip_gaji`, status sudah atau belum dibayar dengan tanggal transfer.
- **Lihat slip:** preview HTML dari `previewSlipGajiHtml` di `Code.gs` (template yang sama dengan PDF slip), ditambah Unduh PDF bila sudah ada.
- **Belum diuji dengan akun tutor asli.**
- **Panel kanan highlight (opsi J):** cincin komposisi penghasilan (porsi mengajar, transport, visit; angka tengah persen mengajar), daftar nominal termasuk denda telat, kartu rekening berikon bank, dan tombol Lihat slip gaji.

### [v5] Minimalisasi tampilan semua role (8 Okt 2026)
- **Beranda tutor:** blok bantuan di highlight jadi satu baris "Jadwal belum muncul?" dengan tombol ringkas "Hubungi kepala unit". Di desktop highlight dirapatkan dari 214px ke 180px (garis gaji 52px, padding lebih tipis).
- **Kartu sesi presensi tutor (HP):** teks bantuan untuk jadwal hari ini/fleksibel dan rincian Mengajar/Transport dihapus. Info terlambat/denda pindah ke baris info. Tombol aksi ringkas (Revisi / Isi presensi / Lihat) sejajar dengan honor. "Alasan ditolak" tetap tampil. Tabel desktop tidak berubah.
- **Profil (semua role):** baris tanpa ikon. Di HP label di kiri dan nilai di kanan; di desktop label tetap di atas nilai. Bagian Akun disembunyikan karena nama, peran, unit, dan tanggal bergabung sudah ada di kartu atas.
- **Judul daftar (kepala unit, HRD, manajer, super admin):** chip jumlah (`*-resultCount`) disembunyikan; sub-baris "x aktif · y nonaktif" di highlight Data tutor, Ortu & siswa, Kontrak, dan Kelola user juga disembunyikan.
- **Alasan ditolak (tutor, opsi A):** teks tidak lagi merah. Kartu sesi dan catatan di form revisi memakai kotak abu dengan garis merah 2px di kiri, label kecil "Alasan ditolak" di atas teks hitam. Kolom Keterangan di tabel hitam. Kartu "Laporan ditolak" di beranda: panel angka putih dengan angka merah (tanpa gradasi), alasan abu dengan ikon chat merah kecil.
- **Contoh laporan pembelajaran (tutor, opsi B):** tombol "Contoh" di kanan label Ringkasan sesi membuka kartu contoh (penanda Materi, Kegiatan, Perkembangan siswa) dengan nama siswa yang dipilih; "Pakai contoh ini" mengisi kolom, dengan konfirmasi kalau kolom sudah berisi.
- **Sesi hari ini (kepala unit, HRD, manajer):** disamakan dengan beranda tutor: baris Hari ini, Kemarin, dan Fleksibel (minggu ini), dengan tanda sudah/belum lapor per sesi; popup menyebut status kemarin/minggu ini dan pesan pengingat menyesuaikan.
- **Highlight HRD dan Data Ortu & Siswa (desktop lebih padat):** Home HRD memakai garis tren gaji 6 bulan dan bar "N tutor aktif / X% mengajar bulan ini" (menggantikan gauge). Highlight Data Ortu & Siswa memakai satu batang jenjang bersegmen dengan legenda; panel kanan menampilkan siswa aktif per unit (4 teratas + "N unit lain"), atau per jenis kelamin untuk kepala unit (satu unit).
- **Tombol + kepala unit/HRD:** roda pilihan muncul seperti kipas dari balik bar (busur dari 0 sampai setengah lingkaran penuh) dan menyapu balik saat ditutup (desktop: kartu berayun dari tombol). Form yang dibuka dari pilihan tumbuh dari pilihan itu (roda pilihan menutup), tombol + tetap tampil sebagai x di atas lapisan gelap dan menutup form (juga Esc dan tab bawah), sama seperti tutor.
- **Lainnya:** kartu profil jadi satu baris ringkas (avatar, nama, peran · unit, tombol panah); seluruh kartu bisa diketuk untuk membuka profil.

### [v5] Langkah berikutnya (disepakati 27 Sep 2026)
1. ~~Penggajian: generate slip gaji~~ (selesai, otomatis saat menu Gaji dibuka).
2. ~~Profil: Edit~~ (selesai). Dibutuhkan semua role. Isinya:
   - nama, jenis kelamin, no HP
   - foto profil dengan kompresi canvas
   - ganti password
   - khusus tutor: keahlian, pendidikan terakhir, no WA, bank dan rekening
3. ~~Kelola User / Tutor~~ (selesai, Edge Function `admin-users`):
   - Tambah akun dari admin.
   - Tolak pendaftar dan hapus user sekalian menghapus akun Supabase Auth. Ini butuh proses sisi server.
4. **Fase 3: Dashboard Kepala Unit (sudah, lihat di atas) & HRD (berikutnya).** Prasyaratnya:
   - Simpan `unit_id` di sesi.
   - Buat konfigurasi menu per role (dock + Lainnya).
   - Terapkan flag akses per modul (unit-scoped, read-only).
   - Uji RLS dengan akun asli.
5. **Fase 4: Dashboard Tutor** (Section 6.1). Presensi (4a), Beranda (4b), dan Gaji (4c) sudah.
6. **Genio News**, paling akhir. Sampai saat itu menu tetap berlabel "Coming Soon".

Tidak dikerjakan untuk saat ini:
- Home & Progres, karena Home sudah diredesign.
- Redesign dan Google Sign-In di Login.

### Fase 2 — Desktop layout (Manajer)
Adaptasi seluruh modul Fase 1 ke layout desktop, setelah versi mobile-nya fix.

### Fase 3 — Dashboard Kepala Unit & HRD
Reuse komponen dari dashboard Manajer, terapkan flag akses masing-masing role (unit-scoped, read-only Data Tutor untuk Kepala Unit, sembunyikan menu yang tidak relevan). Mobile dulu, lalu desktop.

### Fase 4 — Dashboard Tutor
Dibangun terpisah dari awal (bukan reuse komponen Manajer): Beranda, Form Isi Presensi, Riwayat Presensi, Slip Gaji, Genio News, Profile. Mobile-first lalu desktop.

---

*PRD v4 ini sudah mencakup: alur bisnis lengkap, skema database detail (termasuk denormalisasi `unit_id` dan tabel `pengaturan`), harga kontrak berbasis satuan per pertemuan, foto profil semua role, denda keterlambatan lapor, alur revisi presensi, pengisian presensi oleh Manajer/Kepala Unit mewakili tutor (Section 4.3), generate invoice & slip gaji manual per bulan sebelumnya, tutor lintas unit, sidebar per role, pendaftaran mandiri tutor, Genio News (termasuk preview di Home tiap role & HRD sebagai editor), kebijakan retensi data historis (Section 13), dan rencana urutan pengembangan (Section 14). Progress pengembangan bisa mengikuti urutan fase di atas kapan pun dilanjutkan, di sesi manapun.*

**Changelog v2 → v3:**
- Genio News: HRD kini jadi **editor** (create/edit/hapus post), sebelumnya read-only. Editor sekarang: Manajer, HRD, Super Admin.
- Ditambahkan cuplikan singkat Genio News di bagian atas dashboard Home/Beranda di **semua role** (Tutor, Kepala Unit, HRD, Manajer, Super Admin) — sifatnya preview read-only, aksi edit tetap di menu Genio News penuh.

**Changelog v3 → v4:**
- Ditambahkan **Section 4.3**: Manajer (lintas unit) dan Kepala Unit (dibatasi unitnya sendiri) bisa mengisikan presensi mewakili tutor yang berkendala (mis. masalah internet/akses web), lewat tombol "Isi Presensi untuk Tutor" di tab Presensi → popup search & pilih tutor aktif → pilih jadwal tutor tsb → isi form presensi seperti biasa.
- Presensi yang diisikan lewat alur ini (`metode_input = diwakilkan`) **langsung berstatus `diterima`** (skip approval terpisah) dan **dikecualikan dari denda keterlambatan lapor**.
- Tabel `presensi` (Section 7.10) ditambah kolom `metode_input` dan `diinput_oleh` untuk audit trail.
- RLS Kepala Unit (Section 7.18) diperjelas: insert presensi diwakilkan tetap dibatasi `unit_id` unitnya sendiri, walau tutornya bisa mengajar di unit lain.

**Changelog v4 → v5 (27 Sep 2026):**
- **Disesuaikan dengan aplikasi yang sudah dibangun untuk Manajer:**
  - Sistem desain (Section 0).
  - Struktur aplikasi dan navigasi dock + header + Lainnya (Section 1, 6.0).
  - Daftar menu Manajer aktual (Section 6.4).
- **Jadwal Mengajar** jadi menu sendiri, terpisah dari Kontrak.
- **Pemilih periode global** di header menggantikan dropdown bulan per halaman. **Lonceng notifikasi** ditambahkan.
- **Tagihan dan slip gaji** digenerate otomatis saat menunya dibuka, menggantikan tombol "Generate Invoice" dan "Generate Slip Gaji". Ditambah: kirim WhatsApp, batalkan lunas, hapus tagihan.
- **Perhitungan presensi** (telat, denda, visit, reset revisi, diwakilkan) dilakukan oleh trigger database `presensi_before_write`.
- **Kolom tambahan:**
  - `users.no_hp`
  - `siswa.jenis_kelamin/jenjang/kelas/sekolah`
  - `paket_belajar.jenjang/jenis/pelaksanaan/mode_belajar`
  - `kontrak_siswa.nomor_kontrak`
  - `kontrak_tutor.durasi_menit`
  - `presensi.catatan_pembelajaran_url`
  - `operasional.foto_url`
- **Pendaftaran tutor** juga meminta nama bank dan nomor rekening.
- **Struktur folder Drive** saat ini dipisah per jenis dokumen (Section 1a).
- **Status pengembangan** dan langkah berikutnya ditambahkan di Section 14.

