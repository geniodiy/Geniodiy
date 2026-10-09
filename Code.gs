/**
 * Genio Institute — Sistem Manajemen Bimbel
 * Entry point Web App. Routing halaman lewat query param ?page=...
 * Dashboard per role akan ditambahkan bertahap (Fase 1-4 di PRD).
 */

var PAGES = {
  login: 'Login',
  // Login.html sudah mencakup form Masuk & Daftar Tutor dalam satu halaman (toggle via JS).
  dashboard: 'Dashboard'
};

function doGet(e) {
  var page = (e && e.parameter && e.parameter.page) || 'login';
  var templateName = PAGES[page] || 'Login';

  var template = HtmlService.createTemplateFromFile(templateName);
  // URL /exec sering melalui rantai redirect internal Google, jadi path relatif
  // seperti "?page=dashboard" bisa salah resolve. Kirim URL deployment yang
  // sebenarnya ke client supaya navigasi antar-halaman selalu pakai URL absolut.
  // (Dashboard.html sendiri sekarang menghitung SCRIPT_URL di sisi client, tapi
  // Login.html masih memakai nilai ini.)
  template.scriptUrl = ScriptApp.getService().getUrl();

  return template.evaluate()
    .setTitle('Genio Institute')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, interactive-widget=resizes-content')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * ===== Upload file presensi (Dokumentasi & Catatan Pembelajaran) ke Google Drive =====
 * Dipanggil dari client lewat google.script.run. File disimpan dalam folder khusus
 * per jenis, lalu dibagikan "anyone with link, view only" supaya URL-nya bisa dipakai
 * langsung ditampilkan/dibuka dari dalam aplikasi tanpa perlu share manual per user.
 */
function getOrCreateDriveFolder_(parentFolder, name) {
  var it = parentFolder.getFoldersByName(name);
  if (it.hasNext()) return it.next();
  return parentFolder.createFolder(name);
}

/**
 * Isi ID folder Google Drive di sini kalau mau tentukan sendiri lokasi
 * penyimpanan (bukan dibuat otomatis). Cara ambil ID: buka folder tujuan
 * di Google Drive, lihat URL-nya —
 *   https://drive.google.com/drive/folders/INI_ID_FOLDERNYA
 * Kosongkan string-nya ('') kalau mau tetap pakai folder otomatis "Genio
 * Institute - Uploads" seperti sebelumnya.
 */
var PRESENSI_FOLDER_IDS = {
  foto: '1PkJicYsWzCgBQwdygLZ8Nz2kRR9KIjeR',     // <-- isi ID folder "Dokumentasi Presensi" di sini
  catatan: '1PkJicYsWzCgBQwdygLZ8Nz2kRR9KIjeR'   // <-- ID folder "Catatan Pembelajaran" (PDF/gambar); sekarang satu folder dengan dokumentasi
};

function uploadPresensiFile(base64Data, fileName, mimeType, jenis) {
  try {
    var jenisKey = (jenis === 'catatan') ? 'catatan' : 'foto';
    var configuredId = PRESENSI_FOLDER_IDS[jenisKey];

    var subfolder;
    if (configuredId) {
      subfolder = DriveApp.getFolderById(configuredId);
    } else {
      var rootFolder = getOrCreateDriveFolder_(DriveApp.getRootFolder(), 'Genio Institute - Uploads');
      var subfolderName = (jenisKey === 'catatan') ? 'Catatan Pembelajaran' : 'Dokumentasi Presensi';
      subfolder = getOrCreateDriveFolder_(rootFolder, subfolderName);
    }

    var bytes = Utilities.base64Decode(base64Data);
    var blob = Utilities.newBlob(bytes, mimeType, fileName);
    var file = subfolder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    return { success: true, url: file.getUrl(), fileId: file.getId(), name: file.getName() };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * ID folder Google Drive khusus buat bukti pengeluaran Operasional (struk/kwitansi).
 * URL Folder: https://drive.google.com/drive/folders/1F6oXPSiN4YCIx1AgUORSxBrUjS6XQkOs
 */
var OPERASIONAL_FOLDER_ID = '1F6oXPSiN4YCIx1AgUORSxBrUjS6XQkOs';

function uploadOperasionalFile(base64Data, fileName, mimeType) {
  try {
    var subfolder;
    if (OPERASIONAL_FOLDER_ID) {
      subfolder = DriveApp.getFolderById(OPERASIONAL_FOLDER_ID);
    } else {
      var rootFolder = getOrCreateDriveFolder_(DriveApp.getRootFolder(), 'Genio Institute - Uploads');
      subfolder = getOrCreateDriveFolder_(rootFolder, 'Bukti Operasional');
    }

    var bytes = Utilities.base64Decode(base64Data);
    var blob = Utilities.newBlob(bytes, mimeType, fileName);
    var file = subfolder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    return { success: true, url: file.getUrl(), fileId: file.getId(), name: file.getName() };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Folder induk untuk unggahan baru (cap + tanda tangan dan bukti pemasukan lain), pilihan owner 9 Okt 2026.
 * Subfolder dibuat otomatis di dalamnya. Kosongkan untuk kembali ke "Genio Institute - Uploads" di root Drive.
 */
var UPLOADS_FOLDER_ID = '1dntccwxbd_CI-CRnpql82mKkEsWz1V1y';
function getUploadsFolder_() {
  if (UPLOADS_FOLDER_ID) {
    try { return DriveApp.getFolderById(UPLOADS_FOLDER_ID); } catch (e) { /* folder tidak bisa dibuka: pakai bawaan */ }
  }
  return getOrCreateDriveFolder_(DriveApp.getRootFolder(), 'Genio Institute - Uploads');
}

/**
 * Bukti foto pemasukan lain (wajib di form Pemasukan lain), subfolder "Bukti Pemasukan Lain" di folder unggahan.
 */
function uploadPemasukanLainFile(base64Data, fileName, mimeType) {
  try {
    var subfolder = getOrCreateDriveFolder_(getUploadsFolder_(), 'Bukti Pemasukan Lain');
    var blob = Utilities.newBlob(Utilities.base64Decode(base64Data), mimeType, fileName);
    var file = subfolder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return { success: true, url: file.getUrl(), fileId: file.getId(), name: file.getName() };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * ID folder Google Drive untuk foto profil (semua role). Kosongkan untuk folder
 * otomatis "Genio Institute - Uploads/Foto Profil".
 * Foto sudah dikompres di browser (maks. lebar 800px) sebelum dikirim ke sini.
 * URL yang dikembalikan adalah link gambar langsung supaya bisa dipakai di <img src>.
 */
var PROFIL_FOLDER_ID = '1xcwChbByNVpdhitV6W6PXEZFxCjx5Oay';

function uploadProfilFile(base64Data, fileName, mimeType) {
  try {
    var subfolder;
    if (PROFIL_FOLDER_ID) {
      subfolder = DriveApp.getFolderById(PROFIL_FOLDER_ID);
    } else {
      var rootFolder = getOrCreateDriveFolder_(DriveApp.getRootFolder(), 'Genio Institute - Uploads');
      subfolder = getOrCreateDriveFolder_(rootFolder, 'Foto Profil');
    }

    var bytes = Utilities.base64Decode(base64Data);
    var blob = Utilities.newBlob(bytes, mimeType, fileName);
    var file = subfolder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    return { success: true, url: 'https://lh3.googleusercontent.com/d/' + file.getId(), fileId: file.getId(), name: file.getName() };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Cap + tanda tangan untuk PDF (menu Pengaturan > Identitas dokumen). Disimpan di "Genio Institute - Uploads/Identitas Dokumen";
 * file lama dibuang saat diganti. ID file disimpan di pengaturan identitas_dokumen.ttd_file_id.
 */
function uploadDokumenTtd(base64Data, fileName, mimeType, oldFileId) {
  try {
    if (!/^image\/(png|jpeg)$/.test(mimeType || '')) return { success: false, error: 'Gunakan gambar PNG atau JPG' };
    var folder = getOrCreateDriveFolder_(getUploadsFolder_(), 'Cap dan Tanda Tangan');
    var file = folder.createFile(Utilities.newBlob(Utilities.base64Decode(base64Data), mimeType, fileName || 'cap-tanda-tangan.png'));
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    if (oldFileId && oldFileId !== file.getId()) {
      try { DriveApp.getFileById(oldFileId).setTrashed(true); } catch (e) {}
    }
    return { success: true, fileId: file.getId(), url: 'https://lh3.googleusercontent.com/d/' + file.getId() };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * ID folder Google Drive khusus untuk menyimpan file PDF Slip Gaji Tutor (pdf-slip-gaji).
 * Cara ambil ID: buka folder tujuan di Google Drive, lihat URL-nya:
 *   https://drive.google.com/drive/folders/INI_ID_FOLDERNYA
 * Kosongkan string-nya ('') jika mau dibuatkan otomatis dalam folder "Genio Institute - Uploads/Slip Gaji".
 */
var SLIP_GAJI_FOLDER_ID = '175pC_l-tYbYXPruIHhsrxZI5Q3BAeZZO';

/**
 * ID Folder Google Drive untuk menyimpan PDF Laporan Belajar Siswa (Presensi).
 * URL Folder: https://drive.google.com/drive/folders/1SZ8BUZRq_G0d283Ku-vLR9PHm_u2pfWi
 */
var LAPORAN_BELAJAR_FOLDER_ID = '1SZ8BUZRq_G0d283Ku-vLR9PHm_u2pfWi';

/**
 * ID Folder Google Drive untuk PDF Invoice (belum lunas) dan Kuitansi (lunas), dipisah.
 * Kosongkan ('') jika ingin dibuatkan otomatis dalam folder "Genio Institute - Uploads/Tagihan & Kuitansi".
 */
var INVOICE_FOLDER_ID = '1GQicyee2sBrGzzdKVdGooB69kZuycoQJ';
var KUITANSI_FOLDER_ID = '10E1hTgF-PHMTMUIrjQa4RHpk_BoUolGX';

/**
 * Preview laporan belajar dalam bentuk HTML (tampilan yang sama dengan PDF, tanpa membuat file).
 * Dipakai tombol "Lihat laporan" di dashboard tutor.
 */
function previewLaporanBelajarHtml(laporanData) {
  try {
    return { success: true, html: buildLaporanBelajarHtml_(laporanData || {}) };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function generateLaporanBelajarPdf(laporanData) {
  try {
    var subfolder = getLaporanBelajarFolder_();

    var htmlContent = buildLaporanBelajarHtml_(laporanData);
    var cleanSiswa = (laporanData.siswaNama || 'Siswa').replace(/[^a-zA-Z0-9_\- ]/g, '').trim().replace(/\s+/g, '_');
    var cleanTgl = (laporanData.tanggalRaw || laporanData.tanggal || 'Tanggal').replace(/[^a-zA-Z0-9_\-]/g, '_');
    var idShort = (laporanData.id || '').substring(0, 8);
    var fileName = 'Laporan_Belajar_' + cleanSiswa + '_' + cleanTgl + (idShort ? '_' + idShort : '') + '.pdf';

    // Hapus file lama jika ada dengan nama yang sama di subfolder agar tidak duplikat di Drive
    try {
      var existingFiles = subfolder.getFilesByName(fileName);
      while (existingFiles.hasNext()) {
        existingFiles.next().setTrashed(true);
      }
    } catch (cleanErr) {
      Logger.log('Warning cleaning old file: ' + cleanErr.message);
    }

    var blob = Utilities.newBlob(htmlContent, 'text/html', 'laporan.html')
      .getAs('application/pdf')
      .setName(fileName);

    var file = subfolder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    return {
      success: true,
      url: file.getUrl(),
      fileId: file.getId(),
      name: file.getName()
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function getLaporanBelajarFolder_() {
  if (LAPORAN_BELAJAR_FOLDER_ID) return DriveApp.getFolderById(LAPORAN_BELAJAR_FOLDER_ID);
  var rootFolder = getOrCreateDriveFolder_(DriveApp.getRootFolder(), 'Genio Institute - Uploads');
  return getOrCreateDriveFolder_(rootFolder, 'Laporan Belajar');
}

/**
 * PDF rekap laporan belajar untuk satu orang tua dalam satu periode (tab "Kirim laporan" di Presensi).
 * Header dan identitas sekali di atas, tabel ringkasan, lalu rincian tiap pertemuan per siswa, footer sekali di akhir.
 * Nama file memuat kunci isi (rekapKey dari daftar id presensi), jadi rekap dengan isi sama menimpa file lama,
 * sedangkan rekap susulan dengan isi berbeda menjadi file baru dan link yang sudah dikirim ke orang tua tetap hidup.
 */
function generateRekapLaporanPdf(rekapData) {
  try {
    var d = rekapData || {};
    var folder = getOrCreateDriveFolder_(getLaporanBelajarFolder_(), 'Rekap Laporan Belajar');
    var clean = function (s) { return String(s || '').replace(/[^a-zA-Z0-9_\- ]/g, '').trim().replace(/\s+/g, '_'); };
    var fileName = 'Rekap_Laporan_Belajar_' + (clean(d.ortuNama) || 'Orang_Tua') + '_' + clean(d.tanggalMulai) + '_sd_' + clean(d.tanggalSelesai) +
      (d.rekapKey ? '_' + clean(d.rekapKey) : '') + '.pdf';
    try {
      var existing = folder.getFilesByName(fileName);
      while (existing.hasNext()) existing.next().setTrashed(true);
    } catch (cleanErr) {
      Logger.log('Warning cleaning old rekap: ' + cleanErr.message);
    }
    var blob = Utilities.newBlob(buildRekapLaporanHtml_(d), 'text/html', 'rekap.html').getAs('application/pdf').setName(fileName);
    var file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return { success: true, url: file.getUrl(), fileId: file.getId(), name: file.getName(), size: file.getSize() };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Isi file PDF laporan belajar (satuan atau rekap) sebagai base64, supaya browser bisa langsung
 * menyimpan atau membagikan file tanpa membuka Google Drive. Hanya file PDF laporan belajar
 * (nama berawalan Laporan_Belajar_ atau Rekap_Laporan_Belajar_) yang dilayani.
 */
function getLaporanFileBase64(fileIdOrUrl) {
  try {
    var fileId = String(fileIdOrUrl || '');
    var m = fileId.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || fileId.match(/\/d\/([a-zA-Z0-9_-]+)/) || fileId.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (m && m[1]) fileId = m[1];
    if (!/^[a-zA-Z0-9_-]{10,}$/.test(fileId)) return { success: false, error: 'File tidak dikenali' };
    var file = DriveApp.getFileById(fileId);
    var name = file.getName();
    if (!/^(Rekap_)?Laporan_Belajar_.*\.pdf$/i.test(name)) return { success: false, error: 'Bukan file laporan belajar' };
    if (file.isTrashed()) return { success: false, error: 'File laporan sudah diganti. Tutup lalu buka lagi popup kirimnya.' };
    var blob = file.getBlob();
    return { success: true, name: file.getName(), mimeType: blob.getContentType() || 'application/pdf', base64: Utilities.base64Encode(blob.getBytes()) };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function generateSlipGajiPdf(slipData) {
  try {
    var subfolder;
    if (SLIP_GAJI_FOLDER_ID) {
      subfolder = DriveApp.getFolderById(SLIP_GAJI_FOLDER_ID);
    } else {
      var rootFolder = getOrCreateDriveFolder_(DriveApp.getRootFolder(), 'Genio Institute - Uploads');
      subfolder = getOrCreateDriveFolder_(rootFolder, 'Slip Gaji');
    }

    var htmlContent = buildSlipGajiHtml_(slipData);
    var cleanTutor = (slipData.tutorNama || 'Tutor').replace(/[^a-zA-Z0-9_\- ]/g, '').trim().replace(/\s+/g, '_');
    var fileName = 'Slip_Gaji_' + cleanTutor + '_' + (slipData.periode || 'Periode') + '.pdf';

    // Hapus file lama jika ada dengan nama yang sama di subfolder agar tidak duplikat di Drive
    try {
      var existingFiles = subfolder.getFilesByName(fileName);
      while (existingFiles.hasNext()) {
        existingFiles.next().setTrashed(true);
      }
    } catch (cleanErr) {
      Logger.log('Warning cleaning old file: ' + cleanErr.message);
    }

    var blob = Utilities.newBlob(htmlContent, 'text/html', 'slip.html')
      .getAs('application/pdf')
      .setName(fileName);

    var file = subfolder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    return {
      success: true,
      url: file.getUrl(),
      fileId: file.getId(),
      name: file.getName()
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function batchGenerateSlipGajiPdf(slipList) {
  var results = [];
  for (var i = 0; i < slipList.length; i++) {
    var res = generateSlipGajiPdf(slipList[i]);
    results.push({
      id: slipList[i].id,
      success: res.success,
      url: res.url,
      error: res.error
    });
  }
  return results;
}

function generateInvoicePdf(invoiceData) {
  try {
    var subfolder;
    var tagihanFolderId = invoiceData.status === 'lunas' ? KUITANSI_FOLDER_ID : INVOICE_FOLDER_ID;
    if (tagihanFolderId) {
      subfolder = DriveApp.getFolderById(tagihanFolderId);
    } else {
      var rootFolder = getOrCreateDriveFolder_(DriveApp.getRootFolder(), 'Genio Institute - Uploads');
      subfolder = getOrCreateDriveFolder_(rootFolder, 'Tagihan & Kuitansi');
    }

    // Jika ada berkas PDF lama (misal dicetak ulang karena ada penambahan presensi baru), hapus dari Drive
    if (invoiceData.oldPdfUrl) {
      try {
        deleteDriveFiles(invoiceData.oldPdfUrl);
      } catch (cleanErr) {
        Logger.log('Warning cleaning old pdf: ' + cleanErr.message);
      }
    }

    var htmlContent = buildInvoiceHtml_(invoiceData);
    var cleanOrtu = (invoiceData.ortuNama || invoiceData.siswaNama || 'OrangTua').replace(/[^a-zA-Z0-9_\- ]/g, '').trim().replace(/\s+/g, '_');
    var isLunas = invoiceData.status === 'lunas';
    var prefix = isLunas ? 'Kuitansi_' : 'Invoice_';
    var cleanPeriode = (invoiceData.periode || 'Periode').replace(/[^a-zA-Z0-9_\-]/g, '_');
    // Tagihan tambahan diberi akhiran sendiri supaya tidak menimpa (membuang) PDF invoice/kuitansi pertama orang tua yang sama
    var tambahanSuffix = (invoiceData.tambahan && invoiceData.docNo) ? '_Tambahan-' + String(invoiceData.docNo).split('-').pop() : '';
    var fileName = prefix + cleanOrtu + '_' + cleanPeriode + tambahanSuffix + '.pdf';

    try {
      var existingFiles = subfolder.getFilesByName(fileName);
      while (existingFiles.hasNext()) {
        existingFiles.next().setTrashed(true);
      }
    } catch (cleanErr) {
      Logger.log('Warning cleaning old file by name: ' + cleanErr.message);
    }

    var blob = Utilities.newBlob(htmlContent, 'text/html', 'invoice.html')
      .getAs('application/pdf')
      .setName(fileName);

    var file = subfolder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    return {
      success: true,
      url: file.getUrl(),
      fileId: file.getId(),
      name: file.getName()
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function batchGenerateInvoicePdf(invoiceList) {
  var results = [];
  for (var i = 0; i < invoiceList.length; i++) {
    var res = generateInvoicePdf(invoiceList[i]);
    results.push({
      id: invoiceList[i].id,
      success: res.success,
      url: res.url,
      error: res.error
    });
  }
  return results;
}

/**
 * Menghapus/memindahkan ke sampah (trash) file-file slip gaji di Google Drive
 * HANYA berdasarkan daftar ID atau URL berkas yang dikirimkan (spesifik yang tampil di tabel).
 */
function deleteDriveFiles(fileIdsOrUrls) {
  var deletedCount = 0;
  var handledIds = {};

  if (!fileIdsOrUrls) return { success: true, count: 0 };

  if (typeof fileIdsOrUrls === 'string') {
    fileIdsOrUrls = [fileIdsOrUrls];
  }

  for (var i = 0; i < fileIdsOrUrls.length; i++) {
    var item = fileIdsOrUrls[i];
    if (!item) continue;
    var fileId = item;
    if (typeof item === 'string' && (item.indexOf('drive.google.com') !== -1 || item.indexOf('docs.google.com') !== -1 || item.indexOf('http') !== -1)) {
      var m = item.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
              item.match(/\/d\/([a-zA-Z0-9_-]+)/) ||
              item.match(/[?&]id=([a-zA-Z0-9_-]+)/);
      if (m && m[1]) fileId = m[1];
    }
    if (fileId && !handledIds[fileId]) {
      try {
        var f = DriveApp.getFileById(fileId);
        if (f) {
          f.setTrashed(true);
          handledIds[fileId] = true;
          deletedCount++;
        }
      } catch (e) {
        Logger.log('Could not trash file ID ' + fileId + ': ' + e.message);
      }
    }
  }

  return { success: true, count: deletedCount };
}

function deleteDriveFilesByIds(fileIdsOrUrls) {
  return deleteDriveFiles(fileIdsOrUrls);
}


// Logo (latar biru tema, PNG 160px) disimpan sebagai data URI di Logo.html, dipakai juga oleh Login dan Dashboard.
// Di-embed langsung karena konverter HTML->PDF tidak memuat gambar eksternal.
function getGenioLogoDataUri_() {
  try {
    return HtmlService.createHtmlOutputFromFile('Logo').getContent().trim();
  } catch (e) {
    return '';
  }
}

/**
 * Preview slip gaji dalam bentuk HTML (tampilan yang sama dengan PDF, tanpa membuat file).
 * Dipakai tombol "Lihat slip" di dashboard tutor.
 */
function previewSlipGajiHtml(slipData) {
  try {
    return { success: true, html: buildSlipGajiHtml_(slipData || {}) };
  } catch (err) {
    return { success: false, error: err.message };
  }
}


// ===== Kerangka bersama semua PDF (gaya A: kop logo, garis biru, tabel bersih) =====
// Invoice, kuitansi, dan slip gaji memakai font nota (Courier New); laporan belajar dan rekap memakai font biasa.
// Identitas (alamat, kontak, rekening, penanda tangan, tagline, cap + tanda tangan) dikirim aplikasi dari
// pengaturan kunci identitas_dokumen (d.identitas); kalau kosong dipakai nilai bawaan di bawah.
var DOC_BLUE = '#1C1AAF', DOC_INK = '#1d1f2e', DOC_SOFT = '#6b6f85', DOC_LINE = '#e3e5f0', DOC_TINT = '#EEEEFB', DOC_SURF = '#F5F6FB';
var DOC_SANS = 'Helvetica, Arial, sans-serif';
var DOC_MONO = '"Courier New", Courier, monospace';
var DOC_IDENTITAS_BAWAAN = {
  alamat: 'Jl. Gedongkuning, Gg. Antasena No.13A, Pringgolayan, Bantul, Yogyakarta',
  telepon: '082133131931',
  email: 'genioyogyakarta@gmail.com',
  kontak_admin: '082133131931 (Admin Genio Yogyakarta)',
  rekening: [{ bank: 'BRI', nomor: '138001004672509' }, { bank: 'BNI', nomor: '838161400' }, { bank: 'BCA', nomor: '8023104383' }],
  atas_nama: 'Finda Triarsa',
  ttd_nama: 'Finda Triarsa, S.Pd.',
  ttd_jabatan: 'Kepala Cabang Genio Yogyakarta',
  ttd_file_id: '',
  tagline: 'Juara bukan hanya sekadar impian!'
};

function docEsc_(v) {
  return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function docRp_(n) { return 'Rp ' + Math.round(Number(n) || 0).toLocaleString('id-ID'); }
function docTglPanjang_(dt) {
  var b = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  dt = dt || new Date();
  return dt.getDate() + ' ' + b[dt.getMonth()] + ' ' + dt.getFullYear();
}
// "Sel, 01/09" dari tanggal ISO
function docTglNota_(iso) {
  var m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return docEsc_(iso || '-');
  var hari = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'][new Date(+m[1], +m[2] - 1, +m[3]).getDay()];
  return hari + ', ' + m[3] + '/' + m[2];
}
// Nomor rekening ditulis apa adanya (tanpa spasi)
function docRek_(nomor) { return String(nomor || '').replace(/\s+/g, ''); }

function docIdentity_(d) {
  var x = (d && d.identitas) || {}, out = {};
  Object.keys(DOC_IDENTITAS_BAWAAN).forEach(function (k) {
    var v = x[k];
    out[k] = (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)) ? DOC_IDENTITAS_BAWAAN[k] : v;
  });
  if (x.ttd_file_id === '') out.ttd_file_id = '';
  out.rekening = (out.rekening || []).filter(function (r) { return r && (r.bank || r.nomor); });
  return out;
}

function getGenioLockupDataUri_() {
  try { return HtmlService.createHtmlOutputFromFile('LogoLockup').getContent().trim(); } catch (e) { return ''; }
}
// Cap + tanda tangan (PNG di Google Drive) disematkan sebagai data URI, karena konverter PDF tidak memuat gambar dari luar
var DOC_TTD_CACHE_ = {};
function docTtdDataUri_(fileId) {
  if (!fileId) return '';
  if (DOC_TTD_CACHE_[fileId] !== undefined) return DOC_TTD_CACHE_[fileId];
  var uri = '';
  try {
    var blob = DriveApp.getFileById(fileId).getBlob();
    uri = 'data:' + (blob.getContentType() || 'image/png') + ';base64,' + Utilities.base64Encode(blob.getBytes());
  } catch (e) { Logger.log('Cap/tanda tangan tidak terbaca: ' + e.message); }
  DOC_TTD_CACHE_[fileId] = uri;
  return uri;
}

function docCss_(mono) {
  var F = mono ? DOC_MONO : DOC_SANS;
  return '@page { size: A4 portrait; margin: 14mm 16mm 12mm; }' +
    'body { font-family: ' + F + '; color: ' + DOC_INK + '; margin: 0; padding: 0; background: #fff; font-size: ' + (mono ? '8.6pt' : '9.5pt') + '; line-height: 1.45; }' +
    'table { border-collapse: collapse; width: 100%; }' +
    'td, th { font-family: ' + F + '; }' +
    '.muted { color: ' + DOC_SOFT + '; } .blue { color: ' + DOC_BLUE + '; } .b { font-weight: 700; }' +
    '.n { text-align: right; white-space: nowrap; } .c { text-align: center; color: #8a8ea6; }' +
    '.hd td { vertical-align: top; }' +
    '.title { font-size: 20pt; font-weight: 700; color: ' + DOC_BLUE + '; text-align: right; letter-spacing: ' + (mono ? '2px' : '.5px') + '; line-height: 1.1; }' +
    '.subtitle { text-align: right; margin-top: 1mm; color: ' + DOC_SOFT + '; }' +
    '.addr { font-size: 8pt; color: ' + DOC_SOFT + '; margin-top: 2.5mm; }' +
    '.rule { border-top: 2.4px solid ' + DOC_BLUE + '; margin: 4mm 0 4.5mm; height: 0; }' +
    '.lbl { font-size: 8pt; color: ' + DOC_BLUE + '; font-weight: 700; margin-bottom: 1.5mm; }' +
    '.who { font-size: 11pt; font-weight: 700; }' +
    '.kv td { padding: .6mm 0; vertical-align: top; } .kv td.k { width: 30mm; color: ' + DOC_SOFT + '; }' +
    '.it { margin-top: 6mm; } .it th { text-align: left; font-size: 8pt; color: ' + DOC_BLUE + '; background: ' + DOC_TINT + '; padding: 2.3mm 3mm; font-weight: 700; }' +
    '.it th.n { text-align: right; } .it th.c { text-align: center; color: ' + DOC_BLUE + '; }' +
    '.it td { padding: 1.5mm 3mm; border-bottom: 1px ' + (mono ? 'dashed #d5d8e3' : 'solid #eceef5') + '; vertical-align: top; }' +
    '.it .sub { font-size: 8pt; color: ' + DOC_SOFT + '; margin-top: .6mm; }' +
    '.tot { margin-top: 1mm; ' + (mono ? 'border-top: 1px dashed #b9bdd0;' : '') + ' }' +
    '.tot td { padding: 2.2mm 3mm; }' +
    '.tot .big { font-size: 13pt; font-weight: 700; color: ' + DOC_BLUE + '; }' +
    '.tot tr.last td { ' + (mono ? 'border-bottom: 3px double ' + DOC_BLUE + ';' : '') + ' }' +
    '.note { background: ' + DOC_TINT + '; color: ' + DOC_BLUE + '; border-radius: 2.5mm; padding: 3mm 4mm; margin: 0 0 5mm; font-weight: 700; }' +
    '.box { background: ' + DOC_SURF + '; border-radius: 3mm; padding: 4mm; }' +
    '.box-t { font-weight: 700; margin-bottom: 1.5mm; }' +
    '.rk td { padding: .5mm 5mm .5mm 0; width: auto; }' +
    '.sign { text-align: center; }' +
    '.sign-name { display: inline-block; border-top: 1px solid #c9ccd8; padding-top: 1.5mm; min-width: 48mm; font-weight: 700; }' +
    '.stamp { display: inline-block; border: 2px solid #1E8E5A; color: #1E8E5A; border-radius: 2mm; padding: 1mm 3.5mm; font-weight: 700; letter-spacing: 2px; }' +
    '.pill { display: inline-block; padding: .4mm 2.4mm; border-radius: 10mm; font-size: 7.5pt; font-weight: 700; }' +
    '.pill-ok { background: #E9F7EF; color: #1E8E5A; } .pill-visit { background: #fff; color: ' + DOC_BLUE + '; border: 1px solid #d6d6f3; }' +
    '.pill-wait { background: #FFF4E0; color: #A15C00; } .pill-no { background: #FDEAEA; color: #C0352B; }' +
    '.sec { font-size: 8.5pt; font-weight: 700; color: ' + DOC_BLUE + '; margin: 5mm 0 2.5mm; }' +
    '.ft { margin-top: 5mm; border-top: 1px solid ' + DOC_LINE + '; padding-top: 3mm; font-size: 8pt; text-align: center; page-break-inside: avoid; }' +
    '.tag { font-style: italic; font-weight: 700; color: ' + DOC_BLUE + '; }' +
    // Lebih dari satu halaman: kepala tabel diulang, baris dan blok tidak terpotong, total + tanda tangan tetap bersama
    '.keep, .tot, .ft, .info { page-break-inside: avoid; } .it tr, .meet { page-break-inside: avoid; }' +
    'thead { display: table-header-group; } tfoot { display: table-footer-group; }' +
    '.sec { page-break-after: avoid; } .tot { page-break-before: avoid; }';
}

function docHeader_(idn, title, subtitleHtml) {
  var lock = getGenioLockupDataUri_();
  var addr = docEsc_(idn.alamat) + '<br>' + docEsc_(idn.telepon) + (idn.email ? ' &middot; ' + docEsc_(idn.email) : '');
  var size = title.length > 16 ? '15pt' : title.length > 10 ? '17pt' : '20pt';
  return '<table class="hd"><tr>' +
      '<td>' + (lock ? '<img src="' + lock + '" style="height:13mm; display:block;">' : '<div class="b blue" style="font-size:15pt;">Genio <span style="color:#D4070F;">Institute</span></div><div class="muted">Yogyakarta</div>') + '</td>' +
      '<td style="width:95mm;"><div class="title" style="font-size:' + size + '; white-space:nowrap;">' + title + '</div>' + (subtitleHtml ? '<div class="subtitle">' + subtitleHtml + '</div>' : '') + '</td>' +
    '</tr><tr><td colspan="2"><div class="addr">' + addr + '</div></td></tr></table>' +
    '<div class="rule"></div>';
}

function docRekeningBox_(idn, sekolah) {
  if (!idn.rekening.length) return '';
  return '<div class="box"><div class="box-t">Pembayaran melalui transfer</div><table class="rk">' +
    idn.rekening.map(function (r) { return '<tr><td class="b" style="width:16mm;">' + docEsc_(r.bank) + '</td><td>' + docEsc_(docRek_(r.nomor)) + '</td></tr>'; }).join('') +
    '</table><div class="muted" style="font-size:8pt; margin-top:1.5mm;">a.n. ' + docEsc_(idn.atas_nama) + '. Mohon cantumkan nama ' + (sekolah ? 'sekolah' : 'siswa') + ' di berita transfer.</div></div>';
}

function docSign_(idn, pembuka, ringkas) {
  var img = docTtdDataUri_(idn.ttd_file_id);
  return '<div class="sign"><div class="muted">' + docEsc_(pembuka || 'Mengetahui,') + '</div><div>' + docEsc_(idn.ttd_jabatan) + '</div>' +
    (img ? '<img src="' + img + '" style="height:' + (ringkas ? '14mm' : '17mm') + '; display:block; margin:.5mm auto;">' : '<div style="height:' + (ringkas ? '15mm' : '18mm') + ';"></div>') +
    '<div class="sign-name">' + docEsc_(idn.ttd_nama) + '</div></div>';
}

function docFooter_(idn, tentang) {
  return '<div class="ft"><span class="muted">' + (tentang ? 'Pertanyaan tentang ' + docEsc_(tentang) + ' ini: ' : 'Hubungi kami: ') + docEsc_(idn.kontak_admin) + '</span>' +
    (idn.tagline ? '<br><span class="tag">' + docEsc_(idn.tagline) + '</span>' : '') + '</div>';
}

function docPage_(title, mono, body) {
  return '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + docEsc_(title) + '</title><style>' + docCss_(mono) + '</style></head><body>' + body + '</body></html>';
}

/* ----- Slip gaji tutor (font nota) ----- */
function buildSlipGajiHtml_(d) {
  var idn = docIdentity_(d);
  var isLunas = d.status === 'sudah_dibayar';
  var rows = (d.rincianPresensi && d.rincianPresensi.length) ? d.rincianPresensi : null;
  var body = rows
    ? rows.map(function (it, i) {
        var materi = String(it.materi || 'Sesi pembelajaran').replace(/\s+/g, ' ');
        if (materi.length > 46) materi = materi.slice(0, 45).trim() + '…';
        return '<tr><td class="c">' + (i + 1) + '</td><td>' + docEsc_(it.tanggal || '-') + '</td><td>' + docEsc_(it.mapel || '-') + ' <span class="muted">· ' + docEsc_(it.durasi || '-') + '</span>' +
          '<div class="sub">' + docEsc_(materi) + '</div></td><td class="n">' + docRp_(it.nominal) + '</td></tr>';
      }).join('')
    : '<tr><td class="c">1</td><td>' + docEsc_(d.periodeLabel || d.periode || '-') + '</td><td>' + docEsc_(d.mapel || 'Bimbingan belajar') +
        ' <span class="muted">· ' + docEsc_(d.totalJam || '-') + '</span><div class="sub">Akumulasi ' + docEsc_(d.totalPertemuan || 0) + ' sesi mengajar</div></td><td class="n">' + docRp_(d.totalGaji) + '</td></tr>';
  var no = 'SLP-' + String(d.id || '').substring(0, 8).toUpperCase();
  var html =
    docHeader_(idn, 'SLIP GAJI', 'Honor tutor ' + docEsc_(d.periodeLabel || d.periode || '')) +
    '<table><tr>' +
      '<td style="width:52%; vertical-align:top;"><div class="lbl">Dibayarkan kepada</div><div class="who">' + docEsc_(d.tutorNama || '-') + '</div>' +
        '<div class="muted">Rekening: ' + docEsc_(d.bankText || '-') + '</div><div class="muted">Mapel: ' + docEsc_(d.mapel || '-') + '</div></td>' +
      '<td style="vertical-align:top;"><table class="kv">' +
        '<tr><td class="k">Nomor</td><td class="b">' + docEsc_(no) + '</td></tr>' +
        '<tr><td class="k">Periode</td><td>' + docEsc_(d.periodeLabel || d.periode || '-') + '</td></tr>' +
        '<tr><td class="k">Status</td><td>' + (isLunas ? 'Sudah dibayar' : 'Belum dibayar') + '</td></tr>' +
        '<tr><td class="k">Tanggal bayar</td><td>' + docEsc_(d.tanggalDibayar || '-') + '</td></tr>' +
      '</table></td>' +
    '</tr></table>' +
    '<table class="it"><thead><tr><th class="c" style="width:9mm;">No</th><th style="width:26mm;">Tanggal</th><th>Mapel · durasi · keterangan</th><th class="n" style="width:30mm;">Nominal</th></tr></thead><tbody>' + body + '</tbody></table>' +
    '<table class="tot">' +
      '<tr><td class="muted n">' + docEsc_(d.totalPertemuan || 0) + ' sesi · ' + docEsc_(d.totalJam || '-') + '</td><td style="width:42mm;"></td></tr>' +
      '<tr class="last"><td class="n b">Total gaji</td><td class="n big">' + docRp_(d.totalGaji) + '</td></tr>' +
    '</table>' +
    '<div class="keep"><table style="margin-top:5mm;"><tr>' +
      '<td style="width:55%; vertical-align:top;"><div class="box"><div class="box-t">Catatan</div><div class="muted">Honor dihitung dari presensi yang disetujui pada periode ini, sudah termasuk potongan keterlambatan bila ada.' +
        (isLunas ? '' : ' Pembayaran ditransfer ke rekening di atas.') + '</div></div></td>' +
      '<td style="vertical-align:top;">' + docSign_(idn) + '</td>' +
    '</tr></table>' +
    docFooter_(idn, 'slip gaji') + '</div>';
  return docPage_('Slip gaji - ' + (d.tutorNama || 'Tutor'), true, html);
}

/* ----- Laporan belajar satu pertemuan (font biasa) ----- */
function buildLaporanBelajarHtml_(d) {
  var idn = docIdentity_(d);
  var st = d.status;
  var pill = st === 'visit' ? '<span class="pill pill-visit">Visit</span>'
    : st === 'pending' ? '<span class="pill pill-wait">Menunggu persetujuan</span>'
    : st === 'ditolak' ? '<span class="pill pill-no">Perlu revisi</span>'
    : '<span class="pill pill-ok">Diterima</span>';
  var links = [];
  if (d.materiLink) links.push('<tr><td class="k">Tautan materi</td><td><a href="' + docEsc_(d.materiLink) + '" style="color:' + DOC_BLUE + '; text-decoration:none; word-break:break-all;">' + docEsc_(d.materiLink) + '</a></td></tr>');
  if (d.catatanPembelajaranUrl) links.push('<tr><td class="k">Catatan pembelajaran</td><td><a href="' + docEsc_(d.catatanPembelajaranUrl) + '" style="color:' + DOC_BLUE + '; text-decoration:none;">Buka catatan pembelajaran (papan tulis)</a></td></tr>');
  var html =
    docHeader_(idn, 'LAPORAN BELAJAR', docEsc_(d.tanggal || '')) +
    // Bidang isi berlatar abu-abu tipis (pilihan owner), kepala dan penutup tetap putih
    '<div class="box" style="padding:3.5mm 4mm;"><table><tr>' +
      // Unit sekolah: siswa = kelompok, orang tua = sekolah (dengan PIC)
      '<td style="width:52%; vertical-align:top;"><div class="lbl">' + (d.isRombel ? 'Kelompok' : 'Siswa') + '</div><div class="who">' + docEsc_(d.siswaNama || '-') + '</div>' +
        '<div class="muted">' + (d.isRombel ? 'Sekolah: ' : 'Orang tua: ') + docEsc_(d.ortuNama || '-') + (d.isRombel && d.picNama ? ' (u.p. ' + docEsc_(d.picNama) + ')' : '') + '</div><div class="muted">Unit: ' + docEsc_(d.unit || '-') + '</div></td>' +
      '<td style="vertical-align:top;"><table class="kv">' +
        '<tr><td class="k">Mata pelajaran</td><td class="b">' + docEsc_(d.mapel || '-') + '</td></tr>' +
        '<tr><td class="k">Tutor</td><td>' + docEsc_(d.tutorNama || '-') + '</td></tr>' +
        '<tr><td class="k">Waktu</td><td>' + docEsc_(d.jam || '-') + (d.durasi && d.durasi !== '-' ? ' · ' + docEsc_(String(d.durasi).toLowerCase()) : '') + '</td></tr>' +
        '<tr><td class="k">Status</td><td>' + pill + '</td></tr>' +
      '</table></td>' +
    '</tr></table></div>' +
    '<div class="sec">' + (st === 'visit' ? 'Keterangan visit' : 'Ringkasan pembelajaran') + '</div>' +
    '<div class="box" style="white-space:pre-wrap; line-height:1.65;">' + (d.materiTeks ? docEsc_(d.materiTeks) : '<span class="muted"><i>Tidak ada ringkasan tertulis.</i></span>') + '</div>' +
    (links.length ? '<div class="sec">Tautan dan catatan</div><div class="box" style="padding:3mm 4mm;"><table class="kv">' + links.join('') + '</table></div>' : '') +
    // Penanda tangan di kanan, catatan dan kontak di kiri (tanpa tanda tangan tutor), sama dengan rekap
    '<div class="keep" style="margin-top:7mm; border-top:1px solid ' + DOC_LINE + '; padding-top:3mm;"><table><tr>' +
      '<td style="width:55%; vertical-align:bottom; font-size:8pt; padding-right:6mm;"><span class="muted">Laporan ini dibuat oleh sistem Genio Institute pada ' + docTglPanjang_() + '. Tautan materi dan catatan pembelajaran dapat dibuka langsung dari dokumen ini.</span>' +
        '<br><span class="muted">Hubungi kami: ' + docEsc_(idn.kontak_admin) + '</span>' + (idn.tagline ? '<br><span class="tag">' + docEsc_(idn.tagline) + '</span>' : '') + '</td>' +
      '<td style="vertical-align:top;">' + docSign_(idn) + '</td>' +
    '</tr></table></div>';
  return docPage_('Laporan belajar - ' + (d.siswaNama || 'Siswa'), false, html);
}

/* ----- Rekap laporan belajar beberapa pertemuan (font biasa) ----- */
// d: { ortuNama, siswaNama, unit, periodeLabel, jumlahLabel, mapelList, tutorList,
//      groups: [{ siswaNama, items: [{ no, tanggal, tanggalShort, mapel, tutorNama, jam, durasi, isVisit, materiTeks, materiLink, catatanPembelajaranUrl }] }] }
function buildRekapLaporanHtml_(d) {
  var idn = docIdentity_(d);
  var groups = d.groups || [];
  var multi = groups.length > 1;
  var pill = function (v) { return v ? '<span class="pill pill-visit">Visit</span>' : '<span class="pill pill-ok">Diterima</span>'; };
  var sum = '';
  groups.forEach(function (g) {
    (g.items || []).forEach(function (it) {
      sum += '<tr><td class="c">' + docEsc_(it.no) + '</td><td>' + docEsc_(it.tanggalShort) + '</td><td>' + docEsc_(g.siswaNama) + '</td><td>' + docEsc_(it.mapel) +
        '</td><td>' + docEsc_(it.tutorNama) + '</td><td>' + docEsc_(it.jam) + (it.durasi && !it.isVisit ? ' · ' + docEsc_(it.durasi) : '') + '</td><td>' + pill(it.isVisit) + '</td></tr>';
    });
  });
  var detail = '';
  groups.forEach(function (g) {
    if (multi) detail += '<div class="sec" style="font-size:10pt; border-bottom:1px solid ' + DOC_LINE + '; padding-bottom:1.5mm;">' + docEsc_(g.siswaNama) + '</div>';
    (g.items || []).forEach(function (it) {
      var links = [];
      if (it.materiLink) links.push('Materi: <a href="' + docEsc_(it.materiLink) + '" style="color:' + DOC_BLUE + '; text-decoration:none; word-break:break-all;">' + docEsc_(it.materiLink) + '</a>');
      if (it.catatanPembelajaranUrl) links.push('Catatan pembelajaran: <a href="' + docEsc_(it.catatanPembelajaranUrl) + '" style="color:' + DOC_BLUE + '; text-decoration:none;">buka catatan</a>');
      detail += '<div style="border:1px solid ' + DOC_LINE + '; border-radius:3mm; margin-bottom:3mm; page-break-inside:avoid;">' +
        '<table style="background:' + DOC_TINT + ';"><tr>' +
          '<td style="width:9mm; padding:2.2mm 0 2.2mm 3mm;"><span style="display:inline-block; width:5.5mm; height:5.5mm; line-height:5.5mm; border-radius:3mm; background:' + DOC_BLUE + '; color:#fff; font-size:7.5pt; font-weight:700; text-align:center;">' + docEsc_(it.no) + '</span></td>' +
          '<td style="padding:2.2mm 2mm;"><span class="b">' + docEsc_(it.tanggal) + '</span> <span class="muted" style="font-size:8.5pt;">&nbsp;' + docEsc_(it.mapel) + ' · ' + docEsc_(it.tutorNama) + ' · ' + docEsc_(it.jam) + (it.durasi && !it.isVisit ? ', ' + docEsc_(it.durasi) : '') + '</span></td>' +
          '<td class="n" style="padding:2.2mm 3mm; width:24mm;">' + pill(it.isVisit) + '</td>' +
        '</tr></table>' +
        '<div style="padding:2.5mm 4mm; white-space:pre-wrap; line-height:1.55;">' + (it.materiTeks ? docEsc_(it.materiTeks) : '<span class="muted"><i>Tidak ada ringkasan tertulis.</i></span>') + '</div>' +
        (links.length ? '<div class="muted" style="padding:0 4mm 3mm; font-size:8.5pt;">' + links.join(' &nbsp;&middot;&nbsp; ') + '</div>' : '') +
      '</div>';
    });
  });
  var html =
    docHeader_(idn, 'REKAP LAPORAN BELAJAR', docEsc_(d.periodeLabel || '')) +
    '<table><tr>' +
      '<td style="width:52%; vertical-align:top;"><div class="lbl">' + (d.isSekolah ? 'Sekolah' : 'Orang tua / wali') + '</div><div class="who">' + docEsc_(d.ortuNama || '-') + '</div>' +
        (d.isSekolah && d.picNama ? '<div class="muted">u.p. ' + docEsc_(d.picNama) + '</div>' : '') +
        '<div class="muted">' + (d.isSekolah ? 'Kelompok: ' : 'Siswa: ') + docEsc_(d.siswaNama || '-') + '</div><div class="muted">Unit: ' + docEsc_(d.unit || '-') + '</div></td>' +
      '<td style="vertical-align:top;"><table class="kv">' +
        '<tr><td class="k">Periode</td><td class="b">' + docEsc_(d.periodeLabel || '-') + '</td></tr>' +
        '<tr><td class="k">Pertemuan</td><td>' + docEsc_(d.jumlahLabel || '-') + '</td></tr>' +
        '<tr><td class="k">Mata pelajaran</td><td>' + docEsc_(d.mapelList || '-') + '</td></tr>' +
        '<tr><td class="k">Tutor</td><td>' + docEsc_(d.tutorList || '-') + '</td></tr>' +
      '</table></td>' +
    '</tr></table>' +
    '<div class="sec">Ringkasan pertemuan</div>' +
    '<table class="it" style="margin-top:0;"><thead><tr><th class="c" style="width:9mm;">No</th><th>Tanggal</th><th>' + (d.isSekolah ? 'Kelompok' : 'Siswa') + '</th><th>Mapel</th><th>Tutor</th><th>Waktu</th><th>Status</th></tr></thead><tbody>' + sum + '</tbody></table>' +
    '<div class="sec">Rincian per pertemuan</div>' + detail +
    // Tanda tangan di kanan, catatan dan kontak di kiri dalam satu blok, supaya rekap pendek tetap muat satu halaman
    '<div class="keep" style="margin-top:4mm; border-top:1px solid ' + DOC_LINE + '; padding-top:3mm;"><table><tr>' +
      '<td style="width:55%; vertical-align:bottom; font-size:8pt; padding-right:6mm;"><span class="muted">Rekap ini dibuat oleh sistem Genio Institute pada ' + docTglPanjang_() + '. Tautan materi dan catatan pembelajaran dapat dibuka langsung dari dokumen ini.</span>' +
        '<br><span class="muted">Hubungi kami: ' + docEsc_(idn.kontak_admin) + '</span>' + (idn.tagline ? '<br><span class="tag">' + docEsc_(idn.tagline) + '</span>' : '') + '</td>' +
      '<td style="vertical-align:top;">' + docSign_(idn, null, true) + '</td>' +
    '</tr></table></div>';
  return docPage_('Rekap laporan belajar - ' + (d.ortuNama || 'Orang tua'), false, html);
}

/* ----- Invoice dan kuitansi (font nota) ----- */
// Baris per pertemuan kalau aplikasi mengirim item.pertemuan [{ tanggal, mapel }], kalau tidak satu baris per siswa.
function buildInvoiceHtml_(d) {
  var idn = docIdentity_(d);
  var isLunas = (d.status === 'lunas');
  var docNo = d.docNo || (isLunas
    ? 'REC-' + ((d.receiptId || d.id || '').substring(0, 8).toUpperCase())
    : 'INV-' + ((d.id || '').substring(0, 8).toUpperCase()));
  var totalSesi = d.totalSesi || d.jumlahPertemuan || 0;
  var totalNominal = d.totalNominal || d.nominal || 0;
  // Pemasukan lain (biaya di luar les) dicetak di bawah baris pertemuan; tagihan bisa berisi biaya lain saja
  var extras = d.extras || [];
  var extraTotal = extras.reduce(function (a, e) { return a + (+e.nominal || 0); }, 0);
  var items = (d.items && d.items.length) ? d.items : (extras.length ? [] : [{ nama: d.siswaNama, pakets: d.namaPaket, sesi: totalSesi, hargaSatuan: d.hargaSatuan, nominal: totalNominal }]);
  // Rincian per pertemuan hanya kalau jumlahnya cocok dengan sesi yang ditagih (data lama bisa tidak lengkap)
  var perPertemuan = items.every(function (it) { return it.pertemuan && it.pertemuan.length && it.pertemuan.length === +(it.sesi || it.jumlahPertemuan || 0); });
  var no = 0, rows = '', harga = {};
  items.forEach(function (it) {
    var paket = Array.isArray(it.pakets) ? it.pakets.join(', ') : (it.pakets || it.namaPaket || '');
    harga[Math.round(it.hargaSatuan || 0)] = true;
    if (perPertemuan) {
      it.pertemuan.forEach(function (p) {
        rows += '<tr><td class="c">' + (++no) + '</td><td>' + docTglNota_(p.tanggal) + '</td><td>' + docEsc_(it.nama || it.siswaNama || '-') + '</td><td>' +
          docEsc_([p.mapel, paket].filter(Boolean).join(' · ') || '-') + (p.visit ? ' <span class="muted">(visit)</span>' : '') + '</td><td class="n">' + docRp_(it.hargaSatuan) + '</td></tr>';
      });
    } else {
      rows += '<tr><td class="c">' + (++no) + '</td><td colspan="2"><span class="b">' + docEsc_(it.nama || it.siswaNama || '-') + '</span>' + (paket ? ' · ' + docEsc_(paket) : '') +
        (it.subtext ? '<div class="sub">' + docEsc_(it.subtext) + '</div>' : '') + '</td><td>' + docEsc_(it.sesi || it.jumlahPertemuan || 0) + ' × ' + docRp_(it.hargaSatuan) + '</td><td class="n">' + docRp_(it.nominal) + '</td></tr>';
    }
  });
  if (extras.length) {
    var qty = function (e) { var j = +e.jumlah || 1; return j === 1 ? '' : ' (' + String(Math.round(j * 100) / 100).replace('.', ',') + ' × ' + docRp_(e.hargaSatuan) + ')'; };
    if (items.length) rows += '<tr><td></td><td colspan="4" class="b blue" style="padding-top:3mm; border-bottom:none; font-size:8pt;">Biaya lain</td></tr>';
    extras.forEach(function (e) {
      rows += perPertemuan
        ? '<tr><td class="c">' + (++no) + '</td><td>' + docTglNota_(e.tanggal) + '</td><td>' + docEsc_(e.siswa || '-') + '</td><td>' + docEsc_(e.kategori) + ': ' + docEsc_(e.keterangan) + docEsc_(qty(e)) + '</td><td class="n">' + docRp_(e.nominal) + '</td></tr>'
        : '<tr><td class="c">' + (++no) + '</td><td colspan="2"><span class="b">' + docEsc_(e.kategori) + '</span> · ' + docEsc_(e.keterangan) + '<div class="sub">' + docEsc_([docTglNota_(e.tanggal), e.siswa].filter(Boolean).join(' · ')) + '</div></td><td>' + docEsc_((+e.jumlah || 1) + ' × ' + docRp_(e.hargaSatuan)) + '</td><td class="n">' + docRp_(e.nominal) + '</td></tr>';
    });
  }
  var hargaList = Object.keys(harga);
  var rumus = hargaList.length === 1 && +hargaList[0] > 0 ? totalSesi + ' pertemuan × ' + docRp_(hargaList[0]) : totalSesi + ' pertemuan';
  var title = isLunas ? 'KUITANSI' : 'INVOICE';
  var subtitle = d.tambahan ? 'Tagihan tambahan' : (isLunas ? 'Bukti pembayaran' : (items.length ? 'Tagihan bimbingan belajar' : 'Tagihan biaya lain'));
  var head = perPertemuan
    ? '<tr><th class="c" style="width:9mm;">No</th><th style="width:26mm;">Tanggal</th><th>' + (d.isSekolah ? 'Kelompok' : 'Siswa') + '</th><th>' + (items.length ? 'Mapel · paket' : 'Keterangan') + '</th><th class="n" style="width:30mm;">Biaya</th></tr>'
    : '<tr><th class="c" style="width:9mm;">No</th><th colspan="2">' + (d.isSekolah ? 'Kelompok' : 'Siswa') + ' · paket</th><th style="width:40mm;">Pertemuan</th><th class="n" style="width:32mm;">Subtotal</th></tr>';
  var html =
    docHeader_(idn, title, subtitle) +
    (d.tambahan && d.tambahanNote ? '<div class="note">' + docEsc_(d.tambahanNote) + '</div>' : '') +
    '<table><tr>' +
      '<td style="width:52%; vertical-align:top;"><div class="lbl">' + (isLunas ? 'Diterima dari' : 'Ditagihkan kepada') + '</div><div class="who">' + docEsc_(d.ortuNama || d.siswaNama || '-') + '</div>' +
        (d.isSekolah && d.picNama ? '<div class="muted">u.p. ' + docEsc_(d.picNama) + '</div>' : '') +
        '<div class="muted">' + docEsc_([d.ortuHp, d.unitNama].filter(Boolean).join(' · ') || '-') + '</div><div class="muted">' + (d.isSekolah ? 'Kelompok: ' : 'Siswa: ') + docEsc_(d.siswaList || d.siswaNama || '-') + '</div></td>' +
      '<td style="vertical-align:top;"><table class="kv">' +
        '<tr><td class="k">Nomor</td><td class="b">' + docEsc_(docNo) + '</td></tr>' +
        '<tr><td class="k">Tanggal</td><td>' + docEsc_(isLunas && d.tanggalLunas ? d.tanggalLunas : docTglPanjang_()) + '</td></tr>' +
        '<tr><td class="k">Periode</td><td>' + docEsc_(d.periodeLabel || d.periode || '-') + '</td></tr>' +
        '<tr><td class="k">Status</td><td>' + (isLunas ? 'Lunas' : 'Belum lunas') + '</td></tr>' +
      '</table></td>' +
    '</tr></table>' +
    '<table class="it"><thead>' + head + '</thead><tbody>' + rows + '</tbody></table>' +
    '<table class="tot">' +
      (extras.length
        ? (items.length ? '<tr><td class="muted n">' + docEsc_(rumus) + '</td><td class="n muted" style="width:42mm;">' + docRp_(totalNominal - extraTotal) + '</td></tr>' : '') +
          '<tr><td class="muted n">Biaya lain</td><td class="n muted" style="width:42mm;">' + docRp_(extraTotal) + '</td></tr>'
        : '<tr><td class="muted n">' + docEsc_(rumus) + '</td><td style="width:42mm;"></td></tr>') +
      '<tr class="last"><td class="n b">' + (isLunas ? '<span class="stamp" style="margin-right:6mm;">LUNAS' + (d.tanggalLunas ? ' · ' + docEsc_(d.tanggalLunas) : '') + '</span>' : '') +
        (isLunas ? 'Total dibayar' : 'Total tagihan') + '</td><td class="n big">' + docRp_(totalNominal) + '</td></tr>' +
    '</table>' +
    '<div class="keep"><table style="margin-top:5mm;"><tr>' +
      '<td style="width:55%; vertical-align:top;">' + (isLunas
        ? '<div class="box"><div class="box-t">Terima kasih</div><div class="muted">Pembayaran untuk periode ' + docEsc_(d.periodeLabel || d.periode || '') + ' sudah kami terima. Simpan kuitansi ini sebagai bukti pembayaran yang sah.</div></div>'
        : docRekeningBox_(idn, d.isSekolah)) + '</td>' +
      '<td style="vertical-align:top;">' + docSign_(idn) + '</td>' +
    '</tr></table>' +
    docFooter_(idn, isLunas ? 'kuitansi' : 'invoice') + '</div>';
  return docPage_(title + ' - ' + (d.ortuNama || d.siswaNama || 'Orang tua'), true, html);
}

/**
 * Dipakai di dalam file .html lewat <?!= include('NamaFile'); ?>
 * untuk menyisipkan partial (mis. Config.html berisi CSS & JS bersama).
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}