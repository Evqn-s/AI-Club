import { chromium } from "playwright";
import { createServer } from "vite";

// Reproduce the validator's fold scenario exactly, but sample cheaply.
const server = await createServer({
  server: { port: 5201 },
  define: {
    "import.meta.env.VITE_SUPABASE_URL": JSON.stringify("https://mock.local"),
    "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify("mock-anon-key"),
  },
});
await server.listen();

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
const mockEvents = (() => {
  const base = new Date();
  const mk = (offset, title, time, cat) => {
    const d = new Date(base);
    d.setDate(d.getDate() + offset);
    return {
      id: `e${offset}`,
      title,
      date: d.toISOString().slice(0, 10),
      time,
      location: "Room 101",
      description: "A long description for the event to test card heights in the list view.",
      category: cat,
    };
  };
  return [
    mk(-9, "AI Builders Workshop", "17:00", "Workshop"),
    mk(-5, "Model Evaluation Deep Dive", "18:30", "Talk"),
    mk(-3, "Neural Networks Q&A", "19:00", "Discussion"),
    mk(-1, "Agents in Production", "17:30", "Workshop"),
    mk(0, "Weekly Club Sync", "18:00", "Meeting"),
    mk(1, "Reinforcement Learning Jam", "19:00", "Jam"),
    mk(2, "Prompt Engineering Lab", "17:00", "Lab"),
    mk(4, "Open Source Contribution Day", "13:00", "Community"),
    mk(6, "Ethics of AI Roundtable", "18:00", "Panel"),
    mk(9, "Hackathon Kickoff", "10:00", "Event"),
    mk(12, "Data Viz Masterclass", "17:00", "Workshop"),
    mk(15, "Paper Reading: Attention", "19:00", "Reading"),
  ];
})();
await page.route("**/rest/v1/**", async (route) => {
  const url = route.request().url();
  if (url.includes("/rest/v1/events")) {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(mockEvents),
    });
    return;
  }
  await route.continue();
});
await page.goto("http://localhost:5201/calendar", { waitUntil: "networkidle" });
await page.waitForTimeout(1500);

// Same sequence the validator performs before capturing the fold.
await page.getByRole("button", { name: /week/i }).first().click();
await page.waitForTimeout(1600);
await page.getByRole("button", { name: /list/i }).first().click();
await page.waitForTimeout(1200);
await page.getByRole("button", { name: /month/i }).first().click();
await page.waitForTimeout(1600);

// Dump every [data-calendar-grid] element during the fold so we can see WHICH
// element the validator ends up sampling, and when the DOM switches views.
const res = await page.evaluate(async () => {
  const out = [];
  const events = [];
  window.addEventListener("calendar:transition-start", () =>
    events.push(["start", Math.round(performance.now())])
  );
  window.addEventListener("calendar:transition-end", () =>
    events.push(["end", Math.round(performance.now())])
  );
  const btn = [...document.querySelectorAll("button")].find(
    (b) => b.textContent && b.textContent.trim() === "Week"
  );
  const t0 = performance.now();
  btn.click();
  await new Promise((resolve) => {
    const tick = () => {
      const t = Math.round(performance.now() - t0);
      const grids = [...document.querySelectorAll("[data-calendar-grid]")];
      const snap = grids.map((g, gi) => {
        const kids = [...g.children];
        const rows = kids.filter((k) => k.dataset.rowDelta !== undefined);
        return {
          gi,
          kids: kids.length,
          rows: rows.length,
          d: rows.map((r) => r.dataset.rowDelta).join("/"),
          p: rows.map((r) => r.dataset.rowPitch).join("/"),
          ty: rows.map((r) => {
            const m = new DOMMatrix(getComputedStyle(r).transform);
            return Math.round(m.m42 * 100) / 100;
          }).join("/"),
          op: rows.map((r) => getComputedStyle(r).opacity).join("/"),
        };
      });
      out.push({ t, n: grids.length, grids: snap });
      if (t > 1400) {
        resolve();
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  return { out, events, t0: Math.round(t0) };
});
console.log("=== events ===");
console.log(JSON.stringify(res.events));
console.log("=== grids ===");
for (const s of res.out) {
  console.log(s.t, "grids=" + s.n);
  for (const g of s.grids) {
    console.log(
      "   g" + g.gi,
      "kids=" + g.kids,
      "rows=" + g.rows,
      "d=" + g.d,
      "p=" + g.p,
      "ty=" + g.ty,
      "op=" + g.op
    );
  }
}
await browser.close();
await server.close();
