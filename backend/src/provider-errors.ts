export class ProviderConfigurationError extends Error {
  readonly code = "PROVIDER_NOT_CONFIGURED";
  readonly statusCode = 503;

  constructor(readonly providerKind: string, options?: ErrorOptions) {
    super(`${providerKind} provider is not configured`, options);
    this.name = "ProviderConfigurationError";
  }
}