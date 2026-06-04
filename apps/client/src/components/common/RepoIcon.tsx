import { FaGithub, FaGitlab, FaBitbucket } from 'react-icons/fa6'
import { HiCodeBracket } from 'react-icons/hi2'
import { getRepoProvider } from '../../lib/repoProvider'

interface RepoIconProps {
  url?: string | null
  size?: number
}

export default function RepoIcon({ url, size = 14 }: RepoIconProps) {
  switch (getRepoProvider(url)) {
    case 'github':    return <FaGithub size={size} />
    case 'gitlab':    return <FaGitlab size={size} />
    case 'bitbucket': return <FaBitbucket size={size} />
    default:          return <HiCodeBracket size={size} />
  }
}
