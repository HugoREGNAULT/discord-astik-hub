/**
 * Résolution serveur des salons de notification fonctionnelle (postNotify /
 * postToChannel pour le staff et le recrutement).
 *
 * Priorité aux variables d'env DISCORD_NOTIFY_CHANNEL_STAFF /
 * DISCORD_NOTIFY_CHANNEL_RECRUIT (configurables en prod via Lovable SANS
 * recommit), avec fallback sur les valeurs hardcodées de constants.ts (vides
 * par défaut → notif silencieuse, jamais d'erreur).
 *
 * Module .server : ne jamais importer côté client. Les *.functions.ts doivent
 * l'importer dynamiquement (`await import`) à l'intérieur de leur handler.
 */
import { NOTIFY_CHANNELS } from "./constants";

export const notifyChannels = {
  get STAFF(): string {
    return process.env.DISCORD_NOTIFY_CHANNEL_STAFF || NOTIFY_CHANNELS.STAFF;
  },
  get RECRUIT(): string {
    return process.env.DISCORD_NOTIFY_CHANNEL_RECRUIT || NOTIFY_CHANNELS.RECRUIT;
  },
};
