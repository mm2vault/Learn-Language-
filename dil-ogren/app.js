const KEY = "dilyol_v2";
const DAILY_GOAL = 50;
const AI_API = "https://learn-language-y6sj.netlify.app/api/ai";
let aiVoiceEnabled = localStorage.getItem("dilyol_ai_voice") !== "0";

const S = {
  view: "home",
  langId: null,
  stageId: null,
  region: "all",
  flash: null,
  quiz: null,
  mode: null,
  aiHistory: []
};

function load() {
  const defaults = base();
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "null");
    if (!raw || typeof raw !== "object") return defaults;
    return {
      ...defaults,
      ...raw,
      done: raw.done && typeof raw.done === "object" ? raw.done : {},
      exam: raw.exam && typeof raw.exam === "object" ? raw.exam : {},
      started: raw.started && typeof raw.started === "object" ? raw.started : {}, quizStats: raw.quizStats && typeof raw.quizStats === "object" ? raw.quizStats : {}, achievements: raw.achievements && typeof raw.achievements === "object" ? raw.achievements : {}
    };
  } catch {
    localStorage.removeItem(KEY);
    return defaults;
  }
}
function base() {
  return { xp: 0, streak: 0, lastDay: null, dailyXp: 0, dailyDay: null, done: {}, exam: {}, started: {}, quizStats: {}, achievements: {} };
}
function save() { localStorage.setItem(KEY, JSON.stringify(P)); if (window.DilYolFirebase && window.DilYolFirebase.user) { clearTimeout(window.__dlySaveTimer); window.__dlySaveTimer=setTimeout(()=>window.DilYolFirebase.save(P).catch(console.error),450); } }
let P = load();

function today() {
  const d = new Date();
  return d.getFullYear() + "-" + (d.getMonth()+1) + "-" + d.getDate();
}
function ensureDaily() {
  const t = today();
  if (P.dailyDay !== t) { P.dailyXp = 0; P.dailyDay = t; }
}
function touchStreak() {
  const t = today();
  if (P.lastDay === t) return;
  const y = new Date(); y.setDate(y.getDate()-1);
  const ys = y.getFullYear()+"-"+(y.getMonth()+1)+"-"+y.getDate();
  P.streak = P.lastDay === ys ? (P.streak||0)+1 : 1;
  P.lastDay = t;
  save();
}
function addXp(n) {
  ensureDaily();
  P.xp = (P.xp||0) + n;
  P.dailyXp = (P.dailyXp||0) + n;
  if (S.langId) {
    P.started = P.started || {};
    P.started[S.langId] = true;
  }
  save();
  paintHomeStats();
}

function $(id){ return document.getElementById(id); }
function icon(name, cls=""){ return '<img class="ui-icon '+cls+'" src="assets/icons/'+name+'.svg" alt="" aria-hidden="true">'; }
function show(v){
  document.querySelectorAll(".view").forEach(el => el.classList.remove("active"));
  const el = $("v-"+v);
  if (el) el.classList.add("active");
  S.view = v;
  window.scrollTo({ top: 0, behavior: "instant" });
}
function shuffle(a){
  a = a.slice();
  for (let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
  return a;
}
function stageKey(lang, stage){ return lang + ":" + stage; }

function renderDashboard(){
  paintHomeStats();
  const ids=Object.keys(P.started||{});
  if(!S.langId) S.langId=ids[ids.length-1]||null;
  const meta=LANG_META.find(x=>x.id===S.langId);
  const next=STAGE_NAMES.find(s=>!P.done[stageKey(S.langId,s.id)])||STAGE_NAMES[0];
  const pct=S.langId?Math.round(langProgress(S.langId)/STAGE_NAMES.length*100):0;
  $("continueCard").innerHTML=meta ? "<button class='continue-inner' id='continueBtn' type='button'><span class='continue-flag'>"+meta.flag+"</span><span><b>Kaldığın yerden devam et</b><small>"+meta.name+" · "+next.title+" · %"+pct+"</small></span><strong>→</strong></button>" : "";
  if($("continueBtn")) $("continueBtn").onclick=()=>{S.stageId=next.id;openStage();};
  const qs=Object.values(P.quizStats||{});
  const avg=qs.length?qs.reduce((a,v)=>a+(v.total?v.score/v.total:0),0)/qs.length:1;
  $("aiRecTitle").textContent=avg<.75?"Önce zayıf konularını güçlendir":"Sıradaki ders: "+next.title;
  $("aiRecText").textContent=meta?meta.name+" ilerlemeni kaydettik. Quiz sonuçlarına göre sonraki adımı belirleyeceğiz.":"Bir dil seç ve öğrenmeye başla.";
}
function paintHomeStats(){
  ensureDaily();
  $("hStreak").textContent = P.streak||0;
  $("hXp").textContent = P.xp||0;
  $("hLangs").textContent = Object.keys(P.started||{}).length;
  const g = Math.min(100, Math.round(((P.dailyXp||0)/DAILY_GOAL)*100));
  $("goalFill").style.width = g + "%";
  $("goalText").textContent = (P.dailyXp||0) + "/" + DAILY_GOAL + " XP";
}

function filteredLangs(){
  const q = ($("langSearch").value || "").trim().toLowerCase();
  return LANG_META.filter(l => {
    if (S.region !== "all" && l.region !== S.region) return false;
    if (!q) return true;
    return l.name.toLowerCase().includes(q) || l.id.includes(q);
  });
}

function langProgress(id){
  let n = 0;
  STAGE_NAMES.forEach(s => { if (P.done && P.done[stageKey(id,s.id)]) n++; });
  return n;
}

function renderLangList(){
  const list = filteredLangs();
  $("langList").innerHTML = list.map(l => {
    const pr = langProgress(l.id);
    const total = STAGE_NAMES.length;
    return `<button class="lang-row" data-id="${l.id}" type="button">
      <span class="flag">${l.flag}</span>
      <span class="meta">
        <span class="name">${l.name}</span>
        <span class="sub">${l.speakers} konuşan · ${pr}/${total} etap</span>
      </span>
      <span class="lvl">${pr===0?"Başla":pr===total?"Bitti":"%"+Math.round(pr/total*100)}</span>
    </button>`;
  }).join("") || `<p class="muted" style="padding:20px;text-align:center">Dil bulunamadı</p>`;

  $("langList").querySelectorAll(".lang-row").forEach(btn => {
    btn.addEventListener("click", () => {
      S.langId = btn.dataset.id;
      openPath();
    });
  });
}

function openPath(){
  const meta = LANG_META.find(l => l.id === S.langId);
  if (!meta) return;
  $("pathTitle").textContent = meta.flag + " " + meta.name;
  $("pathSub").textContent = "5 etaplı öğrenme yolu · sınavlar dahil";

  let doneCount = 0;
  STAGE_NAMES.forEach(s => { if (P.done && P.done[stageKey(S.langId,s.id)]) doneCount++; });
  const pct = Math.round((doneCount / STAGE_NAMES.length) * 100);
  $("pathFill").style.width = pct + "%";
  $("pathPct").textContent = pct + "%";

  // Unlock: stage i requires i-1 done (s1 always open)
  $("pathNodes").innerHTML = STAGE_NAMES.map((s, idx) => {
    const key = stageKey(S.langId, s.id);
    const isDone = !!(P.done && P.done[key]);
    const prevDone = idx === 0 || !!(P.done && P.done[stageKey(S.langId, STAGE_NAMES[idx-1].id)]);
    const locked = !prevDone;
    const current = !isDone && prevDone;
    let cls = "path-node";
    if (isDone) cls += " done";
    else if (current) cls += " current";
    if (locked) cls += " locked";

    return `<div class="${cls}">
      <div class="node-rail"><div class="node-dot">${isDone?"✓":(idx+1)}</div></div>
      <button class="node-body" data-stage="${s.id}" data-locked="${locked}" type="button">
        <h3>${s.title}</h3>
        <p>${s.desc}</p>
        <div class="node-tags">
          <span class="tag">Kelimeler</span>
          <span class="tag">Cümleler</span>
          <span class="tag">Quiz</span>
          ${s.id==="s5"?'<span class="tag exam">Etap sınavı</span>':''}
        </div>
      </button>
    </div>`;
  }).join("");

  $("pathNodes").querySelectorAll(".node-body").forEach(btn => {
    btn.addEventListener("click", () => {
      if (btn.dataset.locked === "true") {
        alert("Önce önceki etabı tamamla.");
        return;
      }
      S.stageId = btn.dataset.stage;
      openStage();
    });
  });
  show("path");
}

function openStage(){
  const st = STAGE_NAMES.find(s => s.id === S.stageId);
  const content = getLangContent(S.langId)[S.stageId];
  if (!st || !content) return;
  $("stageTitle").textContent = st.title;
  $("stageHero").innerHTML = `<h3>${st.title}</h3><p>${st.desc}</p><p style="margin-top:8px">${content.lesson||""}</p>`;

  const acts = [
    { id:"words", ic:icon("book"), t:"Kelime listesi", s: content.words.length + " kelime" },
    { id:"flash", ic:icon("cards"), t:"Kartlar", s:"Çevirmeli pratik" },
    { id:"phrases", ic:icon("chat"), t:"Cümleler & diyalog", s: content.phrases.length + " kalıp" },
    { id:"quiz", ic:icon("check"), t:"Etap quizi", s:"10 soruya kadar" },
  ];
  if (S.stageId === "s5") {
    acts.push({ id:"exam", ic:icon("exam"), t:"Genel sınav", s:"Tüm etaplardan karışık · 15 soru" });
  }

  $("stageActions").innerHTML = acts.map(a =>
    `<button class="act" data-act="${a.id}" type="button">
      <span class="ic">${a.ic}</span>
      <span><div class="t">${a.t}</div><div class="s">${a.s}</div></span>
    </button>`
  ).join("");

  $("stageActions").querySelectorAll(".act").forEach(btn => {
    btn.addEventListener("click", () => runAct(btn.dataset.act));
  });
  show("stage");
}

function runAct(act){
  const c = getLangContent(S.langId)[S.stageId];
  if (act === "words") showWords(c);
  if (act === "flash") startFlash(c.words);
  if (act === "phrases") showPhrases(c);
  if (act === "quiz") startQuiz(c.words, false);
  if (act === "exam") startExam();
}

function showWords(c){
  $("lessonTitle").textContent = "Kelimeler";
  $("lessonBody").innerHTML = `<div class="word-grid">${c.words.map(w =>
    `<div class="word-cell"><b>${w[0]}</b><span>${w[1]}</span></div>`
  ).join("")}</div>`;
  S.mode = "words";
  show("lesson");
}

function showPhrases(c){
  $("lessonTitle").textContent = "Cümleler";
  $("lessonBody").innerHTML = c.phrases.map(p =>
    `<div class="phrase"><div class="tg">${p[0]}</div><div class="nt">${p[1]}</div></div>`
  ).join("") + (c.lesson ? `<div class="phrase"><div class="note">${c.lesson}</div></div>` : "");
  S.mode = "phrases";
  show("lesson");
}

/* Flash */
function startFlash(words){
  const safeWords = Array.isArray(words) ? words.filter(w => Array.isArray(w) && w.length >= 2) : [];
  if (!safeWords.length) {
    result("warning", "Kart bulunamadı", "Bu etapta henüz kelime verisi yok.", 0);
    return;
  }
  S.flash = { list: shuffle(safeWords.map(w => ({t:String(w[0]), n:String(w[1])}))), i:0, known:0 };
  paintFlash();
  show("flash");
}
function paintFlash(){
  const f = S.flash;
  if (f.i >= f.list.length){ finishFlash(); return; }
  const w = f.list[f.i];
  $("flashCount").textContent = (f.i+1)+"/"+f.list.length;
  $("fFront").textContent = w.t;
  $("fBack").textContent = w.n;
  $("fFront").classList.remove("hidden");
  $("fBack").classList.add("hidden");
}
function finishFlash(){
  touchStreak();
  const xp = 12 + S.flash.known * 2;
  addXp(xp);
  maybeCompleteStage();
  result("cards","Kartlar bitti", S.flash.known+" kelime pekişti", xp);
}

/* Quiz / Exam — çift yön + cümle soruları */
function collectAllWords(){
  const c = getLangContent(S.langId);
  let all = [];
  STAGE_NAMES.forEach(s => {
    if (c[s.id] && c[s.id].words) all = all.concat(c[s.id].words);
  });
  return all.length ? all : (PACKS.en ? PACKS.en.s1.words : []);
}
function collectAllPhrases(){
  const c = getLangContent(S.langId);
  let all = [];
  STAGE_NAMES.forEach(s => {
    if (c[s.id] && c[s.id].phrases) all = all.concat(c[s.id].phrases);
  });
  return all;
}
function buildQuestions(wordPool, isExam){
  const words = (wordPool.length ? wordPool : collectAllWords())
    .filter(w => Array.isArray(w) && w.length >= 2 && w[0] && w[1]);
  const phrases = collectAllPhrases();
  const n = isExam ? 15 : Math.min(10, Math.max(4, words.length));
  const qs = [];
  const wShuf = shuffle(words.slice());
  const pShuf = shuffle(phrases.slice());

  // ~60% kelime hedef→TR, ~25% TR→hedef, ~15% cümle
  for (let i = 0; i < n; i++) {
    const r = Math.random();
    if (isExam && r > 0.85 && pShuf.length) {
      const p = pShuf[i % pShuf.length];
      qs.push({ type: "phrase", prompt: `Bu cümle ne demek?\n“${p[0]}”`, correct: p[1], pool: phrases.map(x => x[1]) });
    } else if (r > 0.62) {
      const w = wShuf[i % wShuf.length];
      qs.push({ type: "toTarget", prompt: `Hangisi “${w[1]}” anlamına gelir?`, correct: w[0], pool: words.map(x => x[0]) });
    } else {
      const w = wShuf[i % wShuf.length];
      qs.push({ type: "toNative", prompt: `“${w[0]}” ne demek?`, correct: w[1], pool: words.map(x => x[1]) });
    }
  }
  return qs;
}
function pickOptions(correct, pool){
  let opts = [correct];
  const uniquePool = [...new Set((pool || []).filter(Boolean))];
  const p = shuffle(uniquePool.filter(x => x !== correct));
  for (let i = 0; i < p.length && opts.length < 4; i++) opts.push(p[i]);
  // yetersizse doldur
  while (opts.length < 4) opts.push(correct + "·");
  return shuffle(opts).slice(0, 4);
}
function startQuiz(words, isExam){
  const safeWords = Array.isArray(words) ? words.filter(w => Array.isArray(w) && w.length >= 2) : [];
  const list = buildQuestions(safeWords, isExam);
  if (!list.length) {
    result("warning", "Quiz açılamadı", "Bu dil için yeterli ders verisi bulunamadı.", 0);
    return;
  }
  S.quiz = { list, i:0, score:0, locked:false, exam: !!isExam };
  $("quizTitle").textContent = isExam ? "Genel Sınav" : "Quiz";
  paintQuiz();
  show("quiz");
}
function startExam(){
  startQuiz([], true);
}
function paintQuiz(){
  const q = S.quiz;
  if (q.i >= q.list.length){ finishQuiz(); return; }
  const item = q.list[q.i];
  $("quizCount").textContent = (q.i+1)+"/"+q.list.length;
  $("quizFill").style.width = Math.round((q.i/q.list.length)*100)+"%";
  $("qText").textContent = item.prompt;
  $("qFeed").textContent = "";
  q.locked = false;
  const opts = pickOptions(item.correct, item.pool);
  $("qOpts").innerHTML = opts.map(o =>
    `<button class="opt" type="button"></button>`
  ).join("");
  const buttons = $("qOpts").querySelectorAll(".opt");
  opts.forEach((o, idx) => {
    buttons[idx].textContent = o;
    buttons[idx].addEventListener("click", () => answerQuiz(buttons[idx], item.correct));
  });
}
function answerQuiz(btn, correct){
  if (S.quiz.locked) return;
  S.quiz.locked = true;
  const ok = btn.textContent === correct;
  if (ok){
    btn.classList.add("ok");
    S.quiz.score++;
    $("qFeed").textContent = "Doğru!";
    $("qFeed").style.color = "var(--mint)";
    setAiState("happy","Harika! Doğru cevap.");
    setTimeout(()=>setAiState("idle","Hazırım."),900);
  } else {
    btn.classList.add("bad");
    $("qFeed").textContent = "Doğru cevap: " + correct;
    $("qFeed").style.color = "#f87171";
    setAiState("concern","Sorun değil, birlikte tekrar ediyoruz.");
    setTimeout(()=>setAiState("idle","Hazırım."),1000);
    $("qOpts").querySelectorAll(".opt").forEach(b => {
      if (b.textContent === correct) b.classList.add("ok");
    });
  }
  setTimeout(() => { S.quiz.i++; paintQuiz(); }, 800);
}
function finishQuiz(){
  touchStreak();
  const s = S.quiz.score, t = S.quiz.list.length;
  const ratio = t ? s / t : 0;
  const xp = S.quiz.exam ? (30 + s * 4) : (15 + s * 2);
  addXp(xp);
  if (S.quiz.exam){
    P.exam = P.exam || {};
    P.exam[S.langId] = { score:s, total:t, at: Date.now(), pass: ratio >= 0.7 };
    save();
  }
  // Sınavda %70+, quizde %60+ etap sayılır
  P.quizStats=P.quizStats||{}; P.quizStats[stageKey(S.langId,S.stageId||"exam")]={score:s,total:t,at:Date.now()}; updateAchievements(); save();
  const passLine = S.quiz.exam ? 0.7 : 0.6;
  if (ratio >= passLine) maybeCompleteStage();
  let title = S.quiz.exam ? "Sınav bitti" : "Quiz bitti";
  let extra = s + "/" + t + " doğru";
  if (S.quiz.exam) extra += ratio >= 0.7 ? " · Geçtin ✓" : " · Tekrar dene";
  const iconName = ratio === 1 ? "trophy" : ratio >= passLine ? "check" : "brain";
  result(iconName, title, extra, xp);
}

function updateAchievements(){const d=Object.keys(P.done||{}).length,q=Object.keys(P.quizStats||{}).length,defs=[["first","🌱","İlk ders","İlk etabı tamamla",d>=1],["xp100","⭐","100 XP","100 XP kazan",P.xp>=100],["quiz5","🧠","Quizci","5 quiz",q>=5],["streak7","🔥","7 günlük seri","7 gün seri",P.streak>=7],["lang2","🌍","Dil gezgini","2 dil",Object.keys(P.started||{}).length>=2]];defs.forEach(x=>{if(x[4])P.achievements[x[0]]=true;});return defs;}
function maybeCompleteStage(){
  if (!S.langId || !S.stageId) return;
  P.done = P.done || {};
  P.done[stageKey(S.langId, S.stageId)] = true;
  save();
}

function result(iconName, title, text, xp){
  $("rEmoji").innerHTML = icon(iconName, "result-icon");
  $("rTitle").textContent = title;
  $("rText").textContent = text;
  $("rXp").textContent = "+"+xp+" XP";
  show("result");
}

function openExams(){
  const c = getLangContent(S.langId);
  const last = P.exam && P.exam[S.langId];
  $("examList").innerHTML = `
    <div class="exam-card">
      <h3><img class="inline-icon" src="assets/icons/exam.svg" alt=""> Genel etap sınavı</h3>
      <p>15 soru: hedef dil → Türkçe, Türkçe → hedef dil ve cümle anlamı. Geçmek için %70+.</p>
      ${last ? `<p>Son: ${last.score}/${last.total}${last.pass ? " · Geçti ✓" : " · Kaldı"}</p>` : ""}
      <button class="btn primary" id="startExamBtn" type="button">Sınava başla</button>
    </div>
    <div class="exam-card">
      <h3><img class="inline-icon" src="assets/icons/check.svg" alt=""> Hızlı quiz (Etap 1)</h3>
      <p>Temel kelimelerden çift yönlü kısa quiz.</p>
      <button class="btn soft" id="quickQuizBtn" type="button">Başlat</button>
    </div>`;
  $("startExamBtn").onclick = () => startExam();
  $("quickQuizBtn").onclick = () => startQuiz(c.s1.words, false);
  show("exams");
}

function escapeHtml(value){
  const el=document.createElement("div"); el.textContent=String(value ?? ""); return el.innerHTML;
}
function setAiState(state="idle", status){
  const classes=["ai-idle","ai-thinking","ai-speaking","ai-happy","ai-concern"];
  ["aiAvatar","aiMiniAvatar"].forEach(id=>{ const el=$(id); if(!el) return; el.classList.remove(...classes); el.classList.add("ai-"+state); });
  if($("aiStatus")) $("aiStatus").textContent=status || ({idle:"Hazırım.",thinking:"Düşünüyorum…",speaking:"Konuşuyor…",happy:"Harika! Böyle devam.",concern:"Burada birlikte tekrar yapabiliriz.",neutral:"Buradayım."}[state] || "Hazırım.");
}
function appendAiMessage(text, who="bot"){
  const body=$("aiBody"); if(!body) return;
  const row=document.createElement("div"); row.className="ai-message "+(who==="user"?"user":"bot");
  row.innerHTML=escapeHtml(text).replace(/\n/g,"<br>"); body.appendChild(row); body.scrollTop=body.scrollHeight;
}
function chooseTurkishVoice(){
  if(!( "speechSynthesis" in window)) return null;
  const voices=window.speechSynthesis.getVoices()||[];
  return voices.find(v=>/^tr(-|_)/i.test(v.lang)) || voices.find(v=>/turk|türk/i.test(v.name)) || voices[0] || null;
}
function speakAi(text){
  if(!aiVoiceEnabled || !("speechSynthesis" in window) || !text){ setAiState("idle","Hazırım."); return; }
  const spoken=String(text).replace(/[*_`#]/g,"").replace(/\n+/g,". ").trim().slice(0,900);
  window.speechSynthesis.cancel();
  const u=new SpeechSynthesisUtterance(spoken); u.lang="tr-TR"; u.rate=.98; u.pitch=1.03;
  const voice=chooseTurkishVoice(); if(voice) u.voice=voice;
  u.onstart=()=>setAiState("speaking","Konuşuyor…"); u.onend=()=>setAiState("idle","Hazırım."); u.onerror=()=>setAiState("idle","Hazırım.");
  setAiState("speaking","Konuşuyor…"); window.speechSynthesis.speak(u);
}
function updateAiVoiceButton(){
  const b=$("aiVoiceToggle"); if(!b) return; b.textContent=aiVoiceEnabled?"Ses açık":"Ses kapalı"; b.setAttribute("aria-pressed",String(aiVoiceEnabled));
}
function openAi(){
  $("aiModal").classList.remove("hidden"); $("aiModal").setAttribute("aria-hidden","false");
  $("aiBody").innerHTML="";
  if(!S.aiHistory.length){
    const greeting=$("aiRecText").textContent || "Birlikte çalışmaya hazırız.";
    S.aiHistory.push({role:"assistant",content:greeting}); appendAiMessage(greeting,"bot");
    $("aiSpeech").textContent="Hazırım. Bana bir kelime, cümle, quiz sonucu ya da ders sorusu gönder.";
    if(aiVoiceEnabled) speakAi("Hazırım. Bana bir kelime, cümle veya ders sorusu gönder.");
  }else{
    S.aiHistory.forEach(m=>appendAiMessage(m.content,m.role==="user"?"user":"bot"));
    const last=S.aiHistory[S.aiHistory.length-1]; $("aiSpeech").textContent=last?.content||"Hazırım.";
  }
  updateAiVoiceButton(); setAiState("idle","Hazırım.");
}
function closeAi(){
  $("aiModal").classList.add("hidden"); $("aiModal").setAttribute("aria-hidden","true");
  if("speechSynthesis" in window) window.speechSynthesis.cancel(); setAiState("idle","Hazırım.");
}
async function askAi(){
  const input=$("aiInput"), send=$("aiSend"), v=input.value.trim(); if(!v) return;
  input.value=""; S.aiHistory.push({role:"user",content:v}); appendAiMessage(v,"user"); $("aiSpeech").textContent="Mesajını analiz ediyorum…"; setAiState("thinking","Düşünüyorum…"); send.disabled=true;
  const payload={message:v,history:S.aiHistory.slice(0,-1).slice(-9),progress:{lang:S.langId,stage:S.stageId,xp:P.xp,streak:P.streak,done:P.done,quizStats:P.quizStats,dailyXp:P.dailyXp,started:P.started}};
  try{
    let r;
    try{
      r=await fetch(AI_API,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload},signal:AbortSignal.timeout(18000)});
    }catch(firstErr){
      r=await fetch("https://learn-language-y6sj.netlify.app/.netlify/functions/ai",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload),signal:AbortSignal.timeout(18000)});
    }
    const d=await r.json().catch(()=>({}));
    if(!r.ok) throw new Error(d.error||("AI sunucusu hata verdi ("+r.status+")."));
    const reply=String(d.reply||"Şu an yanıt üretemedim. Biraz daha açık sorabilir misin?"); S.aiHistory.push({role:"assistant",content:reply}); appendAiMessage(reply,"bot"); $("aiSpeech").textContent=reply;
    setAiState(d.mood==="happy"?"happy":d.mood==="concern"?"concern":"speaking",d.mood==="happy"?"Harika!":d.mood==="concern"?"Birlikte düzeltiyoruz.":"Konuşuyor…"); speakAi(reply);
  }catch(err){
    const message=err?.name==="AbortError"?"AI yanıtı zaman aşımına uğradı.":(err?.message||"Sunucuya ulaşılamadı.");
    S.aiHistory.pop();
    appendAiMessage("AI şu an bağlanamadı. "+message+" Netlify AI ayarını kontrol et.","bot");
    $("aiSpeech").textContent="AI bağlantısı kontrol edilmeli."; setAiState("concern","Bağlantı sorunu");
  }finally{ send.disabled=false; }
}
function openProfile(){
  const langsStarted = Object.keys(P.started||{}); updateAchievements();
  const stagesDone = Object.keys(P.done||{}).length;
  const defs=updateAchievements();
  const achievementRows=defs.map(x=>`<div class="achievement ${P.achievements[x[0]]?"unlocked":""}"><span>${icon(x[0]==="xp100"?"trophy":x[0]==="quiz5"?"brain":x[0]==="lang2"?"globe":"check","achievement-icon")}</span><b>${x[2]}</b><small>${x[3]}</small></div>`).join("");
  $("profileBody").innerHTML = `
    <div class="prof-card"><h3>Toplam XP</h3><p style="font-size:28px;font-weight:800;color:var(--blue)">${P.xp||0}</p></div>
    <div class="prof-card"><h3>Gün serisi</h3><p style="font-size:28px;font-weight:800">${P.streak||0}</p></div>
    <div class="prof-card"><h3>Başlanan dil</h3><p style="font-size:28px;font-weight:800">${langsStarted.length} / ${LANG_META.length}</p></div>
    <div class="prof-card"><h3>Bitirilen etap</h3><p style="font-size:28px;font-weight:800">${stagesDone}</p></div>
    <div class="prof-card"><h3>Günlük hedef</h3><p>${P.dailyXp||0} / ${DAILY_GOAL} XP</p>
      <div class="bar" style="margin-top:8px"><i style="width:${Math.min(100,Math.round(((P.dailyXp||0)/DAILY_GOAL)*100))}%"></i></div>
    </div>
    <div class="prof-card"><h3>Diller</h3><p>${LANG_META.length} dil · 5 etaplı yol · quiz & sınav</p></div>
    <div class="prof-card"><h3>Başarımlar</h3><div class="achievement-grid">${achievementRows}</div></div>
    <div class="prof-card"><p><b>${window.DilYolFirebase?.user?.displayName||"DilYol kullanıcısı"}</b><br>${window.DilYolFirebase?.user?.email||""}</p><button class="btn soft block" id="profileLogout" type="button">Çıkış yap</button></div>
  `;
  $("profileLogout").onclick=async()=>{try{await window.DilYolFirebase.logout();}catch(e){console.error(e);}};
  show("profile");
}

function authMode(mode){
  $("authLoginTab").classList.toggle("on",mode==="login");
  $("authRegisterTab").classList.toggle("on",mode==="register");
  $("authSubmit").textContent=mode==="register"?"Hesap oluştur":"Giriş yap";
  $("authName").required=mode==="register";
  $("authName").style.display=mode==="register"?"":"none";
  $("authError").textContent="";
}
async function handleAuth(e){
  e.preventDefault();
  const email=$("authEmail").value.trim(), pass=$("authPass").value, name=$("authName").value.trim();
  $("authError").textContent="";
  if(handleAuth.mode==="register" && name.length<2){ $("authError").textContent="Kullanıcı adı en az 2 karakter olmalı."; return; }
  $("authSubmit").disabled=true;
  try {
    if(handleAuth.mode==="register") await window.DilYolFirebase.register(email,pass,name);
    else await window.DilYolFirebase.login(email,pass);
  } catch(err) {
    const m={
      "auth/email-already-in-use":"Bu e-posta zaten kayıtlı.",
      "auth/invalid-email":"Geçerli bir e-posta gir.",
      "auth/weak-password":"Şifre en az 6 karakter olmalı.",
      "auth/invalid-credential":"E-posta veya şifre hatalı.",
      "auth/user-not-found":"Bu hesap bulunamadı.",
      "auth/wrong-password":"Şifre hatalı.",
      "auth/operation-not-allowed":"Firebase Authentication'da E-posta/Şifre girişini açman gerekiyor.",
      "auth/configuration-not-found":"Firebase Authentication yapılandırması eksik.",
      "auth/invalid-api-key":"Firebase API anahtarı geçersiz.",
      "auth/network-request-failed":"İnternet veya Firebase bağlantısı kurulamadı.",
      "auth/too-many-requests":"Çok fazla deneme yapıldı. Biraz sonra tekrar dene."
    };
    const detail=err?.message ? " ("+String(err.message).replace(/^Firebase:\s*/,"").slice(0,180)+")" : "";
    $("authError").textContent=m[err.code]||((window.DilYolFirebase&&window.DilYolFirebase.error)||"Giriş başarısız.")+detail;
  } finally { $("authSubmit").disabled=false; $("authSubmit").textContent=handleAuth.mode==="register"?"Hesap oluştur":"Giriş yap"; }
}
handleAuth.mode="login";
function bindPublicAuth(){
  $("landingLoginTop").onclick=()=>{$("authPanel").classList.remove("hidden"); authMode("login"); handleAuth.mode="login";};
  $("landingStart").onclick=()=>{$("authPanel").classList.remove("hidden"); authMode("register"); handleAuth.mode="register";};
  $("authPanelClose").onclick=()=>$("authPanel").classList.add("hidden");
  $("authForm").addEventListener("submit",handleAuth);
  $("authLoginTab").onclick=()=>{handleAuth.mode="login";authMode("login");};
  $("authRegisterTab").onclick=()=>{handleAuth.mode="register";authMode("register");};
}
function bind(){
  $("langSearch").addEventListener("input", renderLangList);
  document.querySelectorAll("#regionTabs .tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll("#regionTabs .tab").forEach(t => t.classList.remove("on"));
      tab.classList.add("on");
      S.region = tab.dataset.region;
      renderLangList();
    });
  });
  document.querySelectorAll("[data-go]").forEach(btn => {
    btn.addEventListener("click", () => {
      const g = btn.dataset.go;
      if (g === "home"){ paintHomeStats(); renderLangList(); show("home"); }
      if (g === "path") openPath();
    });
  });
  $("btnProfile").onclick=openProfile;
$("aiOpen").onclick=openAi; $("aiClose").onclick=closeAi; $("aiSend").onclick=askAi;
$("aiInput").addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();askAi();}});
$("aiVoiceToggle").onclick=()=>{ aiVoiceEnabled=!aiVoiceEnabled; localStorage.setItem("dilyol_ai_voice",aiVoiceEnabled?"1":"0"); updateAiVoiceButton(); if(!aiVoiceEnabled&&"speechSynthesis" in window) window.speechSynthesis.cancel(); if(aiVoiceEnabled) speakAi("Sesli AI öğretmeni açıldı."); };
updateAiVoiceButton();
  $("btnExamList").onclick = openExams;

  $("flashCard").onclick = () => {
    $("fFront").classList.toggle("hidden");
    $("fBack").classList.toggle("hidden");
  };
  $("fAgain").onclick = () => {
    $("fFront").classList.remove("hidden");
    $("fBack").classList.add("hidden");
  };
  $("fKnow").onclick = () => { S.flash.known++; S.flash.i++; paintFlash(); };
  $("flashBack").onclick = () => openStage();
  $("quizBack").onclick = () => openStage();
  $("lessonBack").onclick = () => openStage();
  $("lessonDone").onclick = () => {
    touchStreak();
    const xp = S.mode === "phrases" ? 10 : 8;
    addXp(xp);
    maybeCompleteStage();
    result("check","Ders tamam", "İçerik gözden geçirildi", xp);
  };
  $("rOk").onclick = () => {
    if (S.langId) openPath();
    else { paintHomeStats(); renderLangList(); show("home"); }
  };
}

function init(){
  try {
    P = load();
    ensureDaily();
    paintHomeStats();
    renderLangList();
    bind();
    renderDashboard();
    show("home");
  } catch (err) {
    console.error("DilYol başlatma hatası:", err);
    document.body.innerHTML = `
      <main style="min-height:100vh;display:grid;place-items:center;padding:24px;background:#070b14;color:#eef3ff;font-family:system-ui,sans-serif">
        <section style="max-width:520px;padding:28px;border:1px solid #243049;border-radius:20px;background:#141c2e">
          <h1 style="margin:0 0 10px">DilYol açılamadı</h1>
          <p style="color:#8b9bb8;line-height:1.5">Uygulama verilerinde bir sorun oluştu. Sayfayı yenile. Düzelmezse site verilerini temizleyip tekrar aç.</p>
          <button onclick="localStorage.removeItem('dilyol_v2');location.reload()" style="margin-top:16px;padding:12px 16px;border:0;border-radius:12px;cursor:pointer">Verileri sıfırla ve yenile</button>
        </section>
      </main>`;
  }
}
document.addEventListener("DOMContentLoaded", () => {
  authMode("login");
  bindPublicAuth();
  const boot = async () => {
    if (!window.DilYolFirebase) {
      $("authError").textContent="Firebase bağlantısı yüklenemedi. Sayfayı yenileyip tekrar dene.";
      return;
    }
    if (!window.DilYolFirebase.user) return;
    if (window.DilYolFirebase.progress) {
      const remote=window.DilYolFirebase.progress, defaults=base();
      P={...defaults,...remote,done:remote.done&&typeof remote.done==="object"?remote.done:{},exam:remote.exam&&typeof remote.exam==="object"?remote.exam:{},started:remote.started&&typeof remote.started==="object"?remote.started:{},quizStats:remote.quizStats&&typeof remote.quizStats==="object"?remote.quizStats:{},achievements:remote.achievements&&typeof remote.achievements==="object"?remote.achievements:{}};
      localStorage.setItem(KEY,JSON.stringify(P));
    } else {
      try { await window.DilYolFirebase.save(P); }
      catch(e) { console.warn("Firestore kayıt atlandı; yerel ilerleme kullanılacak:", e); }
    }
    $("authGate").classList.add("hidden");
    init();
  };
  if(window.DilYolFirebase && window.DilYolFirebase.ready) boot();
  else window.addEventListener("dilyol-auth-ready",boot,{once:true});
  window.addEventListener("dilyol-auth-signed-out",()=>{$("authGate").classList.remove("hidden");});
  setTimeout(()=>{
    if(!window.DilYolFirebase?.ready && $("authError")){
      $("authError").textContent="Firebase bağlantısı başlatılamadı. Sayfayı yenile ve Firebase ayarlarını kontrol et.";
    }
  },8000);
});
