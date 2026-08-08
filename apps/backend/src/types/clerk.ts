export interface ClerkWebhookEvent {
  type: string;
  data: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    image_url: string | null;

    email_addresses: {
      email_address: string;
    }[];
  };
}