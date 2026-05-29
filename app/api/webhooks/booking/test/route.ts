import type { NextRequest } from 'next/server';

const TEST_PAGE_HTML = `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Booking.com Webhook Test</title>
  <style>
    body { font-family: sans-serif; max-width: 600px; margin: 40px auto; padding: 0 20px; }
    h1 { font-size: 1.4rem; }
    button { margin: 6px 4px; padding: 10px 18px; cursor: pointer; border: none; border-radius: 4px; background: #003580; color: #fff; font-size: 0.95rem; }
    button:hover { background: #00224f; }
    pre { background: #f4f4f4; padding: 12px; border-radius: 4px; overflow-x: auto; font-size: 0.85rem; white-space: pre-wrap; }
    #result { margin-top: 16px; }
    .label { font-weight: bold; margin-top: 12px; display: block; }
  </style>
</head>
<body>
  <h1>Booking.com Webhook — Test</h1>
  <p>Simula eventi webhook verso <code>/api/webhooks/booking</code>.</p>

  <span class="label">Scenario:</span>
  <button onclick="run('new')">reservation.new</button>
  <button onclick="run('modify')">reservation.modify</button>
  <button onclick="run('cancel')">reservation.cancel</button>
  <button onclick="run('overbooking')">Overbooking</button>

  <div id="result"></div>

  <script>
    async function run(scenario) {
      const el = document.getElementById('result');
      el.innerHTML = '<em>Invio in corso…</em>';
      try {
        const res = await fetch('/api/webhooks/booking/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scenario }),
        });
        const data = await res.json();
        el.innerHTML = '<span class="label">Risposta (' + res.status + '):</span><pre>' + JSON.stringify(data, null, 2) + '</pre>';
      } catch (e) {
        el.innerHTML = '<pre style="color:red">Errore: ' + e.message + '</pre>';
      }
    }
  </script>
</body>
</html>`;

export async function GET(): Promise<Response> {
  return new Response(TEST_PAGE_HTML, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

export async function POST(request: NextRequest): Promise<Response> {
  let body: { scenario?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'invalid JSON' }, { status: 400 });
  }

  const scenario = body.scenario ?? 'new';

  // Build a synthetic Booking.com event based on the scenario
  const baseReservationId = `test-${scenario}-${Date.now()}`;

  // Use dates relative to today
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const dayAfter = new Date(today);
  dayAfter.setDate(today.getDate() + 3);

  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  type EventType = 'reservation.new' | 'reservation.modify' | 'reservation.cancel';

  const syntheticEvent = (type: EventType, reservationId: string, extra?: object) => ({
    event_id: `evt-${reservationId}`,
    type,
    reservation: {
      id: reservationId,
      room_id: 1,
      checkin: fmt(tomorrow),
      checkout: fmt(dayAfter),
      guest: {
        name: 'Mario Rossi (Test)',
        email: 'test@example.com',
        phone: '+39 333 0000000',
      },
      total_price: 120,
      ...extra,
    },
  });

  let event: object;

  switch (scenario) {
    case 'new':
      event = syntheticEvent('reservation.new', baseReservationId);
      break;

    case 'modify': {
      // First create a base reservation id that might already exist, then modify
      const modifyId = `test-modify-stable`;
      event = syntheticEvent('reservation.modify', modifyId, {
        checkin: fmt(dayAfter),
        checkout: fmt(new Date(today.getTime() + 5 * 86400000)),
        total_price: 200,
      });
      break;
    }

    case 'cancel': {
      const cancelId = `test-cancel-stable`;
      event = syntheticEvent('reservation.cancel', cancelId);
      break;
    }

    case 'overbooking': {
      // Send the same "new" event twice with the same reservation id but different event_id
      // The second should trigger overbooking since dates are already blocked
      const overbookId = `test-overbook-${fmt(today)}`;
      const firstEventId = `evt-overbook-1-${fmt(today)}`;
      const secondEventId = `evt-overbook-2-${fmt(today)}`;

      // Send first event to actually block the dates
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000';

      const first = {
        event_id: firstEventId,
        type: 'reservation.new' as EventType,
        reservation: {
          id: overbookId,
          room_id: 2,
          checkin: fmt(tomorrow),
          checkout: fmt(dayAfter),
          guest: { name: 'Primo Ospite', email: 'primo@test.com', phone: '' },
          total_price: 80,
        },
      };

      const second = {
        event_id: secondEventId,
        type: 'reservation.new' as EventType,
        reservation: {
          id: `${overbookId}-second`,
          room_id: 2,
          checkin: fmt(tomorrow),
          checkout: fmt(dayAfter),
          guest: { name: 'Secondo Ospite', email: 'secondo@test.com', phone: '' },
          total_price: 80,
        },
      };

      const results: object[] = [];

      for (const ev of [first, second]) {
        const res = await fetch(`${baseUrl}/api/webhooks/booking`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(ev),
        });
        const data = await res.json();
        results.push({ event_id: ev.event_id, status: res.status, response: data });
      }

      return Response.json({
        scenario: 'overbooking',
        note: 'Inviati 2 eventi con stesse date e camera. Il secondo dovrebbe registrare errore overbooking.',
        results,
      });
    }

    default:
      return Response.json({ error: `Scenario sconosciuto: ${scenario}` }, { status: 400 });
  }

  // Forward the synthetic event to the real webhook endpoint
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000';
  const res = await fetch(`${baseUrl}/api/webhooks/booking`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(event),
  });

  const data = await res.json();

  return Response.json({
    scenario,
    forwarded_event: event,
    webhook_status: res.status,
    webhook_response: data,
  });
}
