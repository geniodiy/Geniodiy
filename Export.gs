var BACKUP_PARENT_FOLDER_ID = '1tBjY5lcL4GhnU1nGUDl1Lx7xS2x-xU9B'; // folder tujuan backup
var IMPORT_FOLDER_ID = ''; // isi dengan ID folder Drive yang berisi file .gs / .html / appsscript.json baru

var SCRIPT_API_ = 'https://script.googleapis.com/v1/projects/';
var WRITE_SCOPE_ = 'https://www.googleapis.com/auth/script.projects';

function exportProjectFilesToDrive() {
  var files = getProjectFiles_();
  var folderName = 'Backup AppScript - ' +
    Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HHmm');
  var folder = DriveApp.getFolderById(BACKUP_PARENT_FOLDER_ID).createFolder(folderName);

  files.forEach(function (file) {
    folder.createFile(file.name + extForType_(file.type), file.source, MimeType.PLAIN_TEXT);
  });

  Logger.log('Selesai. Folder: ' + folder.getUrl());
  return folder;
}

// Jalankan ini dulu: hanya menampilkan file apa saja yang akan ditimpa / ditambah, tanpa mengubah apa pun.
function previewImportFromDrive() {
  var plan = buildImportPlan_(IMPORT_FOLDER_ID);
  logImportPlan_(plan);
}

// Menimpa file proyek dengan file bernama sama dari folder Drive IMPORT_FOLDER_ID.
// File proyek yang tidak ada di folder tetap dibiarkan. Backup otomatis dibuat sebelum import.
function importProjectFilesFromDrive() {
  var plan = buildImportPlan_(IMPORT_FOLDER_ID);
  logImportPlan_(plan);
  if (!plan.replaced.length && !plan.added.length) {
    Logger.log('Tidak ada file yang cocok untuk diimport. Tidak ada perubahan.');
    return;
  }

  var backup = exportProjectFilesToDrive();
  Logger.log('Backup sebelum import: ' + backup.getUrl());

  var res = UrlFetchApp.fetch(SCRIPT_API_ + ScriptApp.getScriptId() + '/content', {
    method: 'put',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    payload: JSON.stringify({ files: plan.files }),
    muteHttpExceptions: true
  });

  if (res.getResponseCode() !== 200) {
    throw new Error('Import gagal (' + res.getResponseCode() + '): ' + res.getContentText() +
      '\nPastikan Google Apps Script API aktif di https://script.google.com/home/usersettings ' +
      'dan appsscript.json memakai scope ' + WRITE_SCOPE_);
  }

  Logger.log('Import selesai: ' + plan.replaced.length + ' ditimpa, ' + plan.added.length + ' ditambah. ' +
    'Muat ulang editor, lalu buat versi deployment baru supaya web app ikut berubah.');
}

function getProjectFiles_() {
  var res = UrlFetchApp.fetch(SCRIPT_API_ + ScriptApp.getScriptId() + '/content', {
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    muteHttpExceptions: true
  });
  if (res.getResponseCode() !== 200) {
    throw new Error('Gagal membaca proyek (' + res.getResponseCode() + '): ' + res.getContentText());
  }
  return JSON.parse(res.getContentText()).files || [];
}

function extForType_(type) {
  if (type === 'SERVER_JS') return '.gs';
  if (type === 'HTML') return '.html';
  if (type === 'JSON') return '.json';
  return '.txt';
}

function typeForFileName_(fileName) {
  var m = fileName.match(/^(.+)\.(gs|js|html|json)$/i);
  if (!m) return null;
  var ext = m[2].toLowerCase();
  if (ext === 'json') {
    return m[1] === 'appsscript' ? { name: 'appsscript', type: 'JSON' } : null;
  }
  return { name: m[1], type: ext === 'html' ? 'HTML' : 'SERVER_JS' };
}

function buildImportPlan_(folderId) {
  if (!folderId) throw new Error('Isi IMPORT_FOLDER_ID di Export.gs dengan ID folder Drive sumber.');

  var incoming = {};
  var skipped = [];
  var it = DriveApp.getFolderById(folderId).getFiles();
  while (it.hasNext()) {
    var f = it.next();
    var info = typeForFileName_(f.getName());
    if (!info) { skipped.push(f.getName()); continue; }
    var key = info.type + ':' + info.name;
    // Kalau ada nama ganda, pakai file yang paling baru diubah.
    if (incoming[key] && incoming[key].updated > f.getLastUpdated()) continue;
    incoming[key] = {
      name: info.name,
      type: info.type,
      source: f.getBlob().getDataAsString('UTF-8'),
      updated: f.getLastUpdated()
    };
  }

  var current = getProjectFiles_();
  var replaced = [], added = [], kept = [];
  var files = current.map(function (file) {
    var key = file.type + ':' + file.name;
    var inc = incoming[key];
    if (!inc) { kept.push(file.name + extForType_(file.type)); return file; }
    delete incoming[key];
    replaced.push(file.name + extForType_(file.type));
    return { name: file.name, type: file.type, source: file.type === 'JSON' ? keepWriteScope_(inc.source) : inc.source };
  });

  Object.keys(incoming).forEach(function (key) {
    var inc = incoming[key];
    added.push(inc.name + extForType_(inc.type));
    files.push({ name: inc.name, type: inc.type, source: inc.source });
  });

  return { files: files, replaced: replaced, added: added, kept: kept, skipped: skipped };
}

// Manifest yang diimport tetap harus punya izin tulis, supaya fungsi import ini tetap bisa dipakai lagi.
function keepWriteScope_(manifestSource) {
  var manifest = JSON.parse(manifestSource);
  var scopes = (manifest.oauthScopes || []).filter(function (s) {
    return s !== 'https://www.googleapis.com/auth/script.projects.readonly';
  });
  if (scopes.indexOf(WRITE_SCOPE_) === -1) scopes.push(WRITE_SCOPE_);
  manifest.oauthScopes = scopes;
  return JSON.stringify(manifest, null, 2);
}

function logImportPlan_(plan) {
  Logger.log('Akan ditimpa (' + plan.replaced.length + '): ' + (plan.replaced.join(', ') || '-'));
  Logger.log('Akan ditambah (' + plan.added.length + '): ' + (plan.added.join(', ') || '-'));
  Logger.log('Tidak diubah (' + plan.kept.length + '): ' + (plan.kept.join(', ') || '-'));
  if (plan.skipped.length) Logger.log('Dilewati, bukan .gs/.html/appsscript.json: ' + plan.skipped.join(', '));
}
