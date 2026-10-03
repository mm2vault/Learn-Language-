export default async (req) => {
  if (req.method === "OPTIONS") return new Response("", { status: 204, headers: { "Access-Control-Allow-Origin": "https://mm2vault.github.io", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Methods": "POST,OPTIONS" } });
  if (req.method !== "POST") return json({ error: "POST gerekli." }, 405);
  const token = Netlify.env.get("HF_TOKEN");
  if (!token) return json({ error: "HF_TOKEN ayarlanmamış." }, 500);
  try {
    const body = await req.json();
    const message = String(body.message || "").slice(0, 4000);
    const progress = body.progress || {};
    const model = Netlify.env.get("HF_MODEL") || "deepseek-ai/DeepSeek-V3-0324";
    const system = [
      "Sen DilYol adlı dil öğrenme uygulamasının AI öğretmenisin.",
      "Kullanıcının verdiği ilerleme verisini dikkate al.",
      "Quiz sonuçlarını açıklarken doğru cevabı ve nedenini kısa, öğretici şekilde anlat.",
      "Kullanıcı açık uçlu bir cümle gönderirse hedef dil bilgisine göre düzelt, doğru halini ve kısa nedenini ver.",
      "Kullanıcıya seviyesinin çok üstünde gereksiz içerik yükleme.",
      "Ders sırası önerirken önce tamamlanmamış ve zayıf konulara öncelik ver.",
      "İlerleme verisinde olmayan bir başarı veya sonuç uydurma.",
      "Yanıtı Türkçe ver; örnekleri hedef dilde gösterebilirsin."
    ].join("\n");
    const r = await fetch("https://router.huggingface.co/v1/chat/completions", {
      method: "POST",
      headers: {"Authorization":"Bearer "+token,"Content-Type":"application/json"},
      body: JSON.stringify({
        model,
        messages:[
          {role:"system",content:system},
          {role:"user",content:"İlerleme verisi:\n"+JSON.stringify(progress)+"\n\nKullanıcı isteği:\n"+message}
        ],
        max_tokens:500,
        temperature:0.3
      })
    });
    const data = await r.json();
    if (!r.ok) return json({error:data?.error||"Hugging Face isteği başarısız."},r.status);
    return json({reply:data?.choices?.[0]?.message?.content||"AI yanıt üretmedi."},200);
  } catch {
    return json({error:"AI isteği işlenemedi."},500);
  }
};
export const config = { path: "/api/ai" };
function json(data,status){
  return new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json"}});
}