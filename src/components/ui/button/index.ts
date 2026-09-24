import { type VariantProps, cva } from 'class-variance-authority'

export { default as Button } from './Button.vue'

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground shadow-[0_0_40px_#22d3ee26] hover:brightness-110',
        destructive: 'bg-destructive text-white hover:bg-destructive/90',
        outline: 'border border-white/15 bg-white/5 hover:border-cyan-400/40 hover:bg-white/10',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'border border-white/15 bg-white/5 hover:border-cyan-400/40 hover:bg-white/10'
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-8 rounded-xl px-3 text-xs',
        lg: 'h-12 rounded-xl px-8 text-base',
        icon: 'size-8'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default'
    }
  }
)

export type ButtonVariants = VariantProps<typeof buttonVariants>
