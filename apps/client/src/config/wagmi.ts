import { http, createConfig } from 'wagmi'
import { sepolia } from 'wagmi/chains'
import { injected, walletConnect } from 'wagmi/connectors'

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID

const connectors = [
  injected(),
  ...(projectId
    ? [walletConnect({
        projectId,
        metadata: {
          name: 'DeFund',
          description: 'Milestone-Based Crowdfunding Platform',
          url: typeof window !== 'undefined' ? window.location.origin : 'https://defund.app',
          icons: ['https://avatars.githubusercontent.com/u/37784886'],
        },
        showQrModal: true,
      })]
    : []),
]

export const config = createConfig({
  chains: [sepolia],
  connectors,
  transports: {
    [sepolia.id]: http(),
  },
})

export { projectId }

