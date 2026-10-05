import type { ReactNode } from 'react'

type PageHeadingProps = {
  eyebrow: string
  title: string
  description?: string
  action?: ReactNode
}

export default function PageHeading({ eyebrow, title, description, action }: PageHeadingProps) {
  return (
    <div className="page-heading">
      <div>
        <div className="page-eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action && <div className="page-heading-action">{action}</div>}
    </div>
  )
}
