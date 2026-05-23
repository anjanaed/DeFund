import type { ReactNode } from 'react'

interface ButtonProps {
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'launch'
  onClick?: () => void
  className?: string
  type?: 'button' | 'submit' | 'reset'
}

export default function Button({ 
  children, 
  variant = 'primary', 
  onClick, 
  className = '',
  type = 'button'
}: ButtonProps) {
  const variantClass = `btn-${variant}`
  
  return (
    <button 
      type={type}
      className={`btn ${variantClass} ${className}`}
      onClick={onClick}
    >
      {children}
    </button>
  )
}
