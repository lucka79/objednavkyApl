import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/admin/orders/$orderId')({
  component: () => <div>Hello /admin/orders/$oederId!</div>
})