export const OAUTH_PROVIDERS = ['google', 'discord'] as const

export type OAuthProviderId = (typeof OAUTH_PROVIDERS)[number]

export const OAUTH_PROVIDER_LABELS: Record<OAuthProviderId, string> = {
  google: 'Google',
  discord: 'Discord',
}

export function isOAuthProviderId(value: string): value is OAuthProviderId {
  return (OAUTH_PROVIDERS as readonly string[]).includes(value)
}
