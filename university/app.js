(() => {
  'use strict';
  const data = window.APP_DATA;
  let standardData = window.STANDARDS_115 || { layouts: {}, programs: {} };
  let standards = standardData.programs || {};
  let standardsPromise;
  let schoolDetailsPromise;
  let schoolDetails116Promise;
  const programByCode = new Map(data.programs.map(program => [program.code, program]));
  const englishListeningCodes = new Set(window.TELC_116.codes);
  const standardSourceBase = 'https://www.cac.edu.tw/CacLink/apply115/115Apply_sievE_Result_querY_615JG8Wgh9d/html_sieve_result_115_Zx57f1dW/Standard/report/';
  const subjects = data.subjects;
  const baseChecks = [...subjects, '英聽'];
  const baseRatios = [...subjects, '學測科目組合'];
  const state = { query: '', school: '', region: '', academicGroup: '', category: '', comparison: '', selected: new Set(), mode: 'all', noSubject: false, englishListening: false, sort: 'code', limit: 50 };
  const compareCodes = new Set();
  const maxCompare = 10;
  const schoolType = school => school.startsWith('國立') || school.includes('市立') ? 'public' : 'private';
  const $ = id => document.getElementById(id);
  const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const format = number => new Intl.NumberFormat('zh-TW').format(number);
  const normalize = value => String(value).toLowerCase().replace(/臺/g, '台').replace(/\s/g, '');

  $('total-programs').textContent = format(data.programs.length);
  $('total-schools').textContent = format(data.schools.length);
  $('english-listening-count').textContent = format(englishListeningCodes.size);
  $('school').insertAdjacentHTML('beforeend', `<option value="type:public">公立大學</option><option value="type:private">私立學校</option><optgroup label="個別學校">${data.schools.map(s => `<option value="${s.code}">${escapeHtml(s.name)}（${s.code}）</option>`).join('')}</optgroup>`);
  $('region').insertAdjacentHTML('beforeend', data.regions.map(region => `<option value="${region.code}">${escapeHtml(region.name)}</option>`).join(''));
  $('academic-group').insertAdjacentHTML('beforeend', data.academicGroups.map(group => `<option value="${escapeHtml(group)}">${escapeHtml(group)}（${format(data.programs.filter(program => program.academicGroups.includes(group)).length)}）</option>`).join(''));
  $('category').insertAdjacentHTML('beforeend', data.categories.map(c => `<option value="${c}">${c}</option>`).join(''));
  $('subject-options').innerHTML = subjects.map(s => `<label class="subject-option"><input type="checkbox" value="${s}"><span>${s}</span><small>${format(data.programs.filter(p => p.subjects.includes(s)).length)}</small></label>`).join('');

  function filtered() {
    const q = normalize(state.query);
    const selected = [...state.selected];
    const rows = data.programs.filter(p => {
      if (q && !normalize(`${p.code}${p.name}${p.school}${p.schoolCode}`).includes(q)) return false;
      if (state.school.startsWith('type:') && schoolType(p.school) !== state.school.slice(5)) return false;
      if (state.school && !state.school.startsWith('type:') && p.schoolCode !== state.school) return false;
      if (state.region && p.regionCode !== state.region) return false;
      if (state.academicGroup && !p.academicGroups.includes(state.academicGroup)) return false;
      if (state.category && p.category !== state.category) return false;
      if (state.comparison && p.change !== state.comparison) return false;
      if (state.englishListening && !englishListeningCodes.has(p.code)) return false;
      if (state.noSubject) return p.subjects.length === 0;
      if (!selected.length) return true;
      if (state.mode === 'any') return selected.some(s => p.subjects.includes(s));
      if (state.mode === 'exact') return p.subjects.length === selected.length && selected.every(s => p.subjects.includes(s));
      return selected.every(s => p.subjects.includes(s));
    });
    if (state.sort === 'school') rows.sort((a, b) => a.school.localeCompare(b.school, 'zh-Hant') || a.code.localeCompare(b.code));
    if (state.sort === 'subjectCount') rows.sort((a, b) => b.subjects.length - a.subjects.length || a.code.localeCompare(b.code));
    return rows;
  }

  function subjectTags(items, emphasized, style) {
    const cells = subjects.map(s => `<span class="tag-slot"${items.includes(s) ? '' : ' aria-hidden="true"'}>${items.includes(s) ? `<span class="tag ${emphasized.includes(s) ? style : ''}">${escapeHtml(s)}</span>` : ''}</span>`).join('');
    return cells + (items.length ? '' : '<span class="subject-empty-note">不參採</span>');
  }

  function rowHtml(p) {
    const current = subjectTags(p.subjects, p.added, 'added');
    const previous = p.previous ? `<div class="tags">${subjectTags(p.previous.subjects, p.removed, 'removed')}</div>` : '<span class="unmatched">無同名紀錄</span>';
    const previousCode = p.previous && p.previous.code !== p.code ? `<span class="previous-code">115 代碼 ${p.previous.code}</span>` : '';
    const change = p.change === 'changed' ? '<span class="change-pill changed">科目有變動</span>' : p.change === 'unmatched' ? '<span class="change-pill unmatched-pill">待核對</span>' : '';
    const standardButton = `<button class="standard-button" type="button" data-program-code="${p.code}">篩選標準比較</button>`;
    const checked = compareCodes.has(p.code);
    const comparePick = `<label class="compare-pick"><input type="checkbox" data-compare-code="${p.code}" aria-label="加入比較：${escapeHtml(p.school)} ${escapeHtml(p.name)}" ${checked ? 'checked' : ''} ${!checked && compareCodes.size >= maxCompare ? 'disabled' : ''}><span>加入比較</span></label>`;
    return `<tr><td data-label="116 校系"><span class="program-name">${escapeHtml(p.name)}</span><span class="program-codes"><span class="program-code">${p.code}</span>${previousCode}</span><span class="program-group">學群：${escapeHtml(p.academicGroups.join('／'))}</span>${change}${standardButton}${comparePick}</td><td data-label="學校"><span class="school-name">${escapeHtml(p.school)}</span></td><td data-label="類別"><span class="category">${p.category}</span></td><td data-label="116 參採科目"><div class="tags">${current}</div></td><td data-label="115 參採科目">${previous}</td><td data-label="原始資料"><a class="pdf-link" href="data/${p.schoolCode}.pdf#page=${p.page}" data-pdf-program-code="${p.code}" aria-label="查看${escapeHtml(p.school)}${escapeHtml(p.name)}的 116 原始 PDF，第 ${p.page} 頁">116 PDF ↗</a></td></tr>`;
  }

  function criteriaTable(title, labels, previousCells, currentValues, hasPrevious) {
    const allLabels = [...new Set([...labels, ...Object.keys(currentValues || {})])];
    return `<section class="standard-section"><h4>${title}</h4><table class="criteria-table compare-table"><thead><tr><th scope="col">科目／項目</th><th scope="col">115 年</th><th scope="col">116 年</th></tr></thead><tbody>${allLabels.map(label => { const oldIndex = labels.indexOf(label); const previous = oldIndex >= 0 && previousCells[oldIndex] ? previousCells[oldIndex] : { text: '—', confidence: 1 }; const currentText = currentValues && Object.prototype.hasOwnProperty.call(currentValues, label) ? currentValues[label] : '—'; const changed = hasPrevious && currentText !== previous.text; const uncertain = previous.confidence < .7 && previous.text !== '—'; return `<tr><th scope="row">${escapeHtml(label)}</th><td${uncertain ? ' class="ocr-uncertain" title="圖片辨識結果待核對，請查看官方原表"' : ''}>${escapeHtml(previous.text)}${uncertain ? '<sup aria-label="待核對">?</sup>' : ''}</td><td class="current-year${changed ? ' changed-year' : ''}">${escapeHtml(currentText)}</td></tr>`; }).join('')}</tbody></table></section>`;
  }

  function passTable(labels, cells) {
    return `<section class="standard-section pass-section"><h4>115 最低通過分數</h4><table class="criteria-table pass-table"><thead><tr><th scope="col">篩選順序</th><th scope="col">最低通過分數</th></tr></thead><tbody>${labels.map((label, index) => { const cell = cells[index] || { text: '—', confidence: 1 }; const uncertain = cell.confidence < .7 && cell.text !== '—'; return `<tr><th scope="row">${escapeHtml(label)}</th><td class="${cell.text === '—' ? 'pass-empty' : 'pass-score'}${uncertain ? ' ocr-uncertain' : ''}"${uncertain ? ' title="圖片辨識結果待核對，請查看官方原表"' : ''}>${escapeHtml(cell.text)}${uncertain ? '<sup aria-label="待核對">?</sup>' : ''}</td></tr>`; }).join('')}</tbody></table></section>`;
  }

  function scoreTable(title, previousValue, currentValue, hasPrevious) {
    const previousText = String(previousValue || '—').trim();
    const currentText = String(currentValue || '—').trim();
    const changed = hasPrevious && currentText !== previousText;
    return `<section class="standard-section score-section"><h4>${title}</h4><table class="criteria-table score-table"><thead><tr><th scope="col">115 年</th><th scope="col">116 年</th></tr></thead><tbody><tr><td>${escapeHtml(previousText)}</td><td class="current-year${changed ? ' changed-year' : ''}">${escapeHtml(currentText)}</td></tr></tbody></table></section>`;
  }

  function ensureSchoolDetails116() {
    if (window.schoolDetails116) return Promise.resolve();
    if (!schoolDetails116Promise) schoolDetails116Promise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'data/school_116.js?v=20261103a';
      script.onload = resolve;
      script.onerror = () => { schoolDetails116Promise = null; reject(new Error('116 校系分則資料載入失敗')); };
      document.head.appendChild(script);
    });
    return schoolDetails116Promise;
  }

  function ensureSchoolDetails() {
    if (window.schoolDetails115) return Promise.resolve();
    if (!schoolDetailsPromise) schoolDetailsPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'data/school_115.js?v=20261102b';
      script.onload = resolve;
      script.onerror = () => { schoolDetailsPromise = null; reject(new Error('校系分則資料載入失敗')); };
      document.head.appendChild(script);
    });
    return schoolDetailsPromise;
  }

  function ensureStandards() {
    if (window.STANDARDS_115) return Promise.resolve();
    if (!standardsPromise) standardsPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'data/standards.js?v=20261103a';
      script.onload = () => {
        standardData = window.STANDARDS_115 || { layouts: {}, programs: {} };
        standards = standardData.programs || {};
        resolve();
      };
      script.onerror = () => { standardsPromise = null; reject(new Error('標準資料載入失敗')); };
      document.head.appendChild(script);
    });
    return standardsPromise;
  }

  function openStandards(program) {
    if (!program) return;
    const rows = program.previous ? standards[program.previous.code] || [] : [];
    const previous = program.previous ? (window.schoolDetails115 || {})[program.previous.code] : null;
    const current = (window.schoolDetails116 || {})[program.code];
    if (!current) throw new Error(`116 校系分則缺少 ${program.code}`);
    $('standards-title').textContent = `${program.school} ${program.name}`;
    $('standards-description').textContent = `116 校系代碼 ${program.code}${program.previous ? ` · 115 校系代碼 ${program.previous.code}` : ' · 115 無同校同名紀錄'}`;
    $('standards-source').hidden = !program.previous;
    $('school-detail-source').hidden = !program.previous;
    $('standards-source').href = `${standardSourceBase}${program.schoolCode}.htm`;
    $('school-detail-source').href = program.previous ? `https://www.cac.edu.tw/apply115/system/ColQry_115xappLyfOrStu_Azd5gP29/html/115_${program.previous.code}.htm?v=1.0` : '';
    $('school-detail-source-116').href = `https://www.cac.edu.tw/apply116/system/ColQry_116ApplyxForStudent_F75reOza/html/116_${program.code}.htm?v=1.0`;
    $('standards-content').innerHTML = (rows.length ? rows : [null]).map((row, index) => {
      const labels = row ? standardData.layouts[row.layout] : { checks: baseChecks, ratios: baseRatios };
      const details = row ? `<dl class="standard-details">${labels.identity.slice(1).map((label, i) => `<div><dt>115 ${escapeHtml(label)}</dt><dd>${escapeHtml(row.identity[i + 1].text)}</dd></div>`).join('')}</dl>` : '<p class="standard-error">115 無同校同名校系，以下顯示 116 年官方分則資料。</p>';
      const passes = row ? passTable(labels.passes, row.passes) : '';
      const combination = current.combination ? `<p class="standard-combination">116 學測科目組合：${escapeHtml(current.combination)}</p>` : '';
      const extra = row ? `<div class="standard-extra"><strong>115 同級分超額篩選</strong><span>${escapeHtml(row.extra.text)}</span></div>` : '';
      return `<article class="standard-record">${rows.length > 1 ? `<h3>115 原表第 ${index + 1} 列</h3>` : ''}${details}<div class="standard-grid">${passes}<section class="first-stage" aria-labelledby="first-stage-${program.code}-${index}"><h3 id="first-stage-${program.code}-${index}">第一階段</h3><div class="criteria-grid">${criteriaTable('檢定標準', labels.checks, row ? row.checks : [], current.checks, Boolean(row))}${criteriaTable('篩選倍率', labels.ratios, row ? row.ratios : [], current.ratios, Boolean(row))}</div>${combination}</section></div><section class="second-stage" aria-labelledby="second-stage-${program.code}-${index}"><h3 id="second-stage-${program.code}-${index}">第二階段</h3><div class="score-grid">${scoreTable('學測成績採計方式', previous && previous.scoreWeights, current.scoreWeights, Boolean(previous))}${scoreTable('學測佔甄選總成績比例', previous && previous.gsatPercentage, current.gsatPercentage, Boolean(previous))}</div></section>${extra}</article>`;
    }).join('');
    showStandardsDialog();
  }

  function showStandardsDialog() {
    const dialog = $('standards-dialog');
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else { dialog.setAttribute('open', ''); document.body.classList.add('dialog-open'); }
  }

  function closeStandards() {
    const dialog = $('standards-dialog');
    if (typeof dialog.close === 'function') dialog.close();
    else { dialog.removeAttribute('open'); document.body.classList.remove('dialog-open'); }
  }

  let pdfReturnFocus;
  function openPdf(link) {
    const program = programByCode.get(link.dataset.pdfProgramCode);
    if (!program) return;
    pdfReturnFocus = link;
    $('pdf-title').textContent = `${program.school} ${program.name}`;
    $('pdf-page').textContent = `116 原始 PDF · 第 ${program.page} 頁`;
    $('pdf-frame').title = `${program.school} ${program.name} 116 原始 PDF`;
    $('pdf-frame').src = link.getAttribute('href');
    $('pdf-download').href = `data/${program.schoolCode}.pdf`;
    $('pdf-download').download = `116_${program.schoolCode}.pdf`;
    const dialog = $('pdf-dialog');
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else { dialog.setAttribute('open', ''); document.body.classList.add('dialog-open'); }
    document.body.classList.add('pdf-open');
  }

  function closePdf() {
    const dialog = $('pdf-dialog');
    if (typeof dialog.close === 'function' && dialog.open) dialog.close();
    else dialog.removeAttribute('open');
    $('pdf-frame').removeAttribute('src');
    document.body.classList.remove('pdf-open', 'dialog-open');
    if (pdfReturnFocus && pdfReturnFocus.isConnected) pdfReturnFocus.focus();
  }

  function updateCompareControls() {
    const count = compareCodes.size;
    $('compare-tray').hidden = count === 0;
    document.body.classList.toggle('has-compare-tray', count > 0);
    $('compare-count').textContent = `已選 ${count} / ${maxCompare} 個校系`;
    $('compare-hint').textContent = count === maxCompare ? '已達勾選上限' : count < 2 ? '再選 1 個校系即可比較' : '可跨篩選條件繼續加入';
    $('compare-open').disabled = count < 2;
    $('result-rows').querySelectorAll('input[data-compare-code]').forEach(input => {
      const checked = compareCodes.has(input.dataset.compareCode);
      input.checked = checked;
      input.disabled = !checked && count >= maxCompare;
    });
  }

  function compareStandards(program, field) {
    if (!program.previous) return '無同名紀錄';
    const rows = standards[program.previous.code] || [];
    if (!rows.length) return '—';
    return rows.map((row, rowIndex) => {
      const labels = (standardData.layouts[row.layout] || {})[field] || [];
      const entries = labels.map((label, index) => {
        const cell = (row[field] || [])[index];
        if (!cell || cell.text === '—') return '';
        return `${label}：${cell.text}${cell.confidence < .7 ? '（待核對）' : ''}`;
      }).filter(Boolean).join(field === 'passes' ? '\n' : '、');
      return `${rows.length > 1 ? `原表第 ${rowIndex + 1} 列：` : ''}${entries || '—'}`;
    }).join(field === 'passes' ? '\n' : '；');
  }

  function compareStandards116(program, field) {
    const detail = (window.schoolDetails116 || {})[program.code];
    if (!detail) return '—';
    const entries = Object.entries(detail[field] || {}).filter(([, value]) => value !== '—');
    return entries.map(([label, value]) => `${label === '學測科目組合' && detail.combination ? `${label}（${detail.combination}）` : label}：${value}`).join('、') || '—';
  }

  function renderCompareTable() {
    const programs = [...compareCodes].map(code => programByCode.get(code)).filter(Boolean);
    const row = (label, values, html = false, className = '') => `<tr${className ? ` class="${className}"` : ''}><th scope="row">${label}</th>${values.map(value => `<td>${html ? value : escapeHtml(value)}</td>`).join('')}</tr>`;
    const values = fn => programs.map(fn);
    const subjectCell = (program, previous) => previous && !program.previous ? '無同名紀錄' : `<div class="tags">${subjectTags(previous ? program.previous.subjects : program.subjects, previous ? program.removed : program.added, previous ? 'removed' : 'added')}</div>`;
    const changeLabel = program => program.change === 'changed' ? '參採科目有變動' : program.change === 'same' ? '參採科目相同' : '115 無同名紀錄';
    const scroll = $('compare-scroll');
    const scrollLeft = scroll.scrollLeft;
    const dialog = $('compare-dialog');
    dialog.style.setProperty('--compare-table-width', `${140 + 196 * programs.length}px`);
    dialog.style.setProperty('--compare-mobile-table-width', `${115 + 190 * programs.length}px`);
    $('compare-table').innerHTML = `<thead><tr><th scope="col">比較項目</th>${programs.map(program => `<th scope="col"><span class="compare-school">${escapeHtml(program.school)}</span><span class="compare-name">${escapeHtml(program.name)}</span><button type="button" data-compare-remove="${program.code}" aria-label="移除比較：${escapeHtml(program.school)} ${escapeHtml(program.name)}">移除</button></th>`).join('')}</tr></thead><tbody>${row('學校', values(program => program.school))}${row('116 參採科目', values(program => subjectCell(program, false)), true)}${row('115 參採科目', values(program => subjectCell(program, true)), true)}${row('兩年科目比較', values(changeLabel))}${row('115 最低通過分數', values(program => compareStandards(program, 'passes')), false, 'compare-pass-row')}${row('115 檢定標準', values(program => compareStandards(program, 'checks')))}${row('116 檢定標準', values(program => compareStandards116(program, 'checks')))}${row('115 篩選倍率', values(program => compareStandards(program, 'ratios')))}${row('116 篩選倍率', values(program => compareStandards116(program, 'ratios')))}</tbody>`;
    scroll.scrollLeft = scrollLeft;
    $('compare-description').textContent = `已選 ${programs.length} 個校系，最多可選 ${maxCompare} 個`;
  }

  function closeCompare() {
    const dialog = $('compare-dialog');
    if (typeof dialog.close === 'function' && dialog.open) dialog.close();
    else { dialog.removeAttribute('open'); document.body.classList.remove('dialog-open'); }
    $('compare-open').focus();
  }

  function renderChart(id, labels, counts) {
    const maximum = Math.max(...counts, 1);
    $(id).innerHTML = labels.map((label, index) => `<div class="bar-row"><span class="bar-label">${label}</span><span class="bar-track"><span class="bar-fill" style="display:block;width:${Math.round(counts[index] / maximum * 100)}%"></span></span><span class="bar-value">${format(counts[index])}</span></div>`).join('');
  }

  function render() {
    const rows = filtered();
    $('result-count').textContent = format(rows.length);
    $('result-rows').innerHTML = rows.slice(0, state.limit).map(rowHtml).join('');
    $('empty-state').hidden = rows.length !== 0;
    $('showing-count').textContent = rows.length ? `顯示 ${format(Math.min(state.limit, rows.length))} / ${format(rows.length)} 筆` : '顯示 0 筆';
    $('show-more').hidden = state.limit >= rows.length;
    const selectedSchool = data.schools.find(s => s.code === state.school);
    const schoolScope = state.school === 'type:public' ? '公立大學' : state.school === 'type:private' ? '私立學校' : selectedSchool ? selectedSchool.name : '全部學校';
    const selectedRegion = data.regions.find(region => region.code === state.region);
    $('insight-scope').textContent = `目前範圍：${schoolScope}${selectedRegion ? `，${selectedRegion.name}` : ''}${state.academicGroup ? `，${state.academicGroup}` : ''}，${format(rows.length)} 筆符合條件的校系`;
    $('changed-count').textContent = format(rows.filter(p => p.change === 'changed').length);
    $('same-count').textContent = format(rows.filter(p => p.change === 'same').length);
    $('unmatched-count').textContent = format(rows.filter(p => p.change === 'unmatched').length);
    renderChart('subject-chart', subjects, subjects.map(s => rows.filter(p => p.subjects.includes(s)).length));
    const countLabels = ['0 科', '1 科', '2 科', '3 科', '4 科', '5 科', '6 科'];
    renderChart('count-chart', countLabels, countLabels.map((_, n) => rows.filter(p => p.subjects.length === n).length));
    $('no-subject').disabled = state.selected.size > 0;
    $('english-listening-filter').setAttribute('aria-pressed', String(state.englishListening));
    $('subject-options').classList.toggle('disabled', state.noSubject);
    $('subject-options').querySelectorAll('input').forEach(input => { input.disabled = state.noSubject; });
    updateCompareControls();
    return rows;
  }

  function changed() { state.limit = 50; render(); }
  $('search').addEventListener('input', event => { state.query = event.target.value; changed(); });
  $('school').addEventListener('change', event => { state.school = event.target.value; changed(); });
  $('region').addEventListener('change', event => { state.region = event.target.value; changed(); });
  $('academic-group').addEventListener('change', event => { state.academicGroup = event.target.value; changed(); });
  $('category').addEventListener('change', event => { state.category = event.target.value; changed(); });
  $('comparison').addEventListener('change', event => { state.comparison = event.target.value; changed(); });
  $('subject-options').addEventListener('change', event => { if (event.target.checked) state.selected.add(event.target.value); else state.selected.delete(event.target.value); changed(); });
  document.querySelectorAll('input[name="subject-mode"]').forEach(input => input.addEventListener('change', event => { state.mode = event.target.value; changed(); }));
  $('no-subject').addEventListener('change', event => { state.noSubject = event.target.checked; changed(); });
  $('english-listening-filter').addEventListener('click', () => { state.englishListening = !state.englishListening; changed(); });
  $('sort').addEventListener('change', event => { state.sort = event.target.value; changed(); });
  $('show-more').addEventListener('click', () => { state.limit += 50; render(); });
  $('result-rows').addEventListener('change', event => {
    const input = event.target.closest('input[data-compare-code]');
    if (!input) return;
    if (input.checked && compareCodes.size < maxCompare) compareCodes.add(input.dataset.compareCode);
    else compareCodes.delete(input.dataset.compareCode);
    updateCompareControls();
  });
  $('compare-clear').addEventListener('click', () => { compareCodes.clear(); updateCompareControls(); });
  $('compare-open').addEventListener('click', () => {
    if (compareCodes.size < 2) return;
    const button = $('compare-open');
    button.disabled = true;
    button.textContent = '載入中…';
    Promise.allSettled([ensureStandards(), ensureSchoolDetails116()]).then(results => {
      if (compareCodes.size < 2) return;
      $('compare-help').textContent = results.some(result => result.status === 'rejected') ? '部分篩選標準暫時無法載入；仍可比較兩年的參採科目。' : '左右捲動可查看所有已選校系。115、116 年檢定與倍率均依官方校系分則整理；115 最低通過分數依官方篩選標準原圖核對。';
      renderCompareTable();
      const dialog = $('compare-dialog');
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else { dialog.setAttribute('open', ''); document.body.classList.add('dialog-open'); }
      $('compare-scroll').scrollLeft = 0;
    }).finally(() => { button.textContent = '開始比較'; updateCompareControls(); });
  });
  $('compare-table').addEventListener('click', event => {
    const button = event.target.closest('button[data-compare-remove]');
    if (!button) return;
    compareCodes.delete(button.dataset.compareRemove);
    updateCompareControls();
    if (compareCodes.size < 2) closeCompare();
    else renderCompareTable();
  });
  $('compare-close').addEventListener('click', closeCompare);
  $('compare-done').addEventListener('click', closeCompare);
  $('compare-dialog').addEventListener('cancel', event => { event.preventDefault(); closeCompare(); });
  $('result-rows').addEventListener('click', event => {
    const pdfLink = event.target.closest('a[data-pdf-program-code]');
    if (pdfLink) {
      event.preventDefault();
      openPdf(pdfLink);
      return;
    }
    const button = event.target.closest('button[data-program-code]');
    if (!button || button.disabled) return;
    const program = programByCode.get(button.dataset.programCode);
    button.disabled = true;
    button.textContent = '載入中…';
    Promise.all([ensureSchoolDetails116(), ...(program.previous ? [ensureStandards(), ensureSchoolDetails()] : [])]).then(() => openStandards(program)).catch(() => {
      $('standards-title').textContent = `${program.school} ${program.name}`;
      $('standards-description').textContent = '篩選標準比較';
      $('standards-content').innerHTML = '<p class="standard-error">篩選標準資料載入失敗，請重新整理網頁後再試；也可查看官方校系分則。</p>';
      $('standards-source').href = `${standardSourceBase}${program.schoolCode}.htm`;
      $('standards-source').hidden = !program.previous;
      $('school-detail-source').hidden = !program.previous;
      $('school-detail-source-116').href = `https://www.cac.edu.tw/apply116/system/ColQry_116ApplyxForStudent_F75reOza/html/116_${program.code}.htm?v=1.0`;
      showStandardsDialog();
    }).then(() => { button.disabled = false; button.textContent = '篩選標準比較'; });
  });
  $('standards-close').addEventListener('click', closeStandards);
  $('standards-done').addEventListener('click', closeStandards);
  $('pdf-close').addEventListener('click', closePdf);
  $('pdf-done').addEventListener('click', closePdf);
  $('pdf-dialog').addEventListener('cancel', event => { event.preventDefault(); closePdf(); });
  $('reset-filters').addEventListener('click', () => {
    Object.assign(state, { query: '', school: '', region: '', academicGroup: '', category: '', comparison: '', selected: new Set(), mode: 'all', noSubject: false, englishListening: false, sort: 'code', limit: 50 });
    $('search').value = ''; $('school').value = ''; $('region').value = ''; $('academic-group').value = ''; $('category').value = ''; $('comparison').value = ''; $('sort').value = 'code'; $('no-subject').checked = false;
    document.querySelector('input[name="subject-mode"][value="all"]').checked = true;
    $('subject-options').querySelectorAll('input').forEach(input => { input.checked = false; });
    render();
  });
  $('export-csv').addEventListener('click', () => {
    const rows = filtered();
    const values = [['116校系代碼', '116校系名稱', '學校代碼', '學校名稱', '學校所在區域', '類別', '116官方學群', '116參採科目', '115校系代碼', '115參採科目', '比較結果', '116新增科目', '116移除科目', '116 PDF網址'], ...rows.map(p => [p.code, p.name, p.schoolCode, p.school, data.regions.find(region => region.code === p.regionCode)?.name || '', p.category, p.academicGroups.join('、'), p.subjects.join('、') || '不參採', p.previous ? p.previous.code : '', p.previous ? p.previous.subjects.join('、') || '不參採' : '無同名紀錄', p.change, p.added.join('、'), p.removed.join('、'), `https://www.cac.edu.tw/apply116/Classification_readfile.php?fileid=${p.schoolCode}`])];
    const csv = '\ufeff' + values.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = `116_115申請入學參採科目比較_${rows.length}筆.csv`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  render();
})();
