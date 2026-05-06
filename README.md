# Semanatec — Milesight Uplink Receiver

Backend mínimo en Node.js / TypeScript que recibe uplinks HTTP del gateway Milesight (UG65 / UG67) desde un sensor ultrasónico de distancia/nivel EM500-UDL y los guarda en SQLite.

## Requisitos

- Node.js 20+
- npm 9+

## Instalación y arranque

```bash
cp .env.example .env
# Edita .env si necesitas cambiar puerto, ruta de DB o token
npm install
npm run dev
```

Para producción:

```bash
npm run build
npm start
```

## Variables de entorno

| Variable     | Default              | Descripción                                         |
|--------------|----------------------|-----------------------------------------------------|
| `PORT`       | `3000`               | Puerto HTTP                                         |
| `DB_PATH`    | `./data/readings.db` | Ruta del archivo SQLite (el directorio se crea solo) |
| `AUTH_TOKEN` | _(vacío)_            | Si se define, el uplink exige `Authorization: Bearer <token>` |

## Endpoints

### `POST /api/milesight/uplink`
Recibe el JSON del gateway. Responde `200 { ok: true, id }`.

### `GET /api/readings?limit=50&devEUI=24e124...`
Últimos N readings. `limit` máximo 500. `devEUI` es opcional.

### `GET /api/readings/:devEUI/latest`
Último reading de un dispositivo.

### `GET /health`
Healthcheck. Responde `{ status: "ok", ts: "..." }`.

---

## Configurar el gateway Milesight (HTTP Integration)

1. En la interfaz web del UG65/UG67: **Applications → HTTP Integration → Add**.
2. **URL**: `http://<ip-servidor>:3000/api/milesight/uplink`
3. **Method**: `POST`
4. **Headers**:
   - `Content-Type: application/json`
   - Si usas `AUTH_TOKEN`: `Authorization: Bearer <tu-token>`
5. Asegúrate de que el **Payload Codec** del dispositivo esté configurado para que el gateway decodifique el campo `object`.

---

## Curl de prueba

```bash
# Sin autenticación
curl -X POST http://localhost:3000/api/milesight/uplink \
  -H "Content-Type: application/json" \
  -d '{
    "applicationID": "1",
    "applicationName": "luz",
    "deviceName": "ws301-01",
    "devEUI": "24e124fffef00001",
    "fCnt": 42,
    "fPort": 85,
    "object": { "distance": 1250, "battery": 95 },
    "time": "2026-05-06T12:34:56Z"
  }'

# Con autenticación (si AUTH_TOKEN está definido)
curl -X POST http://localhost:3000/api/milesight/uplink \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <tu-token>" \
  -d '{ ... }'

# Listar últimos readings
curl "http://localhost:3000/api/readings?limit=10&devEUI=24e124fffef00001"

# Último reading de un dispositivo
curl http://localhost:3000/api/readings/24e124fffef00001/latest
```
