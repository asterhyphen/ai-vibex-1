export default function OrderTrackingPage({ params }: { params: { code: string } }) {
  return (
    <div className="p-8 text-center text-2xl font-semibold">
      Order Tracking — {params.code} (TODO)
    </div>
  )
}
