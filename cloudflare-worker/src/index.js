const ALLOWED_ORIGIN = "https://mm2vault.github.io";

function cors(extra = {}) {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Vary": "Origin",
    ...extra
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: cors({"Content-Type":"application/json"})
  });
}

function moodFor(text) {
  const t = String(text || "").toLowerCase();
  if (/harika|tebrik|doğru|mükemmel|başardın/.test(t)) return "happy";
  if (/yanlış|dikkat|hata|tekrar|zorlan/.test(t)) return "concern";
  return "neutral";
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, {status:204, headers:cors()});

    if (request.method === "GET") {
      return json({
        ok: true,
        aiConfigured: Boolean(env.GEMINI_API_KEY),
        message: env.GEMINI_API_KEY ? "Gemini Worker hazır." : "GEMINI_API_KEY secret eksik."
      });
    }

    if (request.method !== "POST") return json({error:"POST gerekli."},405);
    if (!env.GEMINI_API_KEY) return json({error:"Worker'da GEMINI_API_KEY secret eksik."},500);

    try {
      const body = await request.json();
      const message = String(body.message || "").slice(0,4000);
      const progress = body.progress || {};
      const history = Array.isArray(body.history)
        ? body.history.slice(-10)
            .filter(x => x && (x.role === "user" || x.role === "assistant") && x.content)
            .map(x => ({role:x.role, content:String(x.content).slice(0,2000)}))
        : [];

      const system = [
        "Sen DilYol adlı dil öğrenme uygulamasının AI öğretmenisin.",
        "Kullanıcının ilerleme verisini dikkate al.",
        "Quiz sonuçlarını açıklarken doğru cevabı ve nedenini kısa ve öğretici şekilde anlat.",
        "Kullanıcı açık uçlu bir cümle gönderirse hedef dil bilgisine göre düzelt, doğru halini ve kısa nedenini ver.",
        "Kullanıcıya seviyesinin çok üstünde gereksiz içerik yükleme.",
        "İlerleme verisinde olmayan bir başarı veya sonuç uydurma.",
        "Yanıtı Türkçe ver; örnekleri hedef dilde gösterebilirsin."
      ].join("\n");

      const transcript = history.map(x => x.role + ": " + x.content).join("\n");
      const prompt = [
        system,
        "",
        "Önceki konuşma:",
        transcript || "(yok)",
        "",
        "İlerleme verisi:",
        JSON.stringify(progress),
        "",
        "Kullanıcı:",
        message
      ].join("\n");

      const model = env.GEMINI_MODEL || "gemini-3.8-flash";
      const endpoint = "https://generativelanguage.googleapis.com/v1beta/interactions";
      const response = await fetch(endpoint, {
        method:"POST",
        headers:{
          "Content-Type":"application/json",
          "x-goog-api-key":env.GEMINI_API_KEY
        },
        body:JSON.stringify({
          model,
          input:prompt,
          store:false,
          generation_config:{temperature:0.3,max_output_tokens:500}
        })
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) return json({error:data?.error?.message || "Gemini isteği başarısız."},response.status);

      const reply = data?.output_text || data?.outputs?.filter(x => x?.type === "text")?.map(x => x.text || "").join("") || "AI yanıt üretmedi.";
      return json({reply,mood:moodFor(reply)});
    } catch (error) {
      return json({error:"AI isteği işlenemedi."},500);
    }
  }
};
