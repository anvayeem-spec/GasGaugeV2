/* App logic: settings, render, events. Needs data.js loaded first. */
const ACTIONS = [
  { name: "Send ETH", gas: 21000 },
  { name: "Send a token (ERC-20)", gas: 65000 },
  { name: "Mint an NFT", gas: 120000 },
  { name: "Swap tokens", gas: 150000 },
  { name: "Deploy a contract", gas: 1200000 }
];
const SEGMENTS = 24;
const $ = id => document.getElementById(id);
const usd = v => v < 1 ? "$" + v.toFixed(2) : "$" + v.toLocaleString("en-US", { maximumFractionDigits: v < 100 ? 2 : 0, minimumFractionDigits: v < 100 ? 2 : 0 });
const clock = t => new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const quantile = (sorted, q) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];

function render({ readings, ethUsd, sample }) {
  const vals = readings.map(r => r.gwei);
  const current = readings[readings.length - 1];
  const sorted = [...vals].sort((a, b) => a - b);
  const lo = sorted[0], hi = sorted[sorted.length - 1];
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  const q35 = quantile(sorted, 0.35), q65 = quantile(sorted, 0.65);
  const cheaperThan = Math.round(vals.filter(v => v > current.gwei).length / vals.length * 100);

  const zone = v => v <= q35 ? "good" : v <= q65 ? "mid" : "bad";
  const z = zone(current.gwei);
  const text = { good: "Good time to send", mid: "About average right now", bad: "Pricey right now. Waiting may save money" };

  $("gwei").textContent = current.gwei.toFixed(1);
  $("lamp").className = "lamp " + z;
  $("verdict").textContent = text[z];
  $("why").textContent = `This is cheaper than ${cheaperThan}% of the readings from the last 24 hours. The average was ${avg.toFixed(1)} gwei.`;
  $("updated").textContent = "Updated " + clock(current.time);

  // Gauge: each segment stands for a slice of the 24h price range
  const span = hi - lo || 1;
  $("gauge").innerHTML = Array.from({ length: SEGMENTS }, (_, i) => {
    const v = lo + (i + 0.5) / SEGMENTS * span;
    const cls = { good: "g", mid: "m", bad: "b" }[zone(v)];
    return `<i class="${cls}${v <= current.gwei ? " on" : ""}"></i>`;
  }).join("");
  $("lo").textContent = lo.toFixed(1) + " gwei";
  $("hi").textContent = hi.toFixed(1) + " gwei";

  // Cost table: gas units x gwei x 1e-9 = ETH, then x ETH price
  const costs = ACTIONS.map(a => ({ ...a, usd: a.gas * current.gwei * 1e-9 * ethUsd }));
  $("rows").innerHTML = costs.map(c =>
    `<tr${z === "good" ? ' class="cheap"' : ""}><th scope="row">${c.name}</th><td>${c.gas.toLocaleString("en-US")}</td><td class="cost">${usd(c.usd)}</td></tr>`
  ).join("");

  // Chart
  const pad = (hi - lo) * 0.1 || 1, yMin = lo - pad, yMax = hi + pad, W = 1000, H = 200;
  const X = i => i / (readings.length - 1) * W;
  const Y = v => H - (v - yMin) / (yMax - yMin) * H;
  const line = vals.map((v, i) => `${i ? "L" : "M"}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join(" ");
  $("plot").innerHTML =
    `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Gas price over the last 24 hours">
      <path d="${line} L${W} ${H} L0 ${H} Z" fill="var(--area)"/>
      <line x1="0" x2="${W}" y1="${Y(avg)}" y2="${Y(avg)}" stroke="var(--muted)" stroke-width="1.5" stroke-dasharray="6 6" vector-effect="non-scaling-stroke"/>
      <path d="${line}" fill="none" stroke="var(--ink)" stroke-width="2" vector-effect="non-scaling-stroke"/>
    </svg><span class="dot" style="top:${(Y(current.gwei) / H * 100).toFixed(1)}%"></span>`;
  $("ytop").textContent = yMax.toFixed(0) + " gwei";
  $("ybot").textContent = Math.max(0, yMin).toFixed(0);
  $("xlabels").innerHTML = [0, 0.25, 0.5, 0.75, 1].map(f => `<span>${clock(readings[Math.round(f * (readings.length - 1))].time)}</span>`).join("");

  $("note").textContent = (sample ? "Showing sample data until the backend is connected. " : "") +
    `Costs assume ETH at ${usd(ethUsd)} and typical gas use per action, so real transactions can differ.`;
}

async function load() {
  $("refresh").disabled = true;
  try { render(await getData()); }
  catch (e) { $("verdict").textContent = "Could not load prices. Check your connection and refresh."; }
  $("refresh").disabled = false;
}
$("refresh").addEventListener("click", load);
load();
