// Renders the fictional evidence documents of the demo mill to PDF (and a PNG
// preview of each first page) from lib/samples/marmara.ts, with a local
// headless Chrome. Run: node scripts/make-samples.ts
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { documents, gasKwh, installation, production, supplier, type SampleDocument } from "../lib/samples/marmara.ts";

const OUT = "public/samples";
const CHROME = [
  process.env.CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].find((p) => p && existsSync(p));
if (!CHROME) throw new Error("No Chrome or Chromium found; set CHROME_PATH.");

const tr = (n: number, digits = 0) =>
  n.toLocaleString("tr-TR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const en = (n: number, digits = 0) =>
  n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const AYLAR: Record<string, string> = { "07": "Temmuz", "08": "Ağustos", "09": "Eylül" };

const css = `
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font: 10.5pt/1.45 "Helvetica Neue", Arial, sans-serif; color: #1d1d1f; margin: 0; }
  .sheet { position: relative; padding: 4mm 2mm; }
  .wm { position: fixed; top: 42%; left: 8%; transform: rotate(-24deg); font-size: 46pt; color: rgba(194,65,12,.10); font-weight: 800; letter-spacing: 4px; white-space: nowrap; }
  header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1d1d1f; padding-bottom: 8px; }
  .brand { font-size: 15pt; font-weight: 800; letter-spacing: .3px; }
  .muted { color: #5c6168; font-size: 8.5pt; }
  h1 { font-size: 13pt; margin: 14px 0 6px; letter-spacing: .5px; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0 12px; }
  th, td { border: 1px solid #c9c6bd; padding: 5px 7px; text-align: left; vertical-align: top; }
  th { background: #f1efe8; font-weight: 600; font-size: 9pt; }
  td.n, th.n { text-align: right; font-variant-numeric: tabular-nums; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 18px; margin: 8px 0; }
  .box { border: 1px solid #c9c6bd; padding: 7px 9px; }
  .stamp { position: absolute; right: 18mm; top: 150mm; border: 3px solid #b42318; color: #b42318; padding: 6px 12px; font-weight: 800; font-size: 16pt; transform: rotate(8deg); letter-spacing: 2px; }
  .stamp small { display: block; font-size: 7.5pt; font-weight: 600; letter-spacing: .5px; }
  footer { margin-top: 16px; border-top: 1px solid #c9c6bd; padding-top: 6px; }
  .sign { margin-top: 26px; display: flex; gap: 40px; }
  .sign div { border-top: 1px solid #1d1d1f; padding-top: 4px; min-width: 180px; font-size: 9pt; }
`;

function page(title: string, body: string, watermark = "ÖRNEK · KURGUSAL · SAMPLE") {
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>${title}</title><style>${css}</style></head>
<body><div class="wm">${watermark}</div><div class="sheet">${body}</div></body></html>`;
}

function gasInvoice(d: SampleDocument) {
  const line = d.lines[0];
  const [y, m] = line.month.split("-");
  const days = new Date(Number(y), Number(m), 0).getDate();
  const kwh = gasKwh(line.quantity, line.gcvKcalPerSm3);
  const unit = 1.4215;
  const net = kwh * unit;
  const copy = d.id.endsWith("-copy");
  const start = 48_210_000 + Number(m) * 1_000_000;
  return page(
    d.title,
    `${copy ? `<div class="stamp">KOPYA<small>Tekrar gönderim · ${tr(12)}.${String(Number(m) + 1).padStart(2, "0")}.${y}</small></div>` : ""}
    <header><div><div class="brand">Körfez Gaz Dağıtım A.Ş.</div><div class="muted">Kurgusal şirket · Fictional company<br>Kocaeli Bölge Müdürlüğü · Vergi No 0000000000 (örnek)</div></div>
    <div class="muted" style="text-align:right">e-Fatura<br>ETTN 6f1c-${d.documentNumber.slice(-4)}-örnek</div></header>
    <h1>DOĞAL GAZ FATURASI</h1>
    <div class="grid">
      <div class="box"><b>Fatura No:</b> ${d.documentNumber}<br><b>Fatura Tarihi:</b> 05.${String(Number(m) + 1).padStart(2, "0")}.${y}<br><b>Tüketim Dönemi:</b> 01.${m}.${y} – ${days}.${m}.${y}</div>
      <div class="box"><b>Abone:</b> ${installation.operator.replace(" (fictional)", "")}<br><b>Tesis:</b> Kocaeli çelikhane ve sıcak haddehane<br><b>Sayaç No:</b> KGD-RMS-44817 · Abone No 9004417</div>
    </div>
    <table>
      <tr><th>Açıklama</th><th class="n">İlk endeks (Sm³)</th><th class="n">Son endeks (Sm³)</th><th class="n">Tüketim (Sm³)</th></tr>
      <tr><td>Doğal gaz tüketimi — sanayi, kademe 3</td><td class="n">${tr(start)}</td><td class="n">${tr(start + line.quantity)}</td><td class="n"><b>${tr(line.quantity)}</b></td></tr>
    </table>
    <table>
      <tr><th>Hesaplama</th><th class="n">Değer</th></tr>
      <tr><td>Ortalama Üst Isıl Değer (kcal/Sm³)</td><td class="n">${tr(line.gcvKcalPerSm3 ?? 0)}</td></tr>
      <tr><td>Enerji (kWh) = Sm³ × ÜID × 4,1868 / 3600</td><td class="n">${tr(kwh)}</td></tr>
      <tr><td>Birim fiyat (TL/kWh)</td><td class="n">${tr(unit, 4)}</td></tr>
      <tr><td>Enerji bedeli (TL)</td><td class="n">${tr(net, 2)}</td></tr>
      <tr><td>KDV %20 (TL)</td><td class="n">${tr(net * 0.2, 2)}</td></tr>
      <tr><th>Ödenecek Tutar (TL)</th><th class="n">${tr(net * 1.2, 2)}</th></tr>
    </table>
    <footer class="muted">Bu belge Ingot demosu için üretilmiş kurgusal bir örnektir; gerçek bir faturayı temsil etmez. · This is a fictional sample made for the Ingot demo.</footer>`,
  );
}

function electricity(d: SampleDocument) {
  const rows = d.lines
    .map((l) => {
      const m = l.month.split("-")[1];
      return `<tr><td>${AYLAR[m]} 2026</td><td class="n">${tr(l.quantity)}</td><td class="n">${tr(l.quantity * 0.21)}</td><td class="n">${tr(l.quantity * 1000 * 2.684, 2)}</td></tr>`;
    })
    .join("");
  const total = d.lines.reduce((s, l) => s + l.quantity, 0);
  return page(
    d.title,
    `<header><div><div class="brand">Kocaeli Enerji Perakende A.Ş.</div><div class="muted">Kurgusal şirket · Fictional company<br>Serbest tüketici hizmetleri</div></div>
    <div class="muted" style="text-align:right">Belge No ${d.documentNumber}<br>Düzenleme 07.10.2026</div></header>
    <h1>ELEKTRİK TÜKETİMİ DÖNEMSEL ÖZET — 2026 / 3. ÇEYREK</h1>
    <div class="grid"><div class="box"><b>Müşteri:</b> ${installation.operator.replace(" (fictional)", "")}<br><b>Tesis:</b> Kocaeli çelikhane ve sıcak haddehane (tüm saha)</div>
    <div class="box"><b>Bağlantı:</b> 154 kV iletim, şebekeden alım<br><b>Sayaç:</b> TM-154-0981 (çift yönlü, saatlik)</div></div>
    <table><tr><th>Dönem</th><th class="n">Aktif enerji (MWh)</th><th class="n">Reaktif (MVArh)</th><th class="n">Tutar (TL, KDV hariç)</th></tr>${rows}
    <tr><th>Toplam</th><th class="n">${tr(total)}</th><th class="n">${tr(total * 0.21)}</th><th class="n">${tr(total * 1000 * 2.684, 2)}</th></tr></table>
    <p class="muted">Tesiste öz üretim yoktur; YEK-G belgesi bu dönemde satın alınmamıştır.</p>
    <footer class="muted">Kurgusal örnek belge — Ingot demosu. · Fictional sample document for the Ingot demo.</footer>`,
  );
}

function productionReport(d: SampleDocument) {
  const months = ["2026-07", "2026-08", "2026-09"] as const;
  const row = (label: string, key: keyof typeof production, digits = 0) => {
    const vals = months.map((m) => production[key][m]);
    return `<tr><td>${label}</td>${vals.map((v) => `<td class="n">${tr(v, digits)}</td>`).join("")}<td class="n"><b>${tr(vals.reduce((a, b) => a + b, 0), digits)}</b></td></tr>`;
  };
  return page(
    d.title,
    `<header><div><div class="brand">Marmara Demo Steel A.Ş.</div><div class="muted">Kurgusal şirket · Fictional company<br>Kocaeli çelikhane (EAF) ve sıcak haddehane</div></div>
    <div class="muted" style="text-align:right">Rapor No ${d.documentNumber}<br>Revizyon 0 · 06.10.2026</div></header>
    <h1>ÜRETİM VE TÜKETİM RAPORU — 2026 / 3. ÇEYREK</h1>
    <p class="muted">Kaynak: MES üretim kayıtları, kantar tartımları ve stok sayımı (çeyrek sonu stok farkları dahil).</p>
    <table><tr><th>Kalem</th><th class="n">Temmuz</th><th class="n">Ağustos</th><th class="n">Eylül</th><th class="n">Toplam</th></tr>
      <tr><th colspan="5">Üretim (ton)</th></tr>
      ${row("Sıvı çelik (slab) üretimi", "crude_steel")}
      ${row("Sıcak haddelenmiş rulo (SHR), < 3 mm, GTİP 7208.39", "hot_rolled")}
      <tr><th colspan="5">Şarj ve sarf malzemeleri (ton)</th></tr>
      ${row("Hurda şarjı (tüketici sonrası ve üretim hurdası)", "scrap")}
      ${row("Pik demir şarjı (DN-2026-0642 partisinden)", "pig_iron")}
      ${row("Grafit elektrot tüketimi", "electrodes", 1)}
      ${row("Şarj karbonu — antrasit, sabit karbon %86", "charge_carbon")}
      ${row("Ham dolomit (CaMg(CO₃)₂) şarjı", "carbonates")}
    </table>
    <p class="muted">Not: Haddehane ısıtma fırını doğal gaz ile çalışır; çelikhanede doğal gaz kullanılmamaktadır. Elektrik tüketimi ayrı özet belgededir.</p>
    <div class="sign"><div>Üretim Müdürü<br>A. Demir (kurgusal)</div><div>Enerji Yöneticisi<br>S. Kaya (kurgusal)</div></div>
    <footer class="muted">Kurgusal örnek belge — Ingot demosu. · Fictional sample document for the Ingot demo.</footer>`,
  );
}

function deliveryNote(d: SampleDocument) {
  return page(
    d.title,
    `<header><div><div class="brand">Demo Gusa Ltda.</div><div class="muted">Fictional company · Minas Gerais, Brazil<br>Blast furnace 7 · Merchant pig iron</div></div>
    <div class="muted" style="text-align:right">Nota de entrega / Delivery note<br><b style="font-size:11pt;color:#1d1d1f">${d.documentNumber}</b></div></header>
    <h1>DELIVERY NOTE</h1>
    <div class="grid"><div class="box"><b>Buyer:</b> ${installation.operator.replace(" (fictional)", "")}, Kocaeli, Türkiye<br><b>Port of discharge:</b> Kocaeli<br><b>Vessel:</b> MV Demo Trader (fictional)</div>
    <div class="box"><b>Date:</b> 18 June 2026<br><b>Bill of lading:</b> DEMO-BL-2026-118<br><b>Incoterm:</b> CFR Kocaeli</div></div>
    <table><tr><th>Product</th><th>CN code</th><th class="n">Net quantity</th></tr>
    <tr><td>Non-alloy pig iron, ≤ 0.5 % P, ≥ 0.4 % Mn, ≤ 1 % Si, in pigs</td><td>7201 10 11</td><td class="n"><b>${en(supplier.deliveredTonnes, 3)} t</b></td></tr></table>
    <div class="box"><b>CBAM information</b><br>Production period: ${supplier.period.label} (blast furnace 7).<br>
    Embedded emissions are carried by a verified statement on the Ingot ledger; the allocation for this delivery uses this delivery note number as its shipment reference.</div>
    <footer class="muted">Fictional sample document for the Ingot demo; it does not represent a real shipment.</footer>`,
    "SAMPLE · FICTIONAL",
  );
}

const render: Record<SampleDocument["kind"], (d: SampleDocument) => string> = {
  gas_invoice: gasInvoice,
  electricity_invoice: electricity,
  production_report: productionReport,
  delivery_note: deliveryNote,
};

mkdirSync(OUT, { recursive: true });
const work = mkdtempSync(join(tmpdir(), "ingot-samples-"));
for (const d of documents) {
  const html = join(work, d.file.replace(/\.pdf$/, ".html"));
  writeFileSync(html, render[d.kind](d));
  const url = pathToFileURL(html).href;
  execFileSync(CHROME, ["--headless=new", "--disable-gpu", "--no-pdf-header-footer", `--print-to-pdf=${join(OUT, d.file)}`, url], { stdio: "ignore" });
  execFileSync(CHROME, ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--window-size=794,1123", `--screenshot=${join(OUT, d.file.replace(/\.pdf$/, ".png"))}`, url], { stdio: "ignore" });
  console.log(`${OUT}/${d.file}`);
}
