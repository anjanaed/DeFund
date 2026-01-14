import type { IconType } from 'react-icons'

interface IconProps {
  icon: IconType
  className?: string
}

export default function Icon({ icon: IconComponent, className = '' }: IconProps) {
  return (
    <div className={`icon ${className}`}>
      <IconComponent />
    </div>
  )
}
