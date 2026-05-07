// ============================================================
//  alerts.ts — Reglas de alerta para el sensor de humedad
//  Agrega o modifica reglas aquí según necesites
// ============================================================

export type Severity = "ok" | "warning" | "danger";

export interface Alert {
    field: string;
    severity: Severity;
    message: string;
    value: number;
}

export interface AlertResult {
    status: Severity;   // peor severidad del conjunto
    alerts: Alert[];
}

interface Reading {
    temperature: number | null;
    moisture: number | null;
    electricity: number | null;
}

// ── Reglas ────────────────────────────────────────────────────
// Modifica estos umbrales libremente
const RULES = {
    temperature: [
        { min: 25, max: 27, severity: "warning" as Severity, message: "Temperatura elevada — monitorear" },
        { min: 27, max: Infinity, severity: "danger" as Severity, message: "Temperatura crítica — posible riesgo de contagio" },
    ],
    moisture: [
        { min: 70, max: 85, severity: "warning" as Severity, message: "Humedad alta — condiciones favorables para patógenos" },
        { min: 85, max: Infinity, severity: "danger" as Severity, message: "Humedad crítica — riesgo elevado de proliferación" },
    ],
    electricity: [
        { min: 0, max: 10, severity: "warning" as Severity, message: "Nivel de electricidad bajo — revisar sensor" },
    ],
};

// ── Evaluador ─────────────────────────────────────────────────
export function evaluateAlerts(reading: Reading): AlertResult {
    const alerts: Alert[] = [];

    for (const [field, rules] of Object.entries(RULES)) {
        const value = reading[field as keyof Reading];
        if (value === null || value === undefined) continue;

        for (const rule of rules) {
            if (value >= rule.min && value < rule.max) {
                alerts.push({ field, severity: rule.severity, message: rule.message, value });
                break; // solo la primera regla que aplique por campo
            }
        }
    }

    // Severidad global = la peor de todas
    const status: Severity =
        alerts.some(a => a.severity === "danger") ? "danger" :
            alerts.some(a => a.severity === "warning") ? "warning" :
                "ok";

    return { status, alerts };
}