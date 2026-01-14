interface StepCardProps {
  number: string
  title: string
  description: string
}

export default function StepCard({ number, title, description }: StepCardProps) {
  return (
    <div className="step">
      <div className="step-number">{number}</div>
      <div className="step-content">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
    </div>
  )
}
