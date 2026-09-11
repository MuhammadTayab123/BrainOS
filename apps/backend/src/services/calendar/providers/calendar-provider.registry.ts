import { CalendarProvider } from "./calendar.provider";
import { CalendarProviderNotFoundError } from "./calendar.provider.types";

/**
 * ============================================================================
 * BrainOS Calendar Provider Registry
 * ============================================================================
 *
 * Manages registered CalendarProvider instances.
 * Completely vendor-agnostic and decoupled from internal BrainOS database models.
 */
export class CalendarProviderRegistry {
  private providers = new Map<string, CalendarProvider>();

  /**
   * Register a CalendarProvider instance.
   * Throws an error if a provider with the same ID is already registered
   * unless allowOverride is set to true.
   */
  public register(provider: CalendarProvider, allowOverride = false): void {
    if (!provider || !provider.id) {
      throw new Error("Cannot register a provider without a valid id.");
    }

    if (this.providers.has(provider.id) && !allowOverride) {
      throw new Error(
        `CalendarProvider with id '${provider.id}' is already registered.`,
      );
    }

    this.providers.set(provider.id, provider);
  }

  /**
   * Get a registered CalendarProvider by ID, or undefined if not found.
   */
  public get(id: string): CalendarProvider | undefined {
    return this.providers.get(id);
  }

  /**
   * Get a registered CalendarProvider by ID, or throw CalendarProviderNotFoundError.
   */
  public getOrThrow(id: string): CalendarProvider {
    const provider = this.providers.get(id);
    if (!provider) {
      throw new CalendarProviderNotFoundError(
        `CalendarProvider with id '${id}' is not registered.`,
        id,
      );
    }
    return provider;
  }

  /**
   * Check if a provider with the given ID is registered.
   */
  public has(id: string): boolean {
    return this.providers.has(id);
  }

  /**
   * List all registered CalendarProvider instances.
   */
  public list(): CalendarProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Unregister a provider by ID. Returns true if removed, false otherwise.
   */
  public unregister(id: string): boolean {
    return this.providers.delete(id);
  }

  /**
   * Remove all registered providers.
   */
  public clear(): void {
    this.providers.clear();
  }
}

/**
 * Global default registry instance.
 */
export const defaultCalendarProviderRegistry = new CalendarProviderRegistry();
