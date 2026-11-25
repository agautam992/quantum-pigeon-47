(function () {
  'use strict';

  var files = [];           // File objects, in the order added
  var results = [];         // output of Renamer.plan
  var $ = function (id) { return document.getElementById(id); };

  var ids = ['newName', 'findText', 'replaceText', 'useRegex', 'matchCase', 'prefix', 'suffix', 'numbering', 'numStart', 'numStep',
    'numPad', 'numPosition', 'numSeparator', 'caseMode', 'spaces', 'stripSpecial', 'extMode', 'extNew', 'sortBy'];

  // Which options belong to which tab, and when that tab counts as "switched on".
  var PANELS = {
    'p-name':    function (o) { return !!o.newName || o.numbering; },
    'p-add':     function (o) { return !!o.prefix || !!o.suffix; },
    'p-replace': function (o) { return !!o.findText; },
    'p-case':    function (o) { return o.caseMode !== 'none'; },
    'p-tidy':    function (o) { return o.spaces !== 'none' || o.stripSpecial; },
    'p-type':    function (o) { return o.extMode !== 'keep'; }
  };

  function readOptions() {
    var o = {};
    ids.forEach(function (id) {
      var el = $(id);
      o[id] = el.type === 'checkbox' ? el.checked : (el.type === 'number' ? Number(el.value) : el.value);
    });
    return o;
  }

  var BAD = { duplicate: 1, illegal: 1, empty: 1, reserved: 1 };
  var MSG = {
    ok: '',
    unchanged: 'No change',
    duplicate: 'Another file gets the same name',
    illegal: 'Has a symbol that is not allowed ( \\ / : * ? " < > | )',
    empty: 'The name would be empty',
    reserved: 'This name is not allowed on Windows'
  };

  function render() {
    var o = readOptions();
    results = Renamer.plan(files, o);

    $('numOpts').hidden = !o.numbering;
    $('extOpts').hidden = o.extMode !== 'change';
    $('empty').hidden = files.length > 0;
    $('results').hidden = files.length === 0;

    Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (t) {
      t.querySelector('.dot').hidden = !PANELS[t.getAttribute('data-panel')](o);
    });

    var list = $('rows');
    list.textContent = '';
    var bad = 0, changed = 0, dup = 0, ill = 0;

    results.forEach(function (r, i) {
      if (BAD[r.status]) bad++;
      if (r.status === 'ok') changed++;
      if (r.status === 'duplicate') dup++;
      if (r.status === 'illegal') ill++;

      var row = document.createElement('div');
      row.className = 'item' + (BAD[r.status] ? ' item--bad' : '');

      var body = document.createElement('div'); body.className = 'item-body';
      var before = document.createElement('div'); before.className = 'before'; before.textContent = r.original;
      var after = document.createElement('div'); after.className = 'after'; after.textContent = r.renamed || '(empty)';
      body.appendChild(before); body.appendChild(after);
      if (MSG[r.status]) {
        var m = document.createElement('div'); m.className = 'msg msg--' + r.status; m.textContent = MSG[r.status];
        body.appendChild(m);
      }

      var b = document.createElement('button');
      b.className = 'x'; b.type = 'button'; b.setAttribute('aria-label', 'Remove ' + r.original); b.title = 'Remove this file'; b.textContent = '×';
      b.addEventListener('click', function () { files.splice(i, 1); render(); });

      row.appendChild(body); row.appendChild(b);
      list.appendChild(row);
    });

    var n = files.length;
    $('fileCount').hidden = !n;
    $('fileCount').textContent = n + ' file' + (n === 1 ? '' : 's') + ' chosen. You can add more.';
    $('summary').textContent = changed + ' of ' + n + ' file' + (n === 1 ? '' : 's') + ' will get a new name.';

    var hints = [];
    if (dup && !o.numbering && o.newName) hints.push('Tip: turn on “Add numbers” in step 2 so each file gets a different name.');
    $('fixRow').hidden = !bad;
    $('fixDup').hidden = !dup;
    $('fixIllegal').hidden = !ill;
    $('fixMsg').textContent = bad ? 'Some files need attention before you can download. ' + hints.join(' ') : '';

    $('download').disabled = !n || bad > 0;
    $('download').textContent = n > 1 ? 'Download ' + n + ' renamed files (ZIP)' : 'Download renamed file';
  }

  function addFiles(list) {
    Array.prototype.forEach.call(list, function (f) { files.push(f); });
    $('notice').textContent = '';
    render();
  }

  function download() {
    if (!files.length || results.some(function (r) { return BAD[r.status]; })) return;
    var btn = $('download'), label = btn.textContent;
    btn.disabled = true; btn.textContent = 'Getting ready…';

    var finish = function () { render(); };
    var save = function (blob, name) {
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
    };

    if (files.length === 1) { save(files[0], results[0].renamed); finish(); return; }

    var zip = new JSZip();
    results.forEach(function (r, i) { zip.file(r.renamed, files[i]); });
    zip.generateAsync({ type: 'blob', compression: 'STORE' }).then(function (blob) {
      save(blob, 'renamed-files.zip'); finish();
    }, function () { $('notice').textContent = 'Sorry, the ZIP could not be made. Try fewer or smaller files.'; btn.textContent = label; finish(); });
  }

  function resetRules() {
    var d = Renamer.DEFAULTS;
    ids.forEach(function (id) {
      var el = $(id);
      if (el.type === 'checkbox') el.checked = !!d[id]; else el.value = d[id];
    });
    render();
  }

  function showPanel(id) {
    Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (t) {
      var on = t.getAttribute('data-panel') === id;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    Object.keys(PANELS).forEach(function (p) { $(p).hidden = p !== id; });
  }

  // Apply auto-fixed names without re-planning from the rules.
  function applyFixed() {
    var list = $('rows');
    var bad = 0;
    results.forEach(function (r, i) {
      if (BAD[r.status]) bad++;
      var item = list.children[i];
      item.className = 'item' + (BAD[r.status] ? ' item--bad' : '');
      item.querySelector('.after').textContent = r.renamed;
      var m = item.querySelector('.msg');
      if (m) m.remove();
      if (MSG[r.status]) {
        m = document.createElement('div'); m.className = 'msg msg--' + r.status; m.textContent = MSG[r.status];
        item.querySelector('.item-body').appendChild(m);
      }
    });
    $('fixDup').hidden = !results.some(function (r) { return r.status === 'duplicate'; });
    $('fixIllegal').hidden = !results.some(function (r) { return r.status === 'illegal'; });
    $('fixRow').hidden = !bad;
    $('download').disabled = !files.length || bad > 0;
    $('notice').textContent = 'Fixed. If you change any option, the names are worked out again.';
  }

  function init() {
    var drop = $('drop'), input = $('fileInput');
    drop.addEventListener('click', function () { input.click(); });
    drop.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
    input.addEventListener('change', function () { addFiles(input.files); input.value = ''; });
    ['dragenter', 'dragover'].forEach(function (t) { drop.addEventListener(t, function (e) { e.preventDefault(); drop.classList.add('is-over'); }); });
    ['dragleave', 'drop'].forEach(function (t) { drop.addEventListener(t, function (e) { e.preventDefault(); drop.classList.remove('is-over'); }); });
    drop.addEventListener('drop', function (e) { if (e.dataTransfer && e.dataTransfer.files) addFiles(e.dataTransfer.files); });

    ids.forEach(function (id) { $(id).addEventListener('input', render); $(id).addEventListener('change', render); });
    Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (t) {
      t.addEventListener('click', function () { showPanel(t.getAttribute('data-panel')); });
    });
    $('clear').addEventListener('click', function () { files = []; $('notice').textContent = ''; render(); });
    $('reset').addEventListener('click', resetRules);
    $('download').addEventListener('click', download);
    $('fixDup').addEventListener('click', function () { Renamer.resolveDuplicates(results); applyFixed(); });
    $('fixIllegal').addEventListener('click', function () { Renamer.sanitize(results); applyFixed(); });

    render();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
