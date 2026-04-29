import React from "react";
import { motion } from "framer-motion";

const packs = [
  { title: "1% ROLEX", price: "$813.54", icon: "watch", bg: "from-orange-700 via-amber-500 to-orange-950" },
  { title: "XPOSED", price: "$671.30", icon: "car", bg: "from-blue-800 via-fuchsia-600 to-cyan-500" },
  { title: "TOGI", price: "$1,005.78", icon: "creator", bg: "from-purple-900 via-fuchsia-600 to-indigo-950" },
  { title: "1% LAMBO", price: "$680.46", icon: "car", bg: "from-orange-700 via-yellow-500 to-orange-950" },
  { title: "CHAMPAGNE", price: "$490.79", icon: "watch", bg: "from-yellow-800 via-amber-400 to-yellow-950" },
];

const topOpens = [
  ["2025 Cadillac Escalade-V", "$200,000.00", "car"],
  ["Techframe Ferrari 70 Yea...", "$100,000.00", "watch"],
  ["Rolex Daytona White Cla...", "$86,350.00", "watch"],
];

const liveOpens = [
  ["Old Rolex", "$1.00", "watch"],
  ["Old Rolex", "$1.00", "watch"],
  ["Dollar Bill", "$1.00", "cash"],
  ["Minecraft Light-Up Diam...", "$72.00", "cube"],
  ["Four-Leaved Clover", "$1.00", "clover"],
  ["Four-Leaved Clover", "$1.00", "clover"],
  ["Old Rolex", "$1.00", "watch"],
  ["Voucher", "$4.00", "voucher"],
];

const battles = [
  { cost: "$2,918.72", unboxed: "$93,661.66", count: 25, icons: ["crown", "crown", "frog", "frog", "clown", "clown", "clown"] },
  { cost: "$446.29", unboxed: "$27,192.00", count: 4, icons: ["crown", "fire", "ghost", "eye", "bird", "bird", "shock"] },
  { cost: "$1,213.79", unboxed: "$77,214.60", count: 4, icons: ["mask", "clown", "crown", "eye", "eye", "eye", "frog"] },
];

const deals = [
  ["1.85x", "1999 Ultra Platinu...", "$43,750.00", "card"],
  ["9.26x", "David Yurman Pyr...", "$21,600.00", "bracelet"],
  ["1.60x", "1999 Ultra Platinu...", "$43,750.00", "card"],
  ["4.00x", "Rolex Datejust Whi...", "$20,000.00", "watch"],
  ["2.07x", "Bulgari Serpenti Vl...", "$21,720.00", "bracelet"],
  ["1.45x", "Bulgari Serpenti Vl...", "$21,720.00", "bracelet"],
];

const faqs = [
  "What is PackDraw?",
  "How do I deposit?",
  "Is PackDraw safe and fair?",
  "Missing crypto deposit?",
  "Is PackDraw trustworthy?",
  "What are Battles?",
  "How do I open a pack?",
  "How do I get Support?",
];

function cn(...v) { return v.filter(Boolean).join(" "); }

function runPreviewTests() {
  console.assert(packs.length === 5, "Expected 5 pack cards");
  console.assert(topOpens.length === 3, "Expected 3 top opens");
  console.assert(liveOpens.length >= 8, "Expected live opens rail to be populated");
  console.assert(battles.every((b) => b.icons.length >= 6), "Battle rows need avatar icons");
  console.assert(faqs.length === 8, "Expected 8 FAQ rows");
}
runPreviewTests();

function Icon({ name, className = "h-5 w-5" }) {
  const common = { className, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true };
  const map = {
    logo: <><path d="M5 4 19 2l-3 17-7 3L5 4Z" fill="currentColor" stroke="none"/><path d="m8 6 8-1-2 10-4 2L8 6Z" fill="#1b2025" stroke="none"/></>,
    packs: <><path d="M5 5h9v14H5z"/><path d="m10 20 7 1.2L20 8l-5-.8"/></>,
    battle: <><path d="M14.2 16.9 4 6.7V4h2.7l10.2 10.2"/><path d="M12.9 18.2 18.2 12.9"/><path d="m15.6 15.6 3.5 3.5"/><path d="M18.2 20 20 18.2"/></>,
    deal: <><circle cx="12" cy="12" r="9"/><path d="M8.5 12.5h7"/><path d="M12 8.5v7"/></>,
    draw: <><path d="M4 5h14v14H4z"/><path d="M15 12h5v7h-7v-5a2 2 0 0 1 2-2Z"/></>,
    event: <><circle cx="12" cy="12" r="9"/><path d="M12 3v9l5 3"/></>,
    rewards: <><path d="M20 12v8H4v-8"/><path d="M2 8h20v4H2z"/><path d="M12 22V8"/><path d="M12 8H7.5A2.5 2.5 0 1 1 10 5.5C10 7 12 8 12 8Z"/><path d="M12 8h4.5A2.5 2.5 0 1 0 14 5.5C14 7 12 8 12 8Z"/></>,
    volume: <><path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M16 9a5 5 0 0 1 0 6"/></>,
    chevron: <path d="m8 10 4 4 4-4"/>,
    star: <path d="M12 3 14 8l5 .5-4 3.5 1.2 5-4.2-2.6L7.8 17 9 12 5 8.5 10 8l2-5Z" fill="currentColor" stroke="none"/>,
    car: <><path d="M4 15h16l-2-5H6l-2 5Z"/><path d="M6 15v2"/><path d="M18 15v2"/><circle cx="7" cy="17" r="1.5"/><circle cx="17" cy="17" r="1.5"/></>,
    watch: <><path d="M9 2h6l-1 5h-4L9 2Z"/><path d="M10 17h4l1 5H9l1-5Z"/><circle cx="12" cy="12" r="5"/><path d="M12 9v3l2 1"/></>,
    card: <><rect x="4" y="6" width="16" height="12" rx="2"/><path d="M7 10h5"/><path d="M7 14h9"/></>,
    bracelet: <><path d="M6 12a6 6 0 0 1 12 0"/><path d="M18 12a6 6 0 0 1-12 0"/><path d="M8 12h8"/></>,
    box: <><path d="m12 3 8 4-8 4-8-4 8-4Z"/><path d="M4 7v10l8 4 8-4V7"/><path d="M12 11v10"/></>,
    cash: <><rect x="3" y="7" width="18" height="10" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 10v4M18 10v4"/></>,
    cube: <><path d="m12 3 8 4-8 4-8-4 8-4Z"/><path d="M4 7v10l8 4 8-4V7"/></>,
    clover: <><path d="M12 12C6 8 9 3 12 7c3-4 6 1 0 5Z" fill="currentColor"/><path d="M12 12c-6 4-3 9 0 5 3 4 6-1 0-5Z" fill="currentColor"/><path d="M12 13v7"/></>,
    voucher: <><path d="M5 8h14v8H5z"/><path d="M8 11h5"/><path d="M8 14h3"/></>,
    trophy: <><path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 4h10v5a5 5 0 0 1-10 0V4Z"/><path d="M7 6H4a3 3 0 0 0 3 3"/><path d="M17 6h3a3 3 0 0 1-3 3"/></>,
    pack: <><path d="M5 4h14v16H5z"/><path d="M8 8h8"/><path d="M8 13h8"/></>,
    shoes: <><path d="M4 15c4 0 8-1 11-5l5 5v3H4v-3Z"/><path d="M8 15v3"/></>,
    claim: <><path d="M4 11h16v9H4z"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/><path d="m7 15 3 3 7-7"/></>,
    x: <><path d="M6 6l12 12"/><path d="M18 6 6 18"/></>,
    instagram: <><rect x="4" y="4" width="16" height="16" rx="4"/><circle cx="12" cy="12" r="3"/><path d="M17 7h.01"/></>,
    youtube: <><path d="M3 8c0-2 1-3 3-3h12c2 0 3 1 3 3v8c0 2-1 3-3 3H6c-2 0-3-1-3-3V8Z"/><path d="m10 9 5 3-5 3V9Z" fill="currentColor"/></>,
  };
  return <svg {...common}>{map[name] || map.box}</svg>;
}

function ProductArt({ type, large = false }) {
  const emojiMap = {
    creator: "🏎️", car: "🏎️", watch: "⌚", card: "🃏", bracelet: "💍", cash: "💵", cube: "💠", clover: "☘️", voucher: "🎟️", box: "📦", pack: "🎴", shoes: "👟", claim: "📦",
  };
  return <div className={cn("select-none leading-none drop-shadow-2xl", large ? "text-[96px]" : "text-[58px]")}>{emojiMap[type] || "🎁"}</div>;
}

function Header() {
  const items = [["packs","Packs"],["battle","Battles"],["deal","Deals"],["draw","Draw"],["event","Events"],["rewards","Rewards"]];
  return <header className="sticky top-0 z-20 h-[64px] border-b border-[#2d3338] bg-[#181d21]">
    <div className="mx-auto flex h-full max-w-[1250px] items-center gap-7 px-6">
      <div className="flex items-center gap-2 text-xl font-black"><Icon name="logo" className="h-6 w-6 text-white"/>PackDraw</div>
      <nav className="hidden flex-1 items-center gap-7 md:flex">
        {items.map(([icon,label]) => <button key={label} className="flex items-center gap-1.5 text-sm font-bold text-slate-300 hover:text-white"><Icon name={icon} className="h-4 w-4 text-slate-500"/>{label}</button>)}
      </nav>
      <button className="hidden text-slate-500 sm:block"><Icon name="volume" className="h-5 w-5"/></button>
      <button className="rounded-md bg-[#2a3035] px-8 py-2 text-sm font-black text-white">Sign In</button>
      <button className="rounded-md bg-[#2b96dc] px-8 py-2 text-sm font-black text-white">Register</button>
    </div>
  </header>;
}

function PromoBanners() {
  return <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
    <div className="relative h-[112px] overflow-hidden rounded-lg bg-[#21282c] p-4">
      <Icon name="battle" className="h-8 w-8 text-[#3b4349]"/>
      <div className="absolute right-5 top-0 text-[92px] leading-none">🏆</div>
      <p className="absolute bottom-5 left-4 w-32 text-base font-black uppercase leading-5 text-slate-200">Your first battle win</p>
    </div>
    <div className="relative h-[112px] overflow-hidden rounded-lg bg-[#21282c] p-4">
      <Icon name="packs" className="h-8 w-8 text-[#3b4349]"/>
      <div className="absolute right-4 top-1 rotate-12 text-[86px] leading-none">🎴</div>
      <p className="absolute bottom-5 left-4 w-32 text-base font-black uppercase leading-5 text-slate-200">Open your first pack!</p>
    </div>
    <div className="relative h-[112px] overflow-hidden rounded-lg bg-[#21282c] p-4">
      <Icon name="deal" className="h-8 w-8 text-[#3b4349]"/>
      <div className="absolute right-4 top-1 text-[82px] leading-none">👜</div>
      <p className="absolute bottom-5 left-4 w-28 text-base font-black uppercase leading-5 text-slate-200">Your best deal</p>
    </div>
  </div>;
}

function SectionTitle({ icon, title }) {
  return <div className="mb-5 flex items-center justify-between">
    <div className="flex items-center gap-2"><Icon name={icon} className="h-5 w-5 text-slate-500"/><h2 className="text-xl font-black text-white">{title}</h2></div>
    <button className="text-sm font-black text-white">View All</button>
  </div>;
}

function PackCard({ pack, i }) {
  return <motion.div initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} transition={{delay:i*0.04}} className="text-center">
    <div className={cn("relative h-[252px] overflow-hidden rounded-lg border border-black/30 bg-gradient-to-br p-3 shadow-xl shadow-black/30", pack.bg)}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(255,255,255,.35),transparent_30%),radial-gradient(circle_at_30%_80%,rgba(255,255,255,.18),transparent_35%)]" />
      <div className="relative z-10 text-2xl font-black uppercase text-white drop-shadow-lg">{pack.title}</div>
      <div className="absolute inset-x-0 bottom-8 z-10 flex justify-center"><ProductArt type={pack.icon} large /></div>
    </div>
    <p className="mt-4 text-sm font-black text-white">{pack.price}</p>
  </motion.div>;
}

function SideItem({ item, i, compact=false }) {
  const [name, price, type] = item;
  return <div className={cn("relative flex flex-col items-center justify-center rounded-lg bg-[#22282c] px-3 text-center", compact ? "h-[158px]" : "h-[180px]")}> 
    <div className="absolute right-3 top-3 grid h-6 w-6 place-items-center rounded-full bg-slate-700 text-[13px]">{i % 3 === 0 ? "🔥" : i % 3 === 1 ? "🌙" : "🙂"}</div>
    <ProductArt type={type} />
    <p className="mt-3 max-w-[150px] truncate text-sm font-bold text-slate-400">{name}</p>
    <p className="text-sm font-black text-white">{price}</p>
  </div>;
}

function BattleRow({ battle, i }) {
  return <div className="relative grid min-h-[132px] grid-cols-1 items-center gap-4 overflow-hidden rounded-lg bg-[#22282c] p-5 pl-12 lg:grid-cols-[280px_1fr_160px]">
    <div className="absolute left-0 top-0 h-full w-1.5 bg-[#55f0a9]" />
    <div className="text-center">
      <div className="mb-2 text-sm font-black uppercase text-slate-500">Jackpot <span className="text-slate-600">▱ ⚡</span></div>
      <div className="flex justify-center -space-x-1 text-3xl">
        {battle.icons.map((x, n) => <span key={`${x}-${n}`} className="drop-shadow">{x === "crown" ? "👑" : x === "frog" ? "🐸" : x === "clown" ? "🤡" : x === "fire" ? "🔥" : x === "ghost" ? "👻" : x === "eye" ? "🧿" : x === "bird" ? "🐦" : x === "shock" ? "😮" : "🎭"}</span>)}
      </div>
      <div className="mt-2 text-xs text-slate-500">cost: <span className="font-black text-white">{battle.cost}</span></div>
    </div>
    <div className="relative flex h-[70px] items-center gap-2 overflow-hidden rounded-md bg-[#15191c] p-2">
      {Array.from({length: battle.count > 10 ? 6 : 4}).map((_, n) => <div key={n} className="grid h-[58px] w-[58px] shrink-0 place-items-center rounded bg-[#252c31] text-2xl opacity-70">🎴</div>)}
      <div className="absolute right-2 top-2 flex items-center gap-1 rounded bg-[#22282c] px-1.5 py-0.5 text-xs font-black text-white">▣ {battle.count}</div>
    </div>
    <div className="flex flex-col items-center gap-3">
      <p className="text-sm font-bold text-slate-500">unboxed: <span className="text-slate-300">{battle.unboxed}</span></p>
      <button className="w-full rounded-md bg-[#3a4147] py-3 text-sm font-black text-white">View Results</button>
    </div>
  </div>;
}

function DealCard({ deal }) {
  return <div className="relative h-[170px] rounded-lg bg-[#22282c] p-3">
    <div className="absolute right-3 top-3 grid h-5 w-5 place-items-center rounded-full bg-teal-600 text-[10px]">↗</div>
    <p className="text-xs font-black text-yellow-300">{deal[0]}</p>
    <div className="mt-2 flex h-[80px] items-center justify-center"><ProductArt type={deal[3]} /></div>
    <p className="truncate text-xs font-bold text-slate-500">{deal[1]}</p>
    <p className="text-sm font-black text-white">{deal[2]}</p>
  </div>;
}

function HowCard({ icon, title, text }) {
  return <div className="h-[255px] rounded-lg bg-[#22282c] p-6 text-center">
    <div className="flex h-[130px] items-center justify-center"><ProductArt type={icon} large /></div>
    <h3 className="text-base font-black text-white">{title}</h3>
    <p className="mx-auto mt-2 max-w-[240px] text-sm leading-5 text-slate-500">{text}</p>
  </div>;
}

function Footer() {
  return <footer className="mt-16 bg-[#121719] py-10">
    <div className="mx-auto grid max-w-[1250px] gap-10 px-6 md:grid-cols-[2fr_1fr_1fr_1.3fr]">
      <div><div className="flex items-center gap-2 text-xl font-black"><Icon name="logo" className="h-6 w-6 text-white"/>PackDraw</div><p className="mt-5 max-w-[260px] text-sm leading-6 text-slate-500">Open packs and battle to win rare and valuable products.</p></div>
      <div><h4 className="font-black uppercase text-white">Games</h4><div className="mt-3 space-y-2 text-sm text-slate-500"><p>Packs</p><p>Battles</p><p>Deals</p><p>Events</p><p>Rewards</p></div></div>
      <div><h4 className="font-black uppercase text-white">Legal</h4><div className="mt-3 space-y-2 text-sm text-slate-500"><p>Fairness</p><p>Privacy Policy</p><p>Terms of Service</p></div><h4 className="mt-6 font-black uppercase text-white">Community</h4><div className="mt-3 flex gap-2"><button className="grid h-8 w-8 place-items-center rounded bg-[#2a3035]"><Icon name="x" className="h-4 w-4"/></button><button className="grid h-8 w-8 place-items-center rounded bg-[#2a3035]"><Icon name="instagram" className="h-4 w-4"/></button><button className="grid h-8 w-8 place-items-center rounded bg-[#2a3035]"><Icon name="youtube" className="h-4 w-4"/></button></div></div>
      <div><p className="text-sm text-slate-500">Select Language</p><button className="mt-2 flex w-full items-center justify-between rounded-md border border-[#2a3035] bg-[#151a1d] px-4 py-3 text-sm font-bold">English <Icon name="chevron" className="h-4 w-4"/></button><h4 className="mt-6 font-black uppercase text-white">Support</h4><p className="mt-2 text-sm text-slate-500">support@packdraw.com</p></div>
    </div>
    <p className="mx-auto mt-10 max-w-[1250px] px-6 text-[10px] leading-5 text-slate-700">Copyright © PackDraw 2026. PackDraw is a brand name of PackDraw Group. This preview is for layout direction only.</p>
  </footer>;
}

export default function PackDrawHomepageClonePreview() {
  return <div className="min-h-screen bg-[#1b2024] text-white">
    <Header />
    <main className="mx-auto grid max-w-[1250px] grid-cols-1 gap-8 px-6 py-8 lg:grid-cols-[1fr_210px]">
      <section className="min-w-0 space-y-16">
        <PromoBanners />
        <section><SectionTitle icon="packs" title="New Packs"/><div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">{packs.map((p,i)=><PackCard key={p.title} pack={p} i={i}/>)}</div></section>
        <section><SectionTitle icon="battle" title="Battle Highlights"/><div className="space-y-4">{battles.map((b,i)=><BattleRow key={i} battle={b} i={i}/>)}</div></section>
        <section><SectionTitle icon="deal" title="Deal Highlights"/><div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">{deals.map((d,i)=><DealCard key={i} deal={d}/>)}</div></section>
        <section><SectionTitle icon="event" title="How It Works"/><div className="grid gap-4 md:grid-cols-3"><HowCard icon="pack" title="01. Open Packs" text="Find your perfect packs & experience the online excitement!"/><HowCard icon="shoes" title="02. Win Items" text="Uncover one item per pack from top brands you know & love!"/><HowCard icon="claim" title="03. Cash or Claim" text="Sell back unwanted items, cash them out, or have them delivered!"/></div></section>
        <section className="grid gap-4 md:grid-cols-2">{faqs.map((f)=><button key={f} className="flex items-center justify-between rounded-lg bg-[#22282c] px-5 py-5 text-left text-sm font-black text-white">{f}<Icon name="chevron" className="h-4 w-4 text-slate-500"/></button>)}</section>
      </section>

      <aside className="hidden space-y-8 lg:block">
        <section><div className="mb-4 flex items-center gap-2"><Icon name="star" className="h-4 w-4 text-yellow-400"/><h3 className="font-black">Top Opens</h3></div><div className="space-y-4">{topOpens.map((x,i)=><SideItem key={i} item={x} i={i}/>)}</div></section>
        <section><div className="mb-4 flex items-center gap-2"><span className="h-3 w-3 rounded-full border-2 border-red-500"/><h3 className="font-black">Live Opens</h3></div><div className="space-y-4">{liveOpens.map((x,i)=><SideItem key={i} item={x} i={i} compact />)}</div></section>
      </aside>
    </main>
    <Footer />
  </div>;
}
