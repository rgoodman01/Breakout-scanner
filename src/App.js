import { useState, useEffect, useCallback, useRef } from "react";

const DEMO_STOCKS = [
  { ticker:"BNRG", price:4.82,  change:8.4,  rvol:4.2,  marketCap:180,  float:8.2,  atr:0.72, aboveVWAP:true,  aboveMa20:true,  aboveMa50:true,  gap:5.1,  consolidationDays:12, spread:1.1, hasEarnings:false, vol:2100000 },
  { ticker:"MVST", price:7.14,  change:12.1, rvol:6.8,  marketCap:420,  float:15.3, atr:0.94, aboveVWAP:true,  aboveMa20:true,  aboveMa50:false, gap:9.2,  consolidationDays:8,  spread:0.8, hasEarnings:false, vol:5400000 },
  { ticker:"CZWI", price:3.27,  change:5.6,  rvol:2.1,  marketCap:95,   float:4.1,  atr:0.38, aboveVWAP:false, aboveMa20:true,  aboveMa50:true,  gap:0,    consolidationDays:19, spread:1.8, hasEarnings:false, vol:630000  },
  { ticker:"FLNC", price:11.55, change:3.2,  rvol:3.5,  marketCap:870,  float:22.0, atr:0.88, aboveVWAP:true,  aboveMa20:true,  aboveMa50:true,  gap:2.1,  consolidationDays:6,  spread:0.5, hasEarnings:false, vol:1750000 },
  { ticker:"PRLD", price:9.03,  change:-1.2, rvol:0.9,  marketCap:310,  float:11.5, atr:0.61, aboveVWAP:false, aboveMa20:false, aboveMa50:false, gap:-2.0, consolidationDays:3,  spread:1.4, hasEarnings:true,  vol:270000  },
  { ticker:"SPGX", price:6.44,  change:14.7, rvol:9.1,  marketCap:240,  float:6.8,  atr:1.12, aboveVWAP:true,  aboveMa20:true,  aboveMa50:true,  gap:11.3, consolidationDays:15, spread:1.0, hasEarnings:false, vol:8200000 },
  { ticker:"HLIT", price:2.98,  change:7.8,  rvol:3.3,  marketCap:72,   float:3.2,  atr:0.44, aboveVWAP:true,  aboveMa20:true,  aboveMa50:false, gap:4.5,  consolidationDays:9,  spread:2.2, hasEarnings:false, vol:990000  },
  { ticker:"VERB", price:1.88,  change:21.3, rvol:12.4, marketCap:58,   float:2.1,  atr:0.31, aboveVWAP:true,  aboveMa20:true,  aboveMa50:true,  gap:18.0, consolidationDays:22, spread:3.1, hasEarnings:false, vol:6200000 },
  { ticker:"MTTR", price:5.61,  change:2.9,  rvol:1.7,  marketCap:1100, float:45.0, atr:0.55, aboveVWAP:true,  aboveMa20:false, aboveMa50:false, gap:0,    consolidationDays:4,  spread:0.6, hasEarnings:false, vol:850000  },
  { ticker:"ITRM", price:13.20, change:6.3,  rvol:4.7,  marketCap:650,  float:18.6, atr:1.05, aboveVWAP:true,  aboveMa20:true,  aboveMa50:true,  gap:3.8,  consolidationDays:11, spread:0.7, hasEarnings:false, vol:3100000 },
];

const DEFAULT_CRITERIA = {
  minPrice:1, maxPrice:20,
  minMarketCap:50, maxMarketCap:2000,
  minRvol:2.0, minVol:500000,
  minChange:3, maxChange:20,
  minFloat:1, minAtr:0.50,
  requireAboveVWAP:true, requireAboveMa20:true,
  excludeEarnings:true, maxSpread:3.0,
  minConsolidationDays:5,
};

const ALERT_THRESHOLDS = { rvol:5, change:10, gap:8 };

function passesFilter(s, c) {
  if (s.price < c.minPrice || s.price > c.maxPrice) return false;
  if (s.marketCap < c.minMarketCap || s.marketCap > c.maxMarketCap) return false;
  if (s.rvol < c.minRvol) return false;
  if (s.vol < c.minVol) return false;
  if (s.change < c.minChange || s.change > c.maxChange) return false;
  if (s.float < c.minFloat) return false;
  if (s.atr < c.minAtr) return false;
  if (c.requireAboveVWAP && !s.aboveVWAP) return false;
  if (c.requireAboveMa20 && !s.aboveMa20) return false;
  if (c.excludeEarnings && s.hasEarnings) return false;
  if (s.spread > c.maxSpread) return false;
  if (s.consolidationDays < c.minConsolidationDays) return false;
  return true;
}

function scoreStock(s) {
  let n = 0;
  if (s.rvol >= 5) n += 30; else if (s.rvol >= 3) n += 20; else n += 10;
  if (s.change >= 10) n += 25; else if (s.change >= 5) n += 15; else n += 8;
  if (s.gap >= 8) n += 20; else if (s.gap >= 4) n += 12; else if (s.gap > 0) n += 5;
  if (s.aboveVWAP) n += 10;
  if (s.aboveMa20) n += 8;
  if (s.aboveMa50) n += 7;
  if (s.consolidationDays >= 10) n += 10; else if (s.consolidationDays >= 5) n += 5;
  return Math.min(n, 100);
}

function fmtVol(v) {
  if (v >= 1e6) return (v/1e6).toFixed(1)+"M";
  if (v >= 1e3) return (v/1e3).toFixed(0)+"K";
  return v;
}

async function requestNotifPermission() {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  return (await Notification.requestPermission()) === "granted";
}

function fireNotification(title, body) {
  if (Notification.permission !== "granted") return;
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.ready.then(reg =>
      reg.showNotification(title, { body, icon:"/icon-192.png", vibrate:[200,100,200], tag:"breakout" })
    );
  }
}

const C = {
  bg:"#0b0e1a", surface:"#0e1122", border:"#1a2040",
  green:"#00e5a0", blue:"#00aaff", yellow:"#f5c842",
  red:"#ff4c6b", purple:"#8060ff",
  text:"#c8d0f0", muted:"#6b7db3", faint:"#3a4060",
};

const pill = color => ({
  fontSize:9, fontWeight:800, letterSpacing:"0.08em",
  padding:"2px 6px", borderRadius:4,
  background:color+"22", color, border:`1px solid ${color}44`,
});

function ScoreBar({ score }) {
  const color = score >= 75 ? C.green : score >= 50 ? C.yellow : C.red;
  return (
    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
      <div style={{ width:44, height:5, background:"#1e2235", borderRadius:3, overflow:"hidden" }}>
        <div style={{ width:`${score}%`, height:"100%", background:color, borderRadius:3 }} />
      </div>
      <span style={{ color, fontFamily:"monospace", fontSize:11, fontWeight:700 }}>{score}</span>
    </div>
  );
}

function Toggle({ value, onChange, label }) {
  return (
    <label style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12, cursor:"pointer" }}>
      <div onClick={() => onChange(!value)} style={{
        width:36, height:20, borderRadius:10, flexShrink:0, position:"relative",
        background:value ? C.green : C.border, transition:"background 0.2s",
      }}>
        <div style={{
          position:"absolute", top:3, left:value ? 19 : 3,
          width:14, height:14, borderRadius:"50%", background:"#fff", transition:"left 0.2s",
        }} />
      </div>
      <span style={{ fontSize:12, color:C.muted }}>{label}</span>
    </label>
  );
}

function NumField({ label, value, step, onChange }) {
  return (
    <div style={{ marginBottom:14 }}>
      <div style={{ fontSize:11, color:C.muted, marginBottom:5, fontWeight:600 }}>{label}</div>
      <input type="number" step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{
          width:"100%", background:"#131829", border:`1px solid ${C.border}`,
          borderRadius:7, padding:"8px 12px", color:C.text, fontSize:13,
          fontFamily:"monospace", outline:"none", boxSizing:"border-box",
        }}
      />
    </div>
  );
}

export default function App() {
  const [criteria, setCriteria]         = useState(DEFAULT_CRITERIA);
  const [results, setResults]           = useState([]);
  const [alerts, setAlerts]             = useState([]);
  const [alertLog, setAlertLog]         = useState([]);
  const [scanning, setScanning]         = useState(false);
  const [lastScan, setLastScan]         = useState(null);
  const [tab, setTab]                   = useState("scanner");
  const [sortKey, setSortKey]           = useState("score");
  const [sortDir, setSortDir]           = useState("desc");
  const [autoRefresh, setAutoRefresh]   = useState(false);
  const [notifEnabled, setNotifEnabled] = useState(typeof Notification !== "undefined" && Notification.permission === "granted");
  const seenAlerts = useRef(new Set());

  const runScan = useCallback(() => {
    setScanning(true);
    setTimeout(() => {
      const passed = DEMO_STOCKS
        .filter(s => passesFilter(s, criteria))
        .map(s => ({ ...s, score: scoreStock(s) }));
      const newAlerts = passed.filter(s =>
        s.rvol >= ALERT_THRESHOLDS.rvol ||
        s.change >= ALERT_THRESHOLDS.change ||
        s.gap >= ALERT_THRESHOLDS.gap
      );
      setResults(passed);
      setAlerts(newAlerts);
      setLastScan(new Date());
      setScanning(false);
      newAlerts.forEach(s => {
        if (!seenAlerts.current.has(s.ticker)) {
          seenAlerts.current.add(s.ticker);
          const reason = s.rvol >= ALERT_THRESHOLDS.rvol ? `RVOL ${s.rvol.toFixed(1)}x`
            : s.gap >= ALERT_THRESHOLDS.gap ? `Gap +${s.gap.toFixed(1)}%`
            : `+${s.change.toFixed(1)}% move`;
          fireNotification(`🔔 ${s.ticker} Breakout`, `${reason} · $${s.price.toFixed(2)}`);
          setAlertLog(prev => [{ ticker:s.ticker, reason, time:new Date(), price:s.price }, ...prev].slice(0,50));
        }
      });
    }, 600);
  }, [criteria]);

  useEffect(() => { runScan(); }, []);
  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(runScan, 30000);
    return () => clearInterval(id);
  }, [autoRefresh, runScan]);

  const handleEnableNotifs = async () => {
    const ok = await requestNotifPermission();
    setNotifEnabled(ok);
    if (ok) fireNotification("✅ Alerts enabled", "You'll be notified on breakouts.");
  };

  const sorted = [...results].sort((a, b) => {
    const av = a[sortKey] ?? 0, bv = b[sortKey] ?? 0;
    return sortDir === "desc" ? bv - av : av - bv;
  });

  const upd = (k, v) => setCriteria(p => ({ ...p, [k]:v }));

  const thStyle = {
    padding:"10px 10px", textAlign:"left", fontSize:10,
    fontWeight:700, letterSpacing:"0.08em", color:C.muted,
    textTransform:"uppercase", cursor:"pointer", whiteSpace:"nowrap",
    userSelect:"none", background:"#0b0e1a",
  };
  const tdStyle = { padding:"10px 10px", fontSize:12, borderTop:`1px solid ${C.border}` };

  const SortArrow = ({ col }) => sortKey === col
    ? <span style={{ color:C.green, marginLeft:2 }}>{sortDir==="desc"?"↓":"↑"}</span>
    : <span style={{ color:C.faint, marginLeft:2 }}>↕</span>;

  return (
    <div style={{ minHeight:"100vh", background:C.bg, color:C.text, fontFamily:"'Inter','Segoe UI',sans-serif" }}>

      {/* Header */}
      <div style={{
        background:C.surface, borderBottom:`1px solid ${C.border}`,
        padding:"0 16px", display:"flex", alignItems:"center", gap:12,
        position:"sticky", top:0, zIndex:100,
      }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, padding:"12px 0", flex:1 }}>
          <div style={{
            width:30, height:30, background:"linear-gradient(135deg,#00e5a0,#00aaff)",
            borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14,
          }}>⚡</div>
          <div>
            <div style={{ fontWeight:800, fontSize:14, color:"#fff" }}>BreakoutScanner</div>
            <div style={{ fontSize:9, color:C.faint, letterSpacing:"0.1em" }}>SMALL CAP · MOMENTUM</div>
          </div>
        </div>
        <button onClick={runScan} disabled={scanning} style={{
          padding:"7px 14px",
          background: scanning ? "#1a2040" : "linear-gradient(135deg,#00e5a0,#00c8ff)",
          border:"none", borderRadius:7,
          color: scanning ? C.faint : "#0b0e1a",
          fontWeight:700, fontSize:12, cursor: scanning ? "not-allowed" : "pointer",
        }}>{scanning ? "Scanning…" : "▶ Scan"}</button>
      </div>

      {/* Stats */}
      <div style={{ display:"flex", gap:8, padding:"12px 16px" }}>
        {[
          { label:"Found",    val:results.length, accent:C.green },
          { label:"Alerts",   val:alerts.length,  accent:C.red   },
          { label:"Avg RVOL", val:results.length ? (results.reduce((a,b)=>a+b.rvol,0)/results.length).toFixed(1)+"x":"—", accent:C.yellow },
          { label:"Top",      val:results.length ? results.reduce((a,b)=>b.change>a.change?b:a).ticker:"—", accent:C.blue },
        ].map(s => (
          <div key={s.label} style={{ flex:1, background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, padding:"10px 10px" }}>
            <div style={{ fontSize:9, color:C.faint, textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:3 }}>{s.label}</div>
            <div style={{ fontSize:18, fontWeight:800, color:s.accent, fontFamily:"monospace" }}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display:"flex", padding:"0 16px", borderBottom:`1px solid ${C.border}` }}>
        {["scanner","criteria","alerts"].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding:"10px 16px", border:"none", background:"transparent",
            cursor:"pointer", fontSize:12, fontWeight:600, textTransform:"capitalize",
            color: tab===t ? C.green : C.muted,
            borderBottom: tab===t ? `2px solid ${C.green}` : "2px solid transparent",
          }}>
            {t}
            {t==="alerts" && alertLog.length > 0 && (
              <span style={{ marginLeft:5, background:C.red, color:"#fff", borderRadius:10, padding:"1px 5px", fontSize:9 }}>{alertLog.length}</span>
            )}
          </button>
        ))}
        <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:8, fontSize:11, color:C.faint }}>
          <label style={{ display:"flex", alignItems:"center", gap:4, cursor:"pointer" }}>
            <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} style={{ accentColor:C.green }} />
            30s
          </label>
          {lastScan && <span>{lastScan.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</span>}
        </div>
      </div>

      <div style={{ padding:"16px" }}>

        {/* SCANNER */}
        {tab === "scanner" && (
          results.length === 0 && !scanning ? (
            <div style={{ textAlign:"center", padding:60, color:C.faint }}>
              <div style={{ fontSize:36, marginBottom:12 }}>🔍</div>
              <div style={{ fontWeight:700 }}>No stocks matched</div>
              <div style={{ fontSize:13, marginTop:6 }}>Loosen filters in Criteria tab</div>
            </div>
          ) : (
            <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:10, overflowX:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse", minWidth:520 }}>
                <thead>
                  <tr>
                    {[
                      {key:"ticker",label:"Ticker"},{key:"price",label:"Price"},
                      {key:"change",label:"Chg%"},{key:"rvol",label:"RVOL"},
                      {key:"vol",label:"Vol"},{key:"gap",label:"Gap"},
                      {key:"score",label:"Score"},{key:"flags",label:"Flags"},
                    ].map(col => (
                      <th key={col.key} style={thStyle} onClick={() => {
                        if (col.key==="flags") return;
                        if (sortKey===col.key) setSortDir(d=>d==="desc"?"asc":"desc");
                        else { setSortKey(col.key); setSortDir("desc"); }
                      }}>
                        {col.label}{col.key!=="flags" && <SortArrow col={col.key}/>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map(stock => {
                    const isAlert = alerts.find(a=>a.ticker===stock.ticker);
                    return (
                      <tr key={stock.ticker} style={{ background:isAlert?"rgba(255,76,107,0.04)":"transparent" }}>
                        <td style={{ ...tdStyle, fontWeight:800, color:"#fff", letterSpacing:"0.05em" }}>
                          {isAlert && <span style={{ color:C.red, marginRight:4 }}>🔔</span>}
                          {stock.ticker}
                        </td>
                        <td style={{ ...tdStyle, fontFamily:"monospace" }}>${stock.price.toFixed(2)}</td>
                        <td style={{ ...tdStyle, fontFamily:"monospace", fontWeight:700, color:stock.change>=10?C.green:stock.change>=5?C.yellow:C.text }}>+{stock.change.toFixed(1)}%</td>
                        <td style={{ ...tdStyle, fontFamily:"monospace", fontWeight:700, color:stock.rvol>=5?C.green:stock.rvol>=3?C.yellow:C.text }}>{stock.rvol.toFixed(1)}x</td>
                        <td style={{ ...tdStyle, fontFamily:"monospace", fontSize:11, color:C.muted }}>{fmtVol(stock.vol)}</td>
                        <td style={{ ...tdStyle, fontFamily:"monospace", color:stock.gap>=8?C.blue:C.text }}>{stock.gap>0?"+":""}{stock.gap.toFixed(1)}%</td>
                        <td style={tdStyle}><ScoreBar score={stock.score}/></td>
                        <td style={tdStyle}>
                          <div style={{ display:"flex", gap:3, flexWrap:"wrap" }}>
                            {stock.aboveVWAP && <span style={pill(C.green)}>VWAP</span>}
                            {stock.aboveMa20  && <span style={pill(C.blue)}>MA20</span>}
                            {stock.aboveMa50  && <span style={pill(C.purple)}>MA50</span>}
                            {stock.gap >= 4   && <span style={pill(C.yellow)}>GAP</span>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        )}

        {/* CRITERIA */}
        {tab === "criteria" && (
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            {[
              { title:"Universe", fields:[
                {key:"minPrice",label:"Min Price ($)",step:0.5},
                {key:"maxPrice",label:"Max Price ($)",step:1},
                {key:"minMarketCap",label:"Min Mkt Cap ($M)",step:10},
                {key:"maxMarketCap",label:"Max Mkt Cap ($M)",step:100},
                {key:"minFloat",label:"Min Float (M shares)",step:0.5},
              ]},
              { title:"Volume", fields:[
                {key:"minRvol",label:"Min RVOL",step:0.1},
                {key:"minVol",label:"Min Volume (shares)",step:50000},
              ]},
              { title:"Price & Momentum", fields:[
                {key:"minChange",label:"Min % Change",step:0.5},
                {key:"maxChange",label:"Max % Change",step:1},
                {key:"minAtr",label:"Min ATR ($)",step:0.05},
                {key:"maxSpread",label:"Max Spread (%)",step:0.1},
              ]},
              { title:"Technical", fields:[
                {key:"minConsolidationDays",label:"Min Consolidation Days",step:1},
              ], toggles:[
                {key:"requireAboveVWAP",label:"Require Above VWAP"},
                {key:"requireAboveMa20",label:"Require Above 20-Day MA"},
                {key:"excludeEarnings",label:"Exclude Earnings Stocks"},
              ]},
            ].map(sec => (
              <div key={sec.title} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:10, padding:16 }}>
                <div style={{ fontWeight:700, fontSize:11, color:C.green, marginBottom:14, letterSpacing:"0.08em", textTransform:"uppercase" }}>{sec.title}</div>
                {sec.fields?.map(f => <NumField key={f.key} label={f.label} value={criteria[f.key]} step={f.step} onChange={v=>upd(f.key,v)} />)}
                {sec.toggles?.map(t => <Toggle key={t.key} value={criteria[t.key]} onChange={v=>upd(t.key,v)} label={t.label} />)}
              </div>
            ))}
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={() => setCriteria(DEFAULT_CRITERIA)} style={{
                flex:1, padding:11, background:"transparent", border:`1px solid ${C.border}`,
                borderRadius:8, color:C.muted, fontWeight:600, fontSize:13, cursor:"pointer",
              }}>Reset</button>
              <button onClick={() => { runScan(); setTab("scanner"); }} style={{
                flex:2, padding:11, background:"linear-gradient(135deg,#00e5a0,#00c8ff)",
                border:"none", borderRadius:8, color:"#0b0e1a", fontWeight:700, fontSize:13, cursor:"pointer",
              }}>Apply & Scan →</button>
            </div>
          </div>
        )}

        {/* ALERTS */}
        {tab === "alerts" && (
          <div>
            {!notifEnabled && (
              <div style={{
                background:"#1a1530", border:`1px solid ${C.purple}44`,
                borderRadius:10, padding:"14px 16px", marginBottom:14,
                display:"flex", alignItems:"center", gap:12,
              }}>
                <span style={{ fontSize:20 }}>🔔</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:700, fontSize:13, color:"#fff", marginBottom:2 }}>Enable push alerts</div>
                  <div style={{ fontSize:11, color:C.muted }}>Get notified on breakouts even when the app is in the background.</div>
                </div>
                <button onClick={handleEnableNotifs} style={{
                  padding:"7px 14px", background:C.purple, border:"none",
                  borderRadius:7, color:"#fff", fontWeight:700, fontSize:12, cursor:"pointer",
                }}>Enable</button>
              </div>
            )}
            <div style={{ fontSize:11, color:C.faint, marginBottom:12 }}>
              Triggers: RVOL ≥{ALERT_THRESHOLDS.rvol}x · Chg ≥+{ALERT_THRESHOLDS.change}% · Gap ≥+{ALERT_THRESHOLDS.gap}%
            </div>
            {alertLog.length === 0 ? (
              <div style={{ textAlign:"center", padding:50, color:C.faint, background:C.surface, borderRadius:10, border:`1px solid ${C.border}` }}>
                <div style={{ fontSize:32, marginBottom:10 }}>🔕</div>
                <div style={{ fontWeight:700 }}>No alerts yet</div>
                <div style={{ fontSize:12, marginTop:4 }}>Run a scan to detect signals</div>
              </div>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:4 }}>
                  <button onClick={() => { setAlertLog([]); seenAlerts.current.clear(); }} style={{
                    padding:"5px 12px", background:"transparent", border:`1px solid #2a1530`,
                    borderRadius:6, color:C.red, fontSize:11, cursor:"pointer",
                  }}>Clear all</button>
                </div>
                {alertLog.map((a,i) => (
                  <div key={i} style={{
                    background:C.surface, border:`1px solid #2a1535`,
                    borderLeft:`3px solid ${C.red}`, borderRadius:8, padding:"12px 14px",
                    display:"flex", alignItems:"center", gap:12,
                  }}>
                    <span style={{ fontSize:16 }}>🔔</span>
                    <div style={{ fontWeight:800, fontSize:15, color:"#fff", width:56, fontFamily:"monospace" }}>{a.ticker}</div>
                    <div style={{ fontFamily:"monospace", fontSize:12, color:C.red, fontWeight:700, flex:1 }}>{a.reason}</div>
                    <div style={{ fontFamily:"monospace", fontSize:12, color:C.text }}>${a.price.toFixed(2)}</div>
                    <div style={{ fontSize:10, color:C.faint }}>{a.time.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
