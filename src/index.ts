import "dotenv/config";
import express, { Request, Response } from "express";
import pino from "pino";
import { config } from "./config";
import { initDb, getReadings, insertReading } from "./db";
import { evaluateAlerts, AlertResult } from "./alerts";
import readingsRouter from "./routes/readings";
import healthRouter from "./routes/health";

export const logger = pino({
  transport:
    process.env.NODE_ENV !== "production"
      ? { target: "pino-pretty", options: { colorize: true } }
      : undefined,
});

// Última alerta en memoria para que el dashboard la consulte
let lastAlertResult: AlertResult = { status: "ok", alerts: [] };

async function main() {
  await initDb();
  logger.info({ db: config.dbPath }, "Base de datos lista");

  const app = express();

  app.use((req, _res, next) => {
    logger.info({ method: req.method, url: req.url }, "request");
    next();
  });

  app.use(express.json({ limit: "1mb" }));

  // ── POST /api/datos — recibe uplink del gateway ──────────────
  app.post("/api/datos", (req: Request, res: Response) => {
    const body = req.body as Record<string, unknown>;

    const obj =
      body.object && typeof body.object === "object"
        ? (body.object as Record<string, unknown>)
        : body;

    const getNum = (key: string): number | null => {
      const v = obj[key];
      return typeof v === "number" ? v : null;
    };

    const temperature = getNum("temperature");
    const moisture = getNum("moisture");
    const electricity = getNum("electricity");

    // Guardar en SQLite
    const id = insertReading({
      devEUI: typeof body.devEUI === "string" ? body.devEUI : config.defaultDevEUI,
      deviceName: typeof body.deviceName === "string" ? body.deviceName : undefined,
      fCnt: typeof body.fCnt === "number" ? body.fCnt : undefined,
      fPort: typeof body.fPort === "number" ? body.fPort : undefined,
      temperature,
      moisture,
      electricity,
      rawObject: JSON.stringify(obj),
      gatewayTime: typeof body.time === "string" ? body.time : undefined,
    });

    // Evaluar alertas
    lastAlertResult = evaluateAlerts({ temperature, moisture, electricity });

    // Log con alertas en consola
    const icons: Record<string, string> = { ok: "✅", warning: "⚠️ ", danger: "🚨" };
    console.log(`\n${icons[lastAlertResult.status]} [id=${id}] temp=${temperature}°C | humedad=${moisture}% | elec=${electricity}`);
    if (lastAlertResult.alerts.length) {
      lastAlertResult.alerts.forEach(a =>
        console.log(`   ${icons[a.severity]} ${a.field.toUpperCase()}: ${a.message}`)
      );
    }

    res.status(200).json({ ok: true, id, alerts: lastAlertResult });
  });

  // ── GET /api/datos — última lectura ──────────────────────────
  app.get("/api/datos", (_req: Request, res: Response) => {
    const rows = getReadings(1);
    if (!rows.length) {
      res.json({ mensaje: "Sin datos aún. El gateway aún no ha enviado nada." });
      return;
    }
    const r = rows[0];
    const alertResult = evaluateAlerts({
      temperature: r.temperature,
      moisture: r.moisture,
      electricity: r.electricity,
    });
    res.json({
      timestamp: r.received_at,
      temperature: r.temperature,
      moisture: r.moisture,
      electricity: r.electricity,
      alerts: alertResult,
    });
  });

  // ── GET /api/alertas — estado actual de alertas ───────────────
  app.get("/api/alertas", (_req: Request, res: Response) => {
    res.json(lastAlertResult);
  });

  // ── Rutas adicionales ─────────────────────────────────────────
  app.use("/api/readings", readingsRouter);
  app.use("/health", healthRouter);

  // ── Dashboard ─────────────────────────────────────────────────
  app.get("/", (_req, res) => {
    res.send(DASHBOARD_HTML);
  });

  app.listen(config.port, "0.0.0.0", () => {
    logger.info({ port: config.port }, "🚀 Servidor listo");
    console.log("\n  Dashboard:  http://192.168.1.101:" + config.port);
    console.log("  Datos:      GET  http://192.168.1.101:" + config.port + "/api/datos");
    console.log("  Alertas:    GET  http://192.168.1.101:" + config.port + "/api/alertas");
    console.log("  Historial:  GET  http://192.168.1.101:" + config.port + "/api/readings\n");
  });
}

// ── Dashboard HTML ────────────────────────────────────────────
const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="es"><head>
<meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Sensor Monitor</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&family=DM+Sans:wght@300;500;600&display=swap');
  :root{
    --bg:#0b0e14;--panel:#111520;--border:#1c2333;
    --teal:#00d4aa;--blue:#3b9eff;--amber:#ffb627;
    --red:#ff4d6a;--green:#00d4aa;--text:#bbc8da;--dim:#4a5c72;
    --mono:'JetBrains Mono',monospace;--sans:'DM Sans',sans-serif;
  }
  *{margin:0;padding:0;box-sizing:border-box;}
  body{background:var(--bg);color:var(--text);font-family:var(--sans);min-height:100vh;padding:28px 20px;}
  header{display:flex;align-items:center;gap:12px;margin-bottom:32px;padding-bottom:16px;border-bottom:1px solid var(--border);}
  .dot{width:9px;height:9px;border-radius:50%;background:var(--teal);box-shadow:0 0 8px var(--teal);animation:pulse 2s infinite;flex-shrink:0;}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
  h1{font-family:var(--mono);font-size:1rem;color:var(--teal);letter-spacing:.06em;}
  .badge{margin-left:auto;font-family:var(--mono);font-size:.68rem;color:var(--dim);}

  /* Alerta banner */
  #alert-banner{display:none;border-radius:10px;padding:16px 20px;margin-bottom:24px;border:1px solid;animation:fadeIn .3s ease;}
  @keyframes fadeIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
  #alert-banner.warning{background:rgba(255,182,39,.08);border-color:var(--amber);color:var(--amber);}
  #alert-banner.danger{background:rgba(255,77,106,.10);border-color:var(--red);color:var(--red);}
  .alert-title{font-family:var(--mono);font-size:.85rem;font-weight:600;margin-bottom:8px;}
  .alert-item{font-size:.8rem;margin-top:4px;opacity:.9;}

  /* Cards */
  .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;margin-bottom:32px;}
  .card{background:var(--panel);border:1px solid var(--border);border-radius:10px;padding:22px;position:relative;overflow:hidden;transition:border-color .3s;}
  .card::after{content:'';position:absolute;top:0;left:0;right:0;height:2px;transition:background .3s;}
  .card.temp::after{background:var(--blue);}
  .card.moist::after{background:var(--teal);}
  .card.elec::after{background:var(--amber);}
  .card.warn-card{border-color:var(--amber)!important;}
  .card.danger-card{border-color:var(--red)!important;animation:shake .4s ease;}
  @keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-4px)}75%{transform:translateX(4px)}}
  .label{font-size:.65rem;letter-spacing:.14em;text-transform:uppercase;color:var(--dim);margin-bottom:10px;}
  .value{font-family:var(--mono);font-size:2.4rem;line-height:1;}
  .card.temp .value{color:var(--blue);}
  .card.moist .value{color:var(--teal);}
  .card.elec .value{color:var(--amber);}
  .unit{font-size:.85rem;color:var(--dim);margin-left:2px;}
  .ts{font-family:var(--mono);font-size:.62rem;color:var(--dim);margin-top:10px;}

  /* Tabla */
  .section{font-size:.65rem;letter-spacing:.14em;text-transform:uppercase;color:var(--dim);margin-bottom:10px;}
  table{width:100%;border-collapse:collapse;font-family:var(--mono);font-size:.78rem;}
  th{text-align:left;color:var(--dim);font-size:.65rem;letter-spacing:.1em;padding:7px 10px;border-bottom:1px solid var(--border);}
  td{padding:9px 10px;border-bottom:1px solid var(--border);}
  tr:hover td{background:rgba(255,255,255,.02);}
  .status-ok{color:var(--teal);}
  .status-warning{color:var(--amber);}
  .status-danger{color:var(--red);}
  #timer{font-family:var(--mono);font-size:.62rem;color:var(--dim);text-align:right;margin-top:16px;}
</style>
</head>
<body>
<header>
  <div class="dot" id="dot"></div>
  <h1>SENSOR MONITOR</h1>
  <span class="badge" id="ts-badge">—</span>
</header>

<!-- Banner de alerta -->
<div id="alert-banner">
  <div class="alert-title" id="alert-title"></div>
  <div id="alert-items"></div>
</div>

<div class="grid">
  <div class="card temp" id="card-temp">
    <div class="label">Temperatura</div>
    <div class="value" id="v-temp">—<span class="unit">°C</span></div>
    <div class="ts" id="ts-main">Sin datos aún</div>
  </div>
  <div class="card moist" id="card-moist">
    <div class="label">Humedad</div>
    <div class="value" id="v-moist">—<span class="unit">%</span></div>
    <div class="ts"></div>
  </div>
  <div class="card elec" id="card-elec">
    <div class="label">Electricidad</div>
    <div class="value" id="v-elec">—</div>
    <div class="ts"></div>
  </div>
</div>

<div class="section">Historial</div>
<table>
  <thead><tr><th>Timestamp</th><th>Temp °C</th><th>Humedad %</th><th>Electricidad</th><th>Estado</th></tr></thead>
  <tbody id="tbody"><tr><td colspan="5" style="color:var(--dim)">Esperando datos del gateway...</td></tr></tbody>
</table>
<div id="timer">Actualiza en <span id="cd">5</span>s</div>

<script>
const ALERT_RULES = {
  temperature: [
    { min: 25, max: 27,       severity: 'warning', message: 'Temperatura elevada — monitorear' },
    { min: 27, max: Infinity, severity: 'danger',  message: 'Temperatura crítica — posible riesgo de contagio' },
  ],
  moisture: [
    { min: 70, max: 85,       severity: 'warning', message: 'Humedad alta — condiciones favorables para patógenos' },
    { min: 85, max: Infinity, severity: 'danger',  message: 'Humedad crítica — riesgo elevado de proliferación' },
  ],
};

function evalAlerts(r){
  const alerts=[];
  for(const [field,rules] of Object.entries(ALERT_RULES)){
    const v=r[field];
    if(v==null)continue;
    for(const rule of rules){
      if(v>=rule.min&&v<rule.max){alerts.push({field,severity:rule.severity,message:rule.message,value:v});break;}
    }
  }
  const status=alerts.some(a=>a.severity==='danger')?'danger':alerts.some(a=>a.severity==='warning')?'warning':'ok';
  return{status,alerts};
}

function applyAlerts(result){
  const banner=document.getElementById('alert-banner');
  const icons={ok:'✅',warning:'⚠️',danger:'🚨'};
  const labels={ok:'Todo normal',warning:'Advertencia',danger:'ALERTA CRÍTICA'};
  ['card-temp','card-moist','card-elec'].forEach(id=>{
    const el=document.getElementById(id);
    el.classList.remove('warn-card','danger-card');
  });
  if(result.status==='ok'){banner.style.display='none';return;}
  banner.style.display='block';
  banner.className='';banner.classList.add(result.status);
  document.getElementById('alert-title').textContent=icons[result.status]+' '+labels[result.status];
  document.getElementById('alert-items').innerHTML=result.alerts.map(a=>
    \`<div class="alert-item">• \${a.field.toUpperCase()}: \${a.message} (\${a.value})</div>\`
  ).join('');
  result.alerts.forEach(a=>{
    const map={temperature:'card-temp',moisture:'card-moist',electricity:'card-elec'};
    const el=document.getElementById(map[a.field]);
    if(el)el.classList.add(a.severity===('danger')?'danger-card':'warn-card');
  });
}

let cd=5;
async function refresh(){
  try{
    const rows=await fetch('/api/readings?limit=30').then(x=>x.json());
    if(!rows.length)return;
    const u=rows[0];
    document.getElementById('v-temp').innerHTML=(u.temperature??'—')+'<span class="unit">°C</span>';
    document.getElementById('v-moist').innerHTML=(u.moisture??'—')+'<span class="unit">%</span>';
    document.getElementById('v-elec').textContent=u.electricity??'—';
    document.getElementById('ts-main').textContent=u.received_at;
    document.getElementById('ts-badge').textContent='Última: '+u.received_at;
    const result=evalAlerts(u);
    applyAlerts(result);
    const sc={ok:'status-ok',warning:'status-warning',danger:'status-danger'};
    document.getElementById('tbody').innerHTML=rows.map(r=>{
      const res=evalAlerts(r);
      const icons={ok:'✅',warning:'⚠️',danger:'🚨'};
      return \`<tr>
        <td>\${r.received_at}</td>
        <td>\${r.temperature??'—'}</td>
        <td>\${r.moisture??'—'}</td>
        <td>\${r.electricity??'—'}</td>
        <td class="\${sc[res.status]}">\${icons[res.status]} \${res.status}</td>
      </tr>\`;
    }).join('');
  }catch(e){console.error(e);}
}
setInterval(()=>{cd--;document.getElementById('cd').textContent=cd;if(cd<=0){cd=5;refresh();}},1000);
refresh();
</script>
</body></html>`;

main().catch((err) => {
  console.error("Error al iniciar:", err);
  process.exit(1);
});