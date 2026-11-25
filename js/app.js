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

    renderLive(o);

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
      b.addEventListener('click', function () { removeAt(i); });

      row.appendChild(body); row.appendChild(b);
      list.appendChild(row);
    });

    var n = files.length;
    $('fileCount').hidden = !n;
    $('fileCount').textContent = n + ' picture' + (n === 1 ? '' : 's') + ' added. You can add more.';
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

  var SAMPLE = { name: 'IMG 4821.JPG', size: 0, lastModified: 0 };

  function chipsFor(o) {
    var c = [];
    if (o.newName) c.push('Name: ' + o.newName);
    if (o.numbering) c.push('Numbers from ' + o.numStart);
    if (o.prefix) c.push('Start: ' + o.prefix);
    if (o.suffix) c.push('End: ' + o.suffix);
    if (o.findText) c.push('Replace “' + o.findText + '”');
    if (o.caseMode !== 'none') c.push('Letters: ' + ({ lower: 'small', upper: 'CAPITALS', title: 'Each Word', sentence: 'First letter' }[o.caseMode]));
    if (o.spaces !== 'none') c.push('Spaces: ' + ({ underscore: '_', dash: '-', remove: 'removed' }[o.spaces]));
    if (o.stripSpecial) c.push('Symbols removed');
    if (o.extMode !== 'keep') c.push('File type: ' + ({ lower: 'small', upper: 'CAPITALS', change: '.' + (o.extNew || '?').replace(/^\./, ''), remove: 'removed' }[o.extMode]));
    return c;
  }

  function renderLive(o) {
    var f = files.length ? files[0] : SAMPLE;
    var r = (files.length ? results[0] : Renamer.plan([SAMPLE], o)[0]);
    $('liveBefore').textContent = f.name;
    $('liveAfter').textContent = r.renamed || '(empty)';
    $('liveAfter').classList.toggle('is-bad', !!BAD[r.status] && r.status !== 'duplicate');
    $('liveNote').textContent = files.length
      ? '(first of ' + files.length + ' file' + (files.length === 1 ? '' : 's') + ')'
      : '(example, choose files in step 1)';
    var box = $('liveChips'); box.textContent = '';
    var chips = chipsFor(o);
    if (!chips.length) {
      var none = document.createElement('span'); none.className = 'chip chip--none'; none.textContent = 'Nothing added yet'; box.appendChild(none);
    }
    chips.forEach(function (t) { var s = document.createElement('span'); s.className = 'chip'; s.textContent = t; box.appendChild(s); });
  }

  var IMG_EXT = /\.(jpe?g|png|gif|webp|bmp|avif|heic|heif|tiff?|svg|ico)$/i;
  var thumbs = new Map();     // File -> object URL for the small preview

  function isImage(f) {
    return (f.type && f.type.indexOf('image/') === 0) || IMG_EXT.test(f.name);
  }

  function renderAdded() {
    var ul = $('added');
    ul.textContent = '';
    files.forEach(function (f, i) {
      var li = document.createElement('li');
      var img = document.createElement('img');
      img.alt = ''; img.width = 40; img.height = 40; img.loading = 'lazy';
      if (!thumbs.has(f)) thumbs.set(f, URL.createObjectURL(f));
      img.src = thumbs.get(f);
      img.addEventListener('error', function () { img.style.visibility = 'hidden'; });
      var name = document.createElement('span'); name.className = 'added-name'; name.textContent = f.name;
      var b = document.createElement('button');
      b.className = 'x'; b.type = 'button'; b.setAttribute('aria-label', 'Remove ' + f.name); b.title = 'Remove this picture'; b.textContent = '×';
      b.addEventListener('click', function () { removeAt(i); });
      li.appendChild(img); li.appendChild(name); li.appendChild(b);
      ul.appendChild(li);
    });
  }

  function dropThumb(f) {
    if (thumbs.has(f)) { URL.revokeObjectURL(thumbs.get(f)); thumbs.delete(f); }
  }

  function removeAt(i) {
    dropThumb(files[i]);
    files.splice(i, 1);
    renderAdded(); render();
  }

  function clearAll() {
    files.forEach(dropThumb);
    files = [];
    $('notice').textContent = '';
    $('skipped').hidden = true;
    renderAdded(); render();
  }

  function addFiles(list) {
    var skipped = 0;
    Array.prototype.forEach.call(list, function (f) {
      if (isImage(f)) files.push(f); else skipped++;
    });
    var sk = $('skipped');
    sk.hidden = !skipped;
    sk.textContent = skipped
      ? skipped + ' file' + (skipped === 1 ? ' was' : 's were') + ' skipped because only pictures are allowed (not videos, documents or other files).'
      : '';
    $('notice').textContent = '';
    renderAdded(); render();
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
    $('clear').addEventListener('click', clearAll);
    $('reset').addEventListener('click', resetRules);
    $('download').addEventListener('click', download);
    $('fixDup').addEventListener('click', function () { Renamer.resolveDuplicates(results); applyFixed(); });
    $('fixIllegal').addEventListener('click', function () { Renamer.sanitize(results); applyFixed(); });

    render();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
