import { NextResponse } from 'next/server'
import { requireAuthenticatedProfile } from '@/lib/utils/server-auth'
import { getBlockedRequestsCount } from '@/lib/rate-limit'

export async function GET() {
  const auth = await requireAuthenticatedProfile(['admin'])
  if (!auth.ok) return auth.response

  const { db } = auth
  const now = new Date()
  const todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date(now)
  todayEnd.setHours(23, 59, 59, 999)
  const last24hStart = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  const [
    orders24hRes,
    activeQueueRes,
    printJobsTodayRes,
    slotsTodayRes,
    topItemsRes,
    loginAttemptsRes,
    blockedProfilesRes,
    rateLimitAuditRes,
  ] = await Promise.all([
    db
      .from('orders')
      .select('id, status, payment_status, total_paise, eta_minutes, created_at, collected_at')
      .gte('created_at', last24hStart.toISOString())
      .order('created_at', { ascending: true }),
    db
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .in('status', ['placed', 'awaiting_cash', 'accepted', 'preparing', 'ready']),
    db
      .from('print_jobs')
      .select('id, cost_paise, payment_status, created_at')
      .gte('created_at', todayStart.toISOString()),
    db
      .from('pickup_slots')
      .select('*')
      .gte('slot_start', todayStart.toISOString())
      .lte('slot_start', todayEnd.toISOString())
      .order('slot_start', { ascending: true }),
    db
      .from('order_items')
      .select('name_snapshot, qty, unit_price_paise, created_at')
      .gte('created_at', todayStart.toISOString())
      .limit(1000),
    db.from('login_attempts').select('attempts, locked_until'),
    db
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('is_blocked', true),
    db
      .from('audit_log')
      .select('id', { count: 'exact', head: true })
      .eq('action', 'rate_limit_blocked'),
  ])

  const orders24h = orders24hRes.data ?? []
  const todayStartMs = todayStart.getTime()
  const ordersToday = orders24h.filter(
    (o) => new Date(o.created_at).getTime() >= todayStartMs
  )

  const foodRevenueTodayPaise = ordersToday
    .filter((o) => o.status !== 'rejected' && o.status !== 'cancelled')
    .reduce((sum, o) => sum + Number(o.total_paise ?? 0), 0)

  const printJobsToday = printJobsTodayRes.data ?? []
  const printRevenueTodayPaise = printJobsToday
    .filter((j) => j.payment_status === 'paid')
    .reduce((sum, j) => sum + Number(j.cost_paise ?? 0), 0)

  // Average wait: collected_at - created_at in minutes (or fallback to eta_minutes)
  const collectedWithWait = ordersToday.filter((o) => o.collected_at)
  let avgWaitMinutes = 0
  if (collectedWithWait.length > 0) {
    const totalMin = collectedWithWait.reduce((sum, o) => {
      const ms =
        new Date(o.collected_at!).getTime() - new Date(o.created_at).getTime()
      return sum + Math.max(0, ms / 60_000)
    }, 0)
    avgWaitMinutes = Math.round((totalMin / collectedWithWait.length) * 10) / 10
  } else if (ordersToday.length > 0) {
    const totalEta = ordersToday.reduce(
      (sum, o) => sum + Number(o.eta_minutes ?? 5),
      0
    )
    avgWaitMinutes = Math.round((totalEta / ordersToday.length) * 10) / 10
  }

  // 24h orders-per-hour bucketed series
  const hourlyBuckets: Array<{ hour: string; label: string; count: number }> = []
  for (let i = 23; i >= 0; i--) {
    const bucketDate = new Date(now.getTime() - i * 60 * 60 * 1000)
    bucketDate.setMinutes(0, 0, 0)
    const key = bucketDate.toISOString().slice(0, 13)
    hourlyBuckets.push({
      hour: key,
      label: bucketDate.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        hour12: false,
      }),
      count: 0,
    })
  }
  const bucketMap = new Map(hourlyBuckets.map((b) => [b.hour, b]))
  for (const order of orders24h) {
    const d = new Date(order.created_at)
    d.setMinutes(0, 0, 0)
    const bucket = bucketMap.get(d.toISOString().slice(0, 13))
    if (bucket) bucket.count += 1
  }

  // Top 5 items today
  const itemAgg = new Map<
    string,
    { name: string; qty: number; revenue_paise: number }
  >()
  for (const row of topItemsRes.data ?? []) {
    const existing = itemAgg.get(row.name_snapshot) ?? {
      name: row.name_snapshot,
      qty: 0,
      revenue_paise: 0,
    }
    existing.qty += Number(row.qty ?? 0)
    existing.revenue_paise +=
      Number(row.qty ?? 0) * Number(row.unit_price_paise ?? 0)
    itemAgg.set(row.name_snapshot, existing)
  }
  const top5Items = Array.from(itemAgg.values())
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5)

  // Blocked requests / failed auth attempts summary
  const failedAttemptHits = (loginAttemptsRes.data ?? []).reduce(
    (sum, r) => sum + Number(r.attempts ?? 0),
    0
  )
  const activeLocks = (loginAttemptsRes.data ?? []).filter(
    (r) => r.locked_until && new Date(r.locked_until).getTime() > Date.now()
  ).length

  const rateLimitBlocked =
    (rateLimitAuditRes.count ?? 0) + getBlockedRequestsCount()

  return NextResponse.json({
    kpis: {
      ordersToday: ordersToday.length,
      revenueTodayPaise: foodRevenueTodayPaise + printRevenueTodayPaise,
      avgWaitMinutes,
      queueLength: activeQueueRes.count ?? 0,
      printJobsToday: printJobsToday.length,
    },
    ordersPerHour: hourlyBuckets,
    slots: slotsTodayRes.data ?? [],
    top5Items,
    security: {
      blockedRequests: failedAttemptHits + rateLimitBlocked,
      rateLimitHits: rateLimitBlocked,
      activeLockouts: activeLocks,
      blockedUsers: blockedProfilesRes.count ?? 0,
    },
  })
}
