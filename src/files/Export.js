define([
  'gui/GuiTR',
  'files/ExportOBJ',
  'files/ExportSGL',
  'files/ExportPLY',
  'files/ExportSTL'
], function (TR, ExportOBJ, ExportSGL, ExportPLY, ExportSTL) {

  'use strict';

  var Export = {};
  Export.exportOBJ = ExportOBJ.exportOBJ;
  Export.exportSGL = ExportSGL.exportSGL;
  Export.exportPLY = ExportPLY.exportPLY;
  Export.exportSTL = ExportSTL.exportSTL;
  Export.exportSketchfab = function (main, key, statusWidget) {
    var fd = new FormData();

    fd.append('token', key);
    fd.append('modelFile', Export.exportOBJ(main.getMeshes(), true), 'sculptglModel.obj');
    fd.append('name', 'My model - ' + main.getReplayWriter().uid_);
    fd.append('tags', 'sculptgl');

    var xhr = new XMLHttpRequest();
    xhr.open('POST', 'https://api.sketchfab.com/v2/models', true);

    var domStatus = statusWidget.domContainer;
    statusWidget.setVisibility(true);
    domStatus.innerHTML = 'Uploading...';

    xhr.onprogress = function (event) {
      if (event.lengthComputable)
        domStatus.innerHTML = 'Uploading : ' + Math.round(event.loaded * 100.0 / event.total) + '%';
    };
    var hideStatus = function () {
      statusWidget.setVisibility(false);
    };
    xhr.onerror = hideStatus;
    xhr.onabort = hideStatus;

    xhr.onload = function () {
      hideStatus();
      var res = JSON.parse(xhr.responseText);
      var uid = res.uid;
      if (!uid) {
        window.alert(TR('sketchfabUploadError', res.detail));
        return;
      }
      window.prompt(TR('Processing...\nYour model will be available at :'), 'https://sketchfab.com/models/' + uid);
      var check = function () {
        var xhrPoll = new XMLHttpRequest();
        xhrPoll.open('GET', 'https://api.sketchfab.com/v2/models/' + uid + '/status?token=' + key, true);
        xhrPoll.onload = function () {
          var resPoll = JSON.parse(xhrPoll.responseText);
          if (resPoll.error)
            window.alert(TR('sketchfabUploadError', resPoll.error));
          else if (resPoll.processing === 'FAILURE')
            window.alert(TR('sketchfabUploadError', resPoll.processing));
          else if (resPoll.processing === 'SUCCEEDED')
            window.prompt(TR('sketchfabUploadSuccess'), 'https://sketchfab.com/models/' + uid);
          else
            window.setTimeout(check, 5000);
        };
        xhrPoll.send();
      };
      check();
    };
    xhr.send(fd);
    return xhr;
  };

  return Export;
});