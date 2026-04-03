export class ProviderConnectionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderConnectionValidationError";
  }
}
