/** Public device-code client shared by Hermes and Grok Build. No client secret. */
export const XAI_OAUTH_ISSUER = 'https://auth.x.ai'
export const XAI_OAUTH_DISCOVERY = `${XAI_OAUTH_ISSUER}/.well-known/openid-configuration`
export const XAI_OAUTH_DEVICE_URL = 'https://auth.x.ai/oauth2/device/code'
export const XAI_OAUTH_TOKEN_URL = 'https://auth.x.ai/oauth2/token'
export const XAI_OAUTH_CLIENT_ID = 'b1a00492-073a-47ea-816f-4c329264a828'
export const XAI_OAUTH_SCOPE = 'openid profile email offline_access grok-cli:access api:access'
export const XAI_OAUTH_GRANT_DEVICE = 'urn:ietf:params:oauth:grant-type:device_code'
export const XAI_API_BASE = 'https://api.x.ai/v1'

/** Refresh this many milliseconds before access-token expiry. */
export const XAI_REFRESH_SKEW_MS = 60_000
