import * as React from "react"
import { cn } from "@/lib/utils"

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        className={cn(
          "flex h-12 w-full rounded-xl border border-border-strong bg-bg-elevated px-4 py-3 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-300 ease-out",
          className
        )}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
