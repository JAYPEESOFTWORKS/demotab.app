// ============================================================
// DemoTab — app.js
// Zero external dependencies. Zero network requests.
// Everything runs locally in your browser tab.
// ============================================================

'use strict';

// ── State ────────────────────────────────────────────────────

const state = {
  mode:       'auto',   // auto | text | markdown | html | code | image
  codeLang:   'auto',
  hasContent: false,
  codeTheme:  'dark',   // dark | light
  wrapLines:  false,
  fontSize:   16,       // content font size in px (code = fontSize - 2)
};

const FONT_MIN = 10;
const FONT_MAX = 32;
const FONT_STEP = 2;

// ── DOM refs (populated in init) ─────────────────────────────

let $dropZone, $contentArea, $clearBtn, $themeBtn, $pasteBtn;

// ── Syntax Highlighter ───────────────────────────────────────

const KEYWORDS = {
  javascript: new Set(['break','case','catch','class','const','continue','debugger',
    'default','delete','do','else','export','extends','false','finally','for','function',
    'if','import','in','instanceof','let','new','null','return','static','super',
    'switch','this','throw','true','try','typeof','undefined','var','void','while','with',
    'yield','async','await','of','from','as','Promise','console']),
  typescript: new Set(['break','case','catch','class','const','continue','debugger',
    'default','delete','do','else','export','extends','false','finally','for','function',
    'if','implements','import','in','instanceof','interface','let','namespace','new',
    'null','private','protected','public','readonly','return','static','super','switch',
    'this','throw','true','try','type','typeof','undefined','var','void','while','with',
    'yield','async','await','enum','abstract','declare','keyof','infer','never','any',
    'string','number','boolean','object','symbol','unknown']),
  python: new Set(['False','None','True','and','as','assert','async','await','break',
    'class','continue','def','del','elif','else','except','finally','for','from',
    'global','if','import','in','is','lambda','nonlocal','not','or','pass','raise',
    'return','try','while','with','yield','print','range','len','type','int','str',
    'list','dict','set','tuple','bool','float','self','cls']),
  go: new Set(['break','case','chan','const','continue','default','defer','else',
    'fallthrough','for','func','go','goto','if','import','interface','map','package',
    'range','return','select','struct','switch','type','var','nil','true','false',
    'make','len','cap','new','append','copy','delete','close','fmt','error','string',
    'int','int8','int16','int32','int64','uint','uint8','uint16','uint32','uint64',
    'float32','float64','bool','byte','rune']),
  rust: new Set(['as','break','const','continue','crate','dyn','else','enum','extern',
    'false','fn','for','if','impl','in','let','loop','match','mod','move','mut','pub',
    'ref','return','self','Self','static','struct','super','trait','true','type',
    'unsafe','use','where','while','async','await','String','Vec','Option','Result',
    'Some','None','Ok','Err','println','print','i8','i16','i32','i64','i128','u8',
    'u16','u32','u64','u128','f32','f64','bool','char','str','usize','isize']),
  sql: new Set(['SELECT','FROM','WHERE','AND','OR','NOT','IN','LIKE','BETWEEN','IS',
    'NULL','JOIN','LEFT','RIGHT','INNER','OUTER','FULL','ON','AS','GROUP','BY','ORDER',
    'HAVING','LIMIT','OFFSET','INSERT','INTO','VALUES','UPDATE','SET','DELETE','CREATE',
    'TABLE','DROP','ALTER','ADD','COLUMN','INDEX','PRIMARY','KEY','FOREIGN','REFERENCES',
    'UNIQUE','DEFAULT','CONSTRAINT','BEGIN','COMMIT','ROLLBACK','DISTINCT','ALL','EXISTS',
    'UNION','INTERSECT','EXCEPT','CASE','WHEN','THEN','ELSE','END','ASC','DESC',
    'COUNT','SUM','AVG','MAX','MIN','COALESCE','CAST','CONVERT','VARCHAR','INT',
    'INTEGER','BIGINT','FLOAT','DECIMAL','TEXT','BOOLEAN','DATE','TIMESTAMP']),
  css: new Set(['important','inherit','initial','unset','none','auto','normal','bold',
    'italic','solid','dashed','dotted','hidden','visible','scroll','fixed','relative',
    'absolute','sticky','flex','grid','block','inline','center','left','right','top',
    'bottom','middle','baseline','space-between','space-around','wrap','nowrap',
    'contain','cover']),
  bash: new Set(['if','then','else','elif','fi','for','while','do','done','case',
    'esac','in','function','return','local','export','readonly','declare','unset',
    'shift','source','echo','printf','read','test','exit','true','false','cd','ls',
    'pwd','mkdir','rm','cp','mv','cat','grep','sed','awk','sort','head','tail',
    'cut','tr','wc','find','chmod','chown','sudo','apt','pip','npm','git']),
  java: new Set(['abstract','assert','boolean','break','byte','case','catch','char',
    'class','const','continue','default','do','double','else','enum','extends','final',
    'finally','float','for','goto','if','implements','import','instanceof','int',
    'interface','long','native','new','package','private','protected','public','return',
    'short','static','strictfp','super','switch','synchronized','this','throw','throws',
    'transient','try','void','volatile','while','null','true','false','String','System',
    'out','println','print']),
  html: new Set(['DOCTYPE','html','head','body','div','span','p','a','img','ul','ol',
    'li','table','tr','td','th','form','input','button','script','style','link','meta',
    'title','h1','h2','h3','h4','h5','h6','header','footer','nav','main','section',
    'article','aside','pre','code','strong','em','br','hr','iframe','canvas','svg']),
};

const BUILTINS_JS = new Set(['Array','Object','String','Number','Boolean','Function',
  'Symbol','Date','RegExp','Error','Map','Set','WeakMap','WeakSet','Promise','Proxy',
  'Reflect','Math','JSON','parseInt','parseFloat','isNaN','isFinite','encodeURI',
  'decodeURI','setTimeout','setInterval','clearTimeout','clearInterval',
  'document','window','navigator','localStorage','sessionStorage','console']);

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function tokenizeHTML(code) {
  let out = '', i = 0;
  const c = () => code[i];
  while (i < code.length) {
    if (code.slice(i, i+4) === '<!--') {
      let s = '';
      while (i < code.length && code.slice(i,i+3) !== '-->') { s += c(); i++; }
      s += '-->'; i += 3;
      out += '<span class="tok-comment">' + escHtml(s) + '</span>';
      continue;
    }
    if (c() === '<') {
      let s = '<'; i++;
      if (c() === '/') { s += '/'; i++; }
      let name = '';
      while (i < code.length && /[a-zA-Z0-9\-:]/.test(c())) { name += c(); i++; }
      s += '<span class="tok-tag">' + escHtml(name) + '</span>';
      while (i < code.length && c() !== '>' && !(c() === '/' && code[i+1] === '>')) {
        if (/[a-zA-Z_\-]/.test(c())) {
          let attr = '';
          while (i < code.length && /[a-zA-Z0-9\-_:]/.test(c())) { attr += c(); i++; }
          s += '<span class="tok-attr">' + escHtml(attr) + '</span>';
        } else if (c() === '"' || c() === "'") {
          const q = c(); let val = q; i++;
          while (i < code.length && c() !== q) { val += c(); i++; }
          val += q; i++;
          s += '<span class="tok-string">' + escHtml(val) + '</span>';
        } else { s += escHtml(c()); i++; }
      }
      if (c() === '/') { s += '/'; i++; }
      if (c() === '>') { s += '>'; i++; }
      out += s; continue;
    }
    out += escHtml(c()); i++;
  }
  return out;
}

function tokenize(code, lang) {
  if (lang === 'html') return tokenizeHTML(code);
  const kw = KEYWORDS[lang] || KEYWORDS.javascript;
  const isJS = ['javascript','typescript'].includes(lang);
  let out = '', i = 0;
  const c = () => code[i];
  const peek = (n=1) => code[i+n];
  const emit = (cls, txt) => cls ? '<span class="tok-' + cls + '">' + escHtml(txt) + '</span>' : escHtml(txt);

  while (i < code.length) {
    if ((c()==='/' && peek()==='/') || (lang==='python' && c()==='#') ||
        (lang==='bash' && c()==='#') || (lang==='sql' && c()==='-' && peek()==='-')) {
      let s = '';
      while (i < code.length && c() !== '\n') { s += c(); i++; }
      out += emit('comment', s); continue;
    }
    if (c()==='/' && peek()==='*') {
      let s = '/*'; i += 2;
      while (i < code.length && !(c()==='*' && peek()==='/')) { s += c(); i++; }
      if (i < code.length) { s += '*/'; i += 2; }
      out += emit('comment', s); continue;
    }
    if (isJS && c()==='`') {
      let s = '`'; i++;
      while (i < code.length && c() !== '`') {
        if (c()==='\\') { s += c(); i++; }
        s += (c() || ''); i++;
      }
      s += '`'; i++;
      out += emit('string', s); continue;
    }
    if (c()==='"' || c()==="'") {
      const q = c(); let s = q; i++;
      while (i < code.length && c() !== q && c() !== '\n') {
        if (c()==='\\') { s += c(); i++; }
        s += (c() || ''); i++;
      }
      s += q; i++;
      out += emit('string', s); continue;
    }
    if (/[0-9]/.test(c()) || (c()==='.' && /[0-9]/.test(peek()))) {
      let s = '';
      while (i < code.length && /[0-9a-fA-FxX._bBoO]/.test(c())) { s += c(); i++; }
      out += emit('number', s); continue;
    }
    if (/[a-zA-Z_$]/.test(c())) {
      let s = '';
      while (i < code.length && /[a-zA-Z0-9_$]/.test(c())) { s += c(); i++; }
      let j = i; while (j < code.length && code[j] === ' ') j++;
      if (code[j] === '(' && !kw.has(s)) {
        out += emit('function', s);
      } else if (kw.has(s)) {
        out += emit('keyword', s);
      } else if (isJS && BUILTINS_JS.has(s)) {
        out += emit('builtin', s);
      } else if (/^[A-Z]/.test(s)) {
        out += emit('classname', s);
      } else {
        out += escHtml(s);
      }
      continue;
    }
    if (/[+\-*/%=<>!&|^~?:@]/.test(c())) {
      let s = c(); i++;
      if (i < code.length && /[+\-*/%=<>!&|^~?:]/.test(c())) { s += c(); i++; }
      out += emit('operator', s); continue;
    }
    if (/[{}()[\];,.]/.test(c())) { out += emit('punct', c()); i++; continue; }
    out += escHtml(c()); i++;
  }
  return out;
}

function highlight(code, lang) {
  if (!lang || lang === 'auto' || lang === 'plain') return escHtml(code);
  return tokenize(code, lang);
}

// ── Language Detection ────────────────────────────────────────

function detectLang(text) {
  const t = text.slice(0, 2000);
  if (/^#!\/.*?(bash|sh|zsh)\b/.test(t)) return 'bash';
  if (/^(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER)\b/im.test(t)) return 'sql';
  if (/\bpackage\s+main\b|\bfunc\s+\w+\s*\(|\bfmt\./.test(t)) return 'go';
  if (/\bfn\s+\w+|\blet\s+mut\b|\bimpl\b|\buse\s+std/.test(t)) return 'rust';
  if (/\bdef\s+\w+\s*\(|\bimport\s+\w+|\bprint\s*\(|\bclass\s+\w+.*:/.test(t)) return 'python';
  if (/\bpublic\s+(class|interface|static)\b|\bSystem\.out\./.test(t)) return 'java';
  if (/\binterface\b.*\{|\btype\s+\w+\s*=|\bReadonly\b/.test(t)) return 'typescript';
  if (/^\s*<!DOCTYPE\s+html|^<html[\s>]/im.test(t)) return 'html';
  if (/<[a-zA-Z][\w.-]*(\s|\/?>)/.test(t) && /<\/[a-zA-Z]/.test(t)) return 'html';
  if (/^\s*[\[{]/.test(t) && /"[^"]+"\s*:/.test(t)) return 'json';
  if (/\{[^}]+:[^}]+\}/.test(t) && /;/.test(t)) return 'css';
  if (/\b(const|let|var|function|=>|async|await|require|module\.exports)\b/.test(t)) return 'javascript';
  return 'plain';
}

// ── Markdown Parser ───────────────────────────────────────────

// Block javascript: in all URLs; block data: in link hrefs (phishing vector).
// data: is allowed in img src (legitimate base64 images).
function safeUrl(url, allowData) {
  try {
    const u = new URL(url, 'https://x');
    if (u.protocol === 'javascript:') return '#';
    if (!allowData && u.protocol === 'data:') return '#';
  } catch { /* relative URL — pass through */ }
  return url;
}

function parseInline(text) {
  text = text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  return text
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, src) =>
      '<img alt="' + alt + '" src="' + safeUrl(src, true) + '" style="max-width:100%">')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, href) =>
      '<a href="' + safeUrl(href, false) + '" target="_blank" rel="noopener noreferrer">' + text + '</a>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/___(.+?)___/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/_(.+?)_/g, '<em>$1</em>')
    .replace(/~~(.+?)~~/g, '<del>$1</del>');
}

function parseMarkdown(md) {
  const lines = md.split('\n');
  let html = '';
  let i = 0;
  let inPara = false, inUL = false, inOL = false;
  const closePara = () => { if (inPara) { html += '</p>\n'; inPara = false; } };
  const closeUL   = () => { if (inUL)   { html += '</ul>\n'; inUL = false; } };
  const closeOL   = () => { if (inOL)   { html += '</ol>\n'; inOL = false; } };
  const closeAll  = () => { closePara(); closeUL(); closeOL(); };

  while (i < lines.length) {
    const line = lines[i];
    const fenceMatch = line.match(/^(`{3,}|~{3,})([\w+-]*)/);
    if (fenceMatch) {
      closeAll();
      const fence = fenceMatch[1], lang = fenceMatch[2] || '';
      i++;
      const codeLines = [];
      while (i < lines.length && !lines[i].startsWith(fence)) { codeLines.push(lines[i]); i++; }
      i++;
      const codeText = codeLines.join('\n');
      const dl = lang || detectLang(codeText);
      html += '<pre><code class="lang-' + dl + '">' + highlight(codeText, dl) + '</code></pre>\n';
      continue;
    }
    const headMatch = line.match(/^(#{1,6})\s+(.+)/);
    if (headMatch) {
      closeAll();
      const lv = headMatch[1].length;
      html += '<h' + lv + '>' + parseInline(headMatch[2]) + '</h' + lv + '>\n';
      i++; continue;
    }
    if (i+1 < lines.length && lines[i+1].match(/^=+\s*$/) && line.trim()) {
      closeAll(); html += '<h1>' + parseInline(line) + '</h1>\n'; i += 2; continue;
    }
    if (i+1 < lines.length && lines[i+1].match(/^-+\s*$/) && line.trim() && !line.match(/^[-*+] /)) {
      closeAll(); html += '<h2>' + parseInline(line) + '</h2>\n'; i += 2; continue;
    }
    if (line.match(/^([-*_] ?){3,}\s*$/)) {
      closeAll(); html += '<hr>\n'; i++; continue;
    }
    if (line.startsWith('>')) {
      closeAll();
      const bqLines = [];
      while (i < lines.length && lines[i].startsWith('>')) { bqLines.push(lines[i].replace(/^>\s?/, '')); i++; }
      html += '<blockquote>' + parseMarkdown(bqLines.join('\n')) + '</blockquote>\n';
      continue;
    }
    const ulMatch = line.match(/^[-*+]\s+(.+)/);
    if (ulMatch) {
      closePara(); closeOL();
      if (!inUL) { html += '<ul>\n'; inUL = true; }
      html += '<li>' + parseInline(ulMatch[1]) + '</li>\n';
      i++; continue;
    }
    const olMatch = line.match(/^\d+\.\s+(.+)/);
    if (olMatch) {
      closePara(); closeUL();
      if (!inOL) { html += '<ol>\n'; inOL = true; }
      html += '<li>' + parseInline(olMatch[1]) + '</li>\n';
      i++; continue;
    }
    if (line.trim() === '') { closeAll(); i++; continue; }
    if (line.match(/^<[a-zA-Z]/)) { closeAll(); html += escHtml(line) + '\n'; i++; continue; }
    closeUL(); closeOL();
    if (!inPara) { html += '<p>'; inPara = true; } else { html += ' '; }
    html += parseInline(line);
    i++;
    const next = lines[i] || '';
    if (!next.trim() || next.match(/^#{1,6} |^[-*+] |\d+\. |^>|^`{3}/)) { closePara(); }
  }
  closeAll();
  return html;
}

// ── Content Type Detection ────────────────────────────────────
// HTML is always shown as syntax-highlighted source — never rendered live.

function detectType(text) {
  const t = text.trimStart();

  // HTML detected — routes to code viewer with html highlighting
  if (/^<!DOCTYPE\s+html/i.test(t) || /^<html[\s>]/i.test(t)) return 'code';
  if (/^<[a-zA-Z][\w.-]*(\s[^>]*)?>/.test(t) && /<\/[a-zA-Z][\w.-]*>/.test(t)) return 'code';

  const mdScore = [
    /^#{1,6}\s/m.test(t),
    /\*\*[^*]+\*\*/.test(t),
    /\[.+\]\(.+\)/.test(t),
    /^[-*+]\s/m.test(t),
    /^>\s/m.test(t),
    /^`{3}/m.test(t),
    /^---\s*$/m.test(t),
  ].filter(Boolean).length;
  if (mdScore >= 2) return 'markdown';

  const codeScore = [
    /\bfunction\b|\bconst\b|\blet\b|\bvar\b/.test(t),
    /\bdef\b|\bimport\b/.test(t),
    /\{\s*\n|\}\s*\n|;\s*\n/.test(t),
    /^#!\//.test(t),
    /^\s{2,}/.test(t),
  ].filter(Boolean).length;
  if (codeScore >= 2) return 'code';

  return 'text';
}

// ── Font Size ─────────────────────────────────────────────────

function applyFontSize() {
  const root = document.documentElement;
  root.style.setProperty('--content-font-size', state.fontSize + 'px');
  root.style.setProperty('--code-font-size', Math.max(state.fontSize - 2, 10) + 'px');
}

function changeFontSize(delta) {
  state.fontSize = Math.min(FONT_MAX, Math.max(FONT_MIN, state.fontSize + delta));
  applyFontSize();
}

function resetFontSize() {
  state.fontSize = 16;
  applyFontSize();
}

// ── Code Theme ───────────────────────────────────────────────

function applyCodeTheme() {
  document.body.classList.toggle('code-light', state.codeTheme === 'light');
  if ($themeBtn) {
    $themeBtn.textContent = state.codeTheme === 'dark' ? '☀ Light' : '◑ Dark';
    $themeBtn.title = state.codeTheme === 'dark'
      ? 'Switch to light code theme (D)'
      : 'Switch to dark code theme (D)';
  }
  // Update any active toolbar theme buttons
  document.querySelectorAll('.code-theme-btn').forEach(btn => {
    btn.textContent = state.codeTheme === 'dark' ? '☀ Light' : '◑ Dark';
  });
}

function toggleCodeTheme() {
  state.codeTheme = state.codeTheme === 'dark' ? 'light' : 'dark';
  applyCodeTheme();
}

// ── Line Wrap ────────────────────────────────────────────────

function applyWrap() {
  const pre = $contentArea.querySelector('.render-code');
  if (pre) pre.classList.toggle('wrap-lines', state.wrapLines);
  document.querySelectorAll('.code-wrap-btn').forEach(btn => {
    btn.classList.toggle('active', state.wrapLines);
  });
}

function toggleWrap() {
  state.wrapLines = !state.wrapLines;
  applyWrap();
}

// ── Renderers ─────────────────────────────────────────────────

function renderText(text) {
  const div = document.createElement('div');
  div.className = 'render-text';
  const blocks = text.split(/\n{2,}/);
  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;
    const lines = trimmed.split('\n');
    const avgLen = lines.reduce((s, l) => s + l.length, 0) / lines.length;
    const isPre = lines.length > 3 && avgLen < 60;
    if (isPre) {
      const pre = document.createElement('div');
      pre.className = 'pre-block';
      pre.textContent = trimmed;
      div.appendChild(pre);
    } else {
      const p = document.createElement('p');
      p.textContent = lines.join(' ');
      div.appendChild(p);
    }
  }
  return div;
}

function renderMarkdown(text) {
  const div = document.createElement('div');
  div.className = 'render-markdown';
  div.innerHTML = parseMarkdown(text);
  div.querySelectorAll('a').forEach(a => { a.target = '_blank'; a.rel = 'noopener noreferrer'; });
  return div;
}

function renderCode(text, lang) {
  lang = (lang && lang !== 'auto') ? lang : detectLang(text);
  state.codeLang = lang;

  const wrap = document.createElement('div');
  wrap.className = 'render-code-wrap';

  // Toolbar
  const toolbar = document.createElement('div');
  toolbar.className = 'code-toolbar';

  // Language selector (replaces static badge)
  const langSelect = document.createElement('select');
  langSelect.className = 'code-lang-select';
  langSelect.title = 'Switch language';
  [['auto','auto'],['javascript','JavaScript'],['typescript','TypeScript'],
   ['python','Python'],['go','Go'],['rust','Rust'],['java','Java'],
   ['sql','SQL'],['css','CSS'],['html','HTML'],['bash','Bash'],['plain','Plain text']
  ].forEach(([val, label]) => {
    const opt = document.createElement('option');
    opt.value = val; opt.textContent = label;
    if (val === lang) opt.selected = true;
    langSelect.appendChild(opt);
  });
  langSelect.addEventListener('change', () => {
    state.codeLang = langSelect.value;
    if (state.hasContent && $contentArea.dataset.raw) {
      showContent(renderCode($contentArea.dataset.raw, state.codeLang));
    }
  });

  // Wrap toggle button
  const wrapBtn = document.createElement('button');
  wrapBtn.className = 'code-toolbar-btn code-wrap-btn' + (state.wrapLines ? ' active' : '');
  wrapBtn.textContent = '↵ Wrap';
  wrapBtn.title = 'Toggle line wrap (W)';
  wrapBtn.addEventListener('click', toggleWrap);

  // Theme toggle button
  const themeBtn = document.createElement('button');
  themeBtn.className = 'code-toolbar-btn code-theme-btn';
  themeBtn.textContent = state.codeTheme === 'dark' ? '☀ Light' : '◑ Dark';
  themeBtn.title = state.codeTheme === 'dark' ? 'Switch to light theme (D)' : 'Switch to dark theme (D)';
  themeBtn.addEventListener('click', toggleCodeTheme);

  const lines = text.split('\n');
  const lc = document.createElement('span');
  lc.className = 'code-line-count';
  lc.textContent = lines.length + ' line' + (lines.length !== 1 ? 's' : '');

  toolbar.append(langSelect, wrapBtn, themeBtn, lc);

  // Code block
  const pre = document.createElement('pre');
  pre.className = 'render-code' + (state.wrapLines ? ' wrap-lines' : '');
  const codeEl = document.createElement('code');
  const highlighted = highlight(text, lang);
  codeEl.innerHTML = highlighted.split('\n').map((ln, idx) =>
    '<span class="code-line"><span class="line-num">' + (idx+1) + '</span><span class="line-content">' + ln + '</span></span>'
  ).join('');


  pre.appendChild(codeEl);
  wrap.append(toolbar, pre);
  return wrap;
}

function renderImage(src) {
  const wrap = document.createElement('div');
  wrap.className = 'render-image-wrap';
  const img = document.createElement('img');
  img.className = 'render-image';
  img.src = src;
  img.alt = 'Pasted image';
  wrap.appendChild(img);
  return wrap;
}

// ── Show / Clear Content ──────────────────────────────────────

function showContent(el) {
  $contentArea.innerHTML = '';
  $contentArea.appendChild(el);
  $contentArea.classList.add('visible');
  $dropZone.style.display = 'none';
  $clearBtn.classList.add('visible');
  state.hasContent = true;
}

function clearContent() {
  $contentArea.innerHTML = '';
  $contentArea.classList.remove('visible');
  $dropZone.style.display = '';
  $clearBtn.classList.remove('visible');
  showThemeBtn(false);
  state.hasContent = false;
  setMode('auto');
}

// ── Paste / Drop ─────────────────────────────────────────────

async function handlePaste(e) {
  e.preventDefault();
  const items = e.clipboardData ? Array.from(e.clipboardData.items) : [];
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      const blob = item.getAsFile();
      if (!blob) continue;
      setMode('image', false);
      showContent(renderImage(URL.createObjectURL(blob)));
      return;
    }
  }
  const text = e.clipboardData.getData('text/plain') || e.clipboardData.getData('text/html') || '';
  if (text.trim()) dispatchText(text);
}

function handleDrop(e) {
  e.preventDefault();
  $dropZone.classList.remove('drag-over');
  const dt = e.dataTransfer;
  if (dt.files && dt.files.length > 0) {
    const file = dt.files[0];
    if (file.type.startsWith('image/')) {
      setMode('image', false);
      showContent(renderImage(URL.createObjectURL(file)));
      return;
    }
    const reader = new FileReader();
    reader.onload = ev => { if (ev.target.result) dispatchText(ev.target.result); };
    reader.readAsText(file);
    return;
  }
  const text = dt.getData('text/plain') || dt.getData('text/html') || '';
  if (text.trim()) dispatchText(text);
}

// ── Dispatch ─────────────────────────────────────────────────

function dispatchText(text) {
  const effectiveMode = state.mode === 'auto' ? detectType(text) : state.mode;
  const isCode = effectiveMode === 'code';
  if (isCode) {
    const lang = state.codeLang !== 'auto' ? state.codeLang : detectLang(text);
    showContent(renderCode(text, lang));
  } else if (effectiveMode === 'markdown') {
    showContent(renderMarkdown(text));
  } else {
    showContent(renderText(text));
  }
  showThemeBtn(isCode);
  $contentArea.dataset.raw = text;
}

// ── Mode ─────────────────────────────────────────────────────

function setMode(mode, rerender = true) {
  state.mode = mode;
  document.querySelectorAll('.type-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.mode === mode);
  });
  if (rerender && state.hasContent && $contentArea.dataset.raw) {
    dispatchText($contentArea.dataset.raw);
  }
}


function showThemeBtn(_show) {
  // header theme button removed; theme toggle lives in the code toolbar only
}

// ── Clipboard / Paste Button ──────────────────────────────────

function enablePasteBtn() {
  if ($pasteBtn) $pasteBtn.disabled = false;
}

async function handlePasteBtn() {
  // Called only on explicit click (user gesture).
  // On HTTPS production: no dialog — implicit permission granted.
  // On file:// dev: browser asks once per session, then remembers.
  try {
    const text = await navigator.clipboard.readText();
    if (text && text.trim()) {
      dispatchText(text);
      if ($pasteBtn) $pasteBtn.disabled = true;
    }
  } catch {
    // Permission denied or API unavailable — nudge toward Ctrl+V
    if ($pasteBtn) {
      const orig = $pasteBtn.textContent;
      $pasteBtn.textContent = '⌨ Use Ctrl+V';
      setTimeout(() => { if ($pasteBtn) $pasteBtn.textContent = orig; }, 2500);
    }
  }
}

// ── Keyboard Shortcuts ────────────────────────────────────────

function handleKeyDown(e) {
  // Ignore when modifier keys are held (except Shift for + sign)
  if (e.ctrlKey || e.metaKey || e.altKey) return;

  const key = e.key.toLowerCase();

  // Esc — clear
  if (e.key === 'Escape') {
    if (state.hasContent) { clearContent(); e.preventDefault(); }
    return;
  }

  // Mode shortcuts (only when no content or content already showing)
  switch (key) {
    case 't': setMode('text');     e.preventDefault(); return;
    case 'm': setMode('markdown'); e.preventDefault(); return;
    case 'c': setMode('code');     e.preventDefault(); return;
    case 'i': setMode('image');    e.preventDefault(); return;
    case 'a': setMode('auto');     e.preventDefault(); return;
  }

  // Font size
  if (e.key === '+' || e.key === '=' || e.key === '>') {
    changeFontSize(FONT_STEP); e.preventDefault(); return;
  }
  if (e.key === '-' || e.key === '<') {
    changeFontSize(-FONT_STEP); e.preventDefault(); return;
  }
  if (e.key === '0') {
    resetFontSize(); e.preventDefault(); return;
  }

  // Wrap toggle (code mode)
  if (key === 'w') {
    toggleWrap(); e.preventDefault(); return;
  }

  // Theme toggle
  if (key === 'd') {
    toggleCodeTheme(); e.preventDefault(); return;
  }
}

// ── Init ─────────────────────────────────────────────────────

function init() {
  $dropZone     = document.getElementById('drop-zone');
  $contentArea  = document.getElementById('content-area');
  $clearBtn     = document.getElementById('clear-btn');
  $themeBtn     = document.getElementById('btn-theme');
  $pasteBtn     = document.getElementById('btn-paste');

  // Theme button hidden until code/html content is active
  showThemeBtn(false);

  document.querySelectorAll('.type-btn').forEach(btn => {
    btn.addEventListener('click', () => setMode(btn.dataset.mode));
  });


  // Font size buttons
  document.getElementById('btn-font-dec')?.addEventListener('click', () => changeFontSize(-FONT_STEP));
  document.getElementById('btn-font-inc')?.addEventListener('click', () => changeFontSize(FONT_STEP));


  if ($clearBtn) $clearBtn.addEventListener('click', clearContent);

  // Paste button — enabled by default (copy/cut events re-enable after use)
  if ($pasteBtn) {
    $pasteBtn.addEventListener('click', handlePasteBtn);
    $pasteBtn.disabled = false;
  }

  document.addEventListener('paste', handlePaste);
  document.addEventListener('keydown', handleKeyDown);

  document.body.addEventListener('dragover', e => {
    e.preventDefault();
    $dropZone.classList.add('drag-over');
  });
  document.body.addEventListener('dragleave', e => {
    if (!e.relatedTarget) $dropZone.classList.remove('drag-over');
  });
  document.body.addEventListener('drop', handleDrop);

  // Re-enable paste button whenever the user copies or cuts something
  document.addEventListener('copy', () => setTimeout(enablePasteBtn, 50));
  document.addEventListener('cut',  () => setTimeout(enablePasteBtn, 50));

  // Apply initial state
  applyFontSize();
  applyCodeTheme();
}

document.addEventListener('DOMContentLoaded', init);
