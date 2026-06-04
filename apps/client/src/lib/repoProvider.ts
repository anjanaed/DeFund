export type RepoProvider = 'github' | 'gitlab' | 'bitbucket' | 'codeberg' | 'generic'

export function getRepoProvider(url: string | null | undefined): RepoProvider {
  if (!url) return 'generic'
  try {
    const { hostname } = new URL(url)
    if (hostname === 'github.com'    || hostname.endsWith('.github.com'))  return 'github'
    if (hostname === 'gitlab.com'    || hostname.endsWith('.gitlab.com'))  return 'gitlab'
    if (hostname === 'bitbucket.org')                                      return 'bitbucket'
    if (hostname === 'codeberg.org')                                       return 'codeberg'
  } catch {
    // malformed URL — fall through to generic
  }
  return 'generic'
}
