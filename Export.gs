function exportProjectFilesToDrive() {
  const scriptId = ScriptApp.getScriptId();
  const url = 'https://script.googleapis.com/v1/projects/' + scriptId + '/content';
  const token = ScriptApp.getOAuthToken();

  const response = UrlFetchApp.fetch(url, {
    headers: { Authorization: 'Bearer ' + token }
  });
  const data = JSON.parse(response.getContentText());
  const files = data.files;

  const folderName = 'Backup AppScript - ' +
    Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HHmm');

  const parent = DriveApp.getFolderById('1tBjY5lcL4GhnU1nGUDl1Lx7xS2x-xU9B'); // ganti dengan ID folder kamu
  const folder = parent.createFolder(folderName);

  files.forEach(function (file) {
    let ext = '.txt';
    if (file.type === 'SERVER_JS') ext = '.gs';
    else if (file.type === 'HTML') ext = '.html';
    else if (file.type === 'JSON') ext = '.json';

    folder.createFile(file.name + ext, file.source, MimeType.PLAIN_TEXT);
  });

  Logger.log('Selesai. Folder: ' + folder.getUrl());
}