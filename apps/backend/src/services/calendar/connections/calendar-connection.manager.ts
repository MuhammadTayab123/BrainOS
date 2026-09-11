import { CalendarProvider } from "../providers/calendar.provider";
import { CalendarProviderRegistry } from "../providers/calendar-provider.registry";
import {
  CalendarProviderCapabilities,
  ProviderCalendarEvent,
  ProviderCreateEventInput,
  ProviderListEventsOptions,
  ProviderRequestOptions,
  ProviderUpdateEventInput,
} from "../providers/calendar.provider.types";
import {
  CalendarConnectionCredentials,
  CalendarConnectionNotFoundError,
  CalendarConnectionStateError,
  CalendarConnectionStatus,
  CreateConnectionInput,
  UpdateConnectionInput,
  UserCalendarConnection,
} from "./calendar-connection.types";
import { CredentialVault } from "./security/credential-vault";
import { UserCalendarConnectionRepository } from "./repositories/calendar-connection.repository";

/**
 * ============================================================================
 * User-Scoped Calendar Provider Wrapper
 * ============================================================================
 *
 * Encapsulates a provider instance bound to a specific user's connection.
 * Holds decrypted credentials strictly in memory during the execution lifecycle.
 * Invariants:
 * - Never registered in the global CalendarProviderRegistry.
 * - Credentials are private and never exposed or logged.
 */
export class UserScopedCalendarProvider implements CalendarProvider {
  public readonly id: string;
  public readonly name: string;
  public readonly capabilities: CalendarProviderCapabilities;

  constructor(
    public readonly userId: string,
    public readonly connectionId: string,
    private readonly credentials: CalendarConnectionCredentials,
    private readonly underlyingProvider: CalendarProvider,
  ) {
    this.id = `${underlyingProvider.id}:${connectionId}`;
    this.name = `${underlyingProvider.name} [User ${userId}]`;
    this.capabilities = { ...underlyingProvider.capabilities };
  }

  /**
   * Internal accessor for drivers requiring authenticated token injection.
   * Never exposed in public serialization or logging.
   */
  public getBoundCredentials(): CalendarConnectionCredentials {
    return {
      ...this.credentials,
      scopes: this.credentials.scopes ? [...this.credentials.scopes] : undefined,
    };
  }

  async listEvents(
    options?: ProviderListEventsOptions,
  ): Promise<ProviderCalendarEvent[]> {
    return this.underlyingProvider.listEvents(options);
  }

  async getEvent(
    externalId: string,
    options?: ProviderRequestOptions,
  ): Promise<ProviderCalendarEvent | null> {
    return this.underlyingProvider.getEvent(externalId, options);
  }

  async createEvent(
    input: ProviderCreateEventInput,
    options?: ProviderRequestOptions,
  ): Promise<ProviderCalendarEvent> {
    return this.underlyingProvider.createEvent(input, options);
  }

  async updateEvent(
    externalId: string,
    input: ProviderUpdateEventInput,
    options?: ProviderRequestOptions,
  ): Promise<ProviderCalendarEvent> {
    return this.underlyingProvider.updateEvent(externalId, input, options);
  }

  async deleteEvent(
    externalId: string,
    options?: ProviderRequestOptions,
  ): Promise<void> {
    return this.underlyingProvider.deleteEvent(externalId, options);
  }
}

/**
 * ============================================================================
 * BrainOS Calendar Connection Manager
 * ============================================================================
 *
 * Orchestrates user-scoped external calendar accounts, credential encryption,
 * and scoped provider instantiation.
 */
export class CalendarConnectionManager {
  constructor(
    private readonly repository: UserCalendarConnectionRepository,
    private readonly vault: CredentialVault,
    private readonly registry: CalendarProviderRegistry,
  ) {}

  /**
   * Create a new external calendar connection for the specified user.
   * Credentials are encrypted with authenticated AES-256-GCM before storage.
   * Returns sanitized connection metadata.
   */
  async createConnection(
    userId: string,
    input: CreateConnectionInput,
  ): Promise<UserCalendarConnection> {
    this.assertContextUser(userId);

    if (!input.providerId || input.providerId.trim().length === 0) {
      throw new Error("providerId is required.");
    }
    if (
      !input.credentials ||
      !input.credentials.accessToken ||
      input.credentials.accessToken.trim().length === 0
    ) {
      throw new Error("accessToken is required in credentials.");
    }

    // Verify provider is recognized by the registry
    if (!this.registry.has(input.providerId.trim())) {
      throw new Error(
        `Calendar provider driver '${input.providerId.trim()}' is not registered.`,
      );
    }

    const encryptedCredentials = await this.vault.encrypt(input.credentials);

    return this.repository.create(userId.trim(), {
      providerId: input.providerId.trim(),
      accountEmail: input.accountEmail ? input.accountEmail.trim() : null,
      displayName: input.displayName ? input.displayName.trim() : null,
      status: input.status ?? "CONNECTED",
      metadata: input.metadata ?? null,
      encryptedCredentials,
    });
  }

  /**
   * Get sanitized connection metadata for an owned connection.
   * Throws CalendarConnectionNotFoundError if not found or cross-user.
   */
  async getConnection(
    userId: string,
    connectionId: string,
  ): Promise<UserCalendarConnection> {
    this.assertContextUser(userId);

    const connection = await this.repository.findById(
      connectionId.trim(),
      userId.trim(),
    );
    if (!connection) {
      throw new CalendarConnectionNotFoundError(
        `Calendar connection '${connectionId}' not found.`,
      );
    }

    return connection;
  }

  /**
   * List all sanitized calendar connections for the given user.
   */
  async listConnections(userId: string): Promise<UserCalendarConnection[]> {
    this.assertContextUser(userId);
    return this.repository.listForUser(userId.trim());
  }

  /**
   * Update connection metadata (displayName, accountEmail, metadata).
   */
  async updateConnection(
    userId: string,
    connectionId: string,
    data: UpdateConnectionInput,
  ): Promise<UserCalendarConnection> {
    this.assertContextUser(userId);

    const updated = await this.repository.update(
      connectionId.trim(),
      userId.trim(),
      data,
    );
    if (!updated) {
      throw new CalendarConnectionNotFoundError(
        `Calendar connection '${connectionId}' not found.`,
      );
    }

    return updated;
  }

  /**
   * Update connection status (e.g. mark NEEDS_REAUTH or DISCONNECTED).
   */
  async updateConnectionStatus(
    userId: string,
    connectionId: string,
    status: CalendarConnectionStatus,
  ): Promise<UserCalendarConnection> {
    this.assertContextUser(userId);

    const updated = await this.repository.updateStatus(
      connectionId.trim(),
      userId.trim(),
      status,
    );
    if (!updated) {
      throw new CalendarConnectionNotFoundError(
        `Calendar connection '${connectionId}' not found.`,
      );
    }

    return updated;
  }

  /**
   * Update connection credentials (e.g. after refresh token rotation or re-auth).
   */
  async updateCredentials(
    userId: string,
    connectionId: string,
    credentials: CalendarConnectionCredentials,
    status: CalendarConnectionStatus = "CONNECTED",
  ): Promise<UserCalendarConnection> {
    this.assertContextUser(userId);

    if (!credentials || !credentials.accessToken) {
      throw new Error("accessToken is required.");
    }

    const encrypted = await this.vault.encrypt(credentials);

    const updated = await this.repository.updateCredentials(
      connectionId.trim(),
      userId.trim(),
      encrypted,
      status,
    );

    if (!updated) {
      throw new CalendarConnectionNotFoundError(
        `Calendar connection '${connectionId}' not found.`,
      );
    }

    return updated;
  }

  /**
   * Delete an external calendar connection. Fails closed if not found.
   */
  async deleteConnection(
    userId: string,
    connectionId: string,
  ): Promise<void> {
    this.assertContextUser(userId);

    const deleted = await this.repository.delete(
      connectionId.trim(),
      userId.trim(),
    );
    if (!deleted) {
      throw new CalendarConnectionNotFoundError(
        `Calendar connection '${connectionId}' not found.`,
      );
    }
  }

  /**
   * Internal binding path: Resolves and binds a user-scoped CalendarProvider
   * for the given connection.
   *
   * Invariants enforced:
   * 1. Requires strict ownership match (throws CalendarConnectionNotFoundError on cross-user access).
   * 2. Rejects connections in NEEDS_REAUTH, DISCONNECTED, or ERROR states with CalendarConnectionStateError.
   * 3. Decrypts credentials via authenticated CredentialVault.
   * 4. Resolves base provider driver from process registry without mutating registry.
   * 5. Returns a user-scoped provider instance.
   */
  async getScopedProvider(
    userId: string,
    connectionId: string,
  ): Promise<UserScopedCalendarProvider> {
    this.assertContextUser(userId);

    const record = await this.repository.findWithCredentials(
      connectionId.trim(),
      userId.trim(),
    );

    if (!record) {
      throw new CalendarConnectionNotFoundError(
        `Calendar connection '${connectionId}' not found.`,
      );
    }

    if (record.status !== "CONNECTED") {
      throw new CalendarConnectionStateError(
        `Calendar connection '${connectionId}' cannot be used: status is '${record.status}'. Re-authentication is required.`,
      );
    }

    const decryptedCredentials = await this.vault.decrypt(
      record.encryptedCredentials,
    );

    const baseProvider = this.registry.getOrThrow(record.providerId);

    return new UserScopedCalendarProvider(
      userId.trim(),
      connectionId.trim(),
      decryptedCredentials,
      baseProvider,
    );
  }

  private assertContextUser(userId: unknown): asserts userId is string {
    if (
      typeof userId !== "string" ||
      userId.trim().length === 0
    ) {
      throw new CalendarConnectionNotFoundError(
        "User context is required for calendar connection operations.",
      );
    }
  }
}
