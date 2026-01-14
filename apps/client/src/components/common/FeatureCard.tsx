import Card from '../common/Card'
import Icon from '../common/Icon'
import type { IconType } from 'react-icons'

interface FeatureCardProps {
  icon: IconType
  title: string
  description: string
}

export default function FeatureCard({ icon, title, description }: FeatureCardProps) {
  return (
    <Card className="feature-card">
      <Icon icon={icon} />
      <h3>{title}</h3>
      <p>{description}</p>
    </Card>
  )
}
