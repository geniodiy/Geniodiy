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
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1')
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
  catatan: '1LxOQPHfj6lVGmRgDtjmNwNPmFINhmbF4'   // <-- isi ID folder "Catatan Pembelajaran" di sini
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
 * ID Folder Google Drive untuk menyimpan PDF Tagihan & Kuitansi (Invoice & Receipt).
 * Kosongkan ('') jika ingin dibuatkan otomatis dalam folder "Genio Institute - Uploads/Tagihan".
 */
var TAGIHAN_FOLDER_ID = '';

function generateLaporanBelajarPdf(laporanData) {
  try {
    var subfolder;
    if (LAPORAN_BELAJAR_FOLDER_ID) {
      subfolder = DriveApp.getFolderById(LAPORAN_BELAJAR_FOLDER_ID);
    } else {
      var rootFolder = getOrCreateDriveFolder_(DriveApp.getRootFolder(), 'Genio Institute - Uploads');
      subfolder = getOrCreateDriveFolder_(rootFolder, 'Laporan Belajar');
    }

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
    if (TAGIHAN_FOLDER_ID) {
      subfolder = DriveApp.getFolderById(TAGIHAN_FOLDER_ID);
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
    var fileName = prefix + cleanOrtu + '_' + cleanPeriode + '.pdf';

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


var GENIO_LOGO_FILE_ID = '1MfkdHvS_OxwYsmcA_s9b-IAWIxgQiBpZ';

// Logo di-embed sebagai data URI karena konverter HTML->PDF tidak memuat gambar eksternal.
function getGenioLogoDataUri_() {
  var cache = CacheService.getScriptCache();
  var hit = cache.get('genio_logo_uri');
  if (hit) return hit;
  var blob = null;
  try {
    blob = DriveApp.getFileById(GENIO_LOGO_FILE_ID).getThumbnail();
  } catch (e) {
    try {
      blob = UrlFetchApp.fetch('https://drive.google.com/thumbnail?id=' + GENIO_LOGO_FILE_ID + '&sz=w160').getBlob();
    } catch (e2) {
      return '';
    }
  }
  if (!blob) return '';
  var uri = 'data:' + (blob.getContentType() || 'image/png') + ';base64,' + Utilities.base64Encode(blob.getBytes());
  if (uri.length < 95000) cache.put('genio_logo_uri', uri, 21600);
  return uri;
}

function buildSlipGajiHtml_(d) {
  var formatRp = function (n) {
    return 'Rp ' + Math.round(Number(n) || 0).toLocaleString('id-ID');
  };
  var esc = function (v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  var BLUE = '#1C1AAF', INK = '#14162B', SOFT = '#5B5F76', BORDER = '#E3E5F0', SURFACE = '#F5F6FB';
  var td = 'padding:10px 12px; border-bottom:1px solid ' + BORDER + '; font-size:11.5px; color:' + INK + ';';

  var tableRowsHtml = '';
  if (d.rincianPresensi && d.rincianPresensi.length > 0) {
    tableRowsHtml = d.rincianPresensi.map(function (item, idx) {
      return '<tr>' +
        '<td style="' + td + ' text-align:center; color:' + SOFT + ';">' + (idx + 1) + '</td>' +
        '<td style="' + td + '">' + esc(item.tanggal || '-') + '</td>' +
        '<td style="' + td + '">' + esc(item.mapel || '-') + '</td>' +
        '<td style="' + td + '">' + esc(item.materi || 'Sesi pembelajaran') + '</td>' +
        '<td style="' + td + ' text-align:center;">' + esc(item.durasi || '1.5 Jam') + '</td>' +
        '<td style="' + td + ' text-align:right; font-weight:700;">' + formatRp(item.nominal) + '</td>' +
      '</tr>';
    }).join('');
  } else {
    tableRowsHtml = '<tr>' +
      '<td style="' + td + ' text-align:center; color:' + SOFT + ';">1</td>' +
      '<td style="' + td + '">Periode ' + esc(d.periodeLabel || d.periode) + '</td>' +
      '<td style="' + td + '">' + esc(d.mapel || 'Bimbingan belajar') + '</td>' +
      '<td style="' + td + '">Akumulasi ' + esc(d.totalPertemuan || 0) + ' sesi mengajar</td>' +
      '<td style="' + td + ' text-align:center;">' + esc(d.totalJam || '-') + '</td>' +
      '<td style="' + td + ' text-align:right; font-weight:700;">' + formatRp(d.totalGaji) + '</td>' +
    '</tr>';
  }

  var isLunas = d.status === 'sudah_dibayar';
  var pillStyle = isLunas
    ? 'background:#E9F7EF; color:#1E8E5A;'
    : 'background:#FFF4E0; color:#A15C00;';
  var statusLabel = isLunas ? 'Lunas' : 'Menunggu pembayaran';

  var infoRow = function (label, value) {
    return '<tr>' +
      '<td style="padding:5px 0; font-size:11px; color:' + SOFT + '; width:118px; vertical-align:top;">' + label + '</td>' +
      '<td style="padding:5px 0; font-size:12px; color:' + INK + '; font-weight:700; vertical-align:top;">' + value + '</td>' +
    '</tr>';
  };
  var th = 'padding:9px 12px; background:' + SURFACE + '; border-bottom:1px solid ' + BORDER + '; font-size:10.5px; font-weight:700; color:' + SOFT + '; text-align:left;';
  var tanggalCetak = new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });
  var logoUri = getGenioLogoDataUri_();

  return '<!DOCTYPE html>' +
  '<html>' +
  '<head>' +
    '<meta charset="utf-8">' +
    '<title>Slip Gaji - ' + esc(d.tutorNama || 'Tutor') + '</title>' +
    '<style>' +
      '@page { size: A4 portrait; margin: 16mm 14mm; }' +
      'body { font-family: "Plus Jakarta Sans", Helvetica, Arial, sans-serif; color: ' + INK + '; margin: 0; padding: 0; background: #fff; line-height: 1.4; }' +
      'table { border-collapse: collapse; }' +
    '</style>' +
  '</head>' +
  '<body>' +
    '<div style="max-width:740px; margin:0 auto;">' +

      '<table style="width:100%; background:' + BLUE + '; border-radius:14px;">' +
        '<tr>' +
          '<td style="padding:20px 24px; vertical-align:middle;">' +
            '<table><tr>' +
              (logoUri ? '<td style="vertical-align:middle; padding-right:12px;"><div style="width:40px; height:40px; border-radius:10px; background:#fff; overflow:hidden;"><img src="' + logoUri + '" style="width:40px; height:40px; display:block;"></div></td>' : '') +
              '<td style="vertical-align:middle;">' +
                '<div style="font-family:Poppins, Helvetica, Arial, sans-serif; font-size:17px; font-weight:800; color:#fff; line-height:1.15;">Genio Institute</div>' +
                '<div style="font-size:10.5px; color:#C9CAF2; margin-top:2px;">Yogyakarta</div>' +
              '</td>' +
            '</tr></table>' +
          '</td>' +
          '<td style="padding:22px 24px; text-align:right; vertical-align:middle;">' +
            '<div style="font-size:19px; font-weight:700; color:#fff;">Slip gaji tutor</div>' +
            '<div style="font-size:11.5px; color:#C9CAF2; margin-top:4px;">Periode ' + esc(d.periodeLabel || d.periode) + '</div>' +
          '</td>' +
        '</tr>' +
      '</table>' +

      '<table style="width:100%; margin-top:22px;">' +
        '<tr>' +
          '<td style="width:50%; vertical-align:top; padding-right:12px;">' +
            '<table style="width:100%;">' +
              infoRow('Nama tutor', esc(d.tutorNama || '-')) +
              infoRow('Rekening bank', esc(d.bankText || '-')) +
              infoRow('Mata pelajaran', esc(d.mapel || '-')) +
            '</table>' +
          '</td>' +
          '<td style="width:50%; vertical-align:top; padding-left:12px; border-left:1px solid ' + BORDER + ';">' +
            '<table style="width:100%;">' +
              infoRow('Status', '<span style="display:inline-block; padding:2px 9px; border-radius:999px; font-size:10.5px; ' + pillStyle + '">' + statusLabel + '</span>') +
              infoRow('Tanggal bayar', esc(d.tanggalDibayar || '-')) +
              infoRow('Total pengajaran', esc(d.totalPertemuan || 0) + ' sesi (' + esc(d.totalJam || '-') + ')') +
            '</table>' +
          '</td>' +
        '</tr>' +
      '</table>' +

      '<div style="font-size:13px; font-weight:700; margin:26px 0 10px;">Rincian mengajar</div>' +
      '<table style="width:100%; border:1px solid ' + BORDER + '; border-radius:12px;">' +
        '<thead>' +
          '<tr>' +
            '<th style="' + th + ' width:34px; text-align:center;">No</th>' +
            '<th style="' + th + '">Tanggal</th>' +
            '<th style="' + th + '">Mata pelajaran</th>' +
            '<th style="' + th + '">Keterangan</th>' +
            '<th style="' + th + ' text-align:center;">Durasi</th>' +
            '<th style="' + th + ' text-align:right;">Nominal</th>' +
          '</tr>' +
        '</thead>' +
        '<tbody>' + tableRowsHtml + '</tbody>' +
      '</table>' +

      '<table style="width:100%; margin-top:18px;">' +
        '<tr>' +
          '<td style="vertical-align:top; font-size:11px; color:' + SOFT + '; padding-right:20px;">' +
            'Total sesi: <strong style="color:' + INK + ';">' + esc(d.totalPertemuan || 0) + ' sesi</strong><br>' +
            'Total jam: <strong style="color:' + INK + ';">' + esc(d.totalJam || '-') + '</strong>' +
          '</td>' +
          '<td style="width:280px; vertical-align:top;">' +
            '<table style="width:100%; background:' + BLUE + '; border-radius:12px;">' +
              '<tr>' +
                '<td style="padding:14px 18px; font-size:12px; color:#C9CAF2;">Total gaji</td>' +
                '<td style="padding:14px 18px; font-size:19px; font-weight:800; color:#fff; text-align:right; white-space:nowrap;">' + formatRp(d.totalGaji) + '</td>' +
              '</tr>' +
            '</table>' +
          '</td>' +
        '</tr>' +
      '</table>' +

      '<div style="margin-top:36px; padding-top:14px; border-top:1px solid ' + BORDER + '; font-size:10.5px; color:' + SOFT + ';">' +
        'Dokumen ini dibuat otomatis oleh sistem Genio Institute pada ' + tanggalCetak + ' dan merupakan bukti penggajian yang sah.' +
      '</div>' +
    '</div>' +
  '</body>' +
  '</html>';
}

function buildLaporanBelajarHtml_(d) {
  var isVisit = (d.status === 'visit');
  var statusBadgeColor = isVisit ? '#007aff' : '#28a745';
  var statusBadgeBg = isVisit ? '#eaf3ff' : '#e8f5e9';
  var statusLabel = isVisit ? 'TELAH VISIT' : 'DISETUJUI / DITERIMA';

  var escapeHtml = function (str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  };

  var materiHtml = d.materiTeks
    ? '<div style="background:#f8f9fa; border:1px solid #ededf0; border-radius:10px; padding:16px 18px; font-size:12px; line-height:1.7; color:#1c1c1e; white-space:pre-wrap;">' + escapeHtml(d.materiTeks) + '</div>'
    : '<div style="background:#f8f9fa; border:1px dashed #d1d1d6; border-radius:10px; padding:16px; font-size:11.5px; color:#8e8e93; font-style:italic;">Tidak ada deskripsi laporan tertulis.</div>';

  var lampiranItems = [];
  if (d.materiLink) {
    lampiranItems.push(
      '<div style="background:#fff; border:1px solid #e5e5ea; border-radius:8px; padding:12px 14px; margin-bottom:8px; display:flex; align-items:center; justify-content:space-between; gap:12px;">' +
        '<div style="font-size:11.5px; font-weight:700; color:#1c1c1e;">Tautan Materi Pembelajaran</div>' +
        '<a href="' + escapeHtml(d.materiLink) + '" target="_blank" style="font-size:11.5px; color:#007aff; text-decoration:none; font-weight:600; max-width:340px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">' + escapeHtml(d.materiLink) + ' &rarr;</a>' +
      '</div>'
    );
  }
  if (d.catatanPembelajaranUrl) {
    lampiranItems.push(
      '<div style="background:#fff; border:1px solid #e5e5ea; border-radius:8px; padding:12px 14px; margin-bottom:8px; display:flex; align-items:center; justify-content:space-between; gap:12px;">' +
        '<div style="font-size:11.5px; font-weight:700; color:#1c1c1e;">Catatan Pembelajaran / Papan Tulis</div>' +
        '<a href="' + escapeHtml(d.catatanPembelajaranUrl) + '" target="_blank" style="font-size:11.5px; color:#28a745; text-decoration:none; font-weight:600; max-width:340px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">Buka Catatan Pembelajaran &rarr;</a>' +
      '</div>'
    );
  }

  var lampiranSectionHtml = lampiranItems.length
    ? lampiranItems.join('')
    : '<div style="font-size:11px; color:#8e8e93; font-style:italic;">Tidak ada berkas atau tautan materi digital pada sesi ini.</div>';

  return '<!DOCTYPE html>' +
  '<html>' +
  '<head>' +
    '<meta charset="utf-8">' +
    '<title>Laporan Belajar - ' + escapeHtml(d.siswaNama || 'Siswa') + '</title>' +
    '<style>' +
      '@page { size: A4 portrait; margin: 16mm 14mm; }' +
      'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1c1c1e; margin: 0; padding: 20px; background: #fff; line-height: 1.45; }' +
      '.report-box { max-width: 740px; margin: 0 auto; border: 1px solid #e5e5ea; border-radius: 12px; padding: 26px; box-sizing: border-box; }' +
      '.header-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; border-bottom: 2.5px solid #1c1c1e; padding-bottom: 14px; }' +
      '.logo-title { font-size: 23px; font-weight: 800; color: #1c1c1e; letter-spacing: -0.5px; }' +
      '.logo-sub { font-size: 11px; color: #8e8e93; text-transform: uppercase; letter-spacing: 1px; margin-top: 3px; font-weight: 600; }' +
      '.report-title { font-size: 18px; font-weight: 800; color: #1c1aaf; text-align: right; letter-spacing: 0.3px; }' +
      '.report-meta { font-size: 11px; color: #636366; text-align: right; margin-top: 4px; }' +
      '.info-table { width: 100%; border-collapse: separate; border-spacing: 12px 0; margin-bottom: 20px; }' +
      '.info-cell { width: 50%; vertical-align: top; padding: 12px 14px; background: #f8f9fa; border: 1px solid #ededf0; border-radius: 10px; }' +
      '.info-row { font-size: 11.5px; margin-bottom: 6px; display: flex; align-items: baseline; }' +
      '.info-label { color: #8e8e93; width: 110px; flex: none; font-size: 11px; }' +
      '.info-val { font-weight: 700; color: #1c1c1e; flex: 1; }' +
      '.section-title { font-size: 12px; font-weight: 800; color: #1c1c1e; text-transform: uppercase; letter-spacing: 0.6px; margin: 20px 0 10px; padding-bottom: 6px; border-bottom: 1.5px solid #ededf0; }' +
      '.status-pill { display: inline-block; padding: 3px 9px; border-radius: 999px; font-size: 10px; font-weight: 800; background: ' + statusBadgeBg + '; color: ' + statusBadgeColor + '; }' +
      '.footer-text { margin-top: 30px; padding-top: 14px; border-top: 1px dashed #d1d1d6; font-size: 10.5px; color: #8e8e93; text-align: center; line-height: 1.5; }' +
    '</style>' +
  '</head>' +
  '<body>' +
    '<div class="report-box">' +
      '<table class="header-table">' +
        '<tr>' +
          '<td style="vertical-align:top;">' +
            '<div class="logo-title">GENIO INSTITUTE</div>' +
            '<div class="logo-sub">Lembaga Bimbingan Belajar &amp; Privat Berkualitas</div>' +
          '</td>' +
          '<td style="text-align:right; vertical-align:top;">' +
            '<div class="report-title">LAPORAN BELAJAR SISWA</div>' +
            '<div class="report-meta">Pelaksanaan: <strong>' + escapeHtml(d.tanggal || '-') + '</strong></div>' +
          '</td>' +
        '</tr>' +
      '</table>' +

      '<table class="info-table">' +
        '<tr>' +
          '<td class="info-cell">' +
            '<div class="info-row"><span class="info-label">Nama Siswa</span><span class="info-val">: ' + escapeHtml(d.siswaNama || '-') + '</span></div>' +
            '<div class="info-row"><span class="info-label">Orang Tua / Wali</span><span class="info-val">: ' + escapeHtml(d.ortuNama || '-') + '</span></div>' +
            '<div class="info-row"><span class="info-label">Mata Pelajaran</span><span class="info-val">: ' + escapeHtml(d.mapel || '-') + '</span></div>' +
            '<div class="info-row"><span class="info-label">Unit / Cabang</span><span class="info-val">: ' + escapeHtml(d.unit || '-') + '</span></div>' +
          '</td>' +
          '<td class="info-cell">' +
            '<div class="info-row"><span class="info-label">Tutor Pengajar</span><span class="info-val">: ' + escapeHtml(d.tutorNama || '-') + '</span></div>' +
            '<div class="info-row"><span class="info-label">Waktu Belajar</span><span class="info-val">: ' + escapeHtml(d.jam || '-') + '</span></div>' +
            '<div class="info-row"><span class="info-label">Durasi Sesi</span><span class="info-val">: ' + escapeHtml(d.durasi || '-') + '</span></div>' +
            '<div class="info-row"><span class="info-label">Status Presensi</span><span class="info-val">: <span class="status-pill">' + statusLabel + '</span></span></div>' +
          '</td>' +
        '</tr>' +
      '</table>' +

      '<div class="section-title">Deskripsi &amp; Capaian Pembelajaran</div>' +
      materiHtml +

      '<div class="section-title">Lampiran &amp; Tautan Digital</div>' +
      lampiranSectionHtml +

      '<div class="footer-text">' +
        'Dokumen ini dicetak otomatis oleh Sistem Informasi Genio Institute pada ' + (new Date().toLocaleDateString('id-ID', { year:'numeric', month:'long', day:'numeric' })) + ' dan merupakan bukti laporan pembelajaran resmi bagi siswa &amp; orang tua.' +
      '</div>' +
    '</div>' +
  '</body>' +
  '</html>';
}

function buildInvoiceHtml_(d) {
  var isLunas = (d.status === 'lunas');
  var docTitle = isLunas ? 'KUITANSI PEMBAYARAN RESMI' : 'INVOICE TAGIHAN BIMBEL';
  var stampColor = isLunas ? '#28a745' : '#d97706';
  var stampBg = isLunas ? '#e8f5e9' : '#fef3c7';
  var stampText = isLunas ? 'LUNAS' : 'TAGIHAN';
  var docNo = isLunas
    ? 'REC-' + ((d.receiptId || d.id || '').substring(0, 8).toUpperCase())
    : 'INV-' + ((d.id || '').substring(0, 8).toUpperCase());

  var formatRp = function (n) {
    return 'Rp ' + Math.round(Number(n) || 0).toLocaleString('id-ID');
  };

  var escapeHtml = function (str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  };

  var terbilang = function (n) {
    n = Math.round(Number(n) || 0);
    if (n === 0) return 'Nol';
    var huruf = ['', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan', 'Sepuluh', 'Sebelas'];
    function convert(num) {
      if (num < 12) return huruf[num];
      if (num < 20) return convert(num - 10) + ' Belas';
      if (num < 100) return convert(Math.floor(num / 10)) + ' Puluh' + (num % 10 ? ' ' + convert(num % 10) : '');
      if (num < 200) return 'Seratus' + (num - 100 ? ' ' + convert(num - 100) : '');
      if (num < 1000) return convert(Math.floor(num / 100)) + ' Ratus' + (num % 100 ? ' ' + convert(num % 100) : '');
      if (num < 2000) return 'Seribu' + (num - 1000 ? ' ' + convert(num - 1000) : '');
      if (num < 1000000) return convert(Math.floor(num / 1000)) + ' Ribu' + (num % 1000 ? ' ' + convert(num % 1000) : '');
      if (num < 1000000000) return convert(Math.floor(num / 1000000)) + ' Juta' + (num % 1000000 ? ' ' + convert(num % 1000000) : '');
      return convert(Math.floor(num / 1000000000)) + ' Miliar' + (num % 1000000000 ? ' ' + convert(num % 1000000000) : '');
    }
    return convert(n).trim();
  };

  var totalSesi = d.totalSesi || d.jumlahPertemuan || 0;
  var totalNominal = d.totalNominal || d.nominal || 0;

  var itemsHtml = '';
  if (d.items && d.items.length > 0) {
    itemsHtml = d.items.map(function (item, idx) {
      var paketStr = Array.isArray(item.pakets) ? item.pakets.join(', ') : (item.pakets || item.namaPaket || 'Bimbel');
      return '<tr>' +
        '<td style="text-align:center;">' + (idx + 1) + '</td>' +
        '<td>' +
          '<strong>' + escapeHtml(item.nama || item.siswaNama || 'Siswa') + '</strong>' + (paketStr ? ' &bull; ' + escapeHtml(paketStr) : '') +
          (item.subtext ? '<div style="font-size:10px; color:#8e8e93; margin-top:2px;">' + escapeHtml(item.subtext) + '</div>' : '') +
        '</td>' +
        '<td style="text-align:center; font-weight:600;">' + (item.sesi || item.jumlahPertemuan || 0) + ' Sesi</td>' +
        '<td style="text-align:right;">' + formatRp(item.hargaSatuan || 0) + '</td>' +
        '<td style="text-align:right; font-weight:700;">' + formatRp(item.nominal || 0) + '</td>' +
      '</tr>';
    }).join('');
  } else {
    itemsHtml = '<tr>' +
      '<td style="text-align:center;">1</td>' +
      '<td>' +
        '<strong>' + escapeHtml(d.siswaNama || 'Siswa') + (d.namaPaket ? ' &bull; ' + escapeHtml(d.namaPaket) : '') + '</strong>' +
        '<div style="font-size:10px; color:#8e8e93; margin-top:2px;">Sesi pembelajaran terlaksana pada periode ' + escapeHtml(d.periodeLabel || d.periode || '-') + '</div>' +
      '</td>' +
      '<td style="text-align:center; font-weight:600;">' + totalSesi + ' Sesi</td>' +
      '<td style="text-align:right;">' + formatRp(d.hargaSatuan || 0) + '</td>' +
      '<td style="text-align:right; font-weight:700;">' + formatRp(totalNominal) + '</td>' +
    '</tr>';
  }

  var namaHeader = d.ortuNama || d.siswaNama || 'Orang Tua';

  return '<!DOCTYPE html>' +
  '<html>' +
  '<head>' +
    '<meta charset="utf-8">' +
    '<title>' + docTitle + ' - ' + escapeHtml(namaHeader) + '</title>' +
    '<style>' +
      '@page { size: A4 portrait; margin: 18mm 15mm; }' +
      'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1c1c1e; margin: 0; padding: 20px; background: #fff; line-height: 1.45; }' +
      '.sheet-box { max-width: 740px; margin: 0 auto; border: 1px solid #e5e5ea; border-radius: 12px; padding: 28px; box-sizing: border-box; }' +
      '.header-table { width: 100%; border-collapse: collapse; margin-bottom: 22px; border-bottom: 2.5px solid #1c1c1e; padding-bottom: 14px; }' +
      '.logo-title { font-size: 24px; font-weight: 800; color: #1c1c1e; letter-spacing: -0.5px; }' +
      '.logo-sub { font-size: 11px; color: #8e8e93; text-transform: uppercase; letter-spacing: 1.2px; margin-top: 3px; font-weight: 600; }' +
      '.logo-unit { font-size: 11px; color: #636366; margin-top: 3px; font-weight: 600; }' +
      '.doc-title { font-size: 18px; font-weight: 800; color: ' + stampColor + '; text-align: right; letter-spacing: 0.5px; }' +
      '.doc-meta { font-size: 11.5px; color: #636366; text-align: right; margin-top: 4px; }' +
      '.info-table { width: 100%; border-collapse: separate; border-spacing: 12px 0; margin-bottom: 22px; }' +
      '.info-cell { width: 50%; vertical-align: top; padding: 12px 14px; background: #f8f9fa; border: 1px solid #ededf0; border-radius: 10px; }' +
      '.info-row { font-size: 11.5px; margin-bottom: 6px; display: flex; align-items: baseline; }' +
      '.info-label { color: #8e8e93; width: 115px; flex: none; font-size: 11px; }' +
      '.info-val { font-weight: 700; color: #1c1c1e; flex: 1; }' +
      '.content-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }' +
      '.content-table th { background: #1c1c1e; color: #fff; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; padding: 10px 8px; text-align: left; }' +
      '.content-table td { padding: 10px 8px; border-bottom: 1px solid #e5e5ea; font-size: 11.5px; }' +
      '.summary-box { float: right; width: 300px; margin-bottom: 24px; background: #f8f9fa; border: 1px solid #ededf0; border-radius: 10px; padding: 14px; box-sizing: border-box; }' +
      '.terbilang-box { float: left; width: 380px; margin-bottom: 24px; background: #f8f9fa; border: 1px solid #ededf0; border-radius: 10px; padding: 14px; box-sizing: border-box; font-size: 11px; }' +
      '.sum-row { display: flex; justify-content: space-between; font-size: 11.5px; padding: 3px 0; color: #636366; }' +
      '.sum-total { display: flex; justify-content: space-between; font-size: 15px; font-weight: 800; padding-top: 8px; margin-top: 6px; border-top: 1.5px solid #1c1c1e; color: #1c1c1e; }' +
      '.status-pill { display: inline-block; padding: 3px 9px; border-radius: 999px; font-size: 10px; font-weight: 800; background: ' + stampBg + '; color: ' + stampColor + '; }' +
      '.sign-table { width: 100%; border-collapse: collapse; margin-top: 36px; clear: both; }' +
      '.sign-cell { width: 50%; text-align: center; font-size: 11px; color: #636366; vertical-align: top; }' +
      '.sign-space { height: 48px; display: flex; align-items: center; justify-content: center; }' +
      '.footer-text { clear: both; margin-top: 28px; padding-top: 14px; border-top: 1px dashed #d1d1d6; font-size: 10.5px; color: #8e8e93; text-align: center; }' +
    '</style>' +
  '</head>' +
  '<body>' +
    '<div class="sheet-box">' +
      '<table class="header-table">' +
        '<tr>' +
          '<td style="vertical-align:top;">' +
            '<div class="logo-title">GENIO INSTITUTE</div>' +
            '<div class="logo-sub">Lembaga Bimbingan Belajar &amp; Privat Berkualitas</div>' +
            '<div class="logo-unit">Unit: ' + escapeHtml(d.unitNama || 'Pusat') + '</div>' +
          '</td>' +
          '<td style="text-align:right; vertical-align:top;">' +
            '<div class="doc-title">' + docTitle + '</div>' +
            '<div class="doc-meta">No: <strong>' + escapeHtml(docNo) + '</strong></div>' +
            '<div class="doc-meta">Periode: <strong>' + escapeHtml(d.periodeLabel || d.periode || '-') + '</strong></div>' +
          '</td>' +
        '</tr>' +
      '</table>' +

      '<table class="info-table">' +
        '<tr>' +
          '<td class="info-cell">' +
            '<div class="info-row"><span class="info-label">Orang Tua / Wali</span><span class="info-val">: ' + escapeHtml(d.ortuNama || '-') + '</span></div>' +
            '<div class="info-row"><span class="info-label">Kontak / No. WA</span><span class="info-val">: ' + escapeHtml(d.ortuHp || '-') + '</span></div>' +
            '<div class="info-row"><span class="info-label">Unit / Cabang</span><span class="info-val">: ' + escapeHtml(d.unitNama || '-') + '</span></div>' +
          '</td>' +
          '<td class="info-cell">' +
            '<div class="info-row"><span class="info-label">Daftar Siswa</span><span class="info-val">: ' + escapeHtml(d.siswaList || d.siswaNama || '-') + '</span></div>' +
            '<div class="info-row"><span class="info-label">Total Sesi</span><span class="info-val">: ' + totalSesi + ' Sesi Pertemuan</span></div>' +
            '<div class="info-row"><span class="info-label">Status Dokumen</span><span class="info-val">: <span class="status-pill">' + stampText + (isLunas && d.tanggalLunas ? ' (' + d.tanggalLunas + ')' : '') + '</span></span></div>' +
          '</td>' +
        '</tr>' +
      '</table>' +

      '<table class="content-table">' +
        '<thead>' +
          '<tr>' +
            '<th style="width:36px; text-align:center;">No</th>' +
            '<th>Deskripsi Pembelajaran</th>' +
            '<th style="text-align:center; width:90px;">Jumlah Sesi</th>' +
            '<th style="text-align:right; width:120px;">Tarif / Sesi</th>' +
            '<th style="text-align:right; width:130px;">Subtotal</th>' +
          '</tr>' +
        '</thead>' +
        '<tbody>' +
          itemsHtml +
        '</tbody>' +
      '</table>' +

      '<div class="terbilang-box">' +
        '<div style="font-weight:700; color:#8e8e93; font-size:9.5px; text-transform:uppercase;">Terbilang:</div>' +
        '<div style="font-style:italic; font-weight:700; color:#1c1c1e; margin-top:4px;"># ' + terbilang(totalNominal) + ' Rupiah #</div>' +
      '</div>' +

      '<div class="summary-box">' +
        '<div class="sum-row"><span>Total Sesi:</span><strong>' + totalSesi + ' Sesi</strong></div>' +
        '<div class="sum-total"><span>TOTAL PEMBAYARAN:</span><span>' + formatRp(totalNominal) + '</span></div>' +
      '</div>' +

      '<table class="sign-table">' +
        '<tr>' +
          '<td class="sign-cell">' +
            '<div>Orang Tua / Wali Siswa,</div>' +
            '<div class="sign-space"></div>' +
            '<div style="border-top:1px solid #c7c7cc; display:inline-block; min-width:160px; padding-top:3px; font-weight:700; color:#1c1c1e;">' + escapeHtml(d.ortuNama || d.siswaNama || '-') + '</div>' +
          '</td>' +
          '<td class="sign-cell">' +
            '<div>Genio Institute ' + escapeHtml(d.unitNama || '') + ',</div>' +
            '<div class="sign-space" style="color:' + stampColor + '; font-weight:900; font-size:16px; opacity:.75; letter-spacing:1px; transform:rotate(-5deg);">' +
              stampText +
            '</div>' +
            '<div style="border-top:1px solid #c7c7cc; display:inline-block; min-width:160px; padding-top:3px; font-weight:700; color:#1c1c1e;">Bagian Administrasi</div>' +
          '</td>' +
        '</tr>' +
      '</table>' +

      '<div class="footer-text">' +
        'Dokumen ini dicetak otomatis oleh Sistem Informasi Genio Institute pada ' + (new Date().toLocaleDateString('id-ID', { year:'numeric', month:'long', day:'numeric' })) + ' dan merupakan bukti transaksi yang sah.' +
      '</div>' +
    '</div>' +
  '</body>' +
  '</html>';
}

/**
 * Dipakai di dalam file .html lewat <?!= include('NamaFile'); ?>
 * untuk menyisipkan partial (mis. Config.html berisi CSS & JS bersama).
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}