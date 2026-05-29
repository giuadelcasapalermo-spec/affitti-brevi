import { after } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  eventExists,
  saveEvent,
  markEventProcessed,
  markEventError,
  processEvent,
  type BookingEvent,
} from '@/lib/booking/processor';

export async function POST(request: NextRequest): Promise<Response> {
  const secret = process.env.BOOKING_WEBHOOK_SECRET;
  if (secret) {
    const signature = request.headers.get('x-booking-signature');
    if (signature !== secret) {
      return new Response('Unauthorized', { status: 401 });
    }
  }

  let body: BookingEvent;
  try {
    body = await request.json();
  } catch {
    return new Response('Bad Request: invalid JSON', { status: 400 });
  }

  const eventId = body.event_id;
  if (!eventId) {
    return new Response('Bad Request: missing event_id', { status: 400 });
  }

  if (await eventExists(eventId)) {
    return Response.json({ ok: true });
  }

  await saveEvent(eventId, body.type, body);

  // Respond 200 immediately — Vercel runs `after()` callbacks after the response
  // is sent, preventing Booking.com from timing out on slow processing.
  after(async () => {
    try {
      await processEvent(body);
      await markEventProcessed(eventId);
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      console.error(`[booking webhook] Error processing event ${eventId}:`, errMsg);
      await markEventError(eventId, errMsg);
    }
  });

  return Response.json({ ok: true });
}
