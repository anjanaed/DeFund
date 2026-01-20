import { useAccount, useConnect, useDisconnect, useEnsName } from 'wagmi'

export default function ConnectWallet() {
  const { address, isConnected } = useAccount()
  const { connect, connectors, isPending } = useConnect()
  const { disconnect } = useDisconnect()
  const { data: ensName } = useEnsName({ address })

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  const handleConnect = async () => {
    try {
      const injectedConnector = connectors.find(c => c.id === 'injected')
      const connector = injectedConnector || connectors[0]
      
      if (connector) {
        await connect({ connector })
      }
    } catch (error) {
      console.error('Failed to connect:', error)
    }
  }

  if (isConnected && address) {
    return (
      <div className="wallet-connected-wrapper">
        <button className="wallet-address-btn">
          {ensName || formatAddress(address)}
        </button>
        <button 
          onClick={() => disconnect()}
          className="btn btn-secondary wallet-disconnect-btn"
        >
          Disconnect
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={handleConnect}
      className="btn btn-primary wallet-connect-btn"
      disabled={isPending}
    >
      {isPending ? 'Connecting...' : 'Connect Wallet'}
    </button>
  )
}
