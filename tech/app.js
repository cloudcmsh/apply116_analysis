(() => {
  'use strict';
  const data = window.APP_DATA;
  const subjects = data.subjects;
  const $ = id => document.getElementById(id);
  const fmt = n => new Intl.NumberFormat('zh-TW').format(n);
  const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const normalize = value => String(value).toLowerCase().replace(/臺/g, '台').replace(/\s/g, '');
  const state = { query: '', school: '', comparison: '', selected: new Set(), mode: 'all', sort: 'school', limit: 40 };

  $('total-programs').textContent = fmt(data.programs.length);
  $('total-schools').textContent = fmt(data.schools.length);
  $('school').insertAdjacentHTML('beforeend', data.schools.map(s => `<option value="${s.code}">${escape(s.name)}（${s.code}）</option>`).join(''));
  $('subject-options').innerHTML = subjects.map(s => `<label class="subject-option"><input type="checkbox" value="${s}"><span>${s}</span><small>${fmt(data.programs.filter(p => p.subjects.includes(s)).length)}</small></label>`).join('');

  function filtered() {
    const q = normalize(state.query);
    const selected = [...state.selected];
    const rows = data.programs.filter(p => {
      if (q && !normalize(`${p.name}${p.school}${p.schoolCode}${p.standard?.code || ''}`).includes(q)) return false;
      if (state.school && p.schoolCode !== state.school) return false;
      if (state.comparison && p.change !== state.comparison) return false;
      if (!selected.length) return true;
      if (state.mode === 'any') return selected.some(s => p.subjects.includes(s));
      if (state.mode === 'exact') return p.subjects.length === selected.length && selected.every(s => p.subjects.includes(s));
      return selected.every(s => p.subjects.includes(s));
    });
    if (state.sort === 'name') rows.sort((a,b) => a.name.localeCompare(b.name,'zh-Hant') || a.schoolCode.localeCompare(b.schoolCode));
    if (state.sort === 'subjectCount') rows.sort((a,b) => b.subjects.length - a.subjects.length || a.id.localeCompare(b.id));
    if (state.sort === 'score') rows.sort((a,b) => (parseFloat(b.standard?.score) || -1) - (parseFloat(a.standard?.score) || -1) || a.id.localeCompare(b.id));
    return rows;
  }

  function tags(items, added = [], removed = []) {
    return `<div class="tags">${subjects.map(s => `<span class="tag-slot">${items.includes(s) ? `<span class="tag ${added.includes(s) ? 'added' : removed.includes(s) ? 'removed' : ''}">${s}</span>` : ''}</span>`).join('')}</div>`;
  }

  function rowHtml(p) {
    const change = p.change === 'changed' ? '<span class="change-pill changed">科目有變動</span>' : p.change === 'unmatched' ? '<span class="change-pill unmatched-pill">待核對</span>' : '';
    const old = p.previous ? tags(p.previous.subjects, [], p.removed) : '<span class="unmatched">無對應紀錄</span>';
    const score = p.standard ? `<button class="standard-button" type="button" data-id="${p.id}"><strong>${escape(p.standard.score)}</strong><small>標準與甄試 ↗</small></button>` : '<span class="score-empty">—</span>';
    const prevLink = p.previous ? `<a class="pdf-link" href="${encodeURI(p.previous.pdf)}#page=${p.previous.page}" data-pdf-program-id="${p.id}" data-pdf-year="115" target="_blank" rel="noopener noreferrer">115 PDF ↗</a>` : '';
    return `<tr><td data-label="116 校系"><span class="program-name">${escape(p.name)}</span><span class="program-code">${p.schoolCode} · 第 ${Number(p.id.split('-')[1])} 筆${p.standard ? ` · 115 代碼 ${p.standard.code}` : ''}</span>${change}</td><td data-label="學校"><span class="school-name">${escape(p.school)}</span></td><td data-label="116 參採">${tags(p.subjects,p.added)}</td><td data-label="115 參採">${old}</td><td data-label="115 最低標準">${score}</td><td data-label="原始資料"><div class="pdf-links"><a class="pdf-link" href="${encodeURI(p.pdf)}#page=${p.page}" data-pdf-program-id="${p.id}" data-pdf-year="116" target="_blank" rel="noopener noreferrer">116 PDF ↗</a>${prevLink}</div></td></tr>`;
  }

  function chart(id, labels, values) {
    const max = Math.max(1,...values);
    $(id).innerHTML = labels.map((label,i) => `<div class="bar-row"><span class="bar-label">${label}</span><span class="bar-track"><span class="bar-fill" style="width:${Math.round(values[i]/max*100)}%"></span></span><span class="bar-value">${fmt(values[i])}</span></div>`).join('');
  }

  let current = [];
  function render() {
    current = filtered();
    $('result-count').textContent = fmt(current.length);
    $('result-rows').innerHTML = current.slice(0,state.limit).map(rowHtml).join('');
    $('showing-count').textContent = current.length ? `顯示 ${fmt(Math.min(state.limit,current.length))}／${fmt(current.length)} 筆` : '顯示 0 筆';
    $('show-more').hidden = current.length <= state.limit;
    $('empty-state').hidden = current.length !== 0;
    $('insight-scope').textContent = `目前範圍：${current.length === data.programs.length ? '全部校系' : `${fmt(current.length)} 筆符合條件的校系`}`;
    for (const kind of ['changed','same','unmatched']) $(`${kind}-count`).textContent = fmt(current.filter(p => p.change === kind).length);
    chart('subject-chart', subjects, subjects.map(s => current.filter(p => p.subjects.includes(s)).length));
    chart('count-chart', ['0 科','1 科','2 科','3 科','4 科','5 科','6 科'], Array.from({length:7},(_,i) => current.filter(p => p.subjects.length === i).length));
  }

  function openStandard(p) {
    const s = p?.standard;
    if (!s) return;
    $('standards-title').textContent = `${p.school} ${p.name}`;
    const originalName = p.previous && p.previous.name !== s.name ? ` · 115 參採表：${p.previous.name}` : '';
    $('standards-description').textContent = `115 志願代碼 ${s.code} · 最低標準表第 ${s.page} 頁${originalName}`;
    const fields = [
      ['學測成績最低篩選標準', s.score],
      ['APCS 超額篩選最低標準（級分）', s.apcsLevel],
      ['APCS 超額篩選標準加權成績', s.apcsScore]
    ];
    $('standards-fields').innerHTML = fields.map(([label,value]) => `<div><dt>${escape(label)}</dt><dd class="${value && value !== '--' ? 'score-value' : 'score-missing'}">${escape(value || '--')}</dd></div>`).join('');
    $('standards-weights').innerHTML = subjects.map(subject => {
      const weight = s.weights[subject];
      return `<tr><th scope="row">${subject}</th><td class="weight-pending">待公布</td><td class="${weight === null ? 'weight-unused' : 'weight-used'}">${weight === null ? '—' : `× ${Number(weight).toFixed(2)}`}</td></tr>`;
    }).join('');
    $('second-stage-review').innerHTML = `<ul>${s.secondStage.reviewItems.map(item => `<li>${escape(item)}</li>`).join('')}</ul>`;
    $('second-stage-ratios').innerHTML = s.secondStage.scoringItems.map(({item,ratio}) => `<tr><th scope="row">${escape(item)}</th><td class="second-stage-pending">待公布</td><td class="${ratio ? 'second-stage-ratio' : 'second-stage-empty'}">${escape(ratio || '—')}</td></tr>`).join('');
    $('standards-source').href = `data/115_第一階段最低篩選標準.pdf#page=${s.page}`;
    $('standards-detail').href = `data/115_more_rule.pdf#page=${s.detailPage}`;
    const dialog = $('standards-dialog');
    if (dialog.showModal) dialog.showModal(); else dialog.setAttribute('open','');
  }

  function closeStandard() {
    const dialog = $('standards-dialog');
    if (dialog.close) dialog.close(); else dialog.removeAttribute('open');
  }

  let documentReturnFocus;
  let pdfDocument;
  let pdfRenderTask;
  let pdfGeneration = 0;
  let pdfPageNumber = 1;
  let pdfPageRequest = 0;
  let pdfjsPromise;
  let pdfFileUrl;

  async function showPdfPage(pageNumber, generation = pdfGeneration) {
    if (!pdfDocument || generation !== pdfGeneration) return;
    const request = ++pdfPageRequest;
    pdfPageNumber = Math.max(1, Math.min(pdfDocument.numPages, pageNumber));
    $('document-description').textContent = `第 ${pdfPageNumber} 頁`;
    $('document-original').href = `${pdfFileUrl}#page=${pdfPageNumber}`;
    $('document-page-status').textContent = `第 ${pdfPageNumber}／${pdfDocument.numPages} 頁`;
    $('document-page-prev').disabled = pdfPageNumber === 1;
    $('document-page-next').disabled = pdfPageNumber === pdfDocument.numPages;
    if (pdfRenderTask) {
      pdfRenderTask.cancel();
      try { await pdfRenderTask.promise; } catch (_) { /* Cancelled render. */ }
    }
    try {
      const page = await pdfDocument.getPage(pdfPageNumber);
      if (generation !== pdfGeneration || request !== pdfPageRequest) return;
      const canvas = $('document-page-canvas');
      const availableWidth = Math.max(200, $('document-pdf-viewer').clientWidth - 32);
      const base = page.getViewport({scale: 1});
      const scale = Math.min(2, availableWidth / base.width);
      const viewport = page.getViewport({scale});
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(viewport.width * pixelRatio);
      canvas.height = Math.round(viewport.height * pixelRatio);
      canvas.style.width = `${Math.round(viewport.width)}px`;
      canvas.style.height = `${Math.round(viewport.height)}px`;
      pdfRenderTask = page.render({canvasContext: canvas.getContext('2d'), viewport, transform: pixelRatio === 1 ? null : [pixelRatio, 0, 0, pixelRatio, 0, 0]});
      await pdfRenderTask.promise;
      if (generation === pdfGeneration && request === pdfPageRequest) $('document-page-canvas').setAttribute('aria-label', `PDF 第 ${pdfPageNumber} 頁`);
    } catch (error) {
      if (error?.name !== 'RenderingCancelledException' && generation === pdfGeneration) {
        $('document-page-status').textContent = '頁面載入失敗，請使用下方連結開啟 PDF';
        console.error('PDF page rendering failed', error);
      }
    }
  }

  async function loadLocalPdf(url, pageNumber) {
    const generation = ++pdfGeneration;
    pdfFileUrl = url.href.split('#')[0];
    $('document-page-status').textContent = 'PDF 載入中…';
    $('document-page-prev').disabled = true;
    $('document-page-next').disabled = true;
    try {
      pdfjsPromise ||= import('./vendor/pdf.mjs');
      const pdfjs = await pdfjsPromise;
      if (generation !== pdfGeneration) return;
      pdfjs.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdf.worker.mjs', location.href).href;
      const task = pdfjs.getDocument({url: pdfFileUrl});
      const document = await task.promise;
      if (generation !== pdfGeneration) { document.destroy(); return; }
      pdfDocument = document;
      await showPdfPage(pageNumber, generation);
    } catch (error) {
      if (generation === pdfGeneration) {
        $('document-page-status').textContent = 'PDF 載入失敗，請使用下方連結開啟 PDF';
        console.error('PDF loading failed', error);
      }
    }
  }

  function closeDocument() {
    const dialog = $('document-dialog');
    if (typeof dialog.close === 'function' && dialog.open) dialog.close();
    else dialog.removeAttribute('open');
    pdfGeneration++;
    pdfPageRequest++;
    pdfRenderTask?.cancel();
    pdfRenderTask = undefined;
    pdfDocument?.destroy();
    pdfDocument = undefined;
    $('document-frame').removeAttribute('src');
    if (documentReturnFocus?.isConnected) documentReturnFocus.focus();
  }

  function openDocument(link) {
    const dialog = $('document-dialog');
    if (dialog.open) return;
    const p = link.dataset.pdfProgramId && data.programs.find(program => program.id === link.dataset.pdfProgramId);
    const url = new URL(link.href);
    const page = Number(url.hash.match(/^#page=(\d+)/)?.[1] || 1);
    const localPdf = url.origin === location.origin && url.pathname.toLowerCase().endsWith('.pdf');
    const title = p ? `${p.school} ${p.name} ${link.dataset.pdfYear} 原始 PDF` : link.textContent.replace(/[↗↓]/g,'').trim();
    documentReturnFocus = link;
    $('document-title').textContent = title;
    $('document-description').textContent = localPdf || p ? `第 ${page} 頁` : url.hostname;
    $('document-help').hidden = url.origin === location.origin;
    $('document-frame').title = title;
    $('document-original').href = link.href;
    $('document-pdf-viewer').hidden = !localPdf;
    $('document-frame').hidden = localPdf;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open','');
    if (localPdf) loadLocalPdf(url, page);
    else $('document-frame').src = link.href;
  }

  function exportCsv() {
    const headers = ['116校系','學校','學校代碼','116參採科目','115參採科目','年度比較','115志願代碼','115第一階段學測最低篩選標準','APCS最低級分','APCS加權成績',...subjects.map(s => `115${s}權重`),'116複試評分項目','115複試評分項目','116甄試評分比率','115甄試評分比率','116原始PDF','115原始PDF'];
    const quote = value => `"${String(value ?? '').replace(/"/g,'""')}"`;
    const lines = [headers, ...current.map(p => [p.name,p.school,p.schoolCode,p.subjects.join('、'),p.previous?.subjects.join('、') || '',p.change,p.standard?.code || '',p.standard?.score || '',p.standard?.apcsLevel || '',p.standard?.apcsScore || '',...subjects.map(s => p.standard?.weights[s] ?? ''),'',p.standard?.secondStage.reviewItems.join('、') || '','',p.standard?.secondStage.scoringItems.map(({item,ratio}) => `${item}：${ratio || '—'}`).join('；') || '',p.pdf,p.previous?.pdf || ''])];
    const blob = new Blob(['\ufeff'+lines.map(row => row.map(quote).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = '116_115_四技申請入學參採科目比較.csv'; link.click();
    setTimeout(() => URL.revokeObjectURL(url),1000);
  }

  $('search').addEventListener('input',e => {state.query=e.target.value;state.limit=40;render();});
  $('school').addEventListener('change',e => {state.school=e.target.value;state.limit=40;render();});
  $('comparison').addEventListener('change',e => {state.comparison=e.target.value;state.limit=40;render();});
  $('sort').addEventListener('change',e => {state.sort=e.target.value;render();});
  $('subject-options').addEventListener('change',e => {if (e.target.checked) state.selected.add(e.target.value); else state.selected.delete(e.target.value);state.limit=40;render();});
  document.querySelectorAll('input[name="subject-mode"]').forEach(input => input.addEventListener('change',e => {state.mode=e.target.value;state.limit=40;render();}));
  $('reset-filters').addEventListener('click',() => {state.query='';state.school='';state.comparison='';state.selected.clear();state.mode='all';state.sort='school';state.limit=40;$('search').value='';$('school').value='';$('comparison').value='';$('sort').value='school';document.querySelectorAll('#subject-options input').forEach(i => i.checked=false);document.querySelector('input[name="subject-mode"][value="all"]').checked=true;render();});
  $('show-more').addEventListener('click',() => {state.limit+=40;render();});
  $('export-csv').addEventListener('click',exportCsv);
  $('result-rows').addEventListener('click',e => {const button=e.target.closest('button[data-id]');if(button) openStandard(data.programs.find(p => p.id===button.dataset.id));});
  $('standards-close').addEventListener('click',closeStandard);
  $('standards-done').addEventListener('click',closeStandard);
  $('standards-dialog').addEventListener('click',e => {if(e.target===$('standards-dialog')) closeStandard();});
  document.addEventListener('click',e => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const link = e.target.closest?.('a[target="_blank"]');
    if (!link || link.hasAttribute('data-direct-open')) return;
    const url = new URL(link.href);
    if (!['http:','https:','file:'].includes(url.protocol)) return;
    e.preventDefault();
    openDocument(link);
  });
  $('document-close').addEventListener('click',closeDocument);
  $('document-done').addEventListener('click',closeDocument);
  $('document-dialog').addEventListener('cancel',e => {e.preventDefault();closeDocument();});
  $('document-page-prev').addEventListener('click',() => showPdfPage(pdfPageNumber - 1));
  $('document-page-next').addEventListener('click',() => showPdfPage(pdfPageNumber + 1));
  render();
})();
