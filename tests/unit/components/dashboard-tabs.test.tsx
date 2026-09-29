import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

/**
 * Regression guard for the dashboard's segmented controls.
 *
 * Both switchers (overview/analytics and the analytics time range) were once
 * built from plain <div> wrappers around <TabsTrigger>. Radix requires a
 * <TabsList> parent because it provides the RovingFocusGroup context, so the
 * page threw "RovingFocusGroupItem must be used within RovingFocusGroup" at
 * runtime — invisible to tsc and lint, and only reachable on an authenticated
 * render. These assertions fail loudly if either group loses its TabsList.
 */

// jsdom lacks these; Next's Link prefetch and recharts both expect constructors
class MockObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return []
  }
}
vi.stubGlobal("IntersectionObserver", MockObserver)
vi.stubGlobal("ResizeObserver", MockObserver)

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/dashboard",
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "test-user", email: "test@example.com" },
    session: { access_token: "token" },
    loading: false,
    signOut: vi.fn(),
    signIn: vi.fn(),
    signUp: vi.fn(),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}))

vi.mock("@/modules/applications/services/application.service", () => ({
  getApplications: vi.fn(async () => []),
  getApplicationStats: vi.fn(async () => ({ total: 0, pending: 0, upcomingDeadlines: 0 })),
}))

vi.mock("@/modules/documents/services/document.service", () => ({
  getDocuments: vi.fn(async () => []),
}))

vi.mock("@/lib/services/notifications", () => ({
  getNotifications: vi.fn(async () => []),
  getRecentNotifications: vi.fn(async () => []),
}))

// the page's analytics effects fetch relative URLs, which jsdom cannot resolve
vi.stubGlobal(
  "fetch",
  vi.fn(async () => new Response(JSON.stringify({}), { status: 200, headers: { "Content-Type": "application/json" } }))
)

// the charts are irrelevant here — keep the test about tab structure
vi.mock("@/modules/analytics/components/MetricsCard", () => ({
  MetricsCard: () => <div data-testid="metrics-card" />,
}))
vi.mock("@/modules/analytics/components/TimelineChart", () => ({
  TimelineChart: () => <div data-testid="timeline-chart" />,
}))
vi.mock("@/modules/analytics/components/ConversionFunnel", () => ({
  ConversionFunnel: () => <div data-testid="conversion-funnel" />,
}))
vi.mock("@/modules/analytics/components/SankeyChart", () => ({
  SankeyChart: () => <div data-testid="sankey-chart" />,
}))

import DashboardPage from "@/app/dashboard/page"

describe("dashboard tab controls", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders the view switcher inside a TabsList (Radix context contract)", async () => {
    render(<DashboardPage />)

    // the page shows a spinner until its data resolves
    await waitFor(() => expect(screen.getAllByRole("tablist").length).toBeGreaterThan(0))

    expect(screen.getByRole("tab", { name: /overview/i })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: /analytics/i })).toBeInTheDocument()
  })

  it("mounts the time-range switcher in its own TabsList when analytics opens", async () => {
    const user = userEvent.setup()
    render(<DashboardPage />)

    const analyticsTab = await screen.findByRole("tab", { name: /analytics/i })
    await user.click(analyticsTab)

    await waitFor(() => expect(screen.getAllByRole("tablist").length).toBe(2))

    const ranges = ["7d", "30d", "90d", "all"] as const
    for (const range of ranges) {
      expect(screen.getByRole("tab", { name: new RegExp(`^${range}$`, "i") })).toBeInTheDocument()
    }
  })

  it("keeps the time-range control keyboard-navigable", async () => {
    const user = userEvent.setup()
    render(<DashboardPage />)

    await user.click(await screen.findByRole("tab", { name: /analytics/i }))

    const range = await screen.findByRole("tab", { name: /^7d$/i })
    range.focus()
    await user.keyboard("{ArrowRight}")

    await waitFor(() =>
      expect(screen.getByRole("tab", { name: /^30d$/i })).toHaveAttribute("data-state", "active")
    )
  })
})
