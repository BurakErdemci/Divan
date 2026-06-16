import { TrialEvent } from '../types/trial';

const API_BASE_URL = 'http://localhost:8000'; // FastAPI dev server default

export interface StartTrialResponse {
  trial_id: string;
}

export async function startTrial(question: string): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/api/trials`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ question }),
  });

  if (!response.ok) {
    throw new Error(`Failed to start trial: ${response.statusText}`);
  }

  const data: StartTrialResponse = await response.json();
  return data.trial_id;
}

export function listenToTrialStream(
  trialId: string,
  onEvent: (event: TrialEvent) => void,
  onError: (error: string) => void,
  onComplete: () => void
): () => void {
  const url = `${API_BASE_URL}/api/trials/${trialId}/events`;
  const eventSource = new EventSource(url);

  eventSource.onmessage = (event) => {
    try {
      const parsed: TrialEvent = JSON.parse(event.data);
      onEvent(parsed);
      
      // If the backend signals that the verdict event is sent, or a complete signal
      // is received, we can complete the stream. Usually SSE can continue until closed, 
      // or we can detect "verdict" phase event as the final.
      if (parsed.type === "verdict") {
        // We let the verdict render, then we complete.
        setTimeout(() => {
          onComplete();
          eventSource.close();
        }, 1000);
      }
    } catch (err) {
      console.error("Failed to parse SSE event", err);
      onError("Veri ayrıştırma hatası");
    }
  };

  eventSource.onerror = (error) => {
    console.error("EventSource error", error);
    onError("Sunucu bağlantısı koptu.");
    eventSource.close();
  };

  // Return unsubscribe/disconnect function
  return () => {
    eventSource.close();
  };
}
