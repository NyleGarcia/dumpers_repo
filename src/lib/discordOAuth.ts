const DISCORD_AUTHORIZED_KEY = 'dr_discord_oauth_authorized'

export function hasDiscordAppAuthorization(): boolean {
  try {
    return localStorage.getItem(DISCORD_AUTHORIZED_KEY) === '1'
  } catch {
    return false
  }
}

/** Call after a successful Discord OAuth sign-in or link. */
export function markDiscordAppAuthorized(): void {
  try {
    localStorage.setItem(DISCORD_AUTHORIZED_KEY, '1')
  } catch {
    // ignore storage failures
  }
}

/**
 * Discord defaults to prompt=consent, which re-shows Authorize on every login.
 * Use consent on first approval, then none for return visits.
 */
export function getDiscordOAuthOptions() {
  return {
    scopes: 'identify email',
    queryParams: {
      prompt: hasDiscordAppAuthorization() ? 'none' : 'consent',
    },
  }
}

export function userHasDiscordIdentity(
  identities: { provider: string }[] | undefined
): boolean {
  return identities?.some((identity) => identity.provider === 'discord') ?? false
}
