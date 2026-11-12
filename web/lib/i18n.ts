// Languages Pause answers in, and the six interview questions in each.
// The AI model writes its explanation in the chosen language. The fixed-rule
// fallback (used when no AI key is set) explains in English only.

export type Lang = "en" | "en-GB" | "fr" | "ru" | "uk" | "es" | "de" | "tr" | "pt" | "zh";

export const LANGS: { id: Lang; label: string; english: string; speech: string }[] = [
  { id: "en", label: "English (US)", english: "American English", speech: "en-US" },
  { id: "en-GB", label: "English (UK)", english: "British English", speech: "en-GB" },
  { id: "fr", label: "Français", english: "French", speech: "fr-FR" },
  { id: "ru", label: "Русский", english: "Russian", speech: "ru-RU" },
  { id: "uk", label: "Українська", english: "Ukrainian", speech: "uk-UA" },
  { id: "es", label: "Español", english: "Spanish", speech: "es-ES" },
  { id: "de", label: "Deutsch", english: "German", speech: "de-DE" },
  { id: "tr", label: "Türkçe", english: "Turkish", speech: "tr-TR" },
  { id: "pt", label: "Português", english: "Portuguese", speech: "pt-PT" },
  { id: "zh", label: "中文", english: "Simplified Chinese", speech: "zh-CN" },
];

export const isLang = (v: unknown): v is Lang => LANGS.some((l) => l.id === v);
export const langName = (id?: string) => LANGS.find((l) => l.id === id)?.english ?? "American English";
export const speechCode = (id?: string) => LANGS.find((l) => l.id === id)?.speech ?? "en-US";

const EN = [
  "Who is this payment for, in your own words?",
  "Did they contact you first, or did you contact them?",
  "Has anyone asked you to keep this payment secret, or not to tell family?",
  "Were you told you must pay quickly or something bad will happen?",
  "Were you promised a profit, a prize, or your money back if you pay a fee?",
  "Is anyone on the phone or chatting with you right now while you do this?",
];

export const QUESTIONS: Record<Lang, string[]> = {
  en: EN,
  "en-GB": EN,
  fr: [
    "À qui est destiné ce paiement, avec vos propres mots ?",
    "Est-ce cette personne qui vous a contacté en premier, ou vous ?",
    "Vous a-t-on demandé de garder ce paiement secret, ou de ne rien dire à votre famille ?",
    "Vous a-t-on dit de payer vite, sinon quelque chose de grave arrivera ?",
    "Vous a-t-on promis un gain, un prix, ou de récupérer votre argent si vous payez des frais ?",
    "Quelqu'un est-il au téléphone ou en train de vous écrire en ce moment ?",
  ],
  ru: [
    "Кому предназначен этот платёж? Расскажите своими словами.",
    "Кто написал или позвонил первым: они вам или вы им?",
    "Вас просили держать этот платёж в секрете или не говорить семье?",
    "Вам говорили, что нужно заплатить срочно, иначе случится что-то плохое?",
    "Вам обещали прибыль, приз или возврат денег после оплаты комиссии?",
    "Кто-нибудь сейчас говорит с вами по телефону или переписывается с вами?",
  ],
  uk: [
    "Для кого цей платіж? Розкажіть своїми словами.",
    "Хто звернувся першим: вони до вас чи ви до них?",
    "Вас просили тримати цей платіж у таємниці або не казати родині?",
    "Вам казали, що треба заплатити терміново, інакше станеться щось погане?",
    "Вам обіцяли прибуток, приз або повернення грошей після сплати комісії?",
    "Хтось зараз розмовляє з вами по телефону чи листується з вами?",
  ],
  es: [
    "¿Para quién es este pago? Cuéntelo con sus propias palabras.",
    "¿Le contactaron primero ellos, o fue usted?",
    "¿Le han pedido que mantenga este pago en secreto o que no se lo cuente a su familia?",
    "¿Le dijeron que debe pagar rápido o pasará algo malo?",
    "¿Le prometieron una ganancia, un premio o recuperar su dinero si paga una comisión?",
    "¿Hay alguien al teléfono o escribiéndole ahora mismo mientras hace esto?",
  ],
  de: [
    "Für wen ist diese Zahlung? Bitte in Ihren eigenen Worten.",
    "Hat die Person Sie zuerst kontaktiert, oder Sie die Person?",
    "Hat Sie jemand gebeten, die Zahlung geheim zu halten oder der Familie nichts zu sagen?",
    "Wurde Ihnen gesagt, Sie müssten schnell zahlen, sonst passiert etwas Schlimmes?",
    "Wurde Ihnen ein Gewinn, ein Preis oder Ihr Geld zurück versprochen, wenn Sie eine Gebühr zahlen?",
    "Ist gerade jemand am Telefon oder schreibt Ihnen, während Sie das tun?",
  ],
  tr: [
    "Bu ödeme kimin için? Kendi sözlerinizle anlatın.",
    "İlk onlar mı size ulaştı, yoksa siz mi onlara?",
    "Bu ödemeyi gizli tutmanızı ya da ailenize söylememenizi isteyen oldu mu?",
    "Hemen ödemezseniz kötü bir şey olacağı söylendi mi?",
    "Bir ücret öderseniz kâr, ödül ya da paranızın geri verileceği vaat edildi mi?",
    "Şu anda biri sizinle telefonda mı ya da size yazıyor mu?",
  ],
  pt: [
    "Para quem é este pagamento? Diga por palavras suas.",
    "Foram eles que o contactaram primeiro, ou foi você?",
    "Alguém lhe pediu para manter este pagamento em segredo ou não contar à família?",
    "Disseram-lhe que tem de pagar depressa ou algo de mau acontece?",
    "Prometeram-lhe lucro, um prémio ou o dinheiro de volta se pagar uma taxa?",
    "Está alguém ao telefone ou a escrever-lhe neste momento?",
  ],
  zh: [
    "这笔钱是付给谁的?请用您自己的话说。",
    "是对方先联系您的,还是您先联系对方的?",
    "有没有人要求您对这笔付款保密,或者不要告诉家人?",
    "有没有人说必须马上付款,否则会有坏事发生?",
    "有没有人承诺付了手续费就能获得收益、奖品或拿回本金?",
    "现在有没有人正在和您通话或聊天?",
  ],
};

/** Short phrases the phone-style screens say aloud or show. */
export const CALL_COPY: Record<Lang, { greet: string; listening: string; thinking: string; again: string }> = {
  en: { greet: "Hello, this is Pause. Tell me about the message or call you received, and I'll tell you if it looks like a scam.", listening: "I'm listening", thinking: "Checking privately", again: "Ask about another one" },
  "en-GB": { greet: "Hello, this is Pause. Tell me about the message or call you received, and I'll tell you whether it looks like a scam.", listening: "I'm listening", thinking: "Checking privately", again: "Ask about another one" },
  fr: { greet: "Bonjour, ici Pause. Parlez-moi du message ou de l'appel que vous avez reçu, et je vous dirai si cela ressemble à une arnaque.", listening: "Je vous écoute", thinking: "Vérification privée", again: "Poser une autre question" },
  ru: { greet: "Здравствуйте, это Pause. Расскажите о сообщении или звонке, который вы получили, и я скажу, похоже ли это на мошенничество.", listening: "Я слушаю", thinking: "Проверяю конфиденциально", again: "Спросить ещё" },
  uk: { greet: "Вітаю, це Pause. Розкажіть про повідомлення чи дзвінок, який ви отримали, і я скажу, чи схоже це на шахрайство.", listening: "Я слухаю", thinking: "Перевіряю конфіденційно", again: "Запитати ще" },
  es: { greet: "Hola, soy Pause. Cuénteme qué mensaje o llamada ha recibido y le diré si parece una estafa.", listening: "Le escucho", thinking: "Comprobando en privado", again: "Preguntar otra cosa" },
  de: { greet: "Hallo, hier ist Pause. Erzählen Sie mir von der Nachricht oder dem Anruf, und ich sage Ihnen, ob es nach Betrug aussieht.", listening: "Ich höre zu", thinking: "Wird privat geprüft", again: "Noch etwas fragen" },
  tr: { greet: "Merhaba, ben Pause. Aldığınız mesajı ya da aramayı anlatın, dolandırıcılığa benzeyip benzemediğini söyleyeyim.", listening: "Dinliyorum", thinking: "Gizlice kontrol ediliyor", again: "Başka bir şey sor" },
  pt: { greet: "Olá, daqui é o Pause. Fale-me da mensagem ou chamada que recebeu e eu digo-lhe se parece uma burla.", listening: "Estou a ouvir", thinking: "A verificar em privado", again: "Perguntar outra coisa" },
  zh: { greet: "您好,我是 Pause。请告诉我您收到的短信或电话,我来判断它是不是诈骗。", listening: "我在听", thinking: "正在私密检查", again: "再问一个" },
};
