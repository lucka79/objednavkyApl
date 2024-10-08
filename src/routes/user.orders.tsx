import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/user/orders')({
  component: () => <div>Hello /user/orders!</div>
})