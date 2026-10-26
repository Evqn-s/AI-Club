import { chromium } from "playwright";
import { createServer } from "vite";

const server = await createServer({
  server: { port: 5199 },
  define: {
    "import.meta.env.VITE_SUPABASE_URL": JSON.stringify("https://mock.local"),
    "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify("mock-anon-key"),
  },
});
await server.listen();

const browser = await chromium.launch();
const results = [];

// Mock Supabase REST responses so the calendar renders with real event data.
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

const mockRest = async (route) => {
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
};

for (const vp of [
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
]) {
  const page = await browser.newPage({ viewport: vp });
  const reqs = [];
  page.on("request", (r) => {
    if (!r.url().includes("localhost:5199")) reqs.push(r.method() + " " + r.url());
  });
  await page.route("**/rest/v1/**", mockRest);
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("http://localhost:5199/calendar", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);

  const measure = async (label) => {
    const info = await page.evaluate(() => {
      const doc = document.documentElement;
      const body = document.body;
      const grid = document.querySelectorAll("[data-calendar-grid]");
      const rowsEl = grid[grid.length - 1];
      const rows = rowsEl ? [...rowsEl.children] : [];
      const tops = rows.map((r) => r.getBoundingClientRect().top);
      const pitch =
        tops.length > 1 ? Math.round((tops[1] - tops[0]) * 100) / 100 : null;
      const lastRowBottom = rows.length
        ? Math.round(rows[rows.length - 1].getBoundingClientRect().bottom * 100) / 100
        : null;
      const lastCell = rows.length
        ? rows[rows.length - 1].querySelector("[data-day-cell], div")
        : null;
      const main = document.querySelector("main");
      const page = document.querySelector("[data-page='calendar']");
      const weekCols = document.querySelectorAll("[data-week-col]");
      const listScroller = document.querySelector("[data-list-scroller]");
      const cards = document.querySelectorAll("[data-event-item]");
      return {
        docScrollH: doc.scrollHeight,
        docClientH: doc.clientHeight,
        bodyScrollH: body.scrollHeight,
        verticalOverflow: doc.scrollHeight - doc.clientHeight,
        rowCount: rows.length,
        pitch,
        lastRowBottom,
        lastRowVisible:
          lastRowBottom !== null ? lastRowBottom <= window.innerHeight + 1 : null,
        mainOverflow: (() => {
          const m = document.querySelector("main");
          return m ? m.scrollHeight - m.clientHeight : null;
        })(),
        pageBottom: page ? Math.round(page.getBoundingClientRect().bottom) : null,
        pageHeight: page ? Math.round(page.getBoundingClientRect().height) : null,
        pageFits: page
          ? page.getBoundingClientRect().bottom <= window.innerHeight + 1
          : null,
        weekCols: weekCols.length,
        weekColBottom: weekCols.length
          ? Math.round(
              Math.max(
                ...[...weekCols].map((c) => c.getBoundingClientRect().bottom)
              )
            )
          : null,
        listScrollH: listScroller ? listScroller.scrollHeight : null,
        listClientH: listScroller ? listScroller.clientHeight : null,
        listFits:
          listScroller && listScroller.scrollHeight > listScroller.clientHeight
            ? "scrolls"
            : "fits",
        cardCount: cards.length,
        lastCardBottom: cards.length
          ? Math.round(
              Math.max(
                ...[...cards].map((c) => c.getBoundingClientRect().bottom)
              )
            )
          : null,
        clipped:
          listScroller && cards.length
            ? [...cards].some(
                (c) =>
                  c.getBoundingClientRect().bottom >
                  listScroller.getBoundingClientRect().bottom + 1
              )
            : null,
        scrollable:
          listScroller && listScroller.scrollHeight > listScroller.clientHeight
            ? (() => {
                const before = listScroller.scrollTop;
                listScroller.scrollTop = 99999;
                const after = listScroller.scrollTop;
                listScroller.scrollTop = before;
                return after > before;
              })()
            : null,
      };
    });
    results.push({ vp: `${vp.width}x${vp.height}`, label, ...info, errors: [...errors], reqs: [...new Set(reqs)] });
  };

  await measure("month");
  await page.screenshot({ path: `shots/${vp.width}-month.png` });

  await page.getByRole("button", { name: /week/i }).first().click();
  await page.waitForTimeout(1600);
  await measure("week");
  await page.screenshot({ path: `shots/${vp.width}-week.png` });

  await page.getByRole("button", { name: /list/i }).first().click();
  await page.waitForTimeout(1200);
  await measure("list");
  await page.screenshot({ path: `shots/${vp.width}-list.png` });

  await page.getByRole("button", { name: /month/i }).first().click();
  await page.waitForTimeout(1600);
  await measure("month-again");
  await page.screenshot({ path: `shots/${vp.width}-month2.png` });

  // --- Animation accuracy: capture mid-transition row geometry ---
  // Captures the FOLD (month -> week): the month rows must collapse into the
  // week that is displayed afterwards, travelling their full displacement
  // before the grid unmounts.
  const anim = await page.evaluate(async () => {
    const grid = document.querySelectorAll("[data-calendar-grid]");
    const rowsEl = grid[grid.length - 1];
    const readRows = () => {
      // Re-query every frame: the month grid unmounts when the mode switches,
      // so a cached reference would go stale mid-transition.
      const grids = document.querySelectorAll("[data-calendar-grid]");
      const el = grids[grids.length - 1];
      if (!el) return [];
      const out = [];
      for (const r of el.children) {
        const cs = getComputedStyle(r);
        const m = new DOMMatrix(cs.transform);
        out.push({
          top: Math.round(r.getBoundingClientRect().top * 100) / 100,
          ty: Math.round(m.m42 * 100) / 100,
          op: Number(cs.opacity).toFixed(2),
          d: r.dataset.rowDelta,
          p: r.dataset.rowPitch,
          a: r.dataset.rowActive,
        });
      }
      return out;
    };
    // Measured pitch straight from the DOM (offsetTop based, like the app)
    const domPitch =
      rowsEl.children.length > 1
        ? rowsEl.children[1].offsetTop - rowsEl.children[0].offsetTop
        : 0;
    const before = readRows();
    const btn = [...document.querySelectorAll("button")].find(
      (b) => b.textContent && b.textContent.trim() === "Week"
    );
    const t0 = performance.now();
    btn.click();
    const frames = [];
    await new Promise((resolve) => {
      const tick = () => {
        const t = Math.round(performance.now() - t0);
        frames.push({ t, rows: readRows() });
        if (t < 700) requestAnimationFrame(tick);
        else resolve();
      };
      requestAnimationFrame(tick);
    });
    // Row metadata must be read DURING the fold: at rest the rows carry
    // pitch=0 (no displacement is computed outside a mode switch).
    const foldFrame = frames.find((f) => f.rows.length && f.rows[0].d !== undefined);
    const rowMeta = (foldFrame?.rows ?? []).map((r) => ({
      delta: r.d,
      pitch: r.p,
      active: r.a,
    }));
    // Max |translateY| seen per row across ALL frames. Computed as a running
    // max, because the final frames have no rows (the month grid unmounts once
    // the fold completes) and a plain reduce would end on an empty array.
    const maxTy = [];
    for (const f of frames) {
      f.rows.forEach((r, i) => {
        maxTy[i] = Math.max(maxTy[i] ?? 0, Math.abs(r.ty));
      });
    }
    // The row that the fold collapses into (data-row-active="true").
    const activeRowIndex = rowMeta.findIndex((r) => r.active === "true");
    // Full-travel check: every non-active row must reach |delta| * pitch.
    // Tolerance of 2px: the sampler reads at rAF granularity, so the last
    // sample before the grid unmounts can land a fraction of a pixel short of
    // the (eased) end value.
    const reached = rowMeta.map((meta, i) => {
      const target = Math.abs(Number(meta.delta)) * Number(meta.pitch || domPitch);
      return {
        delta: Number(meta.delta),
        target: Math.round(target),
        reached: Math.round(maxTy[i] ?? 0),
        ok: target === 0 ? true : (maxTy[i] ?? 0) >= target - 2,
      };
    });
    // The fold must not cut short: the grid has to stay mounted until every
    // row has finished travelling. The longest row needs
    //   latency + max(|delta|) * stagger + duration
    // milliseconds; the grid must still be mounted at that point.
    const longestDelay = Math.max(...rowMeta.map((m) => Math.abs(Number(m.delta)))) * 20;
    const expectedEnd = 70 + longestDelay + 280; // latency + delay + duration
    const unmountAt = frames.find((f) => f.rows.length === 0)?.t ?? Infinity;
    // Last frame in which the month grid was still mounted with all its rows.
    const lastRowFrame = frames.map((f) => f.rows.length).lastIndexOf(rowMeta.length);
    return {
      domPitch,
      rowMeta,
      activeRowIndex,
      reached,
      allRowsTravelled: reached.length > 0 && reached.every((r) => r.ok),
      gridUnmountFrame: frames.findIndex((f) => f.rows.length === 0),
      lastRowFrame,
      expectedEnd,
      unmountAt,
      notCutShort: unmountAt >= expectedEnd,
      before,
      frames,
      maxTy,
    };
  });
  results.push({ vp: `${vp.width}x${vp.height}`, label: "anim", ...anim });

  // --- Unfold accuracy: week -> month ---
  // The month rows must fan OUT from the week that was on screen, again
  // travelling their full displacement before the animation settles.
  const unfold = await page.evaluate(async () => {
    const readRows = () => {
      const grids = document.querySelectorAll("[data-calendar-grid]");
      const el = grids[grids.length - 1];
      if (!el) return [];
      const out = [];
      for (const r of el.children) {
        const cs = getComputedStyle(r);
        const m = new DOMMatrix(cs.transform);
        out.push({
          top: Math.round(r.getBoundingClientRect().top * 100) / 100,
          ty: Math.round(m.m42 * 100) / 100,
          op: Number(cs.opacity).toFixed(2),
          d: r.dataset.rowDelta,
          p: r.dataset.rowPitch,
          a: r.dataset.rowActive,
        });
      }
      return out;
    };
    const btn = [...document.querySelectorAll("button")].find(
      (b) => b.textContent && b.textContent.trim() === "Month"
    );
    const t0 = performance.now();
    btn.click();
    const frames = [];
    await new Promise((resolve) => {
      const tick = () => {
        const t = Math.round(performance.now() - t0);
        frames.push({ t, rows: readRows() });
        if (t < 1000) requestAnimationFrame(tick);
        else resolve();
      };
      requestAnimationFrame(tick);
    });
    // The unfold frame is the one where the rows carry their displacement.
    const unfoldFrame = frames.find(
      (f) => f.rows.length && f.rows[0].d !== undefined && Number(f.rows[0].p) > 0
    );
    const rowMeta = (unfoldFrame?.rows ?? []).map((r) => ({
      delta: r.d,
      pitch: r.p,
      active: r.a,
    }));
    const maxTy = [];
    for (const f of frames) {
      f.rows.forEach((r, i) => {
        maxTy[i] = Math.max(maxTy[i] ?? 0, Math.abs(r.ty));
      });
    }
    const reached = rowMeta.map((meta, i) => {
      const target = Math.abs(Number(meta.delta)) * Number(meta.pitch || 0);
      return {
        delta: Number(meta.delta),
        target: Math.round(target),
        reached: Math.round(maxTy[i] ?? 0),
        ok: target === 0 ? true : (maxTy[i] ?? 0) >= target - 2,
      };
    });
    // The unfold must also outlast its longest staggered row:
    //   latency + max(|delta|) * 50ms stagger + 360ms duration
    const longestDelay = Math.max(...rowMeta.map((m) => Math.abs(Number(m.delta)))) * 50;
    const expectedEnd = 70 + longestDelay + 360;
    const settledAt =
      frames.find((f) => f.rows.length && f.rows.every((r) => Math.abs(r.ty) < 0.5))?.t ?? Infinity;
    return {
      rowMeta,
      activeRowIndex: rowMeta.findIndex((r) => r.active === "true"),
      reached,
      allRowsTravelled: reached.length > 0 && reached.every((r) => r.ok),
      expectedEnd,
      settledAt,
      notCutShort: settledAt >= expectedEnd,
      frames,
      maxTy,
    };
  });
  results.push({ vp: `${vp.width}x${vp.height}`, label: "unfold", ...unfold });

  await page.close();
}

await browser.close();
await server.close();
console.log(JSON.stringify(results, null, 2));

