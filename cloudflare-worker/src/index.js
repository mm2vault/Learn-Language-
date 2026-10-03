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

function extractText(data) {
  if (typeof data?.output_text === "string" && data.output_text.trim()) return data.output_text.trim();

  const steps = Array.isArray(data?.steps) ? data.steps : [];
  const stepText = steps
    .filter(step => step?.type === "model_output")
    .flatMap(step => Array.isArray(step?.content) ? step.content : [])
    .filter(item => item?.type === "text")
    .map(item => item?.text || "")
    .join("");

  if (stepText.trim()) return stepText.trim();

  const outputs = Array.isArray(data?.outputs) ? data.outputs : [];
  return outputs
    .filter(x => x?.type === "text")
    .map(x => x?.text || "")
    .join("")
    .trim();
}

async function callGemini(model, prompt, apiKey) {
  const response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
    method:"POST",
    headers:{
      "Content-Type":"application/json",
      "x-goog-api-key":apiKey
    },
    body:JSON.stringify({
      model,
      input:prompt,
      store:false,
      generation_config:{max_output_tokens:500}
    })
  });

  const data = await response.json().catch(() => ({}));
  return {response, data};
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, {status:204, headers:cors()});

    if (request.method === "GET") {
      return json({
        ok: true,
        aiConfigured: Boolean(env.GEMINI_API_KEY),
        model: env.GEMINI_MODEL || "gemini-3.8-flash",
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

      const preferred = env.GEMINI_MODEL || "gemini-3.8-flash";
      const fallbackModels = ["gemini-3.7-flash", "gemini-3.6-flash"];
      const models = [preferred, ...fallbackModels].filter((model, index, all) => model && all.indexOf(model) === index);

      let lastData = null;
      let lastStatus = 503;

      for (const model of models) {
        const {response, data} = await callGemini(model, prompt, env.GEMINI_API_KEY);
        lastData = data;
        lastStatus = response.status;

        if (response.ok) {
          const reply = extractText(data);
          if (reply) return json({reply, mood:moodFor(reply), model});
          return json({error:"Gemini yanıt verdi ama metin üretmedi."},502);
        }

        // Temporary capacity/rate-limit errors are retried with the next model.
        if (![429,500,502,503,504].includes(response.status)) {
          return json({error:data?.error?.message || "Gemini isteği başarısız."},response.status);
        }
      }

      const upstreamError = lastData?.error?.message || "Gemini şu anda yoğun.";
      return json({
        error:"AI modelleri şu anda yoğun. Birkaç saniye sonra tekrar dene.",
        detail:upstreamError
      }, lastStatus >= 500 ? 503 : lastStatus);
    } catch (error) {
      return json({error:"AI isteği işlenemedi."},500);
    }
  }
};
