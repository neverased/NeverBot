import 'reflect-metadata';

const RESILIENCE_META_KEY = Symbol('discord:resilience');

export interface ResilienceOptions {
  retries?: number;
  timeoutMs?: number;
  baseMs?: number;
  maxMs?: number;
}

export function DiscordResilience(options: ResilienceOptions): MethodDecorator {
  return (_target, _propertyKey, descriptor: PropertyDescriptor) => {
    Reflect.defineMetadata(RESILIENCE_META_KEY, options, descriptor.value!);
    return descriptor;
  };
}

export function getDiscordResilience(
  target: unknown,
): ResilienceOptions | undefined {
  try {
    return Reflect.getMetadata(RESILIENCE_META_KEY, target);
  } catch {
    return undefined;
  }
}

export function setDiscordResilience(
  target: unknown,
  options: ResilienceOptions,
): void {
  try {
    Reflect.defineMetadata(RESILIENCE_META_KEY, options, target as object);
  } catch {
    // no-op if reflect not available
  }
}
