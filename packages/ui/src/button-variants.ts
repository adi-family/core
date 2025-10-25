export const buttonVariants = ['default', 'destructive', 'success', 'outline', 'secondary', 'ghost', 'link'] as const;
export type ButtonVariant = typeof buttonVariants[number];

export const buttonSizes = ['default', 'sm', 'lg'] as const;
export type ButtonSize = typeof buttonSizes[number];
