export interface NotificationProvider {
  send(input: {
    userId: string;
    event:
      | "application_accepted"
      | "service_requested"
      | "interaction_cancelled";
    interactionId: string;
    dedupeKey: string;
  }): Promise<{ delivered: boolean }>;
}
