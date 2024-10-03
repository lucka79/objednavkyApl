import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/driver')({
  component: () => <div>Hello /driver!</div>
})