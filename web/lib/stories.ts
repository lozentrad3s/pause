// Example chats for the phone simulator and the /check page.

export type Platform = "WhatsApp" | "Instagram" | "Facebook" | "TikTok" | "X";

export const PLATFORMS: { id: Platform; color: string; intro: string }[] = [
  { id: "WhatsApp", color: "#1f8f5f", intro: "Hello, is this Grace? Sorry, I think I have the wrong number 🙏" },
  { id: "Instagram", color: "#c13584", intro: "Hi! I saw your garden photos, they're beautiful. Hope it's ok to say hello 🌸" },
  { id: "Facebook", color: "#3b5bdb", intro: "Hello dear, we have mutual friends in the church group. You have a kind smile." },
  { id: "TikTok", color: "#222222", intro: "Your cooking video made my day 😄 I had to message you" },
  { id: "X", color: "#3d3d3d", intro: "Loved your thread about retirement. Can I ask you something privately?" },
];

export interface Line {
  from: "them" | "me";
  text: string;
  day?: string;
}

export interface Story {
  id: string;
  title: string;
  contact: string;
  avatar: string;
  scam: boolean;
  lines: Line[]; // the platform intro is prepended at run time
  payment?: { amount: number; to: string };
}

export const STORIES: Story[] = [
  {
    id: "romance",
    title: "Romance scam",
    contact: "Daniel",
    avatar: "D",
    scam: true,
    payment: { amount: 30, to: "daniel-rig.testnet" },
    lines: [
      { from: "me", text: "Hello! That's kind of you.", day: "Day 1" },
      { from: "them", text: "I'm Daniel, an engineer on an oil rig offshore. It gets lonely out here." },
      { from: "them", text: "Can we talk on Telegram? The signal is better and it's more private." },
      { from: "me", text: "Ok, why not." },
      { from: "them", text: "Good morning my love ❤️ I never felt this way so fast. God brought you to me.", day: "Day 4" },
      { from: "me", text: "Can we do a video call?" },
      { from: "them", text: "My camera is broken and video calls are not allowed on the rig for security reasons." },
      { from: "them", text: "Please don't tell your children about us yet. They won't understand what we have.", day: "Day 9" },
      { from: "them", text: "Baby I'm in trouble. Customs is holding my equipment and I need to pay a clearance fee today.", day: "Day 16" },
      { from: "them", text: "Send 30 NEAR to daniel-rig.testnet and I'll pay you back the moment I land. If you really love me you'll help." },
    ],
  },
  {
    id: "investment",
    title: "Crypto “mentor”",
    contact: "Jenny",
    avatar: "J",
    scam: true,
    payment: { amount: 50, to: "fastgain-x.testnet" },
    lines: [
      { from: "me", text: "No problem, wrong number happens!", day: "Day 1" },
      { from: "them", text: "You seem so kind. I'm Jenny, I trade crypto in Singapore. Let's stay friends 😊" },
      { from: "them", text: "My uncle has insider signals. I made 40% profit this week on the platform.", day: "Day 6" },
      { from: "me", text: "Wow, is that safe?" },
      { from: "them", text: "100% guaranteed returns dear. Start small, just 50 NEAR to fastgain-x.testnet." },
      { from: "them", text: "The bonus round expires tonight. Keep it between us, my uncle doesn't share this with everyone." },
    ],
  },
  {
    id: "genuine",
    title: "Real friend",
    contact: "Tolu",
    avatar: "T",
    scam: false,
    payment: { amount: 3, to: "tolu.testnet" },
    lines: [
      { from: "them", text: "Mummy Grace! Thanks for coming to the naming ceremony yesterday 🙏", day: "Saturday" },
      { from: "me", text: "It was lovely. The baby is beautiful." },
      { from: "them", text: "I paid for the cake, your share is 3 NEAR, no rush at all." },
      { from: "me", text: "Sending now. See you at church on Sunday!" },
    ],
  },
];

/** Plain-text versions for the /check page examples. */
export function storyAsText(s: Story, p: Platform = "WhatsApp"): string {
  const intro = PLATFORMS.find((x) => x.id === p)!.intro;
  const all: Line[] = s.scam ? [{ from: "them", text: intro }, ...s.lines] : s.lines;
  return all.map((l) => `${l.from === "them" ? s.contact : "Me"}: ${l.text}`).join("\n");
}
