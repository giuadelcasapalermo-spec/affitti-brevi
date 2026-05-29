export async function pushARI(
  cameraId: number,
  dates: string[],
  available: boolean,
  prezzo?: number
): Promise<void> {
  const endpoint = process.env.BOOKING_ARI_ENDPOINT;
  const apiKey = process.env.BOOKING_API_KEY;

  if (!endpoint || !apiKey) {
    console.log(
      `[ARI stub] cameraId=${cameraId} dates=${dates.join(',')} available=${available} prezzo=${prezzo ?? 'n/a'}`
    );
    return;
  }

  const payload = {
    room_id: cameraId,
    availability: dates.map(date => ({ date, available })),
    rates: prezzo !== undefined ? dates.map(date => ({ date, price: prezzo })) : [],
  };

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`ARI push failed: ${res.status} ${res.statusText}`);
  }
}
