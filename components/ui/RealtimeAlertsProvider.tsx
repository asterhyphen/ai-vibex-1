'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useTheme } from 'next-themes'
import { Toaster, toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import type { MenuItem, Notification, Order, OrderStatus } from '@/lib/types'
import { SmsPopupQueue, type SmsMessage } from './SmsPopup'

interface AlertsContextValue {
  notifications: Notification[]
  unreadCount: number
  loadingNotifications: boolean
  userId: string | null
  refreshNotifications: () => Promise<void>
  markAllRead: () => Promise<void>
  markIdsRead: (ids: string[]) => Promise<void>
  pushSms: (sms: Omit<SmsMessage, 'id'>) => void
  dismissSms: (id: string) => void
}

const AlertsContext = createContext<AlertsContextValue | null>(null)

export function useAlerts(): AlertsContextValue {
  const ctx = useContext(AlertsContext)
  if (!ctx) {
    throw new Error('useAlerts must be used within RealtimeAlertsProvider')
  }
  return ctx
}

export function useOptionalAlerts(): AlertsContextValue | null {
  return useContext(AlertsContext)
}

export function RealtimeAlertsProvider({ children }: { children: ReactNode }) {
  const { resolvedTheme } = useTheme()
  const [userId, setUserId] = useState<string | null>(null)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loadingNotifications, setLoadingNotifications] = useState(false)
  const [smsQueue, setSmsQueue] = useState<SmsMessage[]>([])

  const orderStatusMapRef = useRef<Map<string, OrderStatus>>(new Map())
  const stockMapRef = useRef<Map<string, boolean>>(new Map())

  const pushSms = useCallback((sms: Omit<SmsMessage, 'id'>) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    setSmsQueue((prev) => [...prev, { ...sms, id }])
  }, [])

  const dismissSms = useCallback((id: string) => {
    setSmsQueue((prev) => prev.filter((item) => item.id !== id))
  }, [])

  const refreshNotifications = useCallback(async () => {
    if (!isSupabaseConfigured() || !userId) {
      setNotifications([])
      return
    }

    setLoadingNotifications(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(25)

      if (!error && data) {
        setNotifications(data as Notification[])
      }
    } finally {
      setLoadingNotifications(false)
    }
  }, [userId])

  const markIdsRead = useCallback(
    async (ids: string[]) => {
      if (!isSupabaseConfigured() || !userId || ids.length === 0) return
      setNotifications((prev) =>
        prev.map((n) => (ids.includes(n.id) ? { ...n, read: true } : n))
      )
      const supabase = createClient()
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', userId)
        .in('id', ids)
    },
    [userId]
  )

  const markAllRead = useCallback(async () => {
    if (!isSupabaseConfigured() || !userId) return
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    const supabase = createClient()
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', userId)
      .eq('read', false)
  }, [userId])

  // Track current authenticated user
  useEffect(() => {
    if (!isSupabaseConfigured()) return

    const supabase = createClient()
    let active = true

    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (active) {
          setUserId(data.user?.id ?? null)
        }
      })
      .catch(() => {
        if (active) setUserId(null)
      })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextId = session?.user?.id ?? null
      setUserId(nextId)
      if (!nextId) {
        setNotifications([])
      }
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  // Subscribe to Realtime updates for orders, stock, and notifications
  useEffect(() => {
    if (!isSupabaseConfigured() || !userId) {
      return
    }

    const supabase = createClient()
    let cancelled = false

    supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(25)
      .then(({ data, error }) => {
        if (!cancelled && !error && data) {
          setNotifications(data as Notification[])
        }
      })

    // Seed current orders & stock states to avoid spurious duplicate alerts
    supabase
      .from('orders')
      .select('id, status')
      .eq('user_id', userId)
      .then(({ data }) => {
        if (cancelled || !data) return
        const nextMap = new Map<string, OrderStatus>()
        for (const row of data) {
          nextMap.set(row.id, row.status as OrderStatus)
        }
        orderStatusMapRef.current = nextMap
      })

    supabase
      .from('menu_items')
      .select('id, in_stock')
      .then(({ data }) => {
        if (cancelled || !data) return
        const nextStock = new Map<string, boolean>()
        for (const item of data) {
          nextStock.set(item.id, Boolean(item.in_stock))
        }
        stockMapRef.current = nextStock
      })

    const channel = supabase
      .channel(`mite-alerts-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const updated = payload.new as Order
          const previous =
            (payload.old as Partial<Order> | null)?.status ??
            orderStatusMapRef.current.get(updated.id)

          orderStatusMapRef.current.set(updated.id, updated.status)
          if (previous === updated.status) return

          switch (updated.status) {
            case 'accepted':
              toast.success(`Order ${updated.code} accepted`, {
                description: 'The kitchen has confirmed your order.',
              })
              pushSms({
                sender: 'MITE Canteen',
                kind: 'success',
                body: `Order ${updated.code} has been accepted by the kitchen.`,
              })
              break
            case 'preparing':
              toast.info(`Order ${updated.code} is preparing`, {
                description: 'Your meal is being freshly prepared now.',
              })
              break
            case 'ready':
              toast.success(`Order ${updated.code} is ready for pickup!`, {
                description: 'Head to the canteen counter and scan your QR pass.',
              })
              pushSms({
                sender: 'MITE Canteen',
                kind: 'success',
                body: `Order ${updated.code} is READY! Collect at the counter with your QR.`,
              })
              break
            case 'rejected':
              toast.error(`Order ${updated.code} was rejected`, {
                description:
                  updated.rejected_reason || 'Please check with the canteen counter.',
              })
              pushSms({
                sender: 'MITE Canteen',
                kind: 'error',
                body: `Order ${updated.code} could not be fulfilled${
                  updated.rejected_reason ? `: ${updated.rejected_reason}` : '.'
                }`,
              })
              break
            default:
              break
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'menu_items',
        },
        (payload) => {
          const item = payload.new as MenuItem
          const prevStock =
            (payload.old as Partial<MenuItem> | null)?.in_stock ??
            stockMapRef.current.get(item.id)

          stockMapRef.current.set(item.id, item.in_stock)
          if (prevStock === undefined || prevStock === item.in_stock) return

          if (!item.in_stock) {
            toast.warning(`${item.name} is now out of stock`, {
              description: 'Check back soon or pick another item.',
            })
          } else {
            toast.info(`${item.name} is back in stock`, {
              description: 'Available to order now.',
            })
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const incoming = payload.new as Notification
          setNotifications((prev) => {
            if (prev.some((n) => n.id === incoming.id)) return prev
            return [incoming, ...prev].slice(0, 25)
          })
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const updated = payload.new as Notification
          setNotifications((prev) =>
            prev.map((n) => (n.id === updated.id ? updated : n))
          )
        }
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [userId, pushSms])

  const visibleNotifications = useMemo(
    () => (userId ? notifications : []),
    [userId, notifications]
  )

  const unreadCount = useMemo(
    () => visibleNotifications.filter((n) => !n.read).length,
    [visibleNotifications]
  )

  const value = useMemo<AlertsContextValue>(
    () => ({
      notifications: visibleNotifications,
      unreadCount,
      loadingNotifications,
      userId,
      refreshNotifications,
      markAllRead,
      markIdsRead,
      pushSms,
      dismissSms,
    }),
    [
      visibleNotifications,
      unreadCount,
      loadingNotifications,
      userId,
      refreshNotifications,
      markAllRead,
      markIdsRead,
      pushSms,
      dismissSms,
    ]
  )

  return (
    <AlertsContext.Provider value={value}>
      {children}
      <Toaster
        richColors
        closeButton
        position="top-right"
        theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
        toastOptions={{
          style: {
            borderRadius: '12px',
            border: '1px solid var(--border)',
          },
        }}
      />
      <SmsPopupQueue messages={smsQueue} onDismiss={dismissSms} />
    </AlertsContext.Provider>
  )
}
