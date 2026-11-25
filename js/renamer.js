/* Pure rename logic. No DOM access, so it can be tested in Node. */
(function (root) {
  'use strict';

  var ILLEGAL = /[\\\/:*?"<>|\u0000-\u001f]/;
  var RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

  var DEFAULTS = {
    newName: '',
    findText: '', replaceText: '', useRegex: false, matchCase: false,
    prefix: '', suffix: '',
    numbering: false, numStart: 1, numStep: 1, numPad: 3, numPosition: 'suffix', numSeparator: '_',
    caseMode: 'none',            // none | lower | upper | title | sentence
    spaces: 'none',              // none | underscore | dash | remove
    stripSpecial: false,
    trim: true,
    extMode: 'keep',             // keep | lower | upper | change | remove
    extNew: '',
    sortBy: 'added'              // added | name | size | date
  };

  function splitName(name) {
    var i = name.lastIndexOf('.');
    if (i <= 0) return { base: name, ext: '' };
    return { base: name.slice(0, i), ext: name.slice(i + 1) };
  }

  function escapeRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  function titleCase(s) {
    return s.toLowerCase().replace(/(^|[\s_\-.])([a-zÀ-ɏ])/g, function (_, a, b) { return a + b.toUpperCase(); });
  }

  function sentenceCase(s) {
    s = s.toLowerCase();
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function pad(n, width) {
    var s = String(Math.abs(n));
    while (s.length < width) s = '0' + s;
    return (n < 0 ? '-' : '') + s;
  }

  function sortOrder(files, sortBy) {
    var idx = files.map(function (_, i) { return i; });
    if (sortBy === 'name') idx.sort(function (a, b) { return files[a].name.localeCompare(files[b].name, undefined, { numeric: true }); });
    else if (sortBy === 'size') idx.sort(function (a, b) { return files[a].size - files[b].size; });
    else if (sortBy === 'date') idx.sort(function (a, b) { return files[a].lastModified - files[b].lastModified; });
    return idx;
  }

  /** Apply the non-numbering rules to one file name. Returns {base, ext}. */
  function transform(name, o) {
    var p = splitName(name), base = p.base, ext = p.ext;

    if (o.newName) base = o.newName;

    if (o.findText) {
      var re;
      try {
        re = new RegExp(o.useRegex ? o.findText : escapeRegex(o.findText), o.matchCase ? 'g' : 'gi');
      } catch (e) { re = null; }
      if (re) base = base.replace(re, o.useRegex ? o.replaceText : function () { return o.replaceText; });
    }

    if (o.spaces === 'underscore') base = base.replace(/\s+/g, '_');
    else if (o.spaces === 'dash') base = base.replace(/\s+/g, '-');
    else if (o.spaces === 'remove') base = base.replace(/\s+/g, '');

    if (o.stripSpecial) base = base.replace(/[^\w\s.\-À-￿]/g, '').replace(/_{2,}/g, '_');

    if (o.caseMode === 'lower') base = base.toLowerCase();
    else if (o.caseMode === 'upper') base = base.toUpperCase();
    else if (o.caseMode === 'title') base = titleCase(base);
    else if (o.caseMode === 'sentence') base = sentenceCase(base);

    if (o.trim) base = base.trim();

    base = (o.prefix || '') + base + (o.suffix || '');

    if (o.extMode === 'lower') ext = ext.toLowerCase();
    else if (o.extMode === 'upper') ext = ext.toUpperCase();
    else if (o.extMode === 'remove') ext = '';
    else if (o.extMode === 'change') ext = (o.extNew || '').replace(/^\./, '');

    return { base: base, ext: ext };
  }

  /**
   * files: [{name,size,lastModified}]
   * Returns [{index, original, renamed, status}] in the original (added) order.
   * status: ok | unchanged | empty | illegal | reserved | duplicate
   */
  function plan(files, opts) {
    var o = {};
    Object.keys(DEFAULTS).forEach(function (k) { o[k] = (opts && opts[k] !== undefined) ? opts[k] : DEFAULTS[k]; });

    var order = sortOrder(files, o.sortBy);
    var results = new Array(files.length);
    var counter = Number(o.numStart) || 0, step = Number(o.numStep) || 1, width = Math.max(0, Number(o.numPad) || 0);

    order.forEach(function (i) {
      var t = transform(files[i].name, o);
      if (o.numbering) {
        var n = pad(counter, width);
        counter += step;
        t.base = o.numPosition === 'prefix' ? n + o.numSeparator + t.base : t.base + o.numSeparator + n;
      }
      var renamed = t.ext ? t.base + '.' + t.ext : t.base;
      results[i] = { index: i, original: files[i].name, renamed: renamed, status: 'ok' };
    });

    var seen = {};
    results.forEach(function (r) {
      var key = r.renamed.toLowerCase();
      seen[key] = (seen[key] || 0) + 1;
    });

    results.forEach(function (r) {
      var b = splitName(r.renamed).base;
      if (!r.renamed || !b) r.status = 'empty';
      else if (ILLEGAL.test(r.renamed)) r.status = 'illegal';
      else if (RESERVED.test(b) || /[. ]$/.test(r.renamed)) r.status = 'reserved';
      else if (seen[r.renamed.toLowerCase()] > 1) r.status = 'duplicate';
      else if (r.renamed === r.original) r.status = 'unchanged';
    });
    return results;
  }

  /** Make duplicate names unique by appending " (n)". Mutates and returns results. */
  function resolveDuplicates(results) {
    var used = {};
    results.forEach(function (r) { if (r.status !== 'duplicate') used[r.renamed.toLowerCase()] = true; });
    results.forEach(function (r) {
      if (r.status !== 'duplicate') return;
      if (!used[r.renamed.toLowerCase()]) {   // first of its group keeps the name
        used[r.renamed.toLowerCase()] = true;
        r.status = 'ok';
        return;
      }
      var p = splitName(r.renamed), n = 1, cand;
      do { cand = p.base + ' (' + n++ + ')' + (p.ext ? '.' + p.ext : ''); } while (used[cand.toLowerCase()]);
      used[cand.toLowerCase()] = true;
      r.renamed = cand;
      r.status = 'ok';
    });
    return results;
  }

  /** Replace characters that are illegal in file names. */
  function sanitize(results) {
    results.forEach(function (r) {
      if (r.status === 'illegal') {
        r.renamed = r.renamed.replace(/[\\\/:*?"<>|\u0000-\u001f]/g, '_');
        r.status = 'ok';
      }
    });
    return results;
  }

  var api = { DEFAULTS: DEFAULTS, plan: plan, resolveDuplicates: resolveDuplicates, sanitize: sanitize, splitName: splitName };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Renamer = api;
})(typeof self !== 'undefined' ? self : this);
