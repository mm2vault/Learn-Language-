const CORS = {"Access-Control-Allow-Origin":"https://mm2vault.github.io","Access-Control-Allow-Headers":"Content-Type","Access-Control-Allow-Methods":"GET,POST,OPTIONS","Vary":"Origin"};

export default async (req) => {
  if (req.method === "OPTIONS") return new Response("", { status: 204, headers: CORS });
  if (req.method === "GET") {
    const hasToken = Boolean(Netlify.env.get("GEMINI_API_KEY"));
    return json({ ok: true, aiConfigured: hasToken, message: hasToken ? "Gemini AI hazır." : "Netlify GEMINI_API_KEY eksik." }, 200);
  }
  if (req.method !== "POST") return json({ error: "POST gerekli." }, 405);
  const token = Netlify.env.get("GEMINI_API_KEY");
  if (!token) return json({ error: "AI sunucusu yapılandırılmamış: Netlify GEMINI_API_KEY eklenmeli." }, 500);
  try {
    const body = await req.json();
    const message = String(body.message || "").slice(0, 4000);
    const progress = body.progress || {};
    const history = Array.isArray(body.history) ? body.history.slice(-10).filter(x => x && (x.role === "user" || x.role === "assistant") && x.content).map(x => ({role:x.role,content:String(x.content).slice(0,2000)})) : [];
    const model = Netlify.env.get("GEMINI_MODEL") || "gemini-3.6-flash";
    const system = `Sen DilYol adlı kişiselleştirilmiş dil öğrenme uygulamasının AI öğretmenisin. Kullanıcının ders cevaplarını, quiz sonuçlarını, tamamladığı aktiviteleri ve mevcut planını analiz et. Yanıtı Türkçe ver. Kullanıcıya uygun, uygulanabilir bir sonraki çalışma planı oluştur. Başarı uydurma. Görünüm için yalnızca şu temalardan birini seç: default, focus, calm, energy, night, minimal. Yalnızca geçerli JSON döndür: {"reply":"...","plan":{"minutes":20,"focus":"...","steps":["...","...","..."],"reason":"..."},"theme":"focus","mood":"neutral"}. mood yalnızca happy, concern veya neutral olabilir.`;
    const prompt = [
      system,
      "",
      "Konuşma geçmişi:",
      JSON.stringify(history),
      "",
      "İlerleme verisi:",
      JSON.stringify(progress),
      "",
      "Kullanıcı isteği:",
      message
    ].join("\n");
    const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/"+encodeURIComponent(model)+":generateContent", {
      method: "POST",
      headers: {"x-goog-api-key":token,"Content-Type":"application/json"},
      body: JSON.stringify({contents:[{role:"user",parts:[{text:prompt}]}],generationConfig:{maxOutputTokens:500,temperature:0.3}})
    });
    const data = await r.json();
    if (!r.ok) return json({error:data?.error?.message||"Gemini isteği başarısız."},r.status);
    const raw=data?.candidates?.[0]?.content?.parts?.map(p=>p.text||"").join("")||"";
    let parsed=null;
    try { parsed=JSON.parse(raw.replace(/^\`\`\`json\s*/,"").replace(/\s*\`\`\`$/,"").trim()); } catch {}
    const reply=String(parsed?.reply||raw||"AI yanıt üretmedi.");
    const plan=parsed?.plan&&typeof parsed.plan==="object" ? {
      minutes:Math.max(5,Math.min(90,Number(parsed.plan.minutes)||20)),
      focus:String(parsed.plan.focus||"Bugünkü ders").slice(0,160),
      steps:Array.isArray(parsed.plan.steps)?parsed.plan.steps.slice(0,5).map(x=>String(x).slice(0,140)):[],
      reason:String(parsed.plan.reason||"İlerlemenize göre kişiselleştirildi.").slice(0,200)
    } : null;
    const allowedThemes=["default","focus","calm","energy","night","minimal"];
    const theme=allowedThemes.includes(parsed?.theme)?parsed.theme:"default";
    const mood=["happy","concern","neutral"].includes(parsed?.mood)?parsed.mood:moodFor(reply);
    return json({reply,plan,theme,mood},200);
  } catch {
    return json({error:"AI isteği işlenemedi."},500);
  }
};
export const config = { path: "/api/ai" };
function moodFor(text){
  const t=String(text||"").toLowerCase();
  if(/harika|tebrik|doğru|mükemmel|başardın/.test(t)) return "happy";
  if(/yanlış|dikkat|hata|tekrar|zorlan/.test(t)) return "concern";
  return "neutral";
}
function json(data,status){
  return new Response(JSON.stringify(data),{status,headers:{...CORS,"Content-Type":"application/json"}});
}