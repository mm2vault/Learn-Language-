const KEY = "dilyol_v2";
const DAILY_GOAL = 50;

const S = {
  view: "home",
  langId: null,
  stageId: null,
  region: "all",
  flash: null,
  quiz: null,
  mode: null
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
function save() { localStorage.setItem(KEY, JSON.stringify(P)); }
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
    { id:"words", ic:"📖", t:"Kelime listesi", s: content.words.length + " kelime" },
    { id:"flash", ic:"🃏", t:"Kartlar", s:"Çevirmeli pratik" },
    { id:"phrases", ic:"💬", t:"Cümleler & diyalog", s: content.phrases.length + " kalıp" },
    { id:"quiz", ic:"✅", t:"Etap quizi", s:"10 soruya kadar" },
  ];
  if (S.stageId === "s5") {
    acts.push({ id:"exam", ic:"📝", t:"Genel sınav", s:"Tüm etaplardan karışık · 15 soru" });
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
    result("⚠️", "Kart bulunamadı", "Bu etapta henüz kelime verisi yok.", 0);
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
  result("🃏","Kartlar bitti", S.flash.known+" kelime pekişti", xp);
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
    result("⚠️", "Quiz açılamadı", "Bu dil için yeterli ders verisi bulunamadı.", 0);
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
  } else {
    btn.classList.add("bad");
    $("qFeed").textContent = "Doğru cevap: " + correct;
    $("qFeed").style.color = "#f87171";
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
  P.quizStats=P.quizStats||{}; P.quizStats[stageKey(S.langId,S.stageId||"exam")]={score:s,total:t,at:Date.now()}; updateAchievements(); save();\n  const passLine = S.quiz.exam ? 0.7 : 0.6;
  if (ratio >= passLine) maybeCompleteStage();
  let title = S.quiz.exam ? "Sınav bitti" : "Quiz bitti";
  let extra = s + "/" + t + " doğru";
  if (S.quiz.exam) extra += ratio >= 0.7 ? " · Geçtin ✓" : " · Tekrar dene";
  const emoji = ratio === 1 ? "🏆" : ratio >= passLine ? "🎉" : "💪";
  result(emoji, title, extra, xp);
}

function updateAchievements(){const d=Object.keys(P.done||{}).length,q=Object.keys(P.quizStats||{}).length,defs=[["first","🌱","İlk ders","İlk etabı tamamla",d>=1],["xp100","⭐","100 XP","100 XP kazan",P.xp>=100],["quiz5","🧠","Quizci","5 quiz",q>=5],["streak7","🔥","7 günlük seri","7 gün seri",P.streak>=7],["lang2","🌍","Dil gezgini","2 dil",Object.keys(P.started||{}).length>=2]];defs.forEach(x=>{if(x[4])P.achievements[x[0]]=true;});return defs;}
function maybeCompleteStage(){
  if (!S.langId || !S.stageId) return;
  P.done = P.done || {};
  P.done[stageKey(S.langId, S.stageId)] = true;
  save();
}

function result(emoji, title, text, xp){
  $("rEmoji").textContent = emoji;
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
      <h3>📝 Genel etap sınavı</h3>
      <p>15 soru: hedef dil → Türkçe, Türkçe → hedef dil ve cümle anlamı. Geçmek için %70+.</p>
      ${last ? `<p>Son: ${last.score}/${last.total}${last.pass ? " · Geçti ✓" : " · Kaldı"}</p>` : ""}
      <button class="btn primary" id="startExamBtn" type="button">Sınava başla</button>
    </div>
    <div class="exam-card">
      <h3>✅ Hızlı quiz (Etap 1)</h3>
      <p>Temel kelimelerden çift yönlü kısa quiz.</p>
      <button class="btn soft" id="quickQuizBtn" type="button">Başlat</button>
    </div>`;
  $("startExamBtn").onclick = () => startExam();
  $("quickQuizBtn").onclick = () => startQuiz(c.s1.words, false);
  show("exams");
}

function openAi(){$("aiModal").classList.remove("hidden");$("aiBody").innerHTML="<div class=\"ai-message bot\"><b>🤖 AI Öğretmen</b><p>"+$("aiRecText").textContent+"</p><small>XP: "+(P.xp||0)+" · Seri: "+(P.streak||0)+"</small></div>";} async function askAi(){const v=$("aiInput").value.trim();if(!v)return;$("aiInput").value="";try{const r=await fetch("/api/ai",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:v,progress:{lang:S.langId,xp:P.xp,streak:P.streak,done:P.done,quizStats:P.quizStats}})}),d=await r.json();if(!r.ok)throw Error();$("aiBody").insertAdjacentHTML("beforeend","<div class=\"ai-message bot\">"+String(d.reply||"Yanıt yok").replace(/\n/g,"<br>")+"</div>");}catch{$("aiBody").insertAdjacentHTML("beforeend","<div class=\"ai-message bot\">AI backend henüz bağlı değil. Tokeni güvenli ortam değişkenine ekleyince aktif olacak.</div>");}} function openProfile(){
  const langsStarted = Object.keys(P.started||{}); updateAchievements();
  const stagesDone = Object.keys(P.done||{}).length;
  $("profileBody").innerHTML = `
    <div class="prof-card"><h3>Toplam XP</h3><p style="font-size:28px;font-weight:800;color:var(--blue)">${P.xp||0}</p></div>
    <div class="prof-card"><h3>Gün serisi</h3><p style="font-size:28px;font-weight:800">${P.streak||0} 🔥</p></div>
    <div class="prof-card"><h3>Başlanan dil</h3><p style="font-size:28px;font-weight:800">${langsStarted.length} / ${LANG_META.length}</p></div>
    <div class="prof-card"><h3>Bitirilen etap</h3><p style="font-size:28px;font-weight:800">${stagesDone}</p></div>
    <div class="prof-card"><h3>Günlük hedef</h3><p>${P.dailyXp||0} / ${DAILY_GOAL} XP</p>
      <div class="bar" style="margin-top:8px"><i style="width:${Math.min(100,Math.round(((P.dailyXp||0)/DAILY_GOAL)*100))}%"></i></div>
    </div>
    <div class="prof-card"><h3>Diller</h3><p>${LANG_META.length} dil · 5 etaplı yol · quiz & sınav</p></div>
  `;
  show("profile");
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
  $("btnProfile").onclick = openProfile; $("aiOpen").onclick=openAi; $("aiClose").onclick=()=>$("aiModal").classList.add("hidden"); $("aiSend").onclick=askAi; $("aiInput").addEventListener("keydown",e=>{if(e.key==="Enter")askAi();});
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
    result("✨","Ders tamam", "İçerik gözden geçirildi", xp);
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
document.addEventListener("DOMContentLoaded", init);
