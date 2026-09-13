/**
 * The DI key for "whatever can deliver a push right now".
 *
 * Its own file because both `notifications.module.ts` and `notifications.service.ts` need
 * it, and importing the module from the service would be a cycle.
 */
export const PUSH_CLIENT = Symbol('PUSH_CLIENT');
