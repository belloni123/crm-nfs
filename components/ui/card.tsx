import * as React from "react"
import { cn } from "@/lib/utils"

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  interactive?: boolean
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, interactive = false, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-[16px] border border-border-subtle bg-bg-elevated p-6 text-text-primary transition-all duration-300 ease-out",
        interactive && "hover:border-border-strong hover:shadow-[0_0_0_1px_#2a2a2a] cursor-pointer",
        className
      )}
      {...props}
    />
  )
)
Card.displayName = "Card"

export { Card }
