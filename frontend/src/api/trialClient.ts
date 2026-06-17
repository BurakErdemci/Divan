import { TrialEvent } from '../types/trial';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export interface StartTrialResponse {
  trial_id: string;
}

export async function startTrial(question: string, projectContext = ''): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/api/trials`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ question, project_context: projectContext }),
  });

  if (!response.ok) {
    throw new Error(`Duruşma başlatılamadı: ${response.statusText || response.status}`);
  }

  const data: StartTrialResponse = await response.json();
  return data.trial_id;
}

export function listenToTrialStream(
  trialId: string,
  onEvent: (event: TrialEvent) => void,
  onError: (error: string) => void,
  onComplete: () => void,
): () => void {
  const url = `${API_BASE_URL}/api/trials/${trialId}/events`;
  const eventSource = new EventSource(url);
  let completed = false;

  eventSource.onmessage = (event) => {
    try {
      const parsed: TrialEvent = JSON.parse(event.data);

      if (parsed.type === 'complete') {
        completed = true;
        onComplete();
        eventSource.close();
        return;
      }

      if (parsed.type === 'error') {
        completed = true;
        onEvent(parsed);
        eventSource.close();
        return;
      }

      onEvent(parsed);
    } catch (err) {
      completed = true;
      console.error('Failed to parse SSE event', err);
      onError('Veri ayrıştırma hatası.');
      eventSource.close();
    }
  };

  eventSource.onerror = (error) => {
    if (completed) return;
    console.error('EventSource error', error);
    onError('Sunucu bağlantısı koptu. Ayrıntı için backend/.divan/server.log dosyasına bak.');
    eventSource.close();
  };

  return () => {
    completed = true;
    eventSource.close();
  };
}
